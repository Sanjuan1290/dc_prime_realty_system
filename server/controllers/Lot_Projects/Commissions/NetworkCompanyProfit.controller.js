import { makeCommissionCashReference } from '../../../services/commissionCashReference.js';
import {
  db, getProjectBySlug, getAuthenticatedUser, tableExists, todayDateOnly, getErrorMessage,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { createOperationalReview } from '../../../services/operationalReview.service.js';
import { validateReleaseReceiptDetails } from '../../../services/releaseReceiptDetails.js';
import { roundProfitMoney } from '../../../services/networkCompanyProfitTerms.js';
import { getNetworkProfitReleaseCalendar } from '../../../services/networkProfitReleaseCalendar.js';
import { getUserProjectAccess } from '../../../services/projectAccess.service.js';

const clean = (value) => String(value ?? '').trim();
const validMethods = new Set(['cash', 'bank_transfer', 'check', 'other']);
const isCancelled = (status) => ['cancelled', 'pending_cancellation', 'deletion_pending'].includes(clean(status).toLowerCase());
const allowedSourceStages = new Set(['Eligible', 'Released']);

const selectProfitContext = async (connection, profitId, projectId, lock = false) => {
  const [rows] = await connection.query(`
    SELECT p.*, a.account_reference, a.account_status,
      l.lot_project_listing_unit_id AS unit, cp.buyer_full_name AS buyer,
      lp.lot_project_name AS project_name, lp.lot_project_storage_code,
      sg.seller_group_type, sg.seller_group_status
    FROM lot_project_network_profit_accounts p
    INNER JOIN lot_project_accounts a ON a.lot_project_account_id = p.lot_project_account_id
    INNER JOIN lot_project_listings l ON l.lot_project_listing_id = p.lot_project_listing_id
    INNER JOIN lot_projects lp ON lp.lot_project_id = p.lot_project_id
    LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id = a.lot_project_client_profile_id
    INNER JOIN seller_groups sg ON sg.seller_group_id = p.seller_group_id
    WHERE p.id = ? AND p.lot_project_id = ? LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`, [profitId, projectId]
  );
  return rows[0] || null;
};

const getStages = async (connection, profitId) => {
  const [rows] = await connection.query(`
    SELECT pr.*,
      (SELECT cr.release_status
       FROM lot_project_commission_releases cr
       JOIN lot_project_commissions c ON c.lot_project_commission_id = cr.lot_project_commission_id
       JOIN lot_project_network_profit_accounts profit ON profit.lot_project_account_id = c.lot_project_account_id
       JOIN accredited_sellers seller ON seller.accredited_seller_id = c.accredited_seller_id
       WHERE profit.id = pr.profit_account_id
         AND seller.seller_group_id = profit.seller_group_id
         AND cr.release_stage = pr.release_stage
       ORDER BY c.lot_project_commission_id ASC LIMIT 1) AS source_stage_status
    FROM lot_project_network_profit_releases pr
    WHERE pr.profit_account_id = ?
    ORDER BY FIELD(pr.release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention')`, [profitId]
  );
  return rows.map((stage) => ({
    id: Number(stage.id),
    stage: stage.release_stage,
    triggerPercent: Number(stage.release_trigger_percent),
    releasePercent: Number(stage.release_percent),
    amount: Number(stage.release_amount),
    status: stage.release_status,
    sourceStageStatus: stage.source_stage_status || 'Pending',
    canRelease: stage.release_status === 'Pending' && allowedSourceStages.has(stage.source_stage_status),
    actualReleaseDate: stage.actual_release_date,
    payeeName: stage.payee_name,
    paymentMethod: stage.payment_method,
    paymentReference: stage.payment_reference,
    bankName: stage.bank_name, accountNumber: stage.account_number,
    receiptDate: stage.receipt_date, witnessName: stage.witness_name,
    recordedAt: stage.release_recorded_at,
  }));
};

const mappedProfit = async (connection, profit, releaseDateInfo = null) => {
  const stages = await getStages(connection, profit.id);
  const released = roundProfitMoney(stages.filter((s) => s.status === 'Released').reduce((sum, s) => sum + s.amount, 0));
  return {
    id: Number(profit.id), accountId: Number(profit.lot_project_account_id),
    projectId: Number(profit.lot_project_id), networkId: Number(profit.seller_group_id),
    network: profit.network_name_snapshot, broker: profit.broker_name_snapshot,
    payee: profit.payee_name_snapshot, unit: profit.unit, buyer: profit.buyer,
    project: profit.project_name, accountReference: profit.account_reference,
    accountStatus: profit.account_status,
    companyProfitRate: Number(profit.company_profit_rate_snapshot),
    commissionBase: Number(profit.commission_base_snapshot),
    totalProfit: Number(profit.gross_profit_snapshot),
    released, remaining: roundProfitMoney(profit.gross_profit_snapshot - released),
    releaseDateInfo,
    stages: stages.map((stage) => ({
      ...stage,
      canRelease: stage.canRelease && Boolean(releaseDateInfo?.isReleaseDate) && !isCancelled(profit.account_status)
        && profit.seller_group_type === 'in_house' && profit.seller_group_status === 'active',
      awaitingReleaseDate: stage.canRelease && !releaseDateInfo?.isReleaseDate && !isCancelled(profit.account_status)
        && profit.seller_group_type === 'in_house' && profit.seller_group_status === 'active',
    })),
  };
};

const ensureTables = async (connection, res) => {
  if (await tableExists(connection, 'lot_project_network_profit_releases')) return true;
  res.status(503).json({ success: false, code: 'NETWORK_PROFIT_MIGRATION_REQUIRED', message: 'Apply the Network Company Profit migration before using releases.' });
  return false;
};

export const getNetworkCompanyProfit = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug));
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    if (!(await ensureTables(connection, res))) return;
    const [rows] = await connection.query(`SELECT p.id FROM lot_project_network_profit_accounts p
      WHERE p.lot_project_id = ? ORDER BY p.id DESC`, [project.lot_project_id]);
    const [[releaseSettings]] = await connection.query(`SELECT release_day_one, release_day_two FROM lot_project_settings WHERE lot_project_id = ? LIMIT 1`, [project.lot_project_id]);
    const releaseDateInfo = getNetworkProfitReleaseCalendar(todayDateOnly(), releaseSettings || {});
    const data = [];
    for (const row of rows) {
      const profit = await selectProfitContext(connection, row.id, project.lot_project_id);
      if (profit) data.push(await mappedProfit(connection, profit, releaseDateInfo));
    }
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const releaseNetworkCompanyProfit = async (req, res) => {
  const connection = await db.getConnection();
  let inTransaction = false;
  try {
    const actor = await getAuthenticatedUser(req);
    if (!actor) return res.status(401).json({ success: false, message: 'Please sign in.' });
    const project = await getProjectBySlug(clean(req.params.projectSlug));
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    if (!(await ensureTables(connection, res))) return;
    const profitId = Number(req.params.profitId);
    const releaseId = Number(req.params.releaseId);
    const method = clean(req.body?.paymentMethod).toLowerCase();
    const suppliedReference = clean(req.body?.paymentReference);
    const date = todayDateOnly();
    const receiptDetails = validateReleaseReceiptDetails(req.body?.receiptDetails, date, date, method);
    if (!Number.isSafeInteger(profitId) || profitId <= 0 || !Number.isSafeInteger(releaseId) || releaseId <= 0) {
      return res.status(400).json({ success: false, message: 'Select a valid Company Profit release.' });
    }
    if (!validMethods.has(method) || (method !== 'cash' && (!suppliedReference || suppliedReference.length > 120))) {
      return res.status(400).json({ success: false, message: 'Choose a payment method and enter its reference (up to 120 characters).' });
    }
    for (const column of ['bank_name', 'account_number', 'receipt_date', 'witness_name']) {
      const [[columnRow]] = await connection.query(`SELECT COUNT(*) AS n FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'lot_project_network_profit_releases' AND column_name = ?`, [column]);
      if (!Number(columnRow?.n)) return res.status(503).json({ success: false, code: 'PROFIT_RECEIPT_MIGRATION_REQUIRED',
        message: 'Apply the Company Profit receipt details migration before releasing this milestone.' });
    }
    if (method !== 'cash' && suppliedReference !== receiptDetails.referenceNumber) return res.status(400).json({ success: false, message: 'The payment reference must match the receipt reference.' });
    await connection.beginTransaction();
    inTransaction = true;
    const profit = await selectProfitContext(connection, profitId, project.lot_project_id, true);
    if (!profit) {
      await connection.rollback(); inTransaction = false;
      return res.status(404).json({ success: false, message: 'Company Profit record not found.' });
    }
    if (profit.seller_group_type !== 'in_house' || profit.seller_group_status !== 'active' || isCancelled(profit.account_status)) {
      await connection.rollback(); inTransaction = false;
      return res.status(409).json({ success: false, message: 'This Network or buyer account is not eligible for a Company Profit release.' });
    }
    const [releaseRows] = await connection.query(`SELECT * FROM lot_project_network_profit_releases
      WHERE id = ? AND profit_account_id = ? LIMIT 1 FOR UPDATE`, [releaseId, profitId]);
    const release = releaseRows[0];
    if (!release || release.release_status !== 'Pending') {
      await connection.rollback(); inTransaction = false;
      return res.status(409).json({ success: false, message: 'This stage is already released, held, or unavailable. Refresh the record.' });
    }
    const reference = method === 'cash'
      ? makeCommissionCashReference({ date, unitCode: profit.unit, id: releaseId, kind: 'company' })
      : suppliedReference;
    // Recheck source commission eligibility inside the same transaction, not just in the UI.
    const [[source]] = await connection.query(`SELECT cr.release_status
      FROM lot_project_commission_releases cr
      JOIN lot_project_commissions c ON c.lot_project_commission_id = cr.lot_project_commission_id
      JOIN accredited_sellers seller ON seller.accredited_seller_id = c.accredited_seller_id
      WHERE c.lot_project_account_id = ? AND seller.seller_group_id = ?
        AND cr.release_stage = ?
      ORDER BY c.lot_project_commission_id ASC LIMIT 1 FOR UPDATE`,
      [profit.lot_project_account_id, profit.seller_group_id, release.release_stage]);
    if (!allowedSourceStages.has(source?.release_status)) {
      await connection.rollback(); inTransaction = false;
      return res.status(409).json({ success: false, message: 'The corresponding commission milestone is not eligible yet. Refresh the commission progress.' });
    }
    // The same configured live-release-day restriction as personal commissions.
    const [[settings]] = await connection.query(`SELECT release_day_one, release_day_two
      FROM lot_project_settings WHERE lot_project_id = ? LIMIT 1`, [project.lot_project_id]);
    const releaseCalendar = getNetworkProfitReleaseCalendar(date, settings || {});
    if (!releaseCalendar.isReleaseDate) {
      await connection.rollback(); inTransaction = false;
      return res.status(409).json({ success: false, message: `Today is not a scheduled commission release day for this project. Next release date: ${releaseCalendar.nextReleaseDate}.` });
    }
    const [updated] = await connection.query(`UPDATE lot_project_network_profit_releases
      SET release_status = 'Released', actual_release_date = ?, released_by_user_id = ?,
        payee_name = ?, payment_method = ?, payment_reference = ?,
        bank_name = ?, account_number = ?, receipt_date = ?, witness_name = ?, release_recorded_at = NOW()
      WHERE id = ? AND profit_account_id = ? AND release_status = 'Pending'`,
      [date, actor.id, profit.payee_name_snapshot, method, reference,
        receiptDetails.bankName, receiptDetails.accountNumber, receiptDetails.receiptDate,
        receiptDetails.witnessName, releaseId, profitId]);
    if (updated.affectedRows !== 1) throw Object.assign(new Error('This release was already processed.'), { statusCode: 409 });
    await writeAuditLog(connection, req, {
      action: 'release', module: 'Commissions', entityType: 'lot_project_network_profit_release', entityId: String(releaseId),
      entityLabel: `${profit.unit} · ${profit.network_name_snapshot} · ${release.release_stage}`,
      title: 'Released Network Company Profit',
      description: `Released ${release.release_stage} Company Profit to ${profit.payee_name_snapshot}.`,
      metadata: { projectId: project.lot_project_id, accountId: profit.lot_project_account_id,
        profitId, releaseId, releaseStage: release.release_stage, amount: Number(release.release_amount),
        payee: profit.payee_name_snapshot, paymentMethod: method, paymentReference: reference,
        receiptDate: receiptDetails.receiptDate, actualReleaseDate: date },
    });
    await createOperationalReview(connection, {
      actor: req.authUser, actionKey: 'commission.release', department: 'accounting',
      projectId: project.lot_project_id, entityType: 'lot_project_network_profit_release', entityId: releaseId,
      entityLabel: `${profit.unit} — Network Company Profit ${release.release_stage}`,
      beforeSnapshot: { status: 'Pending', unitCode: profit.unit, network: profit.network_name_snapshot,
        payee: profit.payee_name_snapshot, amount: Number(release.release_amount), stage: release.release_stage },
      afterSnapshot: { status: 'Released', unitCode: profit.unit, network: profit.network_name_snapshot,
        payee: profit.payee_name_snapshot, amount: Number(release.release_amount), stage: release.release_stage,
        releaseDate: date, paymentMethod: method, paymentReference: reference, receiptDate: receiptDetails.receiptDate },
    });
    await connection.commit(); inTransaction = false;
    return res.json({ success: true, message: `${release.release_stage} Company Profit released successfully.`,
      data: await mappedProfit(connection, profit, releaseCalendar) });
  } catch (error) {
    if (inTransaction) try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error) });
  } finally { connection.release(); }
};

