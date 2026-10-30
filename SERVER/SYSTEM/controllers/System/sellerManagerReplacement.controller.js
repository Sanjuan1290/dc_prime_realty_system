import { db } from '../../db/connect.js';
import { managerReplacementAuthMode } from '../../services/sellerConfirmationPolicy.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { assertGroupCurrentPathsWithinPools } from './sellerGroup.controller.js';
import { createOperationalReview } from '../../services/operationalReview.service.js';
import { getManagerReplacementPlan, replacementFingerprint, assertReplacementApplied } from '../../services/sellerManagerReplacement.service.js';
import { createSensitiveActionVerification, verifyAndConsumeSensitiveAction, maskSensitiveActionEmail, getSensitiveActionRequestIp, SENSITIVE_ACTION_CODE_EXPIRY_MINUTES } from '../../services/sensitiveActionVerification.service.js';
import { sendEmail, isResendConfigured } from '../../services/email.service.js';

const ACTION = 'seller_manager_replacement';
const errorText=e=>e?.statusCode?e.message:'Could not replace the manager. No changes were saved.';
const parse = req=>({groupId:Number(req.params.groupId),outgoingUserId:Number(req.params.userId),replacementUserId:Number(req.body?.replacementUserId||req.query?.replacementUserId||0)});
const reason = req=>String(req.body?.reason||'').trim().slice(0,500);
const transaction = async (req,res,handler)=>{
  const connection=await db.getConnection();
  try { return await handler(connection); }
  catch(e){try{await connection.rollback()}catch{} return res.status(e.statusCode||500).json({message:errorText(e)});}
  finally {connection.release();}
};

export const previewManagerReplacement = (req,res)=>transaction(req,res,async connection=>{
  const plan=await getManagerReplacementPlan(connection,parse(req));
  return res.json({success:true,data:plan});
});

export const requestManagerReplacementCode = (req,res)=>transaction(req,res,async connection=>{
  if(reason(req).length<5) return res.status(400).json({message:'Enter a reason (at least 5 characters).'});
  if(!req.authUser?.email || !isResendConfigured()) return res.status(503).json({message:'Verification email is unavailable. Contact an administrator.'});
  await connection.beginTransaction();
  const plan=await getManagerReplacementPlan(connection,parse(req));
  if(!plan.replacement) { await connection.rollback(); return res.status(400).json({message:'Choose a replacement manager.'}); }
  if(managerReplacementAuthMode(plan.role, { replacesNetworkHead: plan.replacesNetworkHead })!=='email_code') {await connection.rollback();return res.status(400).json({message:'This manager uses direct confirmation. No email code is required.'});}
  const fingerprint=replacementFingerprint(plan,reason(req));
  const payload={fingerprint,actorId:Number(req.authUser.id),groupId:plan.groupId,outgoingUserId:plan.outgoing.userId,replacementUserId:plan.replacement.userId};
  const {verificationId,code}=await createSensitiveActionVerification(connection,{userId:req.authUser.id,actionType:ACTION,entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),payload,reason:reason(req),requestIp:getSensitiveActionRequestIp(req)});
  await sendEmail({to:req.authUser.email,subject:'Confirm manager replacement',text:`Your D&C Prime Realty verification code: ${code}\nReplace ${plan.outgoing.name} with ${plan.replacement.name}.\nSellers moving: ${plan.directReports.length}.\nReason: ${reason(req)}\nExpires in ${SENSITIVE_ACTION_CODE_EXPIRY_MINUTES} minutes. Do not share this code.`});
  await connection.commit();
  return res.json({success:true,data:{verificationId,maskedEmail:maskSensitiveActionEmail(req.authUser.email)},message:'Verification code sent.'});
});

