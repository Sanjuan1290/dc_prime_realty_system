import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getProjectCadastralLots,
  mapListingRow,
  formatDocumentsLabel,
  todayDateOnly,
} from '../_shared/lotProject.shared.js';

const toNumber = (value) => Number(value || 0);
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const buildProjectPayload = async (project) => {
  const cadastralLots = await getProjectCadastralLots(project.lot_project_id);
  const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id);

  return {
    ...project,
    id: project.lot_project_id,
    name: project.lot_project_name,
    location: project.lot_project_location,
    locationCode: project.lot_project_location_code,
    cadastralLots,
    defaultDocuments,
  };
};

const toDateOnly = (date) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value) => {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const shouldBackfillTrendBuckets = (dateRange = {}) => {
  if (dateRange.preset === 'all') return false;

  const fromDate = parseDateOnly(dateRange.from);
  const toDate = parseDateOnly(dateRange.to);
  if (!fromDate || !toDate) return false;

  const days = getDayDiff(fromDate, toDate);
  if (dateRange.groupBy === 'day') return days <= 45;
  return days <= 370;
};

const getDayDiff = (fromDate, toDate) => {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.max(Math.ceil(ms / (1000 * 60 * 60 * 24)), 0);
};

const resolveDashboardDateRange = (query = {}) => {
  const today = new Date();
  const preset = String(query.range || query.dateRange || '3_months').toLowerCase();

  let fromDate;
  let toDate = today;

  if (preset === 'custom') {
    fromDate = parseDateOnly(query.from || query.dateFrom) || startOfMonth(today);
    toDate = parseDateOnly(query.to || query.dateTo) || today;
    if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
  } else if (preset === 'this_month') {
    fromDate = startOfMonth(today);
    toDate = today;
  } else if (preset === 'last_month') {
    const lastMonth = addMonths(today, -1);
    fromDate = startOfMonth(lastMonth);
    toDate = endOfMonth(lastMonth);
  } else if (preset === '2_months') {
    fromDate = addDays(addMonths(today, -2), 1);
  } else if (preset === '6_months') {
    fromDate = addDays(addMonths(today, -6), 1);
  } else if (preset === '12_months') {
    fromDate = addDays(addMonths(today, -12), 1);
  } else if (preset === 'all') {
    fromDate = new Date(2000, 0, 1);
  } else {
    fromDate = addDays(addMonths(today, -3), 1);
  }

  const dayDiff = getDayDiff(fromDate, toDate);
  return {
    preset: preset === 'custom' ? 'custom' : (['this_month', 'last_month', '2_months', '3_months', '6_months', '12_months', 'all'].includes(preset) ? preset : '3_months'),
    from: toDateOnly(fromDate),
    to: toDateOnly(toDate),
    groupBy: dayDiff > 45 ? 'month' : 'day',
  };
};

const formatPeriodLabel = (period, groupBy) => {
  if (!period) return '-';
  const text = String(period);
  if (groupBy === 'month') {
    const [year, month] = text.split('-');
    const date = new Date(Number(year), Number(month || 1) - 1, 1);
    return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
  }

  const date = parseDateOnly(text);
  return date ? date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : text;
};

const addPeriod = (date, groupBy) => groupBy === 'month'
  ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
  : addDays(date, 1);

const normalizePeriod = (date, groupBy) => {
  if (groupBy === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return toDateOnly(date);
};

const makeEmptyTrendBuckets = (dateRange) => {
  const buckets = [];
  let current = parseDateOnly(dateRange.from);
  const end = parseDateOnly(dateRange.to);

  if (!current || !end) return buckets;
  if (dateRange.groupBy === 'month') current = startOfMonth(current);

  while (current <= end) {
    const period = normalizePeriod(current, dateRange.groupBy);
    buckets.push({ period, label: formatPeriodLabel(period, dateRange.groupBy) });
    current = addPeriod(current, dateRange.groupBy);
  }

  return buckets;
};

const mergeTrendRows = (dateRange, salesRows = [], collectionRows = []) => {
  const baseBuckets = shouldBackfillTrendBuckets(dateRange) ? makeEmptyTrendBuckets(dateRange) : [];

  const byPeriod = new Map(
    baseBuckets.map((bucket) => [
      bucket.period,
      {
        ...bucket,
        saleCount: 0,
        totalSales: 0,
        collectionCount: 0,
        collected: 0,
      },
    ])
  );

  for (const row of salesRows) {
    const period = String(row.period || '');
    const current = byPeriod.get(period) || {
      period,
      label: formatPeriodLabel(period, dateRange.groupBy),
      saleCount: 0,
      totalSales: 0,
      collectionCount: 0,
      collected: 0,
    };

    current.saleCount += toNumber(row.sale_count);
    current.totalSales += toNumber(row.total_sales);
    byPeriod.set(period, current);
  }

  for (const row of collectionRows) {
    const period = String(row.period || '');
    const current = byPeriod.get(period) || {
      period,
      label: formatPeriodLabel(period, dateRange.groupBy),
      saleCount: 0,
      totalSales: 0,
      collectionCount: 0,
      collected: 0,
    };

    current.collectionCount += toNumber(row.collection_count);
    current.collected += toNumber(row.collected_amount);
    byPeriod.set(period, current);
  }

  return [...byPeriod.values()]
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))
    .map((item) => ({
      ...item,
      totalSales: roundMoney(item.totalSales),
      collected: roundMoney(item.collected),
    }));
};

