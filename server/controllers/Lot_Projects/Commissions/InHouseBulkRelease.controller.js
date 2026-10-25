// Batch milestone release is deliberately implemented beside (not in place of)
// the individual workflows. All recipients are re-read and locked before writes.
// This module delegates the financial work to the same individual release handlers
// through shared transaction-aware operations (no HTTP calls or partial commits).
import { randomUUID } from 'node:crypto';
import { loadLiveSellerReleaseForBatch, finishBatchSellerRelease } from './Commissions.controller.js';
import { db, getProjectBySlug, getAuthenticatedUser, todayDateOnly, getErrorMessage, tableExists } from '../_shared/lotProject.shared.js';
import { validateReleaseReceiptDetails } from '../../../services/releaseReceiptDetails.js';
import { getNetworkProfitReleaseCalendar } from '../../../services/networkProfitReleaseCalendar.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { createOperationalReview, assertEntityNotReviewLocked } from '../../../services/operationalReview.service.js';
import { validateExactBulkRecipients, isLiveBulkStageEligible, countPendingBulkRecipients } from '../../../services/inHouseBulkReleasePolicy.js';

const STAGES = ['1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention'];
const METHODS = new Set(['cash','bank_transfer','check','other']);
const clean = (v) => String(v ?? '').trim();
const problem = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const id = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;
const validReceipt = (row, today) => {
  const method = clean(row?.paymentMethod).toLowerCase();
  if (!METHODS.has(method)) throw problem('Select a payment method for every pending recipient.', 400);
  const receipt = validateReleaseReceiptDetails(row?.receiptDetails, today, today, method);
  if (clean(row?.paymentReference) !== receipt.referenceNumber) throw problem('Payment and receipt references must match.', 400);
  return { paymentMethod: method, receipt };
};