export const confirmManagerReplacement = (req,res)=>transaction(req,res,async connection=>{
  const verificationId=Number(req.body?.verificationId||0),code=String(req.body?.code||'').trim();
  if(reason(req).length<5) return res.status(400).json({message:'Enter a reason (at least 5 characters).'});
  const {groupId,outgoingUserId,replacementUserId}=parse(req);
  await connection.beginTransaction();
  // Lock the network and all current members so stale previews cannot be confirmed.
  const plan=await getManagerReplacementPlan(connection,{groupId,outgoingUserId,replacementUserId,lock:true});
  if (!plan.replacement) { await connection.rollback(); return res.status(400).json({message:'Choose a replacement manager.'}); }
  const authMode=managerReplacementAuthMode(plan.role, { replacesNetworkHead: plan.replacesNetworkHead });
  // Confirm the exact reviewed snapshot, not an outdated team preview.
  if (!req.body?.expectedStateHash || req.body.expectedStateHash !== plan.stateHash ||
      Number(req.body?.expectedHeadUserId) !== plan.currentHeadUserId) {
    await connection.rollback();
    return res.status(409).json({message:'Team assignments changed. Review the latest team before confirming.'});
  }
  const payload={fingerprint:replacementFingerprint(plan,reason(req)),actorId:Number(req.authUser.id),groupId:plan.groupId,outgoingUserId:plan.outgoing.userId,replacementUserId:plan.replacement.userId};
  if (authMode==='email_code') {
    if (!verificationId || !/^\d{6}$/.test(code)) {await connection.rollback();return res.status(400).json({message:'Enter the 6-digit email code.'});}
    const verified=await verifyAndConsumeSensitiveAction(connection,{verificationId,userId:req.authUser.id,actionType:ACTION,entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),code,payload});
    if(!verified.ok){await connection.commit();return res.status(verified.statusCode||400).json({message:verified.message});}
  } else if (req.body?.confirmReplacement !== true) {
    await connection.rollback();
    return res.status(400).json({message:'Confirm the manager replacement before saving.'});
  }
  if (plan.mergeRequired && req.body?.confirmTeamMerge !== true) {
    await connection.rollback();
    return res.status(400).json({message:'The replacement already manages a team. Review the combined team and explicitly confirm the merge.'});
  }
  const rows=plan.directReports;
  // No historical sales, payment or commission rows are touched.
  for(const row of rows){
    await connection.query('UPDATE accredited_sellers SET accredited_seller_reports_under_user_id=? WHERE accredited_seller_id=? AND accredited_seller_reports_under_user_id=?',[plan.replacement.userId,row.sellerId,plan.outgoing.userId]);
    await connection.query('DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id=?',[row.sellerId]);
    await connection.query('INSERT INTO accredited_seller_managed_sellers(manager_accredited_seller_id,managed_accredited_seller_id) VALUES(?,?)',[plan.replacement.sellerId,row.sellerId]);
  }
  if(plan.replacesNetworkHead) await connection.query('UPDATE seller_groups SET seller_group_head_user_id=? WHERE seller_group_id=? AND seller_group_head_user_id=?',[plan.replacement.userId,plan.groupId,plan.outgoing.userId]);
  await connection.query(`UPDATE users SET status='inactive',can_login=0,deactivated_at=NOW(),deactivated_by_user_id=?,deactivation_reason=?,auth_version=COALESCE(auth_version,0)+1 WHERE id=?`,[req.authUser.id,reason(req),plan.outgoing.userId]);
  await connection.query(`UPDATE accredited_sellers SET accredited_seller_status='inactive' WHERE accredited_seller_id=?`,[plan.outgoing.sellerId]);
  await assertReplacementApplied(connection,plan);
  // Verify fixed project commission rates remain valid after changing the Network Head.
  await assertGroupCurrentPathsWithinPools(connection,plan.groupId);
  const [saved]=await connection.query(`INSERT INTO seller_manager_replacements
   (seller_group_id,outgoing_user_id,replacement_user_id,outgoing_role,reason,created_by_user_id,verification_id,direct_reports_moved,impact_snapshot_json)
   VALUES(?,?,?,?,?,?,?,?,?)`,[plan.groupId,plan.outgoing.userId,plan.replacement.userId,plan.role,reason(req),req.authUser.id,authMode==='email_code'?verificationId:null,rows.length,JSON.stringify(plan)]);
  const replacementId=Number(saved.insertId);
  for(const row of rows) await connection.query(`INSERT INTO seller_manager_replacement_items(replacement_id,affected_accredited_seller_id,previous_manager_user_id,new_manager_user_id) VALUES(?,?,?,?)`,[replacementId,row.sellerId,row.previousManagerUserId,row.nextManagerUserId]);
  const review=await createOperationalReview(connection,{actor:req.authUser,actionKey:'seller.manager_replace',department:'marketing',entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),entityLabel:plan.outgoing.name,beforeSnapshot:{manager:plan.outgoing,reportingSellers:rows,accountStatus:'active'},afterSnapshot:{manager:plan.replacement,reportingSellers:rows,formerManagerStatus:'inactive',replacementId}});
  await writeAuditLog(connection,req,{action:'update',module:'Accreditation',entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),entityLabel:plan.outgoing.name,title:'Replaced and deactivated manager',description:`Reassigned ${rows.length} direct reports to ${plan.replacement.name}.`,metadata:{replacementId,groupId:plan.groupId,role:plan.role,fromUserId:plan.outgoing.userId,toUserId:plan.replacement.userId,fromManagerName:plan.outgoing.name,toManagerName:plan.replacement.name,affected:rows,reason:reason(req),verificationId:authMode==='email_code'?verificationId:null,verificationMethod:authMode==='email_code'?'email_code':'administrator_confirmation',mergeApproved:Boolean(plan.mergeRequired && req.body.confirmTeamMerge),headChanged:plan.replacesNetworkHead,reviewId:review.reviewId,reviewNumber:review.reviewNumber}});
  await connection.query('UPDATE seller_manager_replacements SET operational_review_id=? WHERE replacement_id=?',[review.reviewId,replacementId]);
  await connection.commit();
  return res.json({success:true,message:'Manager replaced and team moved.',data:{replacementId,review,affected:rows.length}});
});

