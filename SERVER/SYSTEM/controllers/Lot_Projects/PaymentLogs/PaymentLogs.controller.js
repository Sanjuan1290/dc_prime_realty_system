import { displayBusinessInstant } from '../../../utils/businessDateTime.js';
import { PERMISSIONS, roleHasPermission } from '../../../config/permissions.js';
import { resolveAuditCategory, mapSellerReleaseAuditRow, mapCompanyProfitAuditRow, combineProjectPaymentAudit } from '../../../services/projectPaymentAuditEvents.js';
import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getUserFullName,
} from '../_shared/lotProject.shared.js';

const toNumber = (value) => Number(value || 0);
const dateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};
const dateTimeText = (value) => displayBusinessInstant(value);
const isDateOnly = (value = '') => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());

const titleCase = (value = '') =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getLotProjectPaymentLogs = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const search = String(req.query.search || '').trim();
    const action = String(req.query.action || 'all').trim();
    const category = resolveAuditCategory(String(req.query.category || 'all').trim());
    const canViewCommissionReleases = roleHasPermission(req.authUser, PERMISSIONS.LOT_COMMISSIONS_VIEW);
    if (!canViewCommissionReleases && ['seller_commission', 'company_profit'].includes(category)) {
      return res.status(403).json({ success: false, message: 'Commission viewing permission is required for payout history.' });
    }
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    const requiredTables = ['lot_project_payment_logs', 'lot_project_payments', 'lot_project_listings'];
    for (const tableName of requiredTables) {
      if (!(await tableExists(connection, tableName))) {
        return res.status(500).json({ success: false, message: `${tableName} table does not exist.` });
      }
    }

    const includePayments = category === 'all' || category === 'buyer_payment';
    const includeSeller = canViewCommissionReleases && (category === 'all' || category === 'seller_commission') && (action === 'all' || action === 'released');
    const includeCompany = canViewCommissionReleases && (category === 'all' || category === 'company_profit') && (action === 'all' || action === 'released');
    const where = ['p.lot_project_id = ?'];
    const params = [project.lot_project_id];

    if (action !== 'all') {
      where.push('pl.action_type = ?');
      params.push(action);
    }

    if (dateFrom && isDateOnly(dateFrom)) {
      where.push('pl.action_at >= ?');
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo && isDateOnly(dateTo)) {
      where.push('pl.action_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(`${dateTo} 00:00:00`);
    }

    if (search) {
      where.push(`(
        l.lot_project_listing_unit_id LIKE ?
        OR cp.buyer_full_name LIKE ?
        OR account.account_reference LIKE ?
        OR p.lot_project_payment_reference_id LIKE ?
        OR pl.action_description LIKE ?
        OR CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const [rows] = includePayments && action !== 'released' ? await connection.query(
      `
        SELECT
          pl.lot_project_payment_log_id,
          pl.action_type,
          pl.action_description,
          pl.action_at,
          p.lot_project_payment_id,
          p.lot_project_payment_type,
          p.lot_project_payment_method,
          p.lot_project_payment_amount,
          p.lot_project_payment_date,
          p.lot_project_payment_reference_id,
          p.lot_project_payment_status,
          l.lot_project_listing_unit_id,
          cp.buyer_full_name,
          account.account_reference,
          account.account_status,
          lp.lot_project_name,
          u.first_name,
          u.middle_name,
          u.last_name,
          u.email
        FROM lot_project_payment_logs pl
        INNER JOIN lot_project_payments p
          ON p.lot_project_payment_id = pl.lot_project_payment_id
        INNER JOIN lot_project_listings l
          ON l.lot_project_listing_id = p.lot_project_listing_id
        INNER JOIN lot_projects lp
          ON lp.lot_project_id = p.lot_project_id
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = p.lot_project_client_profile_id
        LEFT JOIN lot_project_accounts account
          ON account.lot_project_account_id = p.lot_project_account_id
        LEFT JOIN users u
          ON u.id = pl.action_by_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY pl.action_at DESC, pl.lot_project_payment_log_id DESC
        LIMIT 300
      `,
      params
    ) : [[]];

    const paymentLogs = rows.map((row) => ({
      id: `buyer-payment-${row.lot_project_payment_log_id}`,
      category: 'buyer_payment',
      direction: ['created', 'verified'].includes(row.action_type) ? 'incoming' : 'payment_activity',
      payee: '-',
      paymentId: row.lot_project_payment_id,
      action: row.action_type,
      actionLabel: titleCase(row.action_type),
      actionDescription: row.action_description || '-',
      actionAt: row.action_at,
      actionAtText: dateTimeText(row.action_at),
      project: row.lot_project_name || project.lot_project_name,
      unit: row.lot_project_listing_unit_id || '-',
      buyer: row.buyer_full_name || 'No buyer name',
      accountReference: row.account_reference || '-',
      accountStatus: row.account_status || '-',
      amount: toNumber(row.lot_project_payment_amount),
      paymentType: titleCase(row.lot_project_payment_type),
      paymentMethod: row.lot_project_payment_method || '-',
      paymentDate: dateOnly(row.lot_project_payment_date),
      referenceId: row.lot_project_payment_reference_id || '-',
      paymentStatus: row.lot_project_payment_status || '-',
      encodedBy: getUserFullName(row),
    }));

    const projectName = project.lot_project_name;
    const buildReleaseWhere = (timestampColumn, additionalSearch) => {
      const clauses = [];
      const values = [];
      if (dateFrom && isDateOnly(dateFrom)) {
        clauses.push(`${timestampColumn} >= ?`);
        values.push(`${dateFrom} 00:00:00`);
      }
      if (dateTo && isDateOnly(dateTo)) {
        clauses.push(`${timestampColumn} < DATE_ADD(?, INTERVAL 1 DAY)`);
        values.push(`${dateTo} 00:00:00`);
      }
      if (search) {
        clauses.push(`(${additionalSearch.map((column) => `${column} LIKE ?`).join(' OR ')})`);
        values.push(...additionalSearch.map(() => `%${search}%`));
      }
      return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values };
    };
    let sellerLogs = [];
    let companyLogs = [];
    const unavailableCategories = [];

    if (includeSeller) {
      if (!(await tableExists(connection, 'lot_project_commission_releases'))) {
        unavailableCategories.push('Seller Commission Releases');
      } else {
        const hasReceipts = (await tableExists(connection, 'lot_project_commission_receipt_items'))
          && (await tableExists(connection, 'lot_project_commission_receipts'));
        const recordedTime = 'COALESCE(r.release_recorded_at, CAST(r.actual_release_date AS DATETIME))';
        const filters = buildReleaseWhere(recordedTime, [
          'l.lot_project_listing_unit_id', 'cp.buyer_full_name', 'account.buyer_name_snapshot',
          'account.account_reference', 'c.seller_display_name_snapshot', 'c.seller_group_name_snapshot',
          "CONCAT_WS(' ', su.first_name, su.middle_name, su.last_name)",
          "CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)",
          ...(hasReceipts ? ['receipt.reference_number'] : []),
        ]);
        const receiptSelect = hasReceipts ? 'receipt.reference_number AS receipt_reference' : 'NULL AS receipt_reference';
        const receiptJoins = hasReceipts ? `
          LEFT JOIN lot_project_commission_receipt_items ri ON ri.lot_project_commission_release_id = r.lot_project_commission_release_id
          LEFT JOIN lot_project_commission_receipts receipt ON receipt.lot_project_commission_receipt_id = ri.lot_project_commission_receipt_id AND receipt.receipt_status = 'active'` : '';
        const [releaseRows] = await connection.query(`
          SELECT r.lot_project_commission_release_id AS release_id, r.release_stage, r.release_entry_mode,
            r.net_release_amount, r.actual_release_date, r.release_recorded_at AS recorded_at, ${recordedTime} AS action_at,
            c.commission_role, c.seller_display_name_snapshot, c.seller_group_name_snapshot,
            l.lot_project_listing_unit_id AS unit,
            account.account_reference, account.account_status,
            COALESCE(cp.buyer_full_name, account.buyer_name_snapshot) AS buyer,
            CONCAT_WS(' ', su.first_name, su.middle_name, su.last_name) AS seller_name,
            u.first_name, u.middle_name, u.last_name, u.email,
            ${receiptSelect}
          FROM lot_project_commission_releases r
          JOIN lot_project_commissions c ON c.lot_project_commission_id = r.lot_project_commission_id
          JOIN lot_project_listings l ON l.lot_project_listing_id = c.lot_project_listing_id
          LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = c.lot_project_account_id
          LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
          LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = c.accredited_seller_id
          LEFT JOIN users su ON su.id = seller.user_id
          LEFT JOIN users u ON u.id = r.released_by_user_id
          ${receiptJoins}
          WHERE c.lot_project_id = ? AND r.release_status = 'Released'${filters.sql}
          ORDER BY ${recordedTime} DESC, r.lot_project_commission_release_id DESC LIMIT 300
        `, [project.lot_project_id, ...filters.values]);
        sellerLogs = releaseRows.map((row) => mapSellerReleaseAuditRow(row, projectName, dateTimeText));
      }
      // A finalized cancellation may archive and remove the original commission
      // records. Restore their audit visibility from immutable cancellation snapshots,
      // without double-counting releases that are still in the active table.
      if ((await tableExists(connection, 'lot_project_commission_releases'))
        && (await tableExists(connection, 'lot_project_archived_commission_releases'))) {
        const archiveTime = 'COALESCE(ar.release_recorded_at, CAST(ar.actual_release_date AS DATETIME))';
        const archivedFilters = buildReleaseWhere(archiveTime, [
          'ar.unit_id_snapshot', 'ar.buyer_name_snapshot', 'account.account_reference',
          "CONCAT_WS(' ', su.first_name, su.middle_name, su.last_name)",
          'ar.receipt_reference_number',
        ]);
        const [archiveRows] = await connection.query(`
          SELECT ar.source_commission_release_id AS release_id, ar.release_stage, ar.release_entry_mode,
            ar.net_release_amount, ar.actual_release_date, ar.release_recorded_at AS recorded_at,
            ${archiveTime} AS action_at, ar.commission_role, ar.receipt_reference_number AS receipt_reference,
            NULL AS seller_display_name_snapshot, NULL AS seller_group_name_snapshot,
            ar.unit_id_snapshot AS unit, ar.buyer_name_snapshot AS buyer,
            account.account_reference, account.account_status,
            CONCAT_WS(' ', su.first_name, su.middle_name, su.last_name) AS seller_name,
            NULL AS first_name, NULL AS middle_name, NULL AS last_name, NULL AS email,
            1 AS archived
          FROM lot_project_archived_commission_releases ar
          LEFT JOIN lot_project_accounts account ON account.lot_project_account_id = ar.lot_project_account_id
          LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = ar.accredited_seller_id
          LEFT JOIN users su ON su.id = seller.user_id
          WHERE ar.lot_project_id = ?
            AND NOT EXISTS (
              SELECT 1 FROM lot_project_commission_releases active_release
              WHERE active_release.lot_project_commission_release_id = ar.source_commission_release_id
            )${archivedFilters.sql}
          ORDER BY ${archiveTime} DESC, ar.source_commission_release_id DESC LIMIT 300
        `, [project.lot_project_id, ...archivedFilters.values]);
        sellerLogs.push(...archiveRows.map((row) => mapSellerReleaseAuditRow(row, projectName, dateTimeText)));
      }
    }

    if (includeCompany) {
      if (!(await tableExists(connection, 'lot_project_network_profit_releases'))
        || !(await tableExists(connection, 'lot_project_network_profit_accounts'))) {
        unavailableCategories.push('Network Company Profit Releases');
      } else {
        const recordedTime = 'COALESCE(r.release_recorded_at, CAST(r.actual_release_date AS DATETIME))';
        const filters = buildReleaseWhere(recordedTime, [
          'l.lot_project_listing_unit_id', 'cp.buyer_full_name', 'account.buyer_name_snapshot',
          'account.account_reference', 'p.network_name_snapshot', 'p.payee_name_snapshot',
          'r.payee_name', 'r.payment_reference',
          "CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)",
        ]);
        const [profitRows] = await connection.query(`
          SELECT r.id AS release_id, r.release_stage, r.release_amount,
            r.actual_release_date, r.release_recorded_at AS recorded_at, r.payee_name, r.payment_method, r.payment_reference,
            ${recordedTime} AS action_at,
            p.network_name_snapshot, p.payee_name_snapshot,
            l.lot_project_listing_unit_id AS unit,
            account.account_reference, account.account_status,
            COALESCE(cp.buyer_full_name, account.buyer_name_snapshot) AS buyer,
            u.first_name, u.middle_name, u.last_name, u.email
          FROM lot_project_network_profit_releases r
          JOIN lot_project_network_profit_accounts p ON p.id = r.profit_account_id
          JOIN lot_project_listings l ON l.lot_project_listing_id = p.lot_project_listing_id
          JOIN lot_project_accounts account ON account.lot_project_account_id = p.lot_project_account_id
          LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
          LEFT JOIN users u ON u.id = r.released_by_user_id
          WHERE p.lot_project_id = ? AND r.release_status = 'Released'${filters.sql}
          ORDER BY ${recordedTime} DESC, r.id DESC LIMIT 300
        `, [project.lot_project_id, ...filters.values]);
        companyLogs = profitRows.map((row) => mapCompanyProfitAuditRow(row, projectName, dateTimeText));
      }
    }

    const { entries: logs, stats } = combineProjectPaymentAudit(paymentLogs, sellerLogs, companyLogs);

    return res.json({
      success: true,
      data: logs,
      stats,
      unavailableCategories,
      canViewCommissionReleases,
      project: {
        ...project,
        id: project.lot_project_id,
        name: project.lot_project_name,
        slug: project.lot_project_slug,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};