const mapBreakdownTrend = (rows = [], nameKey = 'name') => rows.map((row) => ({
  period: row.period,
  label: row.label,
  [nameKey]: row.name || '-',
  saleCount: toNumber(row.sale_count),
  salesAmount: roundMoney(row.sales_amount),
}));

const getPeriodSql = (column, groupBy) => groupBy === 'month'
  ? `DATE_FORMAT(${column}, '%Y-%m')`
  : `DATE(${column})`;

export const getLotProjectDashboard = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    const projectPayload = await buildProjectPayload(project);
    const hasListings = await tableExists(connection, 'lot_project_listings');
    const dateRange = resolveDashboardDateRange(req.query);

    const emptyStats = {
      totalUnits: 0,
      available: 0,
      hold: 0,
      soldActive: 0,
      fullyPaid: 0,
      pendingCancellation: 0,
      cancelled: 0,
      totalContractPrice: 0,
      totalSales: 0,
      totalCollected: 0,
      pendingSales: 0,
      outstandingBalance: 0,
      collectionProgress: 0,
      listedLotValue: 0,
      availableLotValue: 0,
      soldLotValue: 0,
      totalCommission: 0,
      grossCommission: 0,
      eligibleCommission: 0,
      releasedCommission: 0,
      cashAdvanceDeductions: 0,
      netRemainingCommission: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      upcomingDueAmount: 0,
    };

    if (!hasListings) {
      return res.json({
        success: true,
        data: {
          project: projectPayload,
          stats: emptyStats,
          dateRange,
          salesTrend: mergeTrendRows(dateRange),
          sellerSalesTrend: [],
          groupSalesTrend: [],
          upcomingDues: [],
          sellerPerformance: [],
          groupPerformance: [],
          recentUnits: [],
        },
      });
    }

    const hasPayments = await tableExists(connection, 'lot_project_payments');
    const hasSchedules = await tableExists(connection, 'lot_project_payment_schedules');
    const hasCommissions = await tableExists(connection, 'lot_project_commissions');
    const hasCommissionReleases = await tableExists(connection, 'lot_project_commission_releases');
    const hasClientProfiles = await tableExists(connection, 'lot_project_client_profiles');
    const hasListingDocuments = await tableExists(connection, 'lot_project_listing_documents');
    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');

    const paymentSummarySelect = hasPayments
      ? `COALESCE((
          SELECT SUM(p.lot_project_payment_amount)
          FROM lot_project_payments p
          WHERE p.lot_project_id = l.lot_project_id
            AND p.lot_project_listing_id = l.lot_project_listing_id
            AND p.lot_project_payment_status = 'Verified'
        ), 0)`
      : '0';

    const downpaymentDiscountCreditExpr = hasClientProfiles
      ? `CASE
          WHEN cp.lot_project_client_profile_id IS NOT NULL
            THEN ROUND(
              (l.lot_project_listing_tcp * (COALESCE(cp.soa_downpayment_percentage, 0) / 100))
              * (COALESCE(cp.soa_dp_discount_percentage, 0) / 100),
              2
            )
          ELSE 0
        END`
      : '0';

    const effectiveCollectedExpr = `CASE
      WHEN l.lot_project_listing_sold_substatus = 'fully_paid' THEN l.lot_project_listing_tcp
      ELSE LEAST(${paymentSummarySelect} + ${downpaymentDiscountCreditExpr}, l.lot_project_listing_tcp)
    END`;

    const releaseSummaryJoin = hasCommissionReleases
      ? `
        LEFT JOIN (
          SELECT
            lot_project_commission_id,
            COALESCE(SUM(CASE WHEN release_status = 'Eligible' THEN net_release_amount ELSE 0 END), 0) AS eligible_amount,
            COALESCE(SUM(CASE WHEN release_status = 'Released' THEN net_release_amount ELSE 0 END), 0) AS released_amount,
            COALESCE(SUM(deduction_amount), 0) AS deduction_amount
          FROM lot_project_commission_releases
          GROUP BY lot_project_commission_id
        ) release_summary ON release_summary.lot_project_commission_id = c.lot_project_commission_id
      `
      : '';

    const releaseEligibleExpr = hasCommissionReleases
      ? 'COALESCE(release_summary.eligible_amount, 0)'
      : `CASE WHEN c.commission_status = 'Eligible' THEN c.net_remaining_commission_amount ELSE 0 END`;
    const releaseReleasedExpr = hasCommissionReleases
      ? 'COALESCE(release_summary.released_amount, 0)'
      : 'c.released_commission_amount';
    const releaseDeductionExpr = '0';

    const [summaryRows] = await connection.query(
      `
        SELECT
          COUNT(*) AS totalUnits,
          SUM(lot_project_listing_status = 'available') AS available,
          SUM(lot_project_listing_status = 'hold') AS hold,
          SUM(lot_project_listing_status = 'sold' AND COALESCE(lot_project_listing_sold_substatus, 'active') = 'active') AS soldActive,
          SUM(lot_project_listing_status = 'sold' AND lot_project_listing_sold_substatus = 'fully_paid') AS fullyPaid,
          SUM(lot_project_listing_status = 'pending_for_cancellation') AS pendingCancellation,
          SUM(lot_project_listing_status = 'cancelled') AS cancelled,
          COALESCE(SUM(lot_project_listing_tcp), 0) AS totalContractPrice,
          COALESCE(SUM(CASE WHEN lot_project_listing_status <> 'cancelled' THEN lot_project_listing_tcp ELSE 0 END), 0) AS listedLotValue,
          COALESCE(SUM(CASE WHEN lot_project_listing_status IN ('available', 'hold') THEN lot_project_listing_tcp ELSE 0 END), 0) AS availableLotValue,
          COALESCE(SUM(CASE WHEN lot_project_listing_status = 'sold' THEN lot_project_listing_tcp ELSE 0 END), 0) AS soldLotValue
        FROM lot_project_listings
        WHERE lot_project_id = ?
      `,
      [project.lot_project_id]
    );

    const [moneyRows] = await connection.query(
      `
        SELECT
          COALESCE(SUM(l.lot_project_listing_tcp), 0) AS totalSales,
          COALESCE(SUM(${effectiveCollectedExpr}), 0) AS totalCollected,
          COALESCE(SUM(GREATEST(l.lot_project_listing_tcp - ${effectiveCollectedExpr}, 0)), 0) AS pendingSales
        FROM lot_project_listings l
        ${hasClientProfiles ? 'LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_listing_id = l.lot_project_listing_id' : ''}
        WHERE l.lot_project_id = ?
          AND l.lot_project_listing_status IN ('sold', 'pending_for_cancellation', 'cancelled')
      `,
      [project.lot_project_id]
    );

    const [commissionRows] = hasCommissions
      ? await connection.query(
          `
            SELECT
              COALESCE(SUM(c.gross_commission_amount), 0) AS totalCommission,
              COALESCE(SUM(${releaseEligibleExpr}), 0) AS eligibleCommission,
              COALESCE(SUM(${releaseReleasedExpr}), 0) AS releasedCommission,
              COALESCE(SUM(${releaseDeductionExpr}), 0) AS cashAdvanceDeductions,
              COALESCE(SUM(GREATEST(c.gross_commission_amount - ${releaseReleasedExpr} - ${releaseDeductionExpr}, 0)), 0) AS netRemainingCommission
            FROM lot_project_commissions c
            ${releaseSummaryJoin}
            WHERE c.lot_project_id = ?
          `,
          [project.lot_project_id]
        )
      : [[{
          totalCommission: 0,
          eligibleCommission: 0,
          releasedCommission: 0,
          cashAdvanceDeductions: 0,
          netRemainingCommission: 0,
        }]];

    const downpaymentRowSql = `(LOWER(s.description) LIKE '%downpayment%' OR LOWER(s.description) LIKE '%down payment%')`;
    const expectedDownpaymentGrossSql = `ROUND((l.lot_project_listing_tcp * (COALESCE(cp.soa_downpayment_percentage, 0) / 100)) / GREATEST(COALESCE(cp.soa_downpayment_terms, 0), 1), 2)`;
    const expectedDownpaymentDiscountSql = `ROUND(${expectedDownpaymentGrossSql} * (COALESCE(cp.soa_dp_discount_percentage, 0) / 100), 2)`;
    const expectedDownpaymentNetSql = `ROUND(${expectedDownpaymentGrossSql} - ${expectedDownpaymentDiscountSql}, 2)`;
    const dueDiscountExpr = `CASE
      WHEN ${downpaymentRowSql} AND COALESCE(cp.soa_dp_discount_percentage, 0) > 0
        THEN ${expectedDownpaymentDiscountSql}
      ELSE 0
    END`;
    const dueCashRequiredExpr = `CASE
      WHEN ${downpaymentRowSql} AND COALESCE(cp.soa_dp_discount_percentage, 0) > 0
        THEN CASE
          WHEN ABS(s.due_amount - ${expectedDownpaymentNetSql}) <= 0.05
            THEN s.due_amount + s.penalty_amount
          ELSE GREATEST(s.due_amount - ${dueDiscountExpr}, 0) + s.penalty_amount
        END
      ELSE s.due_amount + s.penalty_amount
    END`;
    const dueBalanceExpr = `GREATEST((${dueCashRequiredExpr}) - s.amount_paid, 0)`;

    const [scheduleRows] = hasSchedules
      ? await connection.query(
          `
            SELECT
              COALESCE(SUM(s.due_date < CURDATE() AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue') AND ${dueBalanceExpr} > 0), 0) AS overdueCount,
              COALESCE(SUM(s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue') AND ${dueBalanceExpr} > 0), 0) AS dueSoonCount,
              COALESCE(SUM(CASE
                WHEN s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                  AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue')
                  THEN ${dueBalanceExpr}
                ELSE 0
              END), 0) AS upcomingDueAmount
            FROM lot_project_payment_schedules s
            INNER JOIN lot_project_listings l
              ON l.lot_project_listing_id = s.lot_project_listing_id
            LEFT JOIN lot_project_client_profiles cp
              ON cp.lot_project_client_profile_id = s.lot_project_client_profile_id
            WHERE s.lot_project_id = ?
              AND s.due_date IS NOT NULL
          `,
          [project.lot_project_id]
        )
      : [[{ overdueCount: 0, dueSoonCount: 0, upcomingDueAmount: 0 }]];

    const [upcomingDueRows] = hasSchedules
      ? await connection.query(
          `
            SELECT
              s.lot_project_payment_schedule_id,
              s.due_date,
              s.description,
              s.due_amount,
              s.penalty_amount,
              s.amount_paid,
              ${dueDiscountExpr} AS discount_amount,
              ${dueBalanceExpr} AS balance_due,
              l.lot_project_listing_unit_id,
              cp.buyer_full_name
            FROM lot_project_payment_schedules s
            INNER JOIN lot_project_listings l
              ON l.lot_project_listing_id = s.lot_project_listing_id
            LEFT JOIN lot_project_client_profiles cp
              ON cp.lot_project_client_profile_id = s.lot_project_client_profile_id
            WHERE s.lot_project_id = ?
              AND s.due_date IS NOT NULL
              AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue')
              AND s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
              AND ${dueBalanceExpr} > 0
            ORDER BY s.due_date ASC, l.lot_project_listing_unit_id ASC, s.lot_project_payment_schedule_id ASC
            LIMIT 8
          `,
          [project.lot_project_id]
        )
      : [[]];

    const saleDateSelect = hasClientProfiles
      ? 'DATE(COALESCE(cp.lot_project_client_profile_created_at, l.lot_project_listing_updated_at))'
      : 'DATE(l.lot_project_listing_updated_at)';
    const saleClientJoin = hasClientProfiles
      ? 'LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_listing_id = l.lot_project_listing_id'
      : '';

    const [salesTrendRows] = await connection.query(
      `
        SELECT
          ${getPeriodSql('sale_date', dateRange.groupBy)} AS period,
          COUNT(*) AS sale_count,
          COALESCE(SUM(tcp), 0) AS total_sales
        FROM (
          SELECT
            l.lot_project_listing_id,
            l.lot_project_listing_tcp AS tcp,
            ${saleDateSelect} AS sale_date
          FROM lot_project_listings l
          ${saleClientJoin}
          WHERE l.lot_project_id = ?
            AND l.lot_project_listing_status IN ('sold', 'pending_for_cancellation', 'cancelled')
        ) sales_data
        WHERE sale_date BETWEEN ? AND ?
        GROUP BY period
        ORDER BY period ASC
      `,
      [project.lot_project_id, dateRange.from, dateRange.to]
    );

    const [collectionTrendRows] = hasPayments
      ? await connection.query(
          `
            SELECT
              ${getPeriodSql('lot_project_payment_date', dateRange.groupBy)} AS period,
              COUNT(*) AS collection_count,
              COALESCE(SUM(lot_project_payment_amount), 0) AS collected_amount
            FROM lot_project_payments
            WHERE lot_project_id = ?
              AND lot_project_payment_status = 'Verified'
              AND lot_project_payment_date BETWEEN ? AND ?
            GROUP BY period
            ORDER BY period ASC
          `,
          [project.lot_project_id, dateRange.from, dateRange.to]
        )
      : [[]];

    const sellerPerformanceQuery = hasCommissions
      ? `
        SELECT
          acs.accredited_seller_id,
          sg.seller_group_id,
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), 'Unassigned Seller') AS seller_name,
          u.role AS seller_role,
          COALESCE(sg.seller_group_name, 'No Group') AS seller_group_name,
          COUNT(DISTINCT c.lot_project_listing_id) AS unit_count,
          COALESCE(SUM(c.commission_base_amount), 0) AS sales_amount,
          COALESCE(SUM(c.gross_commission_amount), 0) AS gross_commission,
          COALESCE(SUM(${releaseEligibleExpr}), 0) AS eligible_commission,
          COALESCE(SUM(${releaseReleasedExpr}), 0) AS released_commission,
          COALESCE(SUM(${releaseDeductionExpr}), 0) AS deduction_amount,
          COALESCE(SUM(GREATEST(c.gross_commission_amount - ${releaseReleasedExpr} - ${releaseDeductionExpr}, 0)), 0) AS remaining_commission
        FROM lot_project_commissions c
        LEFT JOIN accredited_sellers acs
          ON acs.accredited_seller_id = c.accredited_seller_id
        LEFT JOIN users u
          ON u.id = acs.user_id
        LEFT JOIN seller_groups sg
          ON sg.seller_group_id = acs.seller_group_id
        ${releaseSummaryJoin}
        WHERE c.lot_project_id = ?
        GROUP BY acs.accredited_seller_id, sg.seller_group_id, u.first_name, u.middle_name, u.last_name, u.role, sg.seller_group_name
        ORDER BY sales_amount DESC, gross_commission DESC, seller_name ASC
        LIMIT 8
      `
      : '';

    const groupPerformanceQuery = hasCommissions
      ? `
        SELECT
          group_data.seller_group_id,
          group_data.seller_group_name,
          COUNT(*) AS unit_count,
          COALESCE(SUM(group_data.sales_amount), 0) AS sales_amount,
          COALESCE(SUM(group_data.gross_commission), 0) AS gross_commission,
          COALESCE(SUM(group_data.eligible_commission), 0) AS eligible_commission,
          COALESCE(SUM(group_data.released_commission), 0) AS released_commission,
          COALESCE(SUM(group_data.deduction_amount), 0) AS deduction_amount,
          COALESCE(SUM(group_data.remaining_commission), 0) AS remaining_commission
        FROM (
          SELECT
            COALESCE(sg.seller_group_id, 0) AS seller_group_id,
            COALESCE(sg.seller_group_name, 'No Group') AS seller_group_name,
            c.lot_project_listing_id,
            MAX(c.commission_base_amount) AS sales_amount,
            SUM(c.gross_commission_amount) AS gross_commission,
            SUM(${releaseEligibleExpr}) AS eligible_commission,
            SUM(${releaseReleasedExpr}) AS released_commission,
            SUM(${releaseDeductionExpr}) AS deduction_amount,
            SUM(GREATEST(c.gross_commission_amount - ${releaseReleasedExpr} - ${releaseDeductionExpr}, 0)) AS remaining_commission
          FROM lot_project_commissions c
          LEFT JOIN accredited_sellers acs
            ON acs.accredited_seller_id = c.accredited_seller_id
          LEFT JOIN seller_groups sg
            ON sg.seller_group_id = acs.seller_group_id
          ${releaseSummaryJoin}
          WHERE c.lot_project_id = ?
          GROUP BY COALESCE(sg.seller_group_id, 0), COALESCE(sg.seller_group_name, 'No Group'), c.lot_project_listing_id
        ) group_data
        GROUP BY group_data.seller_group_id, group_data.seller_group_name
        ORDER BY sales_amount DESC, gross_commission DESC, seller_group_name ASC
        LIMIT 8
      `
      : '';

    const [sellerRows] = hasCommissions
      ? await connection.query(sellerPerformanceQuery, [project.lot_project_id])
      : [[]];

    const [groupRows] = hasCommissions
      ? await connection.query(groupPerformanceQuery, [project.lot_project_id])
      : [[]];

    const [sellerTrendRows] = hasCommissions
      ? await connection.query(
          `
            SELECT
              ${getPeriodSql('DATE(c.created_at)', dateRange.groupBy)} AS period,
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), 'Unassigned Seller') AS name,
              COUNT(DISTINCT c.lot_project_listing_id) AS sale_count,
              COALESCE(SUM(c.commission_base_amount), 0) AS sales_amount
            FROM lot_project_commissions c
            LEFT JOIN accredited_sellers acs
              ON acs.accredited_seller_id = c.accredited_seller_id
            LEFT JOIN users u
              ON u.id = acs.user_id
            WHERE c.lot_project_id = ?
              AND DATE(c.created_at) BETWEEN ? AND ?
            GROUP BY period, c.accredited_seller_id, name
            ORDER BY period ASC, sales_amount DESC, name ASC
          `,
          [project.lot_project_id, dateRange.from, dateRange.to]
        )
      : [[]];

    const [groupTrendRows] = hasCommissions
      ? await connection.query(
          `
            SELECT
              group_rows.period,
              group_rows.name,
              COUNT(*) AS sale_count,
              COALESCE(SUM(group_rows.sales_amount), 0) AS sales_amount
            FROM (
              SELECT
                ${getPeriodSql('DATE(c.created_at)', dateRange.groupBy)} AS period,
                COALESCE(sg.seller_group_name, 'No Group') AS name,
                COALESCE(sg.seller_group_id, 0) AS seller_group_id,
                c.lot_project_listing_id,
                MAX(c.commission_base_amount) AS sales_amount
              FROM lot_project_commissions c
              LEFT JOIN accredited_sellers acs
                ON acs.accredited_seller_id = c.accredited_seller_id
              LEFT JOIN seller_groups sg
                ON sg.seller_group_id = acs.seller_group_id
              WHERE c.lot_project_id = ?
                AND DATE(c.created_at) BETWEEN ? AND ?
              GROUP BY period, COALESCE(sg.seller_group_id, 0), COALESCE(sg.seller_group_name, 'No Group'), c.lot_project_listing_id
            ) group_rows
            GROUP BY group_rows.period, group_rows.seller_group_id, group_rows.name
            ORDER BY group_rows.period ASC, sales_amount DESC, group_rows.name ASC
          `,
          [project.lot_project_id, dateRange.from, dateRange.to]
        )
      : [[]];

    const cadastralSelect = hasListingCadastralLinks
      ? `(
          SELECT GROUP_CONCAT(c.lot_project_cadastral_lot_number ORDER BY c.lot_project_cadastral_lot_number SEPARATOR ', ')
          FROM lot_project_listing_cadastral_lots lcl
          INNER JOIN lot_project_cadastral_lot_numbers c
            ON c.lot_project_cadastral_lot_number_id = lcl.lot_project_cadastral_lot_number_id
          WHERE lcl.lot_project_listing_id = l.lot_project_listing_id
        ) AS cadastral_lots,`
      : `NULL AS cadastral_lots,`;

    const clientJoin = hasClientProfiles
      ? `LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_listing_id = l.lot_project_listing_id`
      : `LEFT JOIN (SELECT NULL AS lot_project_listing_id, NULL AS buyer_full_name) cp ON 1 = 0`;

    const listingDocumentJoin = hasListingDocuments
      ? `
          LEFT JOIN (
            SELECT lot_project_listing_id, COUNT(*) AS listing_document_count
            FROM lot_project_listing_documents
            WHERE lot_project_listing_document_status = 'active'
            GROUP BY lot_project_listing_id
          ) ldoc ON ldoc.lot_project_listing_id = l.lot_project_listing_id
        `
      : `LEFT JOIN (SELECT NULL AS lot_project_listing_id, 0 AS listing_document_count) ldoc ON 1 = 0`;

    const scheduleBalanceJoin = hasSchedules
      ? `
          LEFT JOIN (
            SELECT
              s.lot_project_listing_id,
              COALESCE(SUM(GREATEST((CASE
                WHEN (LOWER(s.description) LIKE '%downpayment%' OR LOWER(s.description) LIKE '%down payment%')
                  AND COALESCE(cp2.soa_dp_discount_percentage, 0) > 0
                  THEN CASE
                    WHEN ABS(s.due_amount - ROUND(
                      ((l2.lot_project_listing_tcp * (COALESCE(cp2.soa_downpayment_percentage, 0) / 100)) / GREATEST(COALESCE(cp2.soa_downpayment_terms, 0), 1))
                      - (((l2.lot_project_listing_tcp * (COALESCE(cp2.soa_downpayment_percentage, 0) / 100)) / GREATEST(COALESCE(cp2.soa_downpayment_terms, 0), 1)) * (COALESCE(cp2.soa_dp_discount_percentage, 0) / 100)),
                      2
                    )) <= 0.05
                      THEN s.due_amount + s.penalty_amount
                    ELSE GREATEST(s.due_amount - ROUND(((l2.lot_project_listing_tcp * (COALESCE(cp2.soa_downpayment_percentage, 0) / 100)) / GREATEST(COALESCE(cp2.soa_downpayment_terms, 0), 1)) * (COALESCE(cp2.soa_dp_discount_percentage, 0) / 100), 2), 0) + s.penalty_amount
                  END
                ELSE s.due_amount + s.penalty_amount
              END) - s.amount_paid, 0)), 0) AS actual_remaining_balance
            FROM lot_project_payment_schedules s
            INNER JOIN lot_project_listings l2
              ON l2.lot_project_listing_id = s.lot_project_listing_id
            LEFT JOIN lot_project_client_profiles cp2
              ON cp2.lot_project_client_profile_id = s.lot_project_client_profile_id
            WHERE s.schedule_status <> 'Cancelled'
            GROUP BY s.lot_project_listing_id
          ) sbalance ON sbalance.lot_project_listing_id = l.lot_project_listing_id
        `
      : `LEFT JOIN (SELECT NULL AS lot_project_listing_id, NULL AS actual_remaining_balance) sbalance ON 1 = 0`;

    const [recentRows] = await connection.query(
      `
        SELECT
          l.*,
          ${cadastralSelect}
          cp.buyer_full_name,
          ${paymentSummarySelect} AS total_paid,
          ${effectiveCollectedExpr} AS effective_collected,
          sbalance.actual_remaining_balance,
          COALESCE(ldoc.listing_document_count, 0) AS listing_document_count,
          COALESCE(pdoc.project_default_document_count, 0) AS project_default_document_count,
          COALESCE(pdoc.project_required_document_count, 0) AS project_required_document_count
        FROM lot_project_listings l
        ${clientJoin}
        ${listingDocumentJoin}
        ${scheduleBalanceJoin}
        LEFT JOIN (
          SELECT
            lot_project_id,
            COUNT(*) AS project_default_document_count,
            SUM(lot_project_default_document_is_required = 1) AS project_required_document_count
          FROM lot_project_default_documents
          WHERE lot_project_default_document_status = 'active'
          GROUP BY lot_project_id
        ) pdoc ON pdoc.lot_project_id = l.lot_project_id
        WHERE l.lot_project_id = ?
        ORDER BY l.lot_project_listing_updated_at DESC, l.lot_project_listing_id DESC
        LIMIT 8
      `,
      [project.lot_project_id]
    );

    const summary = summaryRows[0] || {};
    const moneySummary = moneyRows[0] || {};
    const commissionSummary = commissionRows[0] || {};
    const scheduleSummary = scheduleRows[0] || {};
    const totalSales = toNumber(moneySummary.totalSales);
    const totalCollected = toNumber(moneySummary.totalCollected);

    return res.json({
      success: true,
      data: {
        project: projectPayload,
        dateRange,
        salesTrend: mergeTrendRows(dateRange, salesTrendRows, collectionTrendRows),
        sellerSalesTrend: mapBreakdownTrend(sellerTrendRows, 'seller'),
        groupSalesTrend: mapBreakdownTrend(groupTrendRows, 'group'),
        stats: {
          ...emptyStats,
          totalUnits: toNumber(summary.totalUnits),
          available: toNumber(summary.available),
          hold: toNumber(summary.hold),
          soldActive: toNumber(summary.soldActive),
          fullyPaid: toNumber(summary.fullyPaid),
          pendingCancellation: toNumber(summary.pendingCancellation),
          cancelled: toNumber(summary.cancelled),
          totalContractPrice: toNumber(summary.totalContractPrice),
          totalSales,
          totalCollected,
          pendingSales: Math.max(toNumber(moneySummary.pendingSales), 0),
          outstandingBalance: Math.max(toNumber(moneySummary.pendingSales), 0),
          collectionProgress: totalSales > 0 ? Math.min((totalCollected / totalSales) * 100, 100) : 0,
          listedLotValue: toNumber(summary.listedLotValue),
          availableLotValue: toNumber(summary.availableLotValue),
          soldLotValue: toNumber(summary.soldLotValue),
          totalCommission: toNumber(commissionSummary.totalCommission),
          grossCommission: toNumber(commissionSummary.totalCommission),
          eligibleCommission: toNumber(commissionSummary.eligibleCommission),
          releasedCommission: toNumber(commissionSummary.releasedCommission),
          cashAdvanceDeductions: toNumber(commissionSummary.cashAdvanceDeductions),
          netRemainingCommission: toNumber(commissionSummary.netRemainingCommission),
          overdueCount: toNumber(scheduleSummary.overdueCount),
          dueSoonCount: toNumber(scheduleSummary.dueSoonCount),
          upcomingDueAmount: toNumber(scheduleSummary.upcomingDueAmount),
        },
        upcomingDues: upcomingDueRows.map((row) => ({
          id: row.lot_project_payment_schedule_id,
          unit: row.lot_project_listing_unit_id,
          buyer: row.buyer_full_name || '-',
          dueDate: row.due_date,
          description: row.description,
          dueAmount: toNumber(row.due_amount),
          penalty: toNumber(row.penalty_amount),
          paid: toNumber(row.amount_paid),
          discount: toNumber(row.discount_amount),
          balanceDue: toNumber(row.balance_due),
        })),
        sellerPerformance: sellerRows.map((row) => ({
          id: row.accredited_seller_id,
          seller: row.seller_name,
          role: row.seller_role,
          group: row.seller_group_name,
          units: toNumber(row.unit_count),
          salesAmount: toNumber(row.sales_amount),
          grossCommission: toNumber(row.gross_commission),
          eligibleCommission: toNumber(row.eligible_commission),
          releasedCommission: toNumber(row.released_commission),
          cashAdvanceDeductions: toNumber(row.deduction_amount),
          remainingCommission: toNumber(row.remaining_commission),
        })),
        groupPerformance: groupRows.map((row) => ({
          id: row.seller_group_id,
          group: row.seller_group_name,
          units: toNumber(row.unit_count),
          salesAmount: toNumber(row.sales_amount),
          grossCommission: toNumber(row.gross_commission),
          eligibleCommission: toNumber(row.eligible_commission),
          releasedCommission: toNumber(row.released_commission),
          cashAdvanceDeductions: toNumber(row.deduction_amount),
          remainingCommission: toNumber(row.remaining_commission),
        })),
        recentUnits: recentRows.map((row) => {
          const tcp = toNumber(row.lot_project_listing_tcp);
          const paid = toNumber(row.effective_collected ?? row.total_paid);
          const scheduleBalance = row.actual_remaining_balance === null || row.actual_remaining_balance === undefined
            ? Math.max(tcp - paid, 0)
            : Math.max(toNumber(row.actual_remaining_balance), 0);
          const isFullyPaid = row.lot_project_listing_sold_substatus === 'fully_paid' || (tcp > 0 && scheduleBalance <= 0.009);
          const progressPercent = tcp > 0
            ? (isFullyPaid ? 100 : Math.min((paid / tcp) * 100, 100))
            : 0;

          return {
            ...mapListingRow(row),
            collected: isFullyPaid ? tcp : paid,
            balance: isFullyPaid ? 0 : Math.max(tcp - paid, 0),
            scheduleBalance,
            progressValue: progressPercent,
            progress: `${progressPercent.toFixed(1)}%`,
            documents: formatDocumentsLabel(row),
          };
        }),
      },
    });
  } catch (error) {
    console.error('Lot project dashboard error:', error);
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


export const getLotProjectPriceList = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    const projectPayload = await buildProjectPayload(project);
    const hasListings = await tableExists(connection, 'lot_project_listings');

    if (!hasListings) {
      return res.json({ success: true, data: { project: projectPayload, listings: [] } });
    }

    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');
    const cadastralSelect = hasListingCadastralLinks
      ? `(
          SELECT GROUP_CONCAT(c.lot_project_cadastral_lot_number ORDER BY c.lot_project_cadastral_lot_number SEPARATOR ', ')
          FROM lot_project_listing_cadastral_lots lcl
          INNER JOIN lot_project_cadastral_lot_numbers c
            ON c.lot_project_cadastral_lot_number_id = lcl.lot_project_cadastral_lot_number_id
          WHERE lcl.lot_project_listing_id = l.lot_project_listing_id
        ) AS cadastral_lots,`
      : `NULL AS cadastral_lots,`;

    const [rows] = await connection.query(
      `
        SELECT
          l.*,
          ${cadastralSelect}
          NULL AS buyer_full_name,
          0 AS listing_document_count,
          0 AS project_default_document_count,
          0 AS project_required_document_count
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
        ORDER BY l.lot_project_listing_unit_id ASC, l.lot_project_listing_id ASC
      `,
      [project.lot_project_id]
    );

    return res.json({
      success: true,
      data: {
        project: projectPayload,
        listings: rows.map(mapListingRow),
        printedAt: todayDateOnly(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