export const getManagerReplacementHistory = (req,res)=>transaction(req,res,async connection=>{
  const groupId=Number(req.params.groupId);
  if(!Number.isSafeInteger(groupId) || groupId<1) return res.status(400).json({message:'Select a valid Network.'});
  const page=Math.max(1,Math.min(10000,Number(req.query.page)||1));
  const limit=15;
  const [rows]=await connection.query(`SELECT
    history.replacement_id, history.outgoing_role, history.reason,
    history.created_at AS created_at, history.direct_reports_moved,
    history.operational_review_id,
    reversal.reversal_id, reversal.created_at AS restored_at,
    old.account_code AS old_account_code,
    new_manager.account_code AS new_account_code,
    CONCAT_WS(' ',old.first_name,old.last_name) AS outgoing_name,
    CONCAT_WS(' ',new_manager.first_name,new_manager.last_name) AS replacement_name
    FROM seller_manager_replacements AS history
    LEFT JOIN seller_manager_replacement_reversals AS reversal ON reversal.replacement_id=history.replacement_id
    INNER JOIN users AS old ON old.id = history.outgoing_user_id
    INNER JOIN users AS new_manager ON new_manager.id = history.replacement_user_id
    WHERE history.seller_group_id = ?
    ORDER BY history.replacement_id DESC LIMIT ? OFFSET ?`,[groupId,limit,(page-1)*limit]);
  return res.json({success:true,data:rows,page});
});





/**
 * Deactivate an empty In-House DM, SD, or UM without replacing the manager.
 * Strictly for accidental/unused accounts; a designated Network Head or a
 * manager with ANY assigned sellers must use the existing corrective workflow.
 * No sellers, buyer records, commissions or historical transactions are deleted.
 */
