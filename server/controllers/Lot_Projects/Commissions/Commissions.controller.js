import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getLatestActiveScheduleGenerationPredicate,
  getAuthenticatedUser,
  getUserFullName,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';

const toNumber = (value) => Number(value || 0);
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const titleCase = (value = '') =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const roleLabel = (value = '') => {
  const labels = {
    broker_network_manager: 'Broker Network Manager',
    broker: 'Broker',
    manager: 'Manager',
    agent: 'Agent',
  };
  return labels[value] || titleCase(value);
};

const sellerTypeLabel = (value = '') => {
  const labels = {
    main_seller: 'Main Seller',
    hierarchy_seller: 'Hierarchy Seller',
    selling_agent: 'Selling Agent',
  };
  return labels[value] || titleCase(value);
};

const hierarchyLabel = (value = '') => {
  const labels = {
    broker_network_manager: 'BNM',
    broker: 'Broker',
    manager: 'Manager',
    agent: 'Agent',
  };
  return labels[value] || roleLabel(value);
};

const commissionStatusLabel = (status = '') => {
  const labels = {
    Pending: 'Not Eligible',
    Eligible: 'Eligible',
    'Partially Released': 'Partial',
    Released: 'Completed',
    'On Hold': 'On Hold',
    Cancelled: 'Cancelled',
  };
  return labels[status] || status || 'Not Eligible';
};

const getPaymentPercent = (row = {}) => toNumber(row.computed_payment_percent ?? row.payment_percent);

const getRequiredDocumentCountSql = (listingAlias = 'l') => `(
  SELECT COUNT(*)
  FROM lot_project_listing_documents lpd
  WHERE lpd.lot_project_listing_id = ${listingAlias}.lot_project_listing_id
    AND lpd.lot_project_listing_document_status = 'active'
    AND lpd.lot_project_listing_document_is_required = 1
)`;

const getCompletedRequiredDocumentCountSql = (listingAlias = 'l', commissionAlias = 'c') => `(
  SELECT COUNT(*)
  FROM lot_project_listing_documents lpd
  INNER JOIN lot_project_client_documents lcd
    ON lcd.lot_project_listing_id = lpd.lot_project_listing_id
    AND lcd.document_id = lpd.document_id
    AND lcd.lot_project_client_profile_id = ${commissionAlias}.lot_project_client_profile_id
    AND lcd.lot_project_client_document_status IN ('Submitted', 'Approved')
  WHERE lpd.lot_project_listing_id = ${listingAlias}.lot_project_listing_id
    AND lpd.lot_project_listing_document_status = 'active'
    AND lpd.lot_project_listing_document_is_required = 1
)`;

const scheduleSummaryJoin = `
  LEFT JOIN (
    SELECT
      lot_project_client_profile_id,
      COUNT(*) AS schedule_count
    FROM lot_project_payment_schedules schedule_row
    WHERE ${getLatestActiveScheduleGenerationPredicate('schedule_row')}
    GROUP BY lot_project_client_profile_id
  ) schedule_summary ON schedule_summary.lot_project_client_profile_id = c.lot_project_client_profile_id
`;

const effectiveTcpSql = `COALESCE(cp.soa_selected_tcp, l.lot_project_listing_tcp)`;

const downpaymentTargetSql = `
  ROUND((${effectiveTcpSql}) * (COALESCE(cp.soa_downpayment_percentage, 30) / 100), 2)
`;

const reservationFeeDownpaymentCreditSql = `
  CASE
    WHEN COALESCE(cp.soa_reservation_fee_applied_to_downpayment, 0) = 1
      THEN LEAST(COALESCE(cp.soa_reservation_fee, l.lot_project_listing_reservation_fee, 0), (${downpaymentTargetSql}))
    ELSE 0
  END
`;

const downpaymentGrossSql = `
  GREATEST(ROUND((${downpaymentTargetSql}) - (${reservationFeeDownpaymentCreditSql}), 2), 0)
`;

const downpaymentDiscountTotalSql = `
  ROUND((${downpaymentGrossSql}) * (COALESCE(cp.soa_dp_discount_percentage, 0) / 100), 2)
`;

const downpaymentNetSql = `
  GREATEST((${downpaymentGrossSql}) - (${downpaymentDiscountTotalSql}), 0)
`;

const earnedDownpaymentDiscountSql = `
  CASE
    WHEN (${downpaymentDiscountTotalSql}) <= 0 THEN 0
    WHEN (${downpaymentNetSql}) <= 0 THEN (${downpaymentDiscountTotalSql})
    ELSE LEAST(
      (${downpaymentDiscountTotalSql}),
      ROUND((${downpaymentDiscountTotalSql}) * (COALESCE(payment_summary.downpayment_paid, 0) / NULLIF((${downpaymentNetSql}), 0)), 2)
    )
  END
`;

const paidValueWithDiscountSql = `
  ROUND(COALESCE(payment_summary.total_paid, 0) + (${earnedDownpaymentDiscountSql}), 2)
`;