// Accredited Sellers > Proof of Income > Network Company Profit category.
// This is an acknowledgment library, NOT a seller's personal earnings report.
export const getNetworkCompanyProfitAcknowledgments = async (req, res) => {
  const connection = await db.getConnection();
  try {
    if (!(await ensureTables(connection, res))) return;
    const access = await getUserProjectAccess(req.authUser, connection);
    if (!access.allProjects && access.projectIds.length === 0) return res.json({ success: true, data: [] });
    const projectFilter = access.allProjects ? '' : ` AND p.lot_project_id IN (${access.projectIds.map(() => '?').join(', ')})`;
    const [rows] = await connection.query(`
      SELECT p.id AS profit_id, p.lot_project_account_id, p.lot_project_id, p.seller_group_id,
        p.network_name_snapshot, p.broker_name_snapshot, p.payee_name_snapshot,
        p.commission_base_snapshot, p.company_profit_rate_snapshot, p.gross_profit_snapshot,
        lp.lot_project_name AS project_name, lp.lot_project_slug,
        l.lot_project_listing_unit_id AS unit, a.account_reference,
        COALESCE(cp.buyer_full_name, a.buyer_name_snapshot) AS buyer,
        r.id AS release_id, r.release_stage, r.release_percent, r.release_amount,
        r.actual_release_date, r.payee_name, r.payment_method, r.payment_reference, r.release_recorded_at,
        r.bank_name, r.account_number, r.receipt_date, r.witness_name
      FROM lot_project_network_profit_releases r
      JOIN lot_project_network_profit_accounts p ON p.id = r.profit_account_id
      JOIN lot_projects lp ON lp.lot_project_id = p.lot_project_id
      JOIN lot_project_listings l ON l.lot_project_listing_id = p.lot_project_listing_id
      JOIN lot_project_accounts a ON a.lot_project_account_id = p.lot_project_account_id
      LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id = a.lot_project_client_profile_id
      WHERE r.release_status = 'Released'${projectFilter}
      ORDER BY r.release_recorded_at DESC, r.id DESC LIMIT 500
    `, access.allProjects ? [] : access.projectIds);
    return res.json({ success: true, data: rows.map((row) => ({
      profit: {
        id: Number(row.profit_id), accountId: Number(row.lot_project_account_id), projectId: Number(row.lot_project_id),
        sellerGroupId: Number(row.seller_group_id), projectSlug: row.lot_project_slug, network: row.network_name_snapshot, broker: row.broker_name_snapshot,
        payee: row.payee_name_snapshot, commissionBase: Number(row.commission_base_snapshot),
        companyProfitRate: Number(row.company_profit_rate_snapshot), totalProfit: Number(row.gross_profit_snapshot),
        project: row.project_name, unit: row.unit, accountReference: row.account_reference, buyer: row.buyer,
      },
      stage: { id: Number(row.release_id), stage: row.release_stage, status: 'Released',
        releasePercent: Number(row.release_percent), amount: Number(row.release_amount),
        bankName: row.bank_name, accountNumber: row.account_number,
        receiptDate: row.receipt_date, witnessName: row.witness_name,
        actualReleaseDate: row.actual_release_date, payeeName: row.payee_name,
        paymentMethod: row.payment_method, paymentReference: row.payment_reference },
    })) });
  } catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: getErrorMessage(error) }); }
  finally { connection.release(); }
};