export const deactivateEmptyManager = (req,res)=>transaction(req,res,async connection=>{
  const {groupId,outgoingUserId}=parse(req);
  const explanation=reason(req);
  if (explanation.length < 5) return res.status(400).json({message:'Enter a deactivation reason (at least 5 characters).'});
  if (req.body?.confirmDeactivation !== true) return res.status(400).json({message:'Confirm account deactivation before saving.'});
  await connection.beginTransaction();
  // Lock the exact Network and its seller rows to catch stale UI hints.
  const plan=await getManagerReplacementPlan(connection,{groupId,outgoingUserId,lock:true});
  if (!['division_manager','sales_director','unit_manager'].includes(plan.role)) {
    throw Object.assign(new Error('Only an In-House Division Manager, Sales Director, or Unit Manager can use this action.'),{statusCode:409});
  }
  if (plan.replacesNetworkHead) {
    throw Object.assign(new Error('This Division Manager is the designated Network Head. Reassign the Network Head before deactivating this account.'),{statusCode:409});
  }
  if (plan.directReports.length || plan.totalAffected) {
    throw Object.assign(new Error('This manager has assigned sellers. Use Replace Manager to transfer the team before deactivation.'),{statusCode:409});
  }
  // Query across ALL Networks, and include inactive/dummy sellers. An empty
  // visible team must not hide a legacy or cross-network dependency.
  const [[dependent]]=await connection.query(
    'SELECT COUNT(*) AS total FROM accredited_sellers WHERE accredited_seller_reports_under_user_id=?',
    [outgoingUserId]);
  const [[legacyLinks]]=await connection.query(
    'SELECT COUNT(*) AS total FROM accredited_seller_managed_sellers WHERE manager_accredited_seller_id=?',
    [plan.outgoing.sellerId]);
  if (Number(dependent?.total||0) || Number(legacyLinks?.total||0)) {
    throw Object.assign(new Error('This manager still has linked sellers, including inactive records. Reassign them before deactivation.'),{statusCode:409});
  }
  // Recheck the head pointer independently of the plan, before any writes.
  const [[head]]=await connection.query(
    'SELECT seller_group_head_user_id FROM seller_groups WHERE seller_group_id=? FOR UPDATE',
    [groupId]);
  if (Number(head?.seller_group_head_user_id || 0)===outgoingUserId) {
    throw Object.assign(new Error('Reassign the designated Network Head before deactivating this Division Manager.'),{statusCode:409});
  }
  const [accountChange]=await connection.query(`UPDATE users SET
    status='inactive',can_login=0,deactivated_at=NOW(),deactivated_by_user_id=?,
    deactivation_reason=?,auth_version=COALESCE(auth_version,0)+1
    WHERE id=? AND status='active'`,[req.authUser.id,explanation,outgoingUserId]);
  const [sellerChange]=await connection.query(
    `UPDATE accredited_sellers SET accredited_seller_status='inactive'
     WHERE accredited_seller_id=? AND accredited_seller_status='active'`,[plan.outgoing.sellerId]);
  if (accountChange.affectedRows !== 1 || sellerChange.affectedRows !== 1) {
    throw Object.assign(new Error('Account status changed while confirming. No changes were saved.'),{statusCode:409});
  }
  const beforeSnapshot={userId:outgoingUserId,role:plan.role,userStatus:'active',sellerStatus:'active',directReports:0};
  const afterSnapshot={...beforeSnapshot,userStatus:'inactive',sellerStatus:'inactive',deactivationReason:explanation};
  const review=await createOperationalReview(connection,{
    actor:req.authUser,actionKey:'seller.status',department:'marketing',
    entityType:'accredited_seller',entityId:String(plan.outgoing.sellerId),entityLabel:plan.outgoing.name,
    beforeSnapshot,afterSnapshot,
  });
  const roleLabel={division_manager:'Division Manager',sales_director:'Sales Director',unit_manager:'Unit Manager'}[plan.role];
  await writeAuditLog(connection,req,{
    action:'update',module:'Accreditation',entityType:'accredited_seller',
    entityId:String(plan.outgoing.sellerId),entityLabel:plan.outgoing.name,
    title:`Deactivated empty ${roleLabel}`,
    description:`${plan.outgoing.name} deactivated with no linked sellers.`,
    metadata:{groupId,fromUserId:outgoingUserId,role:plan.role,directReports:0,
      reason:explanation,verificationMethod:'explicit_confirmation',
      reviewId:review?.reviewId??null,reviewNumber:review?.reviewNumber??null},
  });
  await connection.commit();
  return res.json({success:true,
    message:`${roleLabel} deactivated. Other teams and historical transactions were unchanged.`,
    data:{userId:outgoingUserId,role:plan.role,reviewId:review?.reviewId??null},
  });
});