const actualRemainingBalanceSql = `
  GREATEST(ROUND((${effectiveTcpSql}) - (${paidValueWithDiscountSql}), 2), 0)
`;

const unpaidScheduledDueSql = actualRemainingBalanceSql;

const computedPaymentPercentSql = `
  CASE
    WHEN (${effectiveTcpSql}) <= 0 THEN 0
    ELSE LEAST(100, ROUND(((${paidValueWithDiscountSql}) / NULLIF((${effectiveTcpSql}), 0)) * 100, 2))
  END
`;

const isPaymentComplete = (row = {}) => {
  const percent = getPaymentPercent(row);
  const remaining = toNumber(row.actual_remaining_balance ?? row.remainingBalance ?? row.remaining_balance);
  const unpaid = toNumber(row.unpaid_scheduled_due ?? row.unpaidScheduledDue);

  return percent >= 100 || (remaining <= 0.009 && unpaid <= 0.009);
};

const areDocumentsComplete = (row = {}) => {
  const required = toNumber(row.required_document_count ?? row.requiredDocumentCount);
  const completed = toNumber(row.completed_required_document_count ?? row.completedRequiredDocumentCount);

  return required <= 0 || completed >= required;
};

const isRetentionReady = (row = {}) => isPaymentComplete(row) && areDocumentsComplete(row);

const releaseOrder = {
  '1st Release': 1,
  '2nd Release': 2,
  '3rd Release': 3,
  '4th Release': 4,
  Retention: 5,
};

const isFinalRelease = (stage = '') => String(stage).toLowerCase() === 'retention';

const normalizeReleaseStatus = (release = {}, paymentPercent = 0, eligibility = {}) => {
  const current = String(release.release_status || 'Pending');
  const paidPercent = Number(paymentPercent || 0);
  const triggerPercent = Number(release.release_trigger_percent || 0);
  const finalRelease = isFinalRelease(release.release_stage);
  const retentionReady = Boolean(eligibility.retentionReady);

  if (['Released', 'Cancelled', 'Earned on Cancellation', 'Forfeited on Cancellation'].includes(current)) return current;

  if (current === 'On Hold') return 'On Hold';

  if (finalRelease) {
    if (!retentionReady || paidPercent < triggerPercent) return 'On Hold';
    return current === 'Eligible' ? 'Eligible' : 'On Hold';
  }

  return paidPercent >= triggerPercent ? 'Eligible' : 'Pending';
};

const getReleaseDateWarning = (settings = {}) => {
  const today = new Date();
  const day = today.getDate();
  const releaseDays = [Number(settings.release_day_one || 7), Number(settings.release_day_two || 22)]
    .filter((item) => item >= 1 && item <= 31)
    .sort((a, b) => a - b);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const nextDate = new Date(today);
  const nextDay = releaseDays.find((releaseDay) => releaseDay >= day);

  if (nextDay) {
    nextDate.setDate(nextDay);
  } else {
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(releaseDays[0] || 7);
  }

  return {
    releaseDays,
    isReleaseDate: releaseDays.includes(day),
    nextReleaseDate: `${monthNames[nextDate.getMonth()]} ${nextDate.getDate()}, ${nextDate.getFullYear()}`,
    nextReleaseDateISO: nextDate.toISOString().slice(0, 10),
  };
};

const mapReleaseRow = (row = {}, paymentPercent = 0, releaseDateInfo = {}, commission = row) => {
  const retentionReady = isRetentionReady(commission);
  const status = normalizeReleaseStatus(row, paymentPercent, { retentionReady });

  return {
    id: row.lot_project_commission_release_id,
    releaseId: row.lot_project_commission_release_id,
    commissionId: row.lot_project_commission_id,
    stage: row.release_stage,
    triggerPercent: toNumber(row.release_trigger_percent),
    releasePercent: toNumber(row.release_percent),
    grossAmount: toNumber(row.gross_release_amount),
    deductionAmount: toNumber(row.deduction_amount),
    netAmount: toNumber(row.net_release_amount),
    status,
    scheduledReleaseDate: row.scheduled_release_date,
    actualReleaseDate: row.actual_release_date,
    releasedByUserId: row.released_by_user_id,
    releaseButtonLabel: releaseDateInfo.isReleaseDate
      ? 'Release Now'
      : `Release on ${releaseDateInfo.nextReleaseDate}`,
    isReleaseDate: releaseDateInfo.isReleaseDate,
    canRelease: ['Eligible', 'Earned on Cancellation'].includes(status),
    canHold: !['Released', 'On Hold', 'Cancelled', 'Earned on Cancellation', 'Forfeited on Cancellation'].includes(status),
    canUnhold: status === 'On Hold' && (!isFinalRelease(row.release_stage) || retentionReady),
    retentionReady,
    paymentComplete: isPaymentComplete(commission),
    documentsComplete: areDocumentsComplete(commission),
  };
};

