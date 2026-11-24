import { randomUUID } from 'node:crypto';
import { db, getProjectBySlug, getAuthenticatedUser, getErrorMessage, tableExists } from '../_shared/lotProject.shared.js';
import { loadLiveSellerReleaseForBatch, finishBatchSellerRelease } from './Commissions.controller.js';
import { validateExactBulkRecipients } from '../../../services/inHouseBulkReleasePolicy.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { assertEntityNotReviewLocked, createOperationalReview } from '../../../services/operationalReview.service.js';

const stages = new Set(['1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention']);
const roles = new Set(['division_manager', 'sales_director', 'unit_manager', 'sales_agent']);
const problem = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });

// Remove holds for one milestone across the saved account/Network. Payouts still
// use the existing release workflow and its release-day and receipt checks.
export const unholdAllInHouseMilestone = async (req, res) => {
  const connection = await db.getConnection();
  let transaction = false;
  try {
    const actor = await getAuthenticatedUser(req);
    if (!actor) throw problem('Please sign in.', 401);
    const projectSlug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(projectSlug);
    if (!project) throw problem('Project not found.', 404);
    const profitId = Number(req.params.profitId);
    const stage = String(req.body?.stage || '').trim();
    if (!Number.isSafeInteger(profitId) || profitId <= 0 || !stages.has(stage) || req.body?.confirmUnholdAll !== true)
      throw problem('Review the selected milestone and confirm Unhold All.', 400);
    if (!(await tableExists(connection, 'lot_project_network_profit_releases')) ||
        !(await tableExists(connection, 'lot_project_commission_releases')))
      throw problem('Commission release tables are unavailable.', 503);

    await connection.beginTransaction(); transaction = true;
    // Use the same parent/stage lock order as Release All.
    const [[profit]] = await connection.query(`SELECT p.*, a.account_status, l.lot_project_listing_unit_id AS unit,
      sg.seller_group_type, sg.seller_group_status
      FROM lot_project_network_profit_accounts p
      JOIN lot_project_accounts a ON a.lot_project_account_id=p.lot_project_account_id
      JOIN lot_project_listings l ON l.lot_project_listing_id=p.lot_project_listing_id
      JOIN seller_groups sg ON sg.seller_group_id=p.seller_group_id
      WHERE p.id=? AND p.lot_project_id=? LIMIT 1 FOR UPDATE`, [profitId, project.lot_project_id]);
    if (!profit) throw problem('Company Profit record not found.', 404);
    if (profit.seller_group_type !== 'in_house' || profit.seller_group_status !== 'active' ||
        ['cancelled', 'pending_cancellation', 'deletion_pending'].includes(String(profit.account_status).toLowerCase()))
      throw problem('This buyer account or Network is not eligible for Unhold All.');
    const [[company]] = await connection.query(`SELECT * FROM lot_project_network_profit_releases
      WHERE profit_account_id=? AND release_stage=? LIMIT 1 FOR UPDATE`, [profitId, stage]);
    if (!company || !['Pending', 'On Hold', 'Released'].includes(company.release_status))
      throw problem('Company Profit milestone is unavailable. Refresh the record.');
    const [sellers] = await connection.query(`SELECT c.lot_project_commission_id AS commissionId, c.commission_role AS role
      FROM lot_project_commissions c
      JOIN accredited_sellers s ON s.accredited_seller_id=c.accredited_seller_id
      WHERE c.lot_project_id=? AND c.lot_project_account_id=? AND s.seller_group_id=?
      ORDER BY c.lot_project_commission_id`, [project.lot_project_id, profit.lot_project_account_id, profit.seller_group_id]);
    if (!sellers.length || sellers.length > 99 || sellers.some(seller => !roles.has(seller.role)))
      throw problem('Review the saved In-House commission recipients before removing holds.');
    validateExactBulkRecipients({ profitId, sellers, entries: req.body?.recipients });

    const held = [];
    for (const seller of sellers) {
      const [[parent]] = await connection.query(`SELECT lot_project_commission_id FROM lot_project_commissions
        WHERE lot_project_commission_id=? AND lot_project_id=? LIMIT 1 FOR UPDATE`, [seller.commissionId, project.lot_project_id]);
      if (!parent) throw problem('Seller commissions changed. Refresh and review the recipients.');
      const loaded = await loadLiveSellerReleaseForBatch(connection, {
        stage, commissionId: seller.commissionId, accountId: profit.lot_project_account_id, projectId: project.lot_project_id,
      });
      if (!loaded) throw problem('A recipient is missing this milestone. Refresh the record.');
      if (loaded.paymentPercent < 100 || !loaded.paymentComplete || !loaded.documentsComplete)
        throw problem('Unhold All requires 100% payment and all required documents to be complete.');
      if (!['On Hold', 'Eligible', 'Released'].includes(loaded.computedStatus))
        throw problem('A recipient milestone is unavailable. Refresh the record.');
      if (loaded.computedStatus !== 'On Hold') continue;
      if (Number(loaded.release.external_receipt_hold_source_release_id || 0))
        throw problem('Resolve the required agent receipt before removing this hold.');
      await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: 'lot_project_commission', entityId: seller.commissionId });
      held.push({ seller, release: loaded.release });
    }
    if (company.release_status === 'On Hold')
      await assertEntityNotReviewLocked(connection, { actor: req.authUser, entityType: 'lot_project_network_profit_release', entityId: company.id });

    const batchId = randomUUID();
    const unheld = [];
    for (const { seller, release } of held) {
      const releaseId = Number(release.lot_project_commission_release_id);
      const beforeSnapshot = {
        projectSlug, commissionId: seller.commissionId, releaseId, releaseStage: stage,
        listingId: release.lot_project_listing_id, unitId: profit.unit, buyerName: release.buyer_full_name,
        status: release.release_status, actualReleaseDate: release.actual_release_date || null,
        releasedByUserId: release.released_by_user_id || null, releaseEntryMode: release.release_entry_mode || 'live', batchId,
      };
      const [changed] = await connection.query(`UPDATE lot_project_commission_releases SET release_status='Eligible'
        WHERE lot_project_commission_release_id=? AND lot_project_commission_id=? AND release_status=?`,
      [releaseId, seller.commissionId, beforeSnapshot.status]);
      if (changed.affectedRows !== 1) throw problem('Commission status changed. Refresh and review the milestone.');
      await writeAuditLog(connection, req, {
        action: 'update', module: 'Commissions', entityType: 'lot_project_commission', entityId: String(seller.commissionId),
        entityLabel: `${profit.unit} · ${stage}`, title: 'Removed commission hold (batch)',
        description: `Removed the ${stage} hold after full payment and required document completion.`,
        metadata: { batchId, projectId: project.lot_project_id, accountId: profit.lot_project_account_id, releaseId, stage },
      });
      await createOperationalReview(connection, {
        actor: req.authUser, actionKey: 'commission.unhold', department: 'accounting', projectId: project.lot_project_id,
        entityType: 'lot_project_commission', entityId: seller.commissionId, entityLabel: `${profit.unit} · ${stage}`,
        beforeSnapshot, afterSnapshot: { ...beforeSnapshot, status: 'Eligible' },
      });
      await finishBatchSellerRelease(connection, release, seller.commissionId, project.lot_project_id);
      unheld.push({ type: 'seller', commissionId: seller.commissionId, releaseId });
    }
    if (company.release_status === 'On Hold') {
      const [changed] = await connection.query(`UPDATE lot_project_network_profit_releases SET release_status='Pending'
        WHERE id=? AND profit_account_id=? AND release_status='On Hold'`, [company.id, profitId]);
      if (changed.affectedRows !== 1) throw problem('Company Profit status changed. Refresh the milestone.');
      const beforeSnapshot = { status: 'On Hold', unitCode: profit.unit, network: profit.network_name_snapshot,
        payee: profit.payee_name_snapshot, amount: Number(company.release_amount), stage, batchId };
      await createOperationalReview(connection, {
        actor: req.authUser, actionKey: 'commission.unhold', department: 'accounting', projectId: project.lot_project_id,
        entityType: 'lot_project_network_profit_release', entityId: company.id,
        entityLabel: `${profit.unit} · Company Profit · ${stage}`,
        beforeSnapshot, afterSnapshot: { ...beforeSnapshot, status: 'Pending' },
      });
      unheld.push({ type: 'company', profitId, releaseId: Number(company.id) });
    }
    if (unheld.length) await writeAuditLog(connection, req, {
      action: 'update', module: 'Commissions', entityType: 'lot_project_network_profit_account', entityId: String(profitId),
      entityLabel: `${profit.unit} · ${stage}`, title: 'Unhold All — In-House commissions',
      description: `Removed ${unheld.length} milestone hold(s) after full payment and document completion.`,
      metadata: { batchId, projectId: project.lot_project_id, accountId: profit.lot_project_account_id, stage, recipients: unheld },
    });
    await connection.commit(); transaction = false;
    return res.json({ success: true, alreadyApplied: !unheld.length,
      message: unheld.length ? `${stage}: removed ${unheld.length} hold(s). No payments were released.` : `${stage} has no remaining holds.`,
      data: { batchId, stage, unheld } });
  } catch (error) {
    if (transaction) try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error) });
  } finally { connection.release(); }
};
