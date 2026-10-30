// Phase 7. Changing a seller is not a commission-rate adjustment. This endpoint
// requires zero payment history and zero financial release evidence, then
// atomically replaces the UNPAID reservation's commission recipients.
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { db } from '../../../db/connect.js';
import { getProjectBySlug, getListingLookupWhere, getErrorMessage, getUserFullName, tableExists } from '../_shared/lotProject.shared.js';
import { isOwnerAdministrator } from '../../../config/permissions.js';
import { getReservationCommissionPreview, replaceReservationCommissions } from '../Commissions/commissionHierarchy.service.js';
import { sellerChangeError, isSellerChangeStageUntouched, isNetworkProfitStageUntouched, safeJsonHash, sellerChangePayload, sellerChangeSnapshot } from '../../../services/assignedSellerChangeGuard.service.js';
import { sendEmail } from '../../../services/email.service.js';
import { createProtectedChangeRequest, consumeProtectedChange } from '../../../services/protectedChange.service.js';
import { createOperationalReview } from '../../../services/operationalReview.service.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';

const ACTION = 'lot_project_assigned_seller_change';
const REVIEW_ACTION = 'commission.assigned_seller_change';
const codeSecret = () => {
  const secret = String(process.env.DESTRUCTIVE_ACTION_CODE_SECRET || process.env.JWT_SECRET || '');
  if (!secret) throw sellerChangeError('Verification is not configured. Contact the system administrator.', 500);
  return secret;
};
const hashCode = code => crypto.createHmac('sha256', codeSecret()).update(String(code)).digest('hex');
const codeValid = (code, hash) => {
  const a = Buffer.from(hashCode(code), 'hex');
  const b = Buffer.from(String(hash || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const fail = (res, error) => res.status(Number(error.statusCode || 0) || 400).json({ success: false, message: getErrorMessage(error) });
const getActor = req => {
  const actor = req.authUser;
  if (!actor?.id) throw sellerChangeError('Sign in before changing a seller.', 401);
  if (!['super_admin', 'system_admin', 'accounting_head', 'accounting_staff'].includes(actor.role)) throw sellerChangeError('You do not have permission to change this seller.', 403);
  return actor;
};
const getContext = async (connection, req, { lock = false } = {}) => {
  const project = await getProjectBySlug(req.params.projectSlug);
  if (!project) throw sellerChangeError('Project not found.', 404);
  const lookup = getListingLookupWhere(String(req.params.listingId || ''), 'l');
  const [rows] = await connection.query(`SELECT l.lot_project_listing_id,l.lot_project_listing_unit_id,l.lot_project_listing_status,l.current_account_id,
      l.lot_project_listing_area_sqm,l.lot_project_listing_price_per_sqm,l.lot_project_listing_installment_price_per_sqm,
      l.lot_project_listing_cash_price_per_sqm,l.lot_project_listing_net_selling_price,l.lot_project_listing_tcp,
      a.lot_project_account_id,a.account_reference,a.account_status,
      cp.lot_project_client_profile_id,cp.lot_project_client_profile_status,cp.assigned_accredited_seller_id,cp.sale_channel,
      cp.soa_selected_base_selling_price,cp.soa_selected_price_per_sqm,cp.soa_selected_net_selling_price,cp.soa_selected_tcp,
      CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name) AS current_seller_name
    FROM lot_project_listings l
    JOIN lot_project_accounts a ON a.lot_project_account_id=l.current_account_id
    JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id=a.lot_project_client_profile_id
    LEFT JOIN accredited_sellers acs ON acs.accredited_seller_id=cp.assigned_accredited_seller_id
    LEFT JOIN users u ON u.id=acs.user_id
    WHERE l.lot_project_id=? AND ${lookup.sql} LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`,
  [project.lot_project_id, ...lookup.params]);
  const listing = rows[0];
  if (!listing) throw sellerChangeError('Active buyer account not found.', 404);
  if (Number(req.body?.accountId || req.query?.accountId || 0) !== Number(listing.lot_project_account_id)) {
    throw sellerChangeError('Buyer account changed. Refresh the page and try again.');
  }
  if (String(listing.lot_project_listing_status).toLowerCase() !== 'sold'
    || listing.account_status !== 'active' || listing.lot_project_client_profile_status !== 'active') {
    throw sellerChangeError('Seller changes are available only for active reserved buyer accounts.');
  }
  if (!Number(listing.assigned_accredited_seller_id)) throw sellerChangeError('This buyer account has no assigned seller.');
  return { project, listing };
};
const getEvidence = async (connection, listing, { lock = false } = {}) => {
  const profileId = Number(listing.lot_project_client_profile_id);
  const accountId = Number(listing.lot_project_account_id);
  const locked = lock ? ' FOR UPDATE' : '';
  // Treat old NULL account references as belonging to the same unique client profile.
  const [payments] = await connection.query(`SELECT lot_project_payment_id FROM lot_project_payments
     WHERE lot_project_account_id=? OR (lot_project_client_profile_id=? AND lot_project_account_id IS NULL) LIMIT 1${locked}`,[accountId,profileId]);
  if (payments.length) throw sellerChangeError('Seller cannot be changed because a payment has already been recorded.');
  const [paidSchedules]=await connection.query(`SELECT lot_project_payment_schedule_id FROM lot_project_payment_schedules
     WHERE (lot_project_account_id=? OR (lot_project_client_profile_id=? AND lot_project_account_id IS NULL))
       AND (amount_paid>0 OR paid_penalty_amount>0 OR paid_interest_amount>0 OR paid_principal_amount>0
            OR date_paid IS NOT NULL OR schedule_status IN ('Paid','Partial','Advance')) LIMIT 1${locked}`,[accountId,profileId]);
  if (paidSchedules.length) throw sellerChangeError('This account has payment history in its schedule. Contact Accounting before changing the seller.');
  const [commissions] = await connection.query(`SELECT c.*, CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name) AS seller_name
    FROM lot_project_commissions c LEFT JOIN accredited_sellers s ON s.accredited_seller_id=c.accredited_seller_id
    LEFT JOIN users u ON u.id=s.user_id
    WHERE c.lot_project_client_profile_id=? AND (c.lot_project_account_id=? OR c.lot_project_account_id IS NULL)
    ORDER BY c.lot_project_commission_id${locked}`,[profileId,accountId]);
  if (!commissions.length) throw sellerChangeError('Saved commission details are missing. Contact Accounting before changing the seller.');
  if (commissions.some(row => Number(row.released_commission_amount||0)>0 || !['Pending','On Hold'].includes(row.commission_status) || Number(row.payment_percent||0)>0)) {
    throw sellerChangeError('Commission records already have financial activity. Seller cannot be changed.');
  }
  const [receiptRows] = await connection.query(`SELECT lot_project_commission_receipt_id FROM lot_project_commission_receipts
     WHERE lot_project_account_id=? OR (lot_project_client_profile_id=? AND lot_project_account_id IS NULL) LIMIT 1${locked}`,[accountId,profileId]);
  if (receiptRows.length) throw sellerChangeError('A commission receipt already exists. Seller cannot be changed.');
  const ids = commissions.map(row=>Number(row.lot_project_commission_id));
  const [releases] = await connection.query(`SELECT * FROM lot_project_commission_releases WHERE lot_project_commission_id IN (${ids.map(()=>'?').join(',')}) ORDER BY lot_project_commission_release_id${locked}`,ids);
  if (releases.some(row=>!isSellerChangeStageUntouched(row))) throw sellerChangeError('A commission release was already changed or recorded. Seller cannot be changed.');
  let profitAccounts=[]; let profitReleases=[];
  if (await tableExists(connection,'lot_project_network_profit_accounts')) {
    [profitAccounts] = await connection.query(`SELECT * FROM lot_project_network_profit_accounts WHERE lot_project_account_id=? ORDER BY id${locked}`,[accountId]);
    if (profitAccounts.length) {
      if (!(await tableExists(connection,'lot_project_network_profit_releases'))) throw sellerChangeError('Network profit records are incomplete. Contact Accounting.');
      const pids=profitAccounts.map(row=>Number(row.id));
      [profitReleases] = await connection.query(`SELECT * FROM lot_project_network_profit_releases WHERE profit_account_id IN (${pids.map(()=>'?').join(',')}) ORDER BY id${locked}`,pids);
      if (profitReleases.some(row=>!isNetworkProfitStageUntouched(row))) throw sellerChangeError('Network Company Profit has already been recorded. Seller cannot be changed.');
      if (await tableExists(connection,'lot_project_network_profit_signed_files')) {
        const [files]=await connection.query(`SELECT f.id FROM lot_project_network_profit_signed_files f
           JOIN lot_project_network_profit_releases r ON r.id=f.profit_release_id
           WHERE r.profit_account_id IN (${pids.map(()=>'?').join(',')}) LIMIT 1`,pids);
        if (files.length) throw sellerChangeError('A Network Profit receipt file exists. Seller cannot be changed.');
      }
    }
  }
  return { commissions, releases, profitAccounts, profitReleases };
};
const buildProposal = async (connection, req, { lock = false } = {}) => {
  const { project, listing } = await getContext(connection,req,{lock});
  const evidence = await getEvidence(connection,listing,{lock});
  const newSellerId=Number(req.body?.newSellerId || 0);
  if (!Number.isSafeInteger(newSellerId)||newSellerId<=0) throw sellerChangeError('Select a replacement seller.',400);
  if (newSellerId===Number(listing.assigned_accredited_seller_id)) throw sellerChangeError('Choose a different seller.');
  // Existing reservation allocation is the authoritative sale base, not new project prices.
  const savedBase=Number(evidence.commissions[0].commission_base_amount||0);
  if (!(savedBase>0) || evidence.commissions.some(r=>Math.abs(Number(r.commission_base_amount||0)-savedBase)>.01)) {
    throw sellerChangeError('Saved commission amounts need review before the seller can be changed.');
  }
  if(lock){
    const [[network]]=await connection.query('SELECT seller_group_id FROM accredited_sellers WHERE accredited_seller_id=? LIMIT 1',[newSellerId]);
    if (!network?.seller_group_id) throw sellerChangeError('Replacement seller is no longer available.');
    // Use the same seller/network lock order as the reservation and replacement flows.
    await connection.query('SELECT seller_group_id FROM seller_groups WHERE seller_group_id=? FOR UPDATE',[network.seller_group_id]);
    await connection.query('SELECT accredited_seller_id FROM accredited_sellers WHERE seller_group_id=? ORDER BY user_id FOR UPDATE',[network.seller_group_id]);
  }
  const preview=await getReservationCommissionPreview(connection,project.lot_project_id,{
    ...listing, lot_project_listing_net_selling_price: savedBase,
    // commissionBase logic prefers SOA snapshot; override all listed sale-base fields.
    soa_selected_base_selling_price: savedBase, soa_selected_net_selling_price: savedBase,
    soa_selected_tcp: savedBase, lot_project_listing_tcp: savedBase,
  },newSellerId);
  if (!preview.isValid) throw sellerChangeError('The new seller has an incomplete commission setup.');
  const previous=sellerChangeSnapshot(evidence.commissions);
  const next=preview.hierarchy.map(r=>({accreditedSellerId:r.accreditedSellerId,sellerName:r.sellerName,role:r.role,
    rate:r.rate,grossCommission:r.estimatedAmount,commissionBase:preview.commissionBase}));
  const fingerprint=safeJsonHash({accountId:listing.lot_project_account_id,currentSellerId:listing.assigned_accredited_seller_id,
    previous,oldReleaseRows:evidence.releases,oldProfit:evidence.profitAccounts,oldProfitReleases:evidence.profitReleases,
    newSellerId,preview:{hierarchy:next,poolRate:preview.poolRate,companyProfitRate:preview.companyProfitRate,groupType:preview.groupType}});
  return {project,listing,evidence,preview,previous,next,fingerprint,newSellerId};
};
export const getAssignedSellerChangeOptions=async(req,res)=>{
  const connection=await db.getConnection();
  try {
    getActor(req);
    const {project,listing}=await getContext(connection,req);
    const evidence=await getEvidence(connection,listing);
    // Search is server-side: sellers beyond the first page must still be discoverable.
    // Preserve the existing eligibility constraints and validate the chosen seller
    // again in buildProposal before issuing any authorization.
    const query=String(req.query?.q || '').trim().slice(0,100).toLowerCase();
    const pattern=`%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    const filters=query ? ` AND (
      LOWER(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) LIKE ?
      OR LOWER(g.seller_group_name) LIKE ?
      OR LOWER(u.role) LIKE ?
      OR LOWER(REPLACE(u.role,'_',' ')) LIKE ?
      OR CAST(s.accredited_seller_id AS CHAR) LIKE ?
      OR LOWER(COALESCE(u.account_code,'')) LIKE ?
    )` : '';
    const params=[project.lot_project_id,listing.assigned_accredited_seller_id,...(query?Array(6).fill(pattern):[])];
    const [matches]=await connection.query(`SELECT s.accredited_seller_id AS id, u.role,CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name) AS name,
      g.seller_group_name AS network, g.seller_group_type AS networkType, u.account_code AS accountCode
      FROM accredited_sellers s JOIN users u ON u.id=s.user_id
      JOIN seller_groups g ON g.seller_group_id=s.seller_group_id
      JOIN seller_group_lot_project_rates gr ON gr.seller_group_id=g.seller_group_id AND gr.lot_project_id=?
        AND gr.seller_group_lot_project_rate_status='active'
      WHERE s.accredited_seller_status='active' AND u.status='active' AND g.seller_group_status='active'
        AND COALESCE(s.is_system_dummy,0)=0 AND (u.role='sales_agent' OR u.role='external_group')
        AND s.accredited_seller_id<>? ${filters} ORDER BY name, s.accredited_seller_id LIMIT 101`,params);
    return res.json({success:true,data:{accountId:listing.lot_project_account_id,unitId:listing.lot_project_listing_unit_id,
      oldSellerName:listing.current_seller_name,candidates:matches.slice(0,100),hasMore:matches.length>100,
      currentCommissions:sellerChangeSnapshot(evidence.commissions)}});
  } catch(error){return fail(res,error)} finally{connection.release()}
};
export const previewAssignedSellerChange=async(req,res)=>{
  const connection=await db.getConnection();
  try {getActor(req);const result=await buildProposal(connection,req);
    return res.json({success:true,data:{accountId:result.listing.lot_project_account_id,oldSellerName:result.listing.current_seller_name,
      previous:result.previous,next:result.next.map((row,index)=>({...row,
        commissionType:result.preview.hierarchy[index]?.commissionType || null,
        sellerGroup:result.preview.hierarchy[index]?.groupName || null,
        reportsUnder:result.preview.hierarchy[index+1]?.sellerName || 'Developer',
      })),fingerprint:result.fingerprint,newSellerId:result.newSellerId,
      oldCompanyProfitRate:Number(result.evidence.commissions[0]?.company_profit_rate_snapshot||0),
      companyProfitRate:result.preview.companyProfitRate,networkType:result.preview.groupType}});
  } catch(error){return fail(res,error)}finally{connection.release()}
};
const getRequestData=(req,proposal)=>{
  const reason=String(req.body?.reason||'').trim();
  if (reason.length<10 || reason.length>500) throw sellerChangeError('Enter a reason of 10–500 characters.',400);
  if(String(req.body?.fingerprint||'')!==proposal.fingerprint)throw sellerChangeError('Seller or commission details changed. Review the latest preview.');
  return {reason,payload:sellerChangePayload({accountId:proposal.listing.lot_project_account_id,listingId:proposal.listing.lot_project_listing_id,
    currentSellerId:proposal.listing.assigned_accredited_seller_id,newSellerId:proposal.newSellerId,fingerprint:proposal.fingerprint,reason})};
};
export const requestAssignedSellerChange=async(req,res)=>{
  const connection=await db.getConnection();
  try{
    const actor=getActor(req); await connection.beginTransaction();
    const proposal=await buildProposal(connection,req,{lock:true});const {reason,payload}=getRequestData(req,proposal);
    if(actor.role==='accounting_head') {await connection.commit();return res.json({success:true,data:{status:'approved',directHeadApproval:true}})}
    if(!isOwnerAdministrator(actor)){
      const result=await createProtectedChangeRequest(connection,{actor,actionKey:REVIEW_ACTION,department:'accounting',projectId:proposal.project.lot_project_id,
        entityType:'lot_project_commission_account',entityId:proposal.listing.lot_project_account_id,
        entityLabel:`Unit ${proposal.listing.lot_project_listing_unit_id}`,payload,reason});
      await writeAuditLog(connection,req,{action:'create',module:'Review Center',entityType:'protected_change_request',
        entityId:String(result.requestId),entityLabel:result.requestNumber||String(result.requestId),
        title:'Requested assigned seller change',description:`Requested Accounting Head approval for unit ${proposal.listing.lot_project_listing_unit_id}.`,
        metadata:{accountId:proposal.listing.lot_project_account_id,oldSellerId:proposal.listing.assigned_accredited_seller_id,newSellerId:proposal.newSellerId,reason}});
      await connection.commit();return res.json({success:true,data:{status:result.status,approvalRequestId:result.requestId,requestNumber:result.requestNumber}});
    }
    const password=String(req.body?.password||'');
    if(!actor.password_hash || !password || !(await bcrypt.compare(password,actor.password_hash))) throw sellerChangeError('Incorrect account password.',401);
    if(!actor.email) throw sellerChangeError('Your account needs an email address to receive the verification code.');
    const code=String(crypto.randomInt(100000,1000000));
    const hash=safeJsonHash(payload);
    await connection.query("UPDATE destructive_action_verifications SET status='expired' WHERE user_id=? AND action_type=? AND status='pending'",[actor.id,ACTION]);
    const [insert]=await connection.query(`INSERT INTO destructive_action_verifications(user_id,action_type,entity_type,entity_id,code_hash,payload_hash,reason,expires_at,status,request_ip)
      VALUES (?,?,'lot_project_account',?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE),'pending',?)`,
      [actor.id,ACTION,String(proposal.listing.lot_project_account_id),hashCode(code),hash,reason,req.ip||null]);
    await sendEmail({to:actor.email,subject:`Change Assigned Seller · ${proposal.listing.lot_project_listing_unit_id}`,
      text:`Hello ${getUserFullName(actor)},\n\nVerification code: ${code}\nUnit: ${proposal.listing.lot_project_listing_unit_id}\nReason: ${reason}\nExpires in 10 minutes. Do not share this code.`,
      html:`<p>Your verification code for Change Assigned Seller is <strong>${code}</strong>.</p><p>Expires in 10 minutes.</p>`});
    await connection.commit();return res.json({success:true,data:{status:'pending',verificationId:Number(insert.insertId)}});
  }catch(error){try{await connection.rollback()}catch{}return fail(res,error)}finally{connection.release()}
};
export const confirmAssignedSellerChange=async(req,res)=>{
  const connection=await db.getConnection();
  try{
    const actor=getActor(req);await connection.beginTransaction();
    const proposal=await buildProposal(connection,req,{lock:true});const {reason,payload}=getRequestData(req,proposal);
    if(!(await tableExists(connection,'lot_project_assigned_seller_changes')))throw sellerChangeError('Apply the Phase 7 database migration before using this feature.',500);
    let approvalType='department_head',approvalId=null,headUserId=actor.id;
    if(isOwnerAdministrator(actor)){
      const verificationId=Number(req.body?.verificationId||0),code=String(req.body?.code||'');
      if(!verificationId||!/^\d{6}$/.test(code))throw sellerChangeError('Enter the 6-digit email verification code.',400);
      const [[v]]=await connection.query(`SELECT *,expires_at<=NOW() AS expired FROM destructive_action_verifications
       WHERE destructive_action_verification_id=? AND user_id=? AND action_type=? AND entity_type='lot_project_account' AND entity_id=? FOR UPDATE`,
       [verificationId,actor.id,ACTION,String(proposal.listing.lot_project_account_id)]);
      if(!v || v.status!=='pending'||Number(v.expired))throw sellerChangeError('Verification expired. Request a new code.');
      if(v.payload_hash!==safeJsonHash(payload))throw sellerChangeError('Details changed since verification. Request a new code.');
      if(!codeValid(code,v.code_hash)){
        const attempts=Number(v.attempt_count||0)+1;
        await connection.query(`UPDATE destructive_action_verifications SET attempt_count=?,status=? WHERE destructive_action_verification_id=?`,
          [attempts,attempts>=Number(v.max_attempts||5)?'locked':'pending',verificationId]);
        await connection.commit();return res.status(401).json({success:false,message:'Incorrect code. Try again.'});
      }
      approvalType='emergency_super_admin';approvalId=verificationId;
      await connection.query(`UPDATE destructive_action_verifications SET status='used',attempt_count=attempt_count+1,verified_at=NOW(),used_at=NOW() WHERE destructive_action_verification_id=?`,[verificationId]);
    }else if(actor.role!=='accounting_head'){
      approvalId=Number(req.body?.approvalRequestId||0);
      const approved=await consumeProtectedChange(connection,{requestId:approvalId,actor,actionKey:REVIEW_ACTION,entityType:'lot_project_commission_account',entityId:proposal.listing.lot_project_account_id,payload});
      headUserId=approved.reviewed_by_head_user_id;approvalType='head_approval';
    }
    // Company Profit entries are owned by the specific buyer account. Only untouched
    // staged rows may be discarded and reprovisioned for the replacement Network.
    for (const profit of proposal.evidence.profitAccounts){
      await connection.query('DELETE FROM lot_project_network_profit_releases WHERE profit_account_id=?',[profit.id]);
      await connection.query('DELETE FROM lot_project_network_profit_accounts WHERE id=?',[profit.id]);
    }
    await connection.query('UPDATE lot_project_client_profiles SET assigned_accredited_seller_id=?,sale_channel=? WHERE lot_project_client_profile_id=?',[
      proposal.newSellerId,proposal.preview.groupType==='external'?'external_group':'distributed',proposal.listing.lot_project_client_profile_id]);
    const inserted=await replaceReservationCommissions(connection,proposal.project.lot_project_id,{
      ...proposal.listing,lot_project_listing_net_selling_price:Number(proposal.evidence.commissions[0].commission_base_amount),
      soa_selected_base_selling_price:Number(proposal.evidence.commissions[0].commission_base_amount),
      soa_selected_net_selling_price:Number(proposal.evidence.commissions[0].commission_base_amount),
      soa_selected_tcp:Number(proposal.evidence.commissions[0].commission_base_amount),
      lot_project_listing_tcp:Number(proposal.evidence.commissions[0].commission_base_amount),
    },proposal.listing.lot_project_client_profile_id,proposal.newSellerId);
    await connection.query('UPDATE lot_project_commissions SET lot_project_account_id=? WHERE lot_project_client_profile_id=? AND lot_project_account_id IS NULL',[
      proposal.listing.lot_project_account_id,proposal.listing.lot_project_client_profile_id]);
    const [saved]=await connection.query('INSERT INTO lot_project_assigned_seller_changes (lot_project_id,lot_project_listing_id,lot_project_account_id,lot_project_client_profile_id,old_seller_id,new_seller_id,old_sale_channel,new_sale_channel,before_snapshot_json,after_snapshot_json,changed_by_user_id,reason,authorization_type,authorization_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
      proposal.project.lot_project_id,proposal.listing.lot_project_listing_id,proposal.listing.lot_project_account_id,proposal.listing.lot_project_client_profile_id,
      proposal.listing.assigned_accredited_seller_id,proposal.newSellerId,proposal.listing.sale_channel,
      proposal.preview.groupType==='external'?'external_group':'distributed',JSON.stringify({hierarchy:proposal.previous,networkProfit:proposal.evidence.profitAccounts,networkProfitStages:proposal.evidence.profitReleases}),JSON.stringify({hierarchy:proposal.next,companyProfitRate:proposal.preview.companyProfitRate,networkType:proposal.preview.groupType}),actor.id,reason,approvalType,approvalId]);
    const workflow=await createOperationalReview(connection,{actor,actionKey:REVIEW_ACTION,department:'accounting',projectId:proposal.project.lot_project_id,
      entityType:'lot_project_commission_account',entityId:proposal.listing.lot_project_account_id,
      entityLabel:`Unit ${proposal.listing.lot_project_listing_unit_id} — ${proposal.listing.account_reference}`,
      beforeSnapshot:{projectSlug:req.params.projectSlug,listingId:proposal.listing.lot_project_listing_id,accountId:proposal.listing.lot_project_account_id,
        assignedSellerId:proposal.listing.assigned_accredited_seller_id,assignedSellerName:proposal.listing.current_seller_name,hierarchy:proposal.previous,networkProfit:proposal.evidence.profitAccounts},
      afterSnapshot:{projectSlug:req.params.projectSlug,listingId:proposal.listing.lot_project_listing_id,accountId:proposal.listing.lot_project_account_id,
        assignedSellerId:proposal.newSellerId,assignedSellerName:proposal.preview.assignedSeller.full_name,hierarchy:proposal.next,companyProfitRate:proposal.preview.companyProfitRate,changeId:saved.insertId},
      headPreApprovedByUserId:headUserId});
    await writeAuditLog(connection,req,{action:'update',module:'Commissions',entityType:'lot_project_account',entityId:String(proposal.listing.lot_project_account_id),
      entityLabel:proposal.listing.account_reference,title:'Changed assigned seller',description:`Assigned seller updated for unit ${proposal.listing.lot_project_listing_unit_id}.`,
      metadata:{changeId:saved.insertId,reason,oldSellerId:proposal.listing.assigned_accredited_seller_id,newSellerId:proposal.newSellerId,
        before:proposal.previous,after:proposal.next,authorizationType:approvalType,reviewId:workflow.reviewId,reviewNumber:workflow.reviewNumber}});
    await connection.commit();return res.json({success:true,message:'Assigned Seller Updated',data:{changeId:Number(saved.insertId),newSellerId:proposal.newSellerId,commissions:inserted,workflow}});
  }catch(error){try{await connection.rollback()}catch{}return fail(res,error)}finally{connection.release()}
};