const buildFallbackMilestones = (commission = {}, releaseDateInfo = {}) => {
  const gross = toNumber(commission.gross_commission_amount);
  const paymentPercent = getPaymentPercent(commission);
  const retentionReady = isRetentionReady(commission);
  const stages = [
    { stage: '1st Release', triggerPercent: 20, releasePercent: 20 },
    { stage: '2nd Release', triggerPercent: 40, releasePercent: 20 },
    { stage: '3rd Release', triggerPercent: 60, releasePercent: 20 },
    { stage: '4th Release', triggerPercent: 75, releasePercent: 15 },
    { stage: 'Retention', triggerPercent: 100, releasePercent: 25 },
  ];

  return stages.map((stage, index) => {
    const grossAmount = roundMoney(gross * (stage.releasePercent / 100));
    const status = isFinalRelease(stage.stage)
      ? 'On Hold'
      : paymentPercent >= stage.triggerPercent
        ? 'Eligible'
        : 'Pending';

    return {
      id: `fallback-${commission.lot_project_commission_id}-${index}`,
      releaseId: null,
      commissionId: commission.lot_project_commission_id,
      stage: stage.stage,
      triggerPercent: stage.triggerPercent,
      releasePercent: stage.releasePercent,
      grossAmount,
      deductionAmount: 0,
      netAmount: grossAmount,
      status,
      scheduledReleaseDate: releaseDateInfo.nextReleaseDateISO,
      actualReleaseDate: null,
      releasedByUserId: null,
      releaseButtonLabel: releaseDateInfo.isReleaseDate ? 'Release Now' : `Release on ${releaseDateInfo.nextReleaseDate}`,
      isReleaseDate: releaseDateInfo.isReleaseDate,
      canRelease: status === 'Eligible',
      canHold: !['Released', 'On Hold', 'Cancelled', 'Earned on Cancellation', 'Forfeited on Cancellation'].includes(status),
      canUnhold: status === 'On Hold' && (!isFinalRelease(stage.stage) || retentionReady),
      retentionReady,
      paymentComplete: isPaymentComplete(commission),
      documentsComplete: areDocumentsComplete(commission),
    };
  });
};

const getAggregateStatus = (commission = {}, releases = []) => {
  const gross = toNumber(commission.gross_commission_amount);
  const released = releases
    .filter((release) => release.status === 'Released')
    .reduce((sum, release) => sum + toNumber(release.netAmount), 0);

  if (commission.commission_status === 'Cancelled') return 'Cancelled';
  if (gross > 0 && released >= gross) return 'Released';
  if (releases.some((release) => release.status === 'On Hold' && !isFinalRelease(release.stage))) return 'On Hold';
  if (releases.some((release) => release.status === 'Earned on Cancellation')) return released > 0 ? 'Partially Released' : 'Eligible';
  if (releases.some((release) => release.status === 'Eligible')) return 'Eligible';
  if (releases.length && releases.every((release) => ['Released', 'Cancelled', 'Forfeited on Cancellation'].includes(release.status))) {
    return released > 0 ? 'Partially Released' : 'Cancelled';
  }
  if (released > 0) return 'Partially Released';
  return 'Pending';
};