// A preview is informational. The POST revalidates all conditions under locks.
export const releaseAllInHouseMilestone = async (req, res) => {
  const connection = await db.getConnection();
  let transaction = false;
  try {
    const actor = await getAuthenticatedUser(req);
    if (!actor) throw problem('Please sign in.', 401);
    const project = await getProjectBySlug(clean(req.params.projectSlug));
    if (!project) throw problem('Project not found.', 404);
    const profitId = id(req.params.profitId);
    const stage = clean(req.body?.stage);
    if (!profitId || !STAGES.includes(stage) || req.body?.confirmReleaseAll !== true)
      throw problem('Review the selected milestone and confirm Release All.', 400);
    if (!Array.isArray(req.body.recipients) || req.body.recipients.length > 100)
      throw problem('Invalid recipient list.', 400);
    const today = todayDateOnly();
    if (!(await tableExists(connection, 'lot_project_network_profit_releases')) ||
        !(await tableExists(connection, 'lot_project_commission_receipts')) ||
        !(await tableExists(connection, 'lot_project_commission_receipt_items')))
      throw problem('Commission receipt/release tables are missing. Apply the existing receipt migrations first.', 503);
    const [[settings]] = await connection.query('SELECT release_day_one, release_day_two FROM lot_project_settings WHERE lot_project_id=? LIMIT 1', [project.lot_project_id]);
    const calendar = getNetworkProfitReleaseCalendar(today, settings || {});
    if (!calendar.isReleaseDate) throw problem(`Release All is only available on scheduled days. Next release: ${calendar.nextReleaseDate}.`, 409);

    await connection.beginTransaction(); transaction = true;
    // Lock Company Profit first; individual Company Profit releases use this lock order.
    const [[profit]] = await connection.query(`SELECT p.*, a.account_status, l.lot_project_listing_unit_id AS unit,
      sg.seller_group_type, sg.seller_group_status
      FROM lot_project_network_profit_accounts p
      JOIN lot_project_accounts a ON a.lot_project_account_id=p.lot_project_account_id
      JOIN lot_project_listings l ON l.lot_project_listing_id=p.lot_project_listing_id
      JOIN seller_groups sg ON sg.seller_group_id=p.seller_group_id
      WHERE p.id=? AND p.lot_project_id=? LIMIT 1 FOR UPDATE`, [profitId, project.lot_project_id]);
    if (!profit) throw problem('Company Profit record not found.', 404);
    if (profit.seller_group_type !== 'in_house' || profit.seller_group_status !== 'active' ||
        ['cancelled','pending_cancellation','deletion_pending'].includes(clean(profit.account_status).toLowerCase()))
      throw problem('This buyer account or Network is not eligible for a live batch release.');
    const [[company]] = await connection.query(`SELECT * FROM lot_project_network_profit_releases
      WHERE profit_account_id=? AND release_stage=? LIMIT 1 FOR UPDATE`, [profitId,stage]);
    if (!company) throw problem('Company Profit milestone not found.');
    if (!['Pending','Released'].includes(company.release_status))
      throw problem(`Company Profit ${stage} is on hold or unavailable.`);

    // Discover the entire authoritative set of recipients from the saved account,
    // not the user-submitted dropdown. No other Network/account can be included.
    const [sellers] = await connection.query(`SELECT c.lot_project_commission_id AS commissionId,
      c.accredited_seller_id AS sellerId, c.commission_role AS role, c.commission_rate_type,
      c.sale_owner_accredited_seller_id, c.lot_project_listing_id, c.lot_project_client_profile_id,
      c.lot_project_account_id, c.gross_commission_amount,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)),''), 'Seller') AS sellerName
      FROM lot_project_commissions c
      JOIN accredited_sellers s ON s.accredited_seller_id=c.accredited_seller_id
      LEFT JOIN users u ON u.id=s.user_id
      WHERE c.lot_project_id=? AND c.lot_project_account_id=? AND s.seller_group_id=?
      ORDER BY c.lot_project_commission_id`, [project.lot_project_id,profit.lot_project_account_id,profit.seller_group_id]);
    if (!sellers.length) throw problem('No saved seller commissions found for this Network/account.');
    if (sellers.some(s=>!['division_manager','sales_director','unit_manager','sales_agent'].includes(s.role)))
      throw problem('A recipient has an unexpected In-House role. Review the account before releasing.');
    if (sellers.length > 100) throw problem('Too many commission recipients for one batch.');
    const { incoming, expected } = validateExactBulkRecipients({profitId,sellers,entries:req.body.recipients});

    // Lock all seller parent records in deterministic order to serialize with the
    // existing per-seller stage handler and protect against concurrent batches.
    const locked = [];
    for (const seller of sellers) {
      const [[parent]] = await connection.query('SELECT lot_project_commission_id FROM lot_project_commissions WHERE lot_project_commission_id=? AND lot_project_id=? LIMIT 1 FOR UPDATE',[seller.commissionId, project.lot_project_id]);
      if (!parent) throw problem('Seller commission was changed. Refresh the batch.');
      const loaded = await loadLiveSellerReleaseForBatch(connection, {
        stage, commissionId: seller.commissionId, accountId: profit.lot_project_account_id,
        projectId: project.lot_project_id,
      });
      if (!loaded) throw problem(`Missing ${stage} milestone for ${seller.sellerName}.`);
      const { release, computedStatus, isHistorical } = loaded;
      if (isHistorical) throw problem('Historical buyer accounts must use individual historical release.');
      if (!isLiveBulkStageEligible(computedStatus))
        throw problem(`${seller.sellerName}: ${stage} is not eligible or is on hold. Nothing was released.`);
      await assertEntityNotReviewLocked(connection, { actor:req.authUser, entityType:'lot_project_commission', entityId:seller.commissionId });
      locked.push({seller,release});
    }

    const companyEntry = incoming.get(`company:${profitId}`);
    const pending = [
      ...(company.release_status === 'Pending' ? [{type:'company', row: companyEntry}] : []),
      ...locked.filter(({release})=>release.release_status!=='Released').map(({seller})=>({type:'seller', row:incoming.get(`seller:${seller.commissionId}`)})),
    ];
    if (!pending.length) { await connection.commit(); transaction=false; return res.json({success:true,alreadyApplied:true,message:`${stage} has already been released for every recipient.`,data:{released:[],skipped:expected.length}}); }
    if (pending.length !== countPendingBulkRecipients(company.release_status, locked.map(({release})=>release.release_status)))
      throw problem('Concurrent commission update detected. Refresh and review the batch.');
    const details = new Map(pending.map(({type,row})=>[type==='company'?'company':`seller:${id(row?.commissionId)}`,validReceipt(row,today)]));
    const batchId = randomUUID();
    const released = [];
    // Save seller releases first, then Company Profit. The parent + stage locks
    // prevent another user from paying the same milestone during this operation.
    for (const {seller,release} of locked) {
      if (release.release_status === 'Released') continue;
      const {receipt,paymentMethod} = details.get(`seller:${seller.commissionId}`);
      const releaseId = id(release.lot_project_commission_release_id);
      const [changed] = await connection.query(`UPDATE lot_project_commission_releases
        SET release_status='Released',actual_release_date=?,released_by_user_id=?,release_entry_mode='live',
            release_recorded_at=COALESCE(release_recorded_at,NOW()),historical_release_note=NULL
        WHERE lot_project_commission_release_id=? AND lot_project_commission_id=? AND release_status=?`,
        [today,actor.id,releaseId,seller.commissionId,release.release_status]);
      if (changed.affectedRows !== 1) throw problem('Commission status changed during this batch.');
      const receiptSellerId = seller.commission_rate_type === 'direct'
        ? id(seller.sale_owner_accredited_seller_id) || seller.sellerId : seller.sellerId;
      const netAmount = Number(release.net_release_amount);
      const [insert] = await connection.query(`INSERT INTO lot_project_commission_receipts
        (lot_project_id,lot_project_listing_id,lot_project_client_profile_id,lot_project_account_id,
         lot_project_commission_id,accredited_seller_id,bank_name,account_number,receipt_date,
         reference_number,witness_name,total_amount,receipt_status,created_by_user_id)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'active',?)`,[
        project.lot_project_id,seller.lot_project_listing_id,seller.lot_project_client_profile_id,
        profit.lot_project_account_id,seller.commissionId,receiptSellerId,
        receipt.bankName,receipt.accountNumber,receipt.receiptDate,receipt.referenceNumber,
        receipt.witnessName,netAmount,actor.id]);
      await connection.query(`INSERT INTO lot_project_commission_receipt_items
        (lot_project_commission_receipt_id,lot_project_commission_release_id,release_amount) VALUES(?,?,?)`,
        [insert.insertId,releaseId,netAmount]);
      await writeAuditLog(connection,req,{action:'release',module:'Commissions',entityType:'lot_project_commission',
        entityId:String(seller.commissionId),entityLabel:`${seller.sellerName} · ${stage}`,
        title:'Released seller commission (batch)',description:`Released ${stage} for ${seller.sellerName}.`,
        metadata:{batchId,projectId:project.lot_project_id,accountId:profit.lot_project_account_id,
          releaseId,receiptId:insert.insertId,paymentMethod,reference:receipt.referenceNumber,amount:netAmount}});
      await createOperationalReview(connection,{actor:req.authUser,actionKey:'commission.release',department:'accounting',
        projectId:project.lot_project_id,entityType:'lot_project_commission',entityId:seller.commissionId,
        entityLabel:`${profit.unit} — ${seller.sellerName} — ${stage}`,
        beforeSnapshot:{projectSlug:clean(req.params.projectSlug),commissionId:seller.commissionId,
          listingId:seller.lot_project_listing_id,unitId:profit.unit,buyerName:release.buyer_full_name,
          releaseId,releaseStage:stage,status:release.release_status,actualReleaseDate:null,
          releasedByUserId:null,releaseEntryMode:'live',receiptId:null,batchId},
        afterSnapshot:{projectSlug:clean(req.params.projectSlug),commissionId:seller.commissionId,
          listingId:seller.lot_project_listing_id,unitId:profit.unit,buyerName:release.buyer_full_name,
          releaseId,releaseStage:stage,status:'Released',actualReleaseDate:today,
          releasedByUserId:actor.id,releaseEntryMode:'live',receiptId:insert.insertId,batchId}});
      released.push({type:'seller',commissionId:seller.commissionId,releaseId,receiptId:insert.insertId,amount:netAmount});
    }
    if (company.release_status === 'Pending') {
      // Same source-stage validation as the individual Company Profit endpoint.
      // Saved seller stages have already been released above inside this transaction.
      const [[source]] = await connection.query(`SELECT cr.release_status FROM lot_project_commission_releases cr
        JOIN lot_project_commissions c ON c.lot_project_commission_id=cr.lot_project_commission_id
        JOIN accredited_sellers s ON s.accredited_seller_id=c.accredited_seller_id
        WHERE c.lot_project_account_id=? AND s.seller_group_id=? AND cr.release_stage=?
        ORDER BY c.lot_project_commission_id ASC LIMIT 1 FOR UPDATE`,
        [profit.lot_project_account_id,profit.seller_group_id,stage]);
      if (!['Eligible','Released'].includes(source?.release_status))
        throw problem('Company Profit source milestone is not eligible for release.');
      const {receipt,paymentMethod} = details.get('company');
      const [updated] = await connection.query(`UPDATE lot_project_network_profit_releases
        SET release_status='Released',actual_release_date=?,released_by_user_id=?,
            payee_name=?,payment_method=?,payment_reference=?,bank_name=?,account_number=?,receipt_date=?,
            witness_name=?,release_recorded_at=NOW()
        WHERE id=? AND profit_account_id=? AND release_status='Pending'`,[
        today,actor.id,profit.payee_name_snapshot,paymentMethod,receipt.referenceNumber,
        receipt.bankName,receipt.accountNumber,receipt.receiptDate,receipt.witnessName,company.id,profitId]);
      if (updated.affectedRows!==1) throw problem('Company Profit status changed during this batch.');
      await writeAuditLog(connection,req,{action:'release',module:'Commissions',entityType:'lot_project_network_profit_release',
        entityId:String(company.id),entityLabel:`${profit.unit} · Company Profit · ${stage}`,
        title:'Released Company Profit (batch)',description:`Released ${stage} for ${profit.payee_name_snapshot}.`,
        metadata:{batchId,profitId,releaseId:company.id,accountId:profit.lot_project_account_id,
          amount:Number(company.release_amount),paymentMethod,reference:receipt.referenceNumber}});
      await createOperationalReview(connection,{actor:req.authUser,actionKey:'commission.release',department:'accounting',
        projectId:project.lot_project_id,entityType:'lot_project_network_profit_release',entityId:company.id,
        entityLabel:`${profit.unit} — Company Profit — ${stage}`,
        beforeSnapshot:{status:'Pending',unitCode:profit.unit,network:profit.network_name_snapshot,
          payee:profit.payee_name_snapshot,amount:Number(company.release_amount),stage,batchId,
          releaseDate:null,paymentMethod:null,paymentReference:null,receiptDate:null},
        afterSnapshot:{status:'Released',unitCode:profit.unit,network:profit.network_name_snapshot,
          payee:profit.payee_name_snapshot,amount:Number(company.release_amount),stage,batchId,
          releaseDate:today,paymentMethod,paymentReference:receipt.referenceNumber,receiptDate:receipt.receiptDate}});
      released.push({type:'company',profitId,releaseId:company.id,amount:Number(company.release_amount)});
    }
    // The individual handler's status sync and full reconciliation also covers
    // discounts, retention, cash advance deductions and historical snapshots.
    for (const { seller, release } of locked) {
      await finishBatchSellerRelease(connection, release, seller.commissionId, project.lot_project_id);
    }
    await writeAuditLog(connection,req,{action:'release',module:'Commissions',entityType:'lot_project_network_profit_account',
      entityId:String(profitId),entityLabel:`${profit.unit} · ${stage}`,title:'Release All — In-House commissions',
      description:`Released ${released.length} recipient milestones in one transaction.`,
      metadata:{batchId,accountId:profit.lot_project_account_id,stage,recipients:released}});
    await connection.commit(); transaction=false;
    return res.json({success:true,message:`${stage}: released ${released.length} recipient(s).`,
      data:{batchId,stage,released,skipped:expected.length-released.length}});
  } catch (error) {
    if (transaction) try{await connection.rollback()}catch{}
    return res.status(error.statusCode||500).json({success:false,message:getErrorMessage(error)});
  } finally {connection.release();}
};