const mapCommissionRow = (row = {}, releases = [], releaseDateInfo = {}) => {
  const gross = toNumber(row.gross_commission_amount);
  const releasedFromMilestones = releases
    .filter((release) => release.status === 'Released')
    .reduce((sum, release) => sum + toNumber(release.netAmount), 0);
  const eligibleToRelease = releases
    .filter((release) => ['Eligible', 'Earned on Cancellation'].includes(release.status))
    .reduce((sum, release) => sum + toNumber(release.netAmount), 0);
  const cashAdvanceDeduction = releases
    .reduce((sum, release) => sum + toNumber(release.deductionAmount), 0);
  const released = releases.length ? releasedFromMilestones : toNumber(row.released_commission_amount);
  const cancellationSettled = releases.some((release) =>
    ['Earned on Cancellation', 'Forfeited on Cancellation'].includes(release.status)
  );
  const remaining = cancellationSettled
    ? releases
        .filter((release) => release.status === 'Earned on Cancellation')
        .reduce((sum, release) => sum + toNumber(release.netAmount), 0)
    : Math.max(gross - released - cashAdvanceDeduction, 0);
  const status = releases.length ? getAggregateStatus(row, releases) : row.commission_status || 'Pending';

  return {
    id: row.lot_project_commission_id,
    commissionId: row.lot_project_commission_id,
    listingId: row.lot_project_listing_id,
    accountId: row.lot_project_account_id,
    clientProfileId: row.lot_project_client_profile_id,
    accreditedSellerId: row.accredited_seller_id,
    client: row.buyer_full_name || 'No buyer name',
    unit: row.lot_project_listing_unit_id || '-',
    project: row.lot_project_name || '-',
    seller: row.seller_display_name_snapshot || row.seller_name || getUserFullName(row),
    mainSeller: row.main_seller_name || (row.commission_seller_type === 'selling_agent' || row.commission_seller_type === 'main_seller' ? row.seller_name || getUserFullName(row) : '-'),
    mainSellerRole: roleLabel(row.main_seller_role),
    sellerEmail: row.seller_email || '',
    sellerContactNo: row.seller_contact_no || '',
    sellerGroup: row.seller_group_name_snapshot || row.seller_group_name || '-',
    reportsUnder: row.reports_under || '-',
    accreditationDate: row.accredited_seller_accreditation_date || '',
    role: roleLabel(row.commission_role),
    rawRole: row.commission_role,
    sellerType: sellerTypeLabel(row.commission_seller_type),
    saleType: titleCase(row.commission_sale_type),
    hierarchyLevel: hierarchyLabel(row.commission_role),
    commissionBase: toNumber(row.commission_base_amount),
    rate: toNumber(row.commission_rate),
    commissionType: row.commission_rate_type === 'direct' || row.commission_seller_type === 'selling_agent' ? 'Direct' : 'Override',
    grossCommission: gross,
    released,
    eligibleToRelease,
    cashAdvanceDeduction,
    netRemaining: remaining,
    tcp: toNumber(row.lot_project_listing_tcp),
    paid: toNumber(row.total_paid),
    paymentPercent: getPaymentPercent(row),
    remainingBalance: toNumber(row.actual_remaining_balance),
    unpaidScheduledDue: toNumber(row.unpaid_scheduled_due),
    requiredDocumentCount: toNumber(row.required_document_count),
    completedRequiredDocumentCount: toNumber(row.completed_required_document_count),
    documentsComplete: areDocumentsComplete(row),
    paymentComplete: isPaymentComplete(row),
    retentionReady: isRetentionReady(row),
    status,
    statusLabel: commissionStatusLabel(status),
    releaseMilestones: releases,
    releaseDateInfo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const getProjectReleaseSettings = async (connection, lotProjectId) => {
  if (!(await tableExists(connection, 'lot_project_settings'))) {
    return { release_day_one: 7, release_day_two: 22 };
  }

  const [rows] = await connection.query(
    `
      SELECT release_day_one, release_day_two
      FROM lot_project_settings
      WHERE lot_project_id = ?
      LIMIT 1
    `,
    [lotProjectId]
  );

  return rows[0] || { release_day_one: 7, release_day_two: 22 };
};

const syncReleaseStatuses = async (connection, commissionRows = []) => {
  if (!commissionRows.length || !(await tableExists(connection, 'lot_project_commission_releases'))) return;

  for (const commission of commissionRows) {
    await connection.query(
      `
        UPDATE lot_project_commission_releases
        SET release_status = CASE
          WHEN release_status IN ('Released', 'Cancelled', 'Earned on Cancellation', 'Forfeited on Cancellation') THEN release_status
          WHEN release_status = 'On Hold' THEN release_status
          WHEN release_stage = 'Retention' AND ? = 0 THEN 'On Hold'
          WHEN ? >= release_trigger_percent THEN 'Eligible'
          ELSE 'Pending'
        END
        WHERE lot_project_commission_id = ?
      `,
      [
        isRetentionReady(commission) ? 1 : 0,
        getPaymentPercent(commission),
        commission.lot_project_commission_id,
      ]
    );
  }
};

const loadReleaseMilestones = async (connection, commissionRows = [], releaseDateInfo = {}) => {
  if (!commissionRows.length) return new Map();

  const releasesByCommission = new Map();
  const commissionIds = commissionRows.map((row) => row.lot_project_commission_id);
  const hasReleaseTable = await tableExists(connection, 'lot_project_commission_releases');

  if (!hasReleaseTable) {
    for (const commission of commissionRows) {
      releasesByCommission.set(
        commission.lot_project_commission_id,
        buildFallbackMilestones(commission, releaseDateInfo)
      );
    }
    return releasesByCommission;
  }

  const placeholders = commissionIds.map(() => '?').join(',');
  const [releaseRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_commission_releases
      WHERE lot_project_commission_id IN (${placeholders})
      ORDER BY FIELD(release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention')
    `,
    commissionIds
  );

  for (const commission of commissionRows) {
    const rows = releaseRows
      .filter((release) => release.lot_project_commission_id === commission.lot_project_commission_id)
      .sort((a, b) => (releaseOrder[a.release_stage] || 99) - (releaseOrder[b.release_stage] || 99));

    releasesByCommission.set(
      commission.lot_project_commission_id,
      rows.length
        ? rows.map((release) => mapReleaseRow(release, getPaymentPercent(commission), releaseDateInfo, commission))
        : buildFallbackMilestones(commission, releaseDateInfo)
    );
  }

  return releasesByCommission;
};

const recomputeCommissionFromReleases = async (connection, commissionId, lotProjectId) => {
  const [commissionRows] = await connection.query(
    `
      SELECT
        c.*,
        ${effectiveTcpSql} AS lot_project_listing_tcp,
        COALESCE(payment_summary.total_paid, 0) AS total_paid,
        ${actualRemainingBalanceSql} AS actual_remaining_balance,
        ${unpaidScheduledDueSql} AS unpaid_scheduled_due,
        ${getRequiredDocumentCountSql('l')} AS required_document_count,
        ${getCompletedRequiredDocumentCountSql('l', 'c')} AS completed_required_document_count,
        ${computedPaymentPercentSql} AS computed_payment_percent
      FROM lot_project_commissions c
      INNER JOIN lot_project_listings l
        ON l.lot_project_listing_id = c.lot_project_listing_id
      LEFT JOIN lot_project_client_profiles cp
        ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
      LEFT JOIN (
        SELECT
          lot_project_client_profile_id,
          SUM(lot_project_payment_amount) AS total_paid,
          SUM(CASE WHEN lot_project_payment_type IN ('downpayment', 'down_payment') THEN lot_project_payment_amount ELSE 0 END) AS downpayment_paid
        FROM lot_project_payments
        WHERE lot_project_payment_status = 'Verified'
        GROUP BY lot_project_client_profile_id
      ) payment_summary ON payment_summary.lot_project_client_profile_id = c.lot_project_client_profile_id
      ${scheduleSummaryJoin}
      WHERE c.lot_project_commission_id = ?
        AND c.lot_project_id = ?
      LIMIT 1
    `,
    [commissionId, lotProjectId]
  );

  const commission = commissionRows[0];
  if (!commission) return null;

  const [releaseRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_commission_releases
      WHERE lot_project_commission_id = ?
      ORDER BY FIELD(release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention')
    `,
    [commissionId]
  );

  const settings = await getProjectReleaseSettings(connection, lotProjectId);
  const releaseDateInfo = getReleaseDateWarning(settings);
  const releases = releaseRows.map((release) => mapReleaseRow(release, getPaymentPercent(commission), releaseDateInfo, commission));
  const released = roundMoney(
    releases
      .filter((release) => release.status === 'Released')
      .reduce((sum, release) => sum + toNumber(release.netAmount), 0)
  );
  const gross = toNumber(commission.gross_commission_amount);
  const cancellationSettled = releases.some((release) =>
    ['Earned on Cancellation', 'Forfeited on Cancellation'].includes(release.status)
  );
  const remaining = cancellationSettled
    ? roundMoney(
        releases
          .filter((release) => release.status === 'Earned on Cancellation')
          .reduce((sum, release) => sum + toNumber(release.netAmount), 0)
      )
    : Math.max(gross - released, 0);
  const nextStatus = getAggregateStatus(commission, releases);

  await connection.query(
    `
      UPDATE lot_project_commissions
      SET
        released_commission_amount = ?,
        net_remaining_commission_amount = ?,
        commission_status = ?
      WHERE lot_project_commission_id = ?
        AND lot_project_id = ?
    `,
    [released, remaining, nextStatus, commissionId, lotProjectId]
  );

  return {
    id: commissionId,
    commissionId,
    released,
    netRemaining: remaining,
    status: nextStatus,
    released_commission_amount: released,
    net_remaining_commission_amount: remaining,
    commission_status: nextStatus,
    releaseMilestones: releases,
  };
};

export const getLotProjectCommissions = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'all').trim();
    const saleType = String(req.query.saleType || 'all').trim().toLowerCase();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    if (!(await tableExists(connection, 'lot_project_commissions'))) {
      return res.status(500).json({ success: false, message: 'lot_project_commissions table does not exist.' });
    }

    const settings = await getProjectReleaseSettings(connection, project.lot_project_id);
    const releaseDateInfo = getReleaseDateWarning(settings);
    const where = ['c.lot_project_id = ?'];
    const params = [project.lot_project_id];

    if (status !== 'all') {
      const statusMap = {
        'Not Eligible': 'Pending',
        Partial: 'Partially Released',
        Completed: 'Released',
      };
      where.push('c.commission_status = ?');
      params.push(statusMap[status] || status);
    }

    if (saleType !== 'all') {
      where.push('c.commission_sale_type = ?');
      params.push(saleType === 'direct' ? 'direct' : 'distributed');
    }

    if (search) {
      // Match the account first, then return every commission recipient for the
      // matched unit. This keeps the seller dropdown complete after searching.
      where.push(`(
        l.lot_project_listing_unit_id LIKE ?
        OR cp.buyer_full_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM lot_project_commissions searchCommission
          LEFT JOIN accredited_sellers searchSeller
            ON searchSeller.accredited_seller_id = searchCommission.accredited_seller_id
          LEFT JOIN users searchUser
            ON searchUser.id = searchSeller.user_id
          LEFT JOIN seller_groups searchGroup
            ON searchGroup.seller_group_id = searchSeller.seller_group_id
          WHERE searchCommission.lot_project_listing_id = c.lot_project_listing_id
            AND searchCommission.lot_project_id = c.lot_project_id
            AND (
              COALESCE(
                searchCommission.seller_display_name_snapshot,
                NULLIF(TRIM(CONCAT_WS(' ', searchUser.first_name, searchUser.middle_name, searchUser.last_name)), '')
              ) LIKE ?
              OR searchUser.email LIKE ?
              OR COALESCE(searchCommission.seller_group_name_snapshot, searchGroup.seller_group_name) LIKE ?
              OR searchCommission.commission_role LIKE ?
              OR searchCommission.commission_rate_type LIKE ?
            )
        )
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }

    const [rows] = await connection.query(
      `
        SELECT
          c.*,
          lp.lot_project_name,
          l.lot_project_listing_unit_id,
          ${effectiveTcpSql} AS lot_project_listing_tcp,
          cp.buyer_full_name,
          COALESCE(payment_summary.total_paid, 0) AS total_paid,
          ${actualRemainingBalanceSql} AS actual_remaining_balance,
          ${unpaidScheduledDueSql} AS unpaid_scheduled_due,
          ${getRequiredDocumentCountSql('l')} AS required_document_count,
          ${getCompletedRequiredDocumentCountSql('l', 'c')} AS completed_required_document_count,
          ${computedPaymentPercentSql} AS computed_payment_percent,
          u.first_name,
          u.middle_name,
          u.last_name,
          u.email AS seller_email,
          u.contact_no AS seller_contact_no,
          NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), '') AS seller_name,
          mainAcs.accredited_seller_id AS main_seller_accredited_seller_id,
          mainSellerUser.id AS main_seller_user_id,
          mainSellerUser.role AS main_seller_role,
          NULLIF(TRIM(CONCAT_WS(' ', mainSellerUser.first_name, mainSellerUser.middle_name, mainSellerUser.last_name)), '') AS main_seller_name,
          sg.seller_group_name,
          acs.accredited_seller_accreditation_date,
          NULLIF(TRIM(CONCAT_WS(' ', reports.first_name, reports.middle_name, reports.last_name)), '') AS reports_under
        FROM lot_project_commissions c
        INNER JOIN lot_project_listings l
          ON l.lot_project_listing_id = c.lot_project_listing_id
        INNER JOIN lot_projects lp
          ON lp.lot_project_id = c.lot_project_id
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
        LEFT JOIN accredited_sellers acs
          ON acs.accredited_seller_id = c.accredited_seller_id
        LEFT JOIN users u
          ON u.id = acs.user_id
        LEFT JOIN users reports
          ON reports.id = acs.accredited_seller_reports_under_user_id
        LEFT JOIN accredited_sellers mainAcs
          ON mainAcs.accredited_seller_id = cp.assigned_accredited_seller_id
        LEFT JOIN users mainSellerUser
          ON mainSellerUser.id = mainAcs.user_id
        LEFT JOIN seller_groups sg
          ON sg.seller_group_id = acs.seller_group_id
        LEFT JOIN (
          SELECT
            lot_project_client_profile_id,
            SUM(lot_project_payment_amount) AS total_paid,
            SUM(CASE WHEN lot_project_payment_type IN ('downpayment', 'down_payment') THEN lot_project_payment_amount ELSE 0 END) AS downpayment_paid
          FROM lot_project_payments
          WHERE lot_project_payment_status = 'Verified'
          GROUP BY lot_project_client_profile_id
        ) payment_summary ON payment_summary.lot_project_client_profile_id = c.lot_project_client_profile_id
        ${scheduleSummaryJoin}
        WHERE ${where.join(' AND ')}
        ORDER BY l.lot_project_listing_unit_id ASC, FIELD(c.commission_role, 'broker_network_manager', 'broker', 'manager', 'agent'), c.lot_project_commission_id ASC
      `,
      params
    );

    await syncReleaseStatuses(connection, rows);
    const releasesByCommission = await loadReleaseMilestones(connection, rows, releaseDateInfo);
    const records = rows.map((row) => mapCommissionRow(row, releasesByCommission.get(row.lot_project_commission_id) || [], releaseDateInfo));
    const stats = records.reduce(
      (summary, item) => {
        summary.total += 1;
        summary.gross += toNumber(item.grossCommission);
        summary.released += toNumber(item.released);
        summary.eligibleToRelease += toNumber(item.eligibleToRelease);
        summary.cashAdvanceDeduction += toNumber(item.cashAdvanceDeduction);
        summary.remaining += toNumber(item.netRemaining);
        if (!summary.byStatus[item.status]) summary.byStatus[item.status] = 0;
        summary.byStatus[item.status] += 1;
        return summary;
      },
      { total: 0, gross: 0, released: 0, eligibleToRelease: 0, cashAdvanceDeduction: 0, remaining: 0, byStatus: {} }
    );

    return res.json({
      success: true,
      data: records,
      stats,
      releaseDateInfo,
      project: {
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

export const updateLotProjectCommission = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const commissionId = Number(req.params.commissionId || 0);
    const action = String(req.body.action || '').trim().toLowerCase();
    const releaseId = Number(req.body.releaseId || req.body.release_id || 0);
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    if (!commissionId) {
      return res.status(400).json({ success: false, message: 'Commission id is required.' });
    }

    const currentUser = await getAuthenticatedUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Please login before updating commission.' });
    }

    if (!['super_admin', 'admin'].includes(currentUser.role)) {
      return res.status(403).json({ success: false, message: 'Admin access is required to update commission.' });
    }

    const hasReleaseTable = await tableExists(connection, 'lot_project_commission_releases');

    if (hasReleaseTable && ['release_stage', 'hold_stage', 'unhold_stage'].includes(action)) {
      if (!releaseId) {
        return res.status(400).json({ success: false, message: 'Release stage id is required.' });
      }

      await connection.beginTransaction();

      const [releaseRows] = await connection.query(
        `
          SELECT
            r.*,
            c.lot_project_id,
            c.payment_percent,
            ${actualRemainingBalanceSql} AS actual_remaining_balance,
            ${unpaidScheduledDueSql} AS unpaid_scheduled_due,
            ${getRequiredDocumentCountSql('l')} AS required_document_count,
            ${getCompletedRequiredDocumentCountSql('l', 'c')} AS completed_required_document_count,
            ${computedPaymentPercentSql} AS computed_payment_percent
          FROM lot_project_commission_releases r
          INNER JOIN lot_project_commissions c
            ON c.lot_project_commission_id = r.lot_project_commission_id
          INNER JOIN lot_project_listings l
            ON l.lot_project_listing_id = c.lot_project_listing_id
          LEFT JOIN lot_project_client_profiles cp
            ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
          LEFT JOIN (
            SELECT
              lot_project_client_profile_id,
              SUM(lot_project_payment_amount) AS total_paid,
              SUM(CASE WHEN lot_project_payment_type IN ('downpayment', 'down_payment') THEN lot_project_payment_amount ELSE 0 END) AS downpayment_paid
            FROM lot_project_payments
            WHERE lot_project_payment_status = 'Verified'
            GROUP BY lot_project_client_profile_id
          ) payment_summary ON payment_summary.lot_project_client_profile_id = c.lot_project_client_profile_id
          ${scheduleSummaryJoin}
          WHERE r.lot_project_commission_release_id = ?
            AND r.lot_project_commission_id = ?
            AND c.lot_project_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [releaseId, commissionId, project.lot_project_id]
      );

      const release = releaseRows[0];
      if (!release) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Commission release stage not found.' });
      }

      const computedStatus = normalizeReleaseStatus(release, getPaymentPercent(release), { retentionReady: isRetentionReady(release) });
      let nextStatus = computedStatus;
      let message = 'Commission release stage updated successfully.';
      let releasedByUserId = release.released_by_user_id;
      let actualReleaseDate = release.actual_release_date;

      if (action === 'release_stage') {
        const settings = await getProjectReleaseSettings(connection, project.lot_project_id);
        const releaseDateInfo = getReleaseDateWarning(settings);
        if (!releaseDateInfo.isReleaseDate) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: `Commission releases are only allowed every ${releaseDateInfo.releaseDays.join(' and ')} of the month. Next release date: ${releaseDateInfo.nextReleaseDate}.` });
        }

        if (!['Eligible', 'Earned on Cancellation'].includes(computedStatus)) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: `${release.release_stage} is not eligible for release yet.` });
        }

        nextStatus = 'Released';
        releasedByUserId = currentUser.id;
        actualReleaseDate = new Date().toISOString().slice(0, 10);
        message = `${release.release_stage} released successfully.`;
      } else if (action === 'hold_stage') {
        if (computedStatus === 'Released') {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Released stages cannot be placed on hold.' });
        }
        nextStatus = 'On Hold';
        message = `${release.release_stage} placed on hold.`;
      } else if (action === 'unhold_stage') {
        if (computedStatus !== 'On Hold') {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Only on-hold stages can be unheld.' });
        }

        if (isFinalRelease(release.release_stage) && !isRetentionReady(release)) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Retention can only be unheld when all required documents are complete and the account is fully paid.',
          });
        }

        const next = getPaymentPercent(release) >= toNumber(release.release_trigger_percent)
          ? 'Eligible'
          : isFinalRelease(release.release_stage)
            ? 'On Hold'
            : 'Pending';
        nextStatus = next;
        message = `${release.release_stage} hold removed.`;
      }

      await connection.query(
        `
          UPDATE lot_project_commission_releases
          SET
            release_status = ?,
            actual_release_date = ?,
            released_by_user_id = ?
          WHERE lot_project_commission_release_id = ?
        `,
        [nextStatus, actualReleaseDate, releasedByUserId, releaseId]
      );

      const data = await recomputeCommissionFromReleases(connection, commissionId, project.lot_project_id);

      if (action === 'release_stage') {
        const [contextRows] = await connection.query(
          `
            SELECT
              c.lot_project_commission_id,
              c.lot_project_listing_id,
              c.accredited_seller_id,
              l.lot_project_listing_unit_id,
              cp.buyer_full_name,
              NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), '') AS seller_name
            FROM lot_project_commissions c
            INNER JOIN lot_project_listings l
              ON l.lot_project_listing_id = c.lot_project_listing_id
            LEFT JOIN lot_project_client_profiles cp
              ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
            LEFT JOIN accredited_sellers acs
              ON acs.accredited_seller_id = c.accredited_seller_id
            LEFT JOIN users u
              ON u.id = acs.user_id
            WHERE c.lot_project_commission_id = ?
              AND c.lot_project_id = ?
            LIMIT 1
          `,
          [commissionId, project.lot_project_id]
        );
        const commissionContext = contextRows[0] || {};
        const sellerName = commissionContext.seller_name || 'Seller';
        const releaseAmount = toNumber(release.net_release_amount);

        await writeAuditLog(connection, req, {
          action: 'release',
          module: 'Commissions',
          entityType: 'lot_project_commission',
          entityId: String(commissionId),
          entityLabel: `${sellerName} — ₱${releaseAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          title: 'Released commission',
          description: `Released ${release.release_stage} commission for ${sellerName}.`,
          metadata: {
            releaseId,
            releaseStage: release.release_stage,
            releaseAmount,
            listingId: commissionContext.lot_project_listing_id || null,
            unitId: commissionContext.lot_project_listing_unit_id || null,
            clientName: commissionContext.buyer_full_name || null,
          },
        });
      }

      await connection.commit();

      return res.json({ success: true, message, data });
    }

    // Fallback for old actions when the release table is unavailable.
    const amount = toNumber(req.body.amount);
    const [rows] = await connection.query(
      `
        SELECT *
        FROM lot_project_commissions
        WHERE lot_project_id = ?
          AND lot_project_commission_id = ?
        LIMIT 1
      `,
      [project.lot_project_id, commissionId]
    );

    const commission = rows[0];
    if (!commission) {
      return res.status(404).json({ success: false, message: 'Commission record not found.' });
    }

    const gross = toNumber(commission.gross_commission_amount);
    const currentReleased = toNumber(commission.released_commission_amount);
    let nextReleased = currentReleased;
    let nextStatus = commission.commission_status;
    let message = 'Commission updated successfully.';

    if (action === 'release') {
      if (amount <= 0) {
        return res.status(400).json({ success: false, message: 'Release amount must be greater than zero.' });
      }

      const remaining = Math.max(gross - currentReleased, 0);
      if (amount > remaining) {
        return res.status(400).json({ success: false, message: 'Release amount cannot be greater than the net remaining commission.' });
      }

      nextReleased = Math.min(currentReleased + amount, gross);
      nextStatus = nextReleased >= gross ? 'Released' : 'Partially Released';
      message = 'Commission release saved successfully.';
    } else if (action === 'hold') {
      nextStatus = 'On Hold';
      message = 'Commission placed on hold.';
    } else if (action === 'unhold') {
      nextStatus = toNumber(commission.payment_percent) > 0 ? 'Eligible' : 'Pending';
      message = 'Commission hold removed.';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid commission action.' });
    }

    const nextRemaining = Math.max(gross - nextReleased, 0);

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE lot_project_commissions
        SET
          released_commission_amount = ?,
          net_remaining_commission_amount = ?,
          commission_status = ?
        WHERE lot_project_commission_id = ?
          AND lot_project_id = ?
      `,
      [nextReleased, nextRemaining, nextStatus, commissionId, project.lot_project_id]
    );

    if (action === 'release') {
      const [contextRows] = await connection.query(
        `
          SELECT
            c.lot_project_listing_id,
            l.lot_project_listing_unit_id,
            cp.buyer_full_name,
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), '') AS seller_name
          FROM lot_project_commissions c
          INNER JOIN lot_project_listings l
            ON l.lot_project_listing_id = c.lot_project_listing_id
          LEFT JOIN lot_project_client_profiles cp
            ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
          LEFT JOIN accredited_sellers acs
            ON acs.accredited_seller_id = c.accredited_seller_id
          LEFT JOIN users u
            ON u.id = acs.user_id
          WHERE c.lot_project_commission_id = ?
            AND c.lot_project_id = ?
          LIMIT 1
        `,
        [commissionId, project.lot_project_id]
      );
      const commissionContext = contextRows[0] || {};
      const sellerName = commissionContext.seller_name || 'Seller';

      await writeAuditLog(connection, req, {
        action: 'release',
        module: 'Commissions',
        entityType: 'lot_project_commission',
        entityId: String(commissionId),
        entityLabel: `${sellerName} — ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        title: 'Released commission',
        description: `Released commission for ${sellerName}.`,
        metadata: {
          amount,
          listingId: commissionContext.lot_project_listing_id || null,
          unitId: commissionContext.lot_project_listing_unit_id || null,
          clientName: commissionContext.buyer_full_name || null,
        },
      });
    }

    await connection.commit();

    return res.json({
      success: true,
      message,
      data: {
        id: commissionId,
        commissionId,
        released: nextReleased,
        netRemaining: nextRemaining,
        status: nextStatus,
        released_commission_amount: nextReleased,
        net_remaining_commission_amount: nextRemaining,
        commission_status: nextStatus,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
