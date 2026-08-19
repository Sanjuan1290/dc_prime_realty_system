import {
  db,
  getComputedSoaTerms,
  getErrorMessage,
  getListingSoaRows,
  getLatestActiveScheduleGenerationPredicate,
  getScheduleTotalDue,
  getStoredScheduleType,
  tableExists,
  columnExists,
  todayDateOnly,
} from '../Lot_Projects/_shared/lotProject.shared.js';
import { calculateContractPricing } from '../Lot_Projects/_shared/listingPricing.js';
import { calculateCommissionPaymentProgress } from '../../utils/commissionProgress.js';

const MONEY_TOLERANCE = 0.05;
const VALID_SCAN_STATUSES = new Set(['pending', 'approved', 'rejected', 'not_scanned', 'error']);
const ACTIVE_ACCOUNT_STATUSES = new Set(['active', 'pending_cancellation', 'closed_fully_paid']);

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value) => Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
const moneyDiff = (left, right) => roundMoney(Math.abs(toNumber(left) - toNumber(right)));
const differs = (left, right, tolerance = MONEY_TOLERANCE) => moneyDiff(left, right) > tolerance;
const clean = (value) => String(value ?? '').trim();
const dateOnly = (value) => value ? String(value).slice(0, 10) : null;

const issueRank = { balanced: 0, review: 1, critical: 2 };
const strongerStatus = (left = 'balanced', right = 'balanced') =>
  issueRank[right] > issueRank[left] ? right : left;

const makeIssue = ({
  category,
  severity = 'review',
  title,
  message,
  amountDifference = 0,
  entityType = null,
  entityId = null,
}) => ({
  category,
  severity,
  title,
  message,
  amountDifference: roundMoney(amountDifference),
  entityType,
  entityId: entityId === null || entityId === undefined ? null : Number(entityId) || String(entityId),
});

const addIssue = (report, issue) => {
  report.issues.push(issue);
  report.status = strongerStatus(report.status, issue.severity);
  report.differenceAmount = roundMoney(report.differenceAmount + Math.abs(toNumber(issue.amountDifference)));
  report.issueCounts[issue.category] = Number(report.issueCounts[issue.category] || 0) + 1;
};

const accountScopeWhere = ({ projectSlug = '', accountId = 0 } = {}) => {
  const where = [];
  const params = [];
  if (clean(projectSlug)) {
    where.push('project.lot_project_slug = ?');
    params.push(clean(projectSlug));
  }
  if (Number(accountId || 0)) {
    where.push('account.lot_project_account_id = ?');
    params.push(Number(accountId));
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

const requiredTables = [
  'lot_project_accounts',
  'lot_projects',
  'lot_project_listings',
  'lot_project_client_profiles',
  'lot_project_payments',
  'lot_project_payment_schedules',
  'lot_project_payment_allocations',
  'lot_project_commissions',
  'lot_project_commission_releases',
  'lot_project_commission_receipts',
  'lot_project_commission_receipt_items',
];

const assertIntegritySchema = async (connection) => {
  const missing = [];
  for (const tableName of requiredTables) {
    if (!(await tableExists(connection, tableName))) missing.push(tableName);
  }
  if (missing.length) {
    const error = new Error(`Data Integrity cannot run because required tables are missing: ${missing.join(', ')}.`);
    error.statusCode = 503;
    error.code = 'DATA_INTEGRITY_SCHEMA_INCOMPLETE';
    throw error;
  }
};

const getAccountRows = async (connection, scope = {}) => {
  const { where, params } = accountScopeWhere(scope);
  const [rows] = await connection.query(
    `
      SELECT
        account.*,
        project.lot_project_name AS project_name,
        project.lot_project_slug AS project_slug,
        project.lot_project_status AS project_status,
        listing.lot_project_listing_unit_id,
        listing.lot_project_listing_old_unit_ids,
        listing.lot_project_listing_area_sqm,
        listing.lot_project_listing_price_per_sqm,
        listing.lot_project_listing_installment_price_per_sqm,
        listing.lot_project_listing_cash_price_per_sqm,
        listing.lot_project_listing_net_selling_price,
        listing.lot_project_listing_lmf_rate,
        listing.lot_project_listing_lmf_amount,
        listing.lot_project_listing_tcp,
        listing.lot_project_listing_reservation_fee,
        listing.annual_interest_rate,
        listing.lot_project_listing_status,
        listing.lot_project_listing_sold_substatus,
        listing.current_account_id,
        profile.buyer_full_name,
        profile.buyer_email,
        profile.lot_project_client_profile_status,
        profile.soa_mode_of_payment,
        profile.soa_selected_price_per_sqm,
        profile.soa_selected_base_selling_price,
        profile.soa_sale_discount_percentage,
        profile.soa_sale_discount_amount,
        profile.soa_selected_net_selling_price,
        profile.soa_selected_lmf_amount,
        profile.soa_selected_tcp,
        profile.soa_reservation_fee,
        profile.soa_reservation_fee_applied_to_downpayment,
        profile.soa_legal_misc_fee_mode,
        profile.soa_legal_misc_fee_amount,
        profile.soa_lmf_waived_amount,
        profile.soa_lmf_waiver_reason,
        profile.soa_starting_date,
        profile.soa_first_due_date,
        profile.soa_is_historical_entry,
        profile.soa_downpayment_percentage,
        profile.soa_downpayment_input_mode,
        profile.soa_downpayment_amount,
        profile.soa_downpayment_terms,
        profile.soa_monthly_terms,
        profile.soa_annual_interest_rate,
        profile.soa_interest_rate_overridden,
        profile.soa_dp_discount_percentage,
        profile.soa_penalty_rate_percent,
        profile.soa_penalty_grace_days,
        profile.soa_penalty_calculation_method,
        profile.needs_soa_review
      FROM lot_project_accounts account
      INNER JOIN lot_projects project
        ON project.lot_project_id = account.lot_project_id
      INNER JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = account.lot_project_listing_id
      LEFT JOIN lot_project_client_profiles profile
        ON profile.lot_project_client_profile_id = account.lot_project_client_profile_id
      ${where}
      ORDER BY project.lot_project_name ASC, account.unit_id_snapshot ASC, account.created_at DESC
    `,
    params
  );
  return rows;
};

const buildScopePredicate = (accountIds = [], profileIds = [], alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  const clauses = [];
  const params = [];
  if (accountIds.length) {
    clauses.push(`${prefix}lot_project_account_id IN (${accountIds.map(() => '?').join(', ')})`);
    params.push(...accountIds);
  }
  if (profileIds.length) {
    clauses.push(`${prefix}lot_project_client_profile_id IN (${profileIds.map(() => '?').join(', ')})`);
    params.push(...profileIds);
  }
  return {
    sql: clauses.length ? `(${clauses.join(' OR ')})` : '1 = 0',
    params,
  };
};

const queryRowsIfTableExists = async (connection, tableName, sql, params = []) => {
  if (!(await tableExists(connection, tableName))) return [];
  const [rows] = await connection.query(sql, params);
  return rows;
};

const loadIntegrityDataset = async (connection, scope = {}) => {
  await assertIntegritySchema(connection);
  const accounts = await getAccountRows(connection, scope);
  if (!accounts.length) {
    return {
      accounts,
      payments: [],
      schedules: [],
      commissions: [],
      releases: [],
      receipts: [],
      receiptItems: [],
      adjustments: [],
      penaltyReliefs: [],
      clientDocumentFiles: [],
      paymentProofs: [],
      receiptFiles: [],
      acknowledgementFiles: [],
    };
  }

  const accountIds = accounts.map((row) => Number(row.lot_project_account_id)).filter(Boolean);
  const profileIds = accounts.map((row) => Number(row.lot_project_client_profile_id)).filter(Boolean);
  const paymentScope = buildScopePredicate(accountIds, profileIds, 'payment');
  const scheduleScope = buildScopePredicate(accountIds, profileIds, 'schedule');
  const commissionScope = buildScopePredicate(accountIds, profileIds, 'commission');
  const receiptScope = buildScopePredicate(accountIds, profileIds, 'receipt');

  const [payments] = await connection.query(
    `
      SELECT
        payment.*,
        COALESCE(allocation_summary.allocation_total, 0) AS allocation_total,
        COALESCE(allocation_summary.allocation_count, 0) AS allocation_count
      FROM lot_project_payments payment
      LEFT JOIN (
        SELECT
          lot_project_payment_id,
          SUM(applied_amount) AS allocation_total,
          COUNT(*) AS allocation_count
        FROM lot_project_payment_allocations
        GROUP BY lot_project_payment_id
      ) allocation_summary
        ON allocation_summary.lot_project_payment_id = payment.lot_project_payment_id
      WHERE ${paymentScope.sql}
      ORDER BY payment.lot_project_payment_date ASC, payment.lot_project_payment_id ASC
    `,
    paymentScope.params
  );

  const [schedules] = await connection.query(
    `
      SELECT
        schedule.*,
        COALESCE(verified_allocations.verified_allocation_total, 0) AS verified_allocation_total
      FROM lot_project_payment_schedules schedule
      LEFT JOIN (
        SELECT
          allocation.lot_project_payment_schedule_id,
          SUM(allocation.applied_amount) AS verified_allocation_total
        FROM lot_project_payment_allocations allocation
        INNER JOIN lot_project_payments payment
          ON payment.lot_project_payment_id = allocation.lot_project_payment_id
         AND payment.lot_project_payment_status = 'Verified'
        GROUP BY allocation.lot_project_payment_schedule_id
      ) verified_allocations
        ON verified_allocations.lot_project_payment_schedule_id = schedule.lot_project_payment_schedule_id
      WHERE ${scheduleScope.sql}
        AND ${getLatestActiveScheduleGenerationPredicate('schedule')}
      ORDER BY schedule.due_date ASC, schedule.lot_project_payment_schedule_id ASC
    `,
    scheduleScope.params
  );

  const [commissions] = await connection.query(
    `
      SELECT commission.*
      FROM lot_project_commissions commission
      WHERE ${commissionScope.sql}
      ORDER BY commission.lot_project_commission_id ASC
    `,
    commissionScope.params
  );

  const commissionIds = commissions.map((row) => Number(row.lot_project_commission_id)).filter(Boolean);
  let releases = [];
  if (commissionIds.length) {
    const releaseEntryModeColumn = await columnExists(connection, 'lot_project_commission_releases', 'release_entry_mode');
    const releaseRecordedAtColumn = await columnExists(connection, 'lot_project_commission_releases', 'release_recorded_at');
    const historicalNoteColumn = await columnExists(connection, 'lot_project_commission_releases', 'historical_release_note');
    const [releaseRows] = await connection.query(
      `
        SELECT
          release_row.*
          ${releaseEntryModeColumn ? '' : ", 'live' AS release_entry_mode"}
          ${releaseRecordedAtColumn ? '' : ', release_row.updated_at AS release_recorded_at'}
          ${historicalNoteColumn ? '' : ', NULL AS historical_release_note'}
        FROM lot_project_commission_releases release_row
        WHERE release_row.lot_project_commission_id IN (${commissionIds.map(() => '?').join(', ')})
        ORDER BY release_row.lot_project_commission_id ASC,
          FIELD(release_row.release_stage, '1st Release', '2nd Release', '3rd Release', '4th Release', 'Retention')
      `,
      commissionIds
    );
    releases = releaseRows;
  }

  const [receipts] = await connection.query(
    `
      SELECT receipt.*
      FROM lot_project_commission_receipts receipt
      WHERE ${receiptScope.sql}
      ORDER BY receipt.receipt_date ASC, receipt.lot_project_commission_receipt_id ASC
    `,
    receiptScope.params
  );

  const receiptIds = receipts.map((row) => Number(row.lot_project_commission_receipt_id)).filter(Boolean);
  let receiptItems = [];
  if (receiptIds.length) {
    const [rows] = await connection.query(
      `
        SELECT
          item.*,
          release_row.actual_release_date,
          release_row.net_release_amount,
          release_row.release_status,
          release_row.lot_project_commission_id
        FROM lot_project_commission_receipt_items item
        LEFT JOIN lot_project_commission_releases release_row
          ON release_row.lot_project_commission_release_id = item.lot_project_commission_release_id
        WHERE item.lot_project_commission_receipt_id IN (${receiptIds.map(() => '?').join(', ')})
        ORDER BY item.lot_project_commission_receipt_id ASC, item.lot_project_commission_receipt_item_id ASC
      `,
      receiptIds
    );
    receiptItems = rows;
  }

  const adjustmentScope = buildScopePredicate(accountIds, profileIds, 'adjustment_row');
  const penaltyScope = buildScopePredicate(accountIds, profileIds, 'relief');
  const adjustments = await queryRowsIfTableExists(
    connection,
    'lot_project_contract_adjustments',
    `SELECT adjustment_row.* FROM lot_project_contract_adjustments adjustment_row WHERE ${adjustmentScope.sql} ORDER BY adjustment_row.created_at ASC`,
    adjustmentScope.params
  );
  const penaltyReliefs = await queryRowsIfTableExists(
    connection,
    'lot_project_penalty_reliefs',
    `SELECT relief.* FROM lot_project_penalty_reliefs relief WHERE ${penaltyScope.sql} ORDER BY relief.created_at ASC`,
    penaltyScope.params
  );

  const clientDocumentFiles = await queryRowsIfTableExists(
    connection,
    'lot_project_client_document_files',
    `SELECT file_row.* FROM lot_project_client_document_files file_row WHERE file_row.lot_project_account_id IN (${accountIds.map(() => '?').join(', ')})`,
    accountIds
  );
  const proofScope = buildScopePredicate(accountIds, profileIds, 'proof');
  const paymentProofs = await queryRowsIfTableExists(
    connection,
    'lot_project_payment_proofs',
    `SELECT proof.* FROM lot_project_payment_proofs proof WHERE ${proofScope.sql}`,
    proofScope.params
  );
  const receiptFileScope = buildScopePredicate(accountIds, profileIds, 'receipt_file');
  const receiptFiles = await queryRowsIfTableExists(
    connection,
    'lot_project_commission_receipt_files',
    `SELECT receipt_file.* FROM lot_project_commission_receipt_files receipt_file WHERE ${receiptFileScope.sql}`,
    receiptFileScope.params
  );
  const ackScope = buildScopePredicate(accountIds, profileIds, 'ack_file');
  const acknowledgementFiles = await queryRowsIfTableExists(
    connection,
    'lot_project_payment_acknowledgement_files',
    `SELECT ack_file.* FROM lot_project_payment_acknowledgement_files ack_file WHERE ${ackScope.sql}`,
    ackScope.params
  );

  return {
    accounts,
    payments,
    schedules,
    commissions,
    releases,
    receipts,
    receiptItems,
    adjustments,
    penaltyReliefs,
    clientDocumentFiles,
    paymentProofs,
    receiptFiles,
    acknowledgementFiles,
  };
};

const groupByResolvedAccount = (accounts = [], rows = []) => {
  const byAccountId = new Map(accounts.map((row) => [Number(row.lot_project_account_id), row]));
  const byProfileId = new Map(accounts.map((row) => [Number(row.lot_project_client_profile_id), row]).filter(([key]) => key));
  const grouped = new Map(accounts.map((row) => [Number(row.lot_project_account_id), []]));

  for (const row of rows) {
    const explicitAccountId = Number(row.lot_project_account_id || 0);
    const profileId = Number(row.lot_project_client_profile_id || 0);
    const account = byAccountId.get(explicitAccountId) || byProfileId.get(profileId);
    if (!account) continue;
    const key = Number(account.lot_project_account_id);
    grouped.get(key)?.push(row);
  }
  return grouped;
};

const groupBy = (rows = [], keyName) => {
  const map = new Map();
  for (const row of rows) {
    const key = Number(row[keyName] || 0);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
};

const summarizeAdjustments = (account, schedules, adjustments, penaltyReliefs, terms) => {
  const saleDiscountAmount = roundMoney(account.soa_sale_discount_amount);
  const approvedDpDiscount = roundMoney(terms.downpaymentDiscountTotal);
  const scheduleDiscountAmount = roundMoney(
    schedules.reduce((sum, row) => sum + toNumber(row.discount_amount), 0)
  );
  const lmfWaivedAmount = roundMoney(account.soa_lmf_waived_amount);
  const activeLmfAdjustments = adjustments.filter((row) => row.adjustment_type === 'lmf_waiver' && row.status === 'active');
  const activePenaltyReliefs = penaltyReliefs.filter((row) => !['cancelled', 'restored'].includes(clean(row.status).toLowerCase()));
  const penaltyWaivedAmount = roundMoney(
    activePenaltyReliefs
      .filter((row) => ['full_waiver', 'partial_waiver'].includes(clean(row.relief_type).toLowerCase()))
      .reduce((sum, row) => sum + toNumber(row.relief_amount), 0)
  );

  return {
    hasAdjustments: [saleDiscountAmount, approvedDpDiscount, lmfWaivedAmount, penaltyWaivedAmount].some((value) => value > MONEY_TOLERANCE),
    saleDiscountPercentage: toNumber(account.soa_sale_discount_percentage),
    saleDiscountAmount,
    approvedDpDiscount,
    scheduleDiscountAmount,
    reservationFeeCredit: roundMoney(terms.reservationFeeDownpaymentCredit),
    lmfWaivedAmount,
    lmfAdjustmentCount: activeLmfAdjustments.length,
    penaltyWaivedAmount,
    penaltyReliefCount: activePenaltyReliefs.length,
  };
};

const buildAccountReports = (dataset) => {
  const paymentsByAccount = groupByResolvedAccount(dataset.accounts, dataset.payments);
  const schedulesByAccount = groupByResolvedAccount(dataset.accounts, dataset.schedules);
  const commissionsByAccount = groupByResolvedAccount(dataset.accounts, dataset.commissions);
  const receiptsByAccount = groupByResolvedAccount(dataset.accounts, dataset.receipts);
  const adjustmentsByAccount = groupByResolvedAccount(dataset.accounts, dataset.adjustments);
  const reliefsByAccount = groupByResolvedAccount(dataset.accounts, dataset.penaltyReliefs);
  const documentFilesByAccount = groupByResolvedAccount(dataset.accounts, dataset.clientDocumentFiles);
  const proofFilesByAccount = groupByResolvedAccount(dataset.accounts, dataset.paymentProofs);
  const receiptFilesByAccount = groupByResolvedAccount(dataset.accounts, dataset.receiptFiles);
  const acknowledgementFilesByAccount = groupByResolvedAccount(dataset.accounts, dataset.acknowledgementFiles);
  const releasesByCommission = groupBy(dataset.releases, 'lot_project_commission_id');
  const receiptItemsByReceipt = groupBy(dataset.receiptItems, 'lot_project_commission_receipt_id');
  const today = todayDateOnly();

  return dataset.accounts.map((account) => {
    const accountId = Number(account.lot_project_account_id);
    const payments = paymentsByAccount.get(accountId) || [];
    const schedules = schedulesByAccount.get(accountId) || [];
    const commissions = commissionsByAccount.get(accountId) || [];
    const receipts = receiptsByAccount.get(accountId) || [];
    const adjustments = adjustmentsByAccount.get(accountId) || [];
    const penaltyReliefs = reliefsByAccount.get(accountId) || [];
    const clientDocumentFiles = documentFilesByAccount.get(accountId) || [];
    const paymentProofs = proofFilesByAccount.get(accountId) || [];
    const receiptFiles = receiptFilesByAccount.get(accountId) || [];
    const acknowledgementFiles = acknowledgementFilesByAccount.get(accountId) || [];
    const report = {
      id: accountId,
      accountId,
      accountReference: account.account_reference,
      accountStatus: account.account_status,
      projectId: Number(account.lot_project_id),
      projectName: account.project_name,
      projectSlug: account.project_slug,
      listingId: Number(account.lot_project_listing_id),
      unitId: account.unit_id_snapshot || account.lot_project_listing_unit_id,
      buyerName: account.buyer_full_name || account.buyer_name_snapshot || '-',
      reservationDate: dateOnly(account.reservation_date),
      accountStartingDate: dateOnly(account.soa_starting_date) || dateOnly(account.reservation_date),
      isHistorical: Number(account.soa_is_historical_entry || 0) === 1 || account.account_status === 'cancelled',
      isCurrent: Number(account.current_account_id || 0) === accountId,
      status: 'balanced',
      differenceAmount: 0,
      issues: [],
      issueCounts: {
        accounts: 0,
        paymentsSoa: 0,
        adjustments: 0,
        commissions: 0,
        proofOfIncome: 0,
        documentsFiles: 0,
      },
    };

    if (!Number(account.lot_project_client_profile_id || 0)) {
      addIssue(report, makeIssue({
        category: 'accounts', severity: 'critical', title: 'Buyer profile is missing',
        message: 'This buyer account is not linked to a client profile.', entityType: 'account', entityId: accountId,
      }));
    }

    if (account.account_status === 'cancelled' && report.isCurrent) {
      addIssue(report, makeIssue({
        category: 'accounts', severity: 'critical', title: 'Cancelled account is still current',
        message: 'The listing still points to this cancelled buyer account as its current account.', entityType: 'account', entityId: accountId,
      }));
    }

    if (ACTIVE_ACCOUNT_STATUSES.has(account.account_status) && !report.isCurrent && account.account_status !== 'closed_fully_paid') {
      addIssue(report, makeIssue({
        category: 'accounts', severity: 'review', title: 'Active account is not the listing current account',
        message: 'Review whether this buyer account should still be operational or should be closed/cancelled.', entityType: 'account', entityId: accountId,
      }));
    }

    if (report.isCurrent && ['available', 'hold', 'cancelled'].includes(clean(account.lot_project_listing_status).toLowerCase())) {
      addIssue(report, makeIssue({
        category: 'accounts', severity: 'critical', title: 'Listing status conflicts with current buyer account',
        message: `The listing is ${account.lot_project_listing_status} but still has a current buyer account.`, entityType: 'listing', entityId: account.lot_project_listing_id,
      }));
    }

    if (Number(account.needs_soa_review || 0) === 1) {
      addIssue(report, makeIssue({
        category: 'paymentsSoa', severity: 'review', title: 'SOA is marked for review',
        message: 'The buyer profile carries the needs_soa_review flag.', entityType: 'account', entityId: accountId,
      }));
    }

    const terms = getComputedSoaTerms(account, schedules);
    const progressSnapshot = calculateCommissionPaymentProgress({
      terms,
      payments,
      forceFullyPaid: clean(account.lot_project_listing_sold_substatus).toLowerCase() === 'fully_paid',
    });
    const verifiedCash = progressSnapshot.verifiedCash;
    const earnedDpDiscount = progressSnapshot.earnedDpDiscount;
    const settledValue = progressSnapshot.settledValue;
    const commissionProgress = progressSnapshot.paymentPercent;
    const contractRemaining = progressSnapshot.remainingBalance;
    const adjustmentSummary = summarizeAdjustments(account, schedules, adjustments, penaltyReliefs, terms);

    const baseSellingPrice = roundMoney(account.soa_selected_base_selling_price);
    const savedSaleDiscount = roundMoney(account.soa_sale_discount_amount);
    const saleDiscountPercentage = toNumber(account.soa_sale_discount_percentage);
    const expectedPricing = baseSellingPrice > 0
      ? calculateContractPricing({
          lotAreaSqm: 1,
          pricePerSqm: baseSellingPrice,
          legalMiscRate: 0,
          saleDiscountPercentage,
        })
      : null;
    const expectedSaleDiscount = expectedPricing ? roundMoney(expectedPricing.saleDiscountAmount) : 0;
    const expectedNetSellingPrice = expectedPricing ? roundMoney(expectedPricing.netSellingPrice) : 0;
    if (baseSellingPrice > 0 && differs(savedSaleDiscount, expectedSaleDiscount)) {
      addIssue(report, makeIssue({
        category: 'adjustments', severity: 'review', title: 'Sale discount snapshot does not match its percentage',
        message: `Saved discount is ${savedSaleDiscount.toFixed(2)} but ${saleDiscountPercentage.toFixed(2)}% of the saved base selling price is ${expectedSaleDiscount.toFixed(2)}.`,
        amountDifference: moneyDiff(savedSaleDiscount, expectedSaleDiscount), entityType: 'account', entityId: accountId,
      }));
    }
    if (baseSellingPrice > 0 && toNumber(account.soa_selected_net_selling_price) > 0 && differs(account.soa_selected_net_selling_price, expectedNetSellingPrice)) {
      addIssue(report, makeIssue({
        category: 'adjustments', severity: 'review', title: 'Net selling price does not match the saved sale discount',
        message: 'The saved contract net selling price does not equal base selling price less the saved discount percentage.',
        amountDifference: moneyDiff(account.soa_selected_net_selling_price, expectedNetSellingPrice), entityType: 'account', entityId: accountId,
      }));
    }

    if (schedules.length && adjustmentSummary.approvedDpDiscount > MONEY_TOLERANCE && differs(adjustmentSummary.scheduleDiscountAmount, adjustmentSummary.approvedDpDiscount)) {
      addIssue(report, makeIssue({
        category: 'adjustments', severity: 'review', title: 'DP discount does not match the latest SOA schedule',
        message: 'The saved DP discount and the sum of discount amounts on the latest SOA generation differ.',
        amountDifference: moneyDiff(adjustmentSummary.scheduleDiscountAmount, adjustmentSummary.approvedDpDiscount), entityType: 'account', entityId: accountId,
      }));
    }

    for (const payment of payments) {
      const status = clean(payment.lot_project_payment_status).toLowerCase();
      const type = clean(payment.lot_project_payment_type).toLowerCase();
      const paymentAmount = roundMoney(payment.lot_project_payment_amount);
      const allocationTotal = roundMoney(payment.allocation_total);
      const explicitAccountId = Number(payment.lot_project_account_id || 0);
      if (explicitAccountId && explicitAccountId !== accountId) continue;

      if (status === 'verified' && type !== 'balloon' && differs(paymentAmount, allocationTotal)) {
        addIssue(report, makeIssue({
          category: 'paymentsSoa', severity: 'critical', title: 'Verified payment allocation does not balance',
          message: `Payment ${payment.lot_project_payment_reference_id || `#${payment.lot_project_payment_id}`} is ${paymentAmount.toFixed(2)} but its SOA allocations total ${allocationTotal.toFixed(2)}.`,
          amountDifference: moneyDiff(paymentAmount, allocationTotal), entityType: 'payment', entityId: payment.lot_project_payment_id,
        }));
      }
      if (status !== 'verified' && allocationTotal > MONEY_TOLERANCE) {
        addIssue(report, makeIssue({
          category: 'paymentsSoa', severity: 'critical', title: 'Non-verified payment still has SOA allocations',
          message: `Payment ${payment.lot_project_payment_reference_id || `#${payment.lot_project_payment_id}`} is ${payment.lot_project_payment_status} but still has ${allocationTotal.toFixed(2)} allocated.`,
          amountDifference: allocationTotal, entityType: 'payment', entityId: payment.lot_project_payment_id,
        }));
      }
      if (!explicitAccountId && Number(payment.lot_project_client_profile_id || 0) === Number(account.lot_project_client_profile_id || 0)) {
        addIssue(report, makeIssue({
          category: 'accounts', severity: 'review', title: 'Payment has no buyer account id',
          message: `Payment ${payment.lot_project_payment_reference_id || `#${payment.lot_project_payment_id}`} is linked only through the buyer profile.`, entityType: 'payment', entityId: payment.lot_project_payment_id,
        }));
      }
    }

    for (const schedule of schedules) {
      if (clean(schedule.schedule_status).toLowerCase() === 'cancelled') continue;
      const scheduleType = getStoredScheduleType(schedule);
      if (scheduleType === 'balloon') continue;
      const storedPaid = roundMoney(schedule.amount_paid);
      const allocatedPaid = roundMoney(schedule.verified_allocation_total);
      if (differs(storedPaid, allocatedPaid)) {
        addIssue(report, makeIssue({
          category: 'paymentsSoa', severity: 'critical', title: 'SOA paid amount does not match payment allocations',
          message: `${schedule.description || 'SOA row'} stores ${storedPaid.toFixed(2)} paid but verified allocations total ${allocatedPaid.toFixed(2)}.`,
          amountDifference: moneyDiff(storedPaid, allocatedPaid), entityType: 'schedule', entityId: schedule.lot_project_payment_schedule_id,
        }));
      }
      if (toNumber(schedule.ending_balance) < -MONEY_TOLERANCE || toNumber(schedule.amount_paid) < -MONEY_TOLERANCE || toNumber(schedule.discount_amount) < -MONEY_TOLERANCE) {
        addIssue(report, makeIssue({
          category: 'paymentsSoa', severity: 'critical', title: 'SOA contains a negative financial value',
          message: `${schedule.description || 'SOA row'} contains a negative stored balance, payment, or discount.`, entityType: 'schedule', entityId: schedule.lot_project_payment_schedule_id,
        }));
      }
    }

    for (const commission of commissions) {
      const commissionReleases = releasesByCommission.get(Number(commission.lot_project_commission_id)) || [];
      const releasedRows = commissionReleases.filter((release) => release.release_status === 'Released');
      const releasedNet = roundMoney(releasedRows.reduce((sum, release) => sum + toNumber(release.net_release_amount), 0));
      const allDeductions = roundMoney(commissionReleases.reduce((sum, release) => sum + toNumber(release.deduction_amount), 0));
      const cancellationSettled = commissionReleases.some((release) =>
        ['Earned on Cancellation', 'Forfeited on Cancellation'].includes(release.release_status)
      );
      const expectedRemaining = cancellationSettled
        ? roundMoney(
            commissionReleases
              .filter((release) => release.release_status === 'Earned on Cancellation')
              .reduce((sum, release) => sum + toNumber(release.net_release_amount), 0)
          )
        : roundMoney(Math.max(toNumber(commission.gross_commission_amount) - releasedNet - allDeductions, 0));

      if (differs(commission.released_commission_amount, releasedNet)) {
        addIssue(report, makeIssue({
          category: 'commissions', severity: 'critical', title: 'Commission released total does not match released milestones',
          message: 'The commission header released amount differs from the sum of released milestone net amounts.',
          amountDifference: moneyDiff(commission.released_commission_amount, releasedNet), entityType: 'commission', entityId: commission.lot_project_commission_id,
        }));
      }
      if (differs(commission.net_remaining_commission_amount, expectedRemaining)) {
        addIssue(report, makeIssue({
          category: 'commissions', severity: 'critical', title: 'Commission remaining amount does not reconcile',
          message: 'Gross commission less released net amounts and release deductions does not equal the stored remaining commission.',
          amountDifference: moneyDiff(commission.net_remaining_commission_amount, expectedRemaining), entityType: 'commission', entityId: commission.lot_project_commission_id,
        }));
      }
      if (differs(commission.payment_percent, commissionProgress, 0.1)) {
        addIssue(report, makeIssue({
          category: 'commissions', severity: 'review', title: 'Stored commission payment progress is stale or inconsistent',
          message: `Stored progress is ${toNumber(commission.payment_percent).toFixed(2)}% while the current discount-aware calculation is ${commissionProgress.toFixed(2)}%.`, entityType: 'commission', entityId: commission.lot_project_commission_id,
        }));
      }

      for (const release of releasedRows) {
        const actualDate = dateOnly(release.actual_release_date);
        if (!actualDate) {
          addIssue(report, makeIssue({
            category: 'commissions', severity: 'critical', title: 'Released commission is missing its actual release date',
            message: `${release.release_stage} is marked Released without an actual release date.`, entityType: 'commission_release', entityId: release.lot_project_commission_release_id,
          }));
        }
        if (!Number(release.released_by_user_id || 0)) {
          addIssue(report, makeIssue({
            category: 'commissions', severity: 'review', title: 'Released commission has no recorded actor',
            message: `${release.release_stage} does not have a released-by user id.`, entityType: 'commission_release', entityId: release.lot_project_commission_release_id,
          }));
        }
        if (actualDate && actualDate > today) {
          addIssue(report, makeIssue({
            category: 'commissions', severity: 'critical', title: 'Commission release date is in the future',
            message: `${release.release_stage} has actual release date ${actualDate}.`, entityType: 'commission_release', entityId: release.lot_project_commission_release_id,
          }));
        }
        if (actualDate && report.accountStartingDate && actualDate < report.accountStartingDate) {
          addIssue(report, makeIssue({
            category: 'commissions', severity: 'critical', title: 'Commission release predates the buyer account',
            message: `${release.release_stage} was recorded on ${actualDate}, before buyer account starting date ${report.accountStartingDate}.`, entityType: 'commission_release', entityId: release.lot_project_commission_release_id,
          }));
        }
        if (clean(release.release_entry_mode).toLowerCase() === 'historical' && actualDate && !release.cancellation_earning_reason) {
          const historicalProgress = calculateCommissionPaymentProgress({
            terms,
            payments,
            cutoffDate: actualDate,
          }).paymentPercent;
          const triggerPercent = toNumber(release.release_trigger_percent);
          if (historicalProgress + 0.01 < triggerPercent) {
            addIssue(report, makeIssue({
              category: 'commissions', severity: 'critical', title: 'Historical release is not supported by encoded payment history',
              message: `${release.release_stage} required ${triggerPercent.toFixed(2)}% progress on ${actualDate}, but verified cash plus earned DP discount encoded on or before that date supports only ${historicalProgress.toFixed(2)}%.`,
              entityType: 'commission_release', entityId: release.lot_project_commission_release_id,
            }));
          }
        }
        if (clean(release.release_entry_mode).toLowerCase() === 'historical' && !release.release_recorded_at) {
          addIssue(report, makeIssue({
            category: 'commissions', severity: 'review', title: 'Historical release is missing its recorded-at timestamp',
            message: `${release.release_stage} is historical but does not have release_recorded_at.`, entityType: 'commission_release', entityId: release.lot_project_commission_release_id,
          }));
        }
      }
    }

    for (const receipt of receipts) {
      if (clean(receipt.receipt_status).toLowerCase() === 'void') continue;
      const items = receiptItemsByReceipt.get(Number(receipt.lot_project_commission_receipt_id)) || [];
      const itemTotal = roundMoney(items.reduce((sum, item) => sum + toNumber(item.release_amount), 0));
      if (differs(receipt.total_amount, itemTotal)) {
        addIssue(report, makeIssue({
          category: 'proofOfIncome', severity: 'critical', title: 'Proof of Income total does not match included releases',
          message: `Receipt ${receipt.reference_number || `#${receipt.lot_project_commission_receipt_id}`} totals ${toNumber(receipt.total_amount).toFixed(2)} but its items total ${itemTotal.toFixed(2)}.`,
          amountDifference: moneyDiff(receipt.total_amount, itemTotal), entityType: 'receipt', entityId: receipt.lot_project_commission_receipt_id,
        }));
      }
      let latestReleaseDate = null;
      for (const item of items) {
        const releaseDate = dateOnly(item.actual_release_date);
        if (releaseDate && (!latestReleaseDate || releaseDate > latestReleaseDate)) latestReleaseDate = releaseDate;
        if (item.release_status !== 'Released') {
          addIssue(report, makeIssue({
            category: 'proofOfIncome', severity: 'critical', title: 'Proof of Income contains a non-released commission stage',
            message: `Receipt item #${item.lot_project_commission_receipt_item_id} points to a commission stage that is not Released.`, entityType: 'receipt', entityId: receipt.lot_project_commission_receipt_id,
          }));
        }
        if (differs(item.release_amount, item.net_release_amount)) {
          addIssue(report, makeIssue({
            category: 'proofOfIncome', severity: 'critical', title: 'Receipt item amount differs from the commission release',
            message: 'A Proof of Income item no longer matches its linked released commission net amount.',
            amountDifference: moneyDiff(item.release_amount, item.net_release_amount), entityType: 'receipt', entityId: receipt.lot_project_commission_receipt_id,
          }));
        }
      }
      const receiptDate = dateOnly(receipt.receipt_date);
      if (latestReleaseDate && receiptDate && receiptDate < latestReleaseDate) {
        addIssue(report, makeIssue({
          category: 'proofOfIncome', severity: 'critical', title: 'Proof of Income date predates an included commission release',
          message: `Receipt date ${receiptDate} is earlier than latest included release date ${latestReleaseDate}.`, entityType: 'receipt', entityId: receipt.lot_project_commission_receipt_id,
        }));
      }
      if (receiptDate && receiptDate > today) {
        addIssue(report, makeIssue({
          category: 'proofOfIncome', severity: 'critical', title: 'Proof of Income date is in the future',
          message: `Receipt ${receipt.reference_number || `#${receipt.lot_project_commission_receipt_id}`} is dated ${receiptDate}.`, entityType: 'receipt', entityId: receipt.lot_project_commission_receipt_id,
        }));
      }
    }

    const inspectFiles = (rows, { activeField = 'file_status', activeValue = 'active', idField, label }) => {
      for (const file of rows) {
        if (clean(file[activeField]).toLowerCase() !== activeValue) continue;
        const publicId = clean(file.cloudinary_public_id);
        if (!publicId) {
          addIssue(report, makeIssue({
            category: 'documentsFiles', severity: 'critical', title: `${label} is missing protected storage metadata`,
            message: 'An active file record does not have a Cloudinary public id.', entityType: 'file', entityId: file[idField],
          }));
        }
        const scan = clean(file.malware_scan_status).toLowerCase();
        if (scan && !VALID_SCAN_STATUSES.has(scan)) {
          addIssue(report, makeIssue({
            category: 'documentsFiles', severity: 'review', title: `${label} has an unknown malware scan status`,
            message: `Stored scan status is ${file.malware_scan_status}.`, entityType: 'file', entityId: file[idField],
          }));
        }
      }
    };
    inspectFiles(clientDocumentFiles, { idField: 'lot_project_client_document_file_id', label: 'Buyer document file' });
    inspectFiles(paymentProofs, { activeField: 'proof_status', activeValue: 'active', idField: 'lot_project_payment_proof_id', label: 'Payment proof' });
    inspectFiles(receiptFiles, { idField: 'lot_project_commission_receipt_file_id', label: 'Proof of Income signed copy' });
    inspectFiles(acknowledgementFiles, { idField: 'lot_project_payment_acknowledgement_file_id', label: 'Payment acknowledgement signed copy' });

    const activeClientDocumentFiles = clientDocumentFiles.filter((row) => clean(row.file_status).toLowerCase() === 'active');
    const activePaymentProofs = paymentProofs.filter((row) => clean(row.proof_status).toLowerCase() === 'active');
    const activeReceiptFiles = receiptFiles.filter((row) => clean(row.file_status).toLowerCase() === 'active');
    const activeAcknowledgementFiles = acknowledgementFiles.filter((row) => clean(row.file_status).toLowerCase() === 'active');
    const activeFileCount = activeClientDocumentFiles.length
      + activePaymentProofs.length
      + activeReceiptFiles.length
      + activeAcknowledgementFiles.length;

    report.financial = {
      baseSellingPrice,
      saleDiscountPercentage,
      saleDiscountAmount: savedSaleDiscount,
      netSellingPrice: roundMoney(account.soa_selected_net_selling_price),
      legalMiscFeeAmount: roundMoney(terms.legalMiscFeeAmount),
      effectiveTcp: roundMoney(terms.tcp),
      verifiedCash,
      approvedDpDiscount: roundMoney(terms.downpaymentDiscountTotal),
      earnedDpDiscount,
      reservationFee: roundMoney(terms.reservationFee),
      reservationFeeCredit: roundMoney(terms.reservationFeeDownpaymentCredit),
      downpaymentTarget: roundMoney(terms.downpaymentTargetTotal),
      downpaymentAfterDiscount: roundMoney(terms.discountedDownpaymentTarget),
      remainingDpCashRequired: roundMoney(terms.downpaymentTotal),
      settledValue,
      contractRemaining,
      commissionProgress,
      lmfWaivedAmount: roundMoney(account.soa_lmf_waived_amount),
      penaltyWaivedAmount: adjustmentSummary.penaltyWaivedAmount,
      scheduleDiscountAmount: adjustmentSummary.scheduleDiscountAmount,
    };
    report.adjustments = adjustmentSummary;
    report.counts = {
      payments: payments.length,
      verifiedPayments: payments.filter((row) => row.lot_project_payment_status === 'Verified').length,
      schedules: schedules.length,
      commissions: commissions.length,
      releasedCommissionStages: commissions.reduce((sum, commission) => sum + (releasesByCommission.get(Number(commission.lot_project_commission_id)) || []).filter((row) => row.release_status === 'Released').length, 0),
      receipts: receipts.filter((row) => row.receipt_status !== 'void').length,
      activeFiles: activeFileCount,
    };
    report.payments = payments.map((row) => ({
      id: Number(row.lot_project_payment_id),
      reference: row.lot_project_payment_reference_id || `#${row.lot_project_payment_id}`,
      type: row.lot_project_payment_type,
      status: row.lot_project_payment_status,
      date: dateOnly(row.lot_project_payment_date),
      amount: roundMoney(row.lot_project_payment_amount),
      allocationTotal: roundMoney(row.allocation_total),
      difference: clean(row.lot_project_payment_type).toLowerCase() === 'balloon'
        ? 0
        : moneyDiff(row.lot_project_payment_amount, row.allocation_total),
    }));
    report.soa = schedules.map((row) => ({
      id: Number(row.lot_project_payment_schedule_id),
      type: getStoredScheduleType(row),
      description: row.description,
      dueDate: dateOnly(row.due_date),
      dueAmount: roundMoney(row.due_amount),
      interest: roundMoney(row.interest_amount),
      discountAmount: roundMoney(row.discount_amount),
      penalty: roundMoney(row.penalty_amount),
      waivedPenalty: roundMoney(row.waived_penalty_amount),
      amountPaid: roundMoney(row.amount_paid),
      allocatedPaid: roundMoney(row.verified_allocation_total),
      endingBalance: roundMoney(row.ending_balance),
      status: row.schedule_status,
      totalDue: roundMoney(getScheduleTotalDue({
        dueAmount: row.due_amount,
        principalAmount: row.principal_amount,
        interest: row.interest_amount,
        discountAmount: row.discount_amount,
        penalty: row.penalty_amount,
      })),
    }));
    report.commissions = commissions.map((commission) => ({
      id: Number(commission.lot_project_commission_id),
      role: commission.commission_role,
      sellerType: commission.commission_seller_type,
      gross: roundMoney(commission.gross_commission_amount),
      storedReleased: roundMoney(commission.released_commission_amount),
      storedRemaining: roundMoney(commission.net_remaining_commission_amount),
      storedPaymentPercent: toNumber(commission.payment_percent),
      expectedPaymentPercent: commissionProgress,
      status: commission.commission_status,
      releases: (releasesByCommission.get(Number(commission.lot_project_commission_id)) || []).map((release) => ({
        id: Number(release.lot_project_commission_release_id),
        stage: release.release_stage,
        status: release.release_status,
        grossAmount: roundMoney(release.gross_release_amount),
        deductionAmount: roundMoney(release.deduction_amount),
        netAmount: roundMoney(release.net_release_amount),
        actualReleaseDate: dateOnly(release.actual_release_date),
        entryMode: release.release_entry_mode || 'live',
        recordedAt: release.release_recorded_at || null,
      })),
    }));
    report.receipts = receipts.map((receipt) => {
      const items = receiptItemsByReceipt.get(Number(receipt.lot_project_commission_receipt_id)) || [];
      return {
        id: Number(receipt.lot_project_commission_receipt_id),
        reference: receipt.reference_number,
        receiptDate: dateOnly(receipt.receipt_date),
        totalAmount: roundMoney(receipt.total_amount),
        itemTotal: roundMoney(items.reduce((sum, item) => sum + toNumber(item.release_amount), 0)),
        status: receipt.receipt_status,
        releases: items.map((item) => ({
          releaseId: Number(item.lot_project_commission_release_id),
          amount: roundMoney(item.release_amount),
          releaseDate: dateOnly(item.actual_release_date),
        })),
      };
    });
    report.files = {
      clientDocuments: activeClientDocumentFiles.length,
      paymentProofs: activePaymentProofs.length,
      proofOfIncomeSignedCopies: activeReceiptFiles.length,
      paymentAcknowledgements: activeAcknowledgementFiles.length,
    };
    report.links = {
      account: `/portal/lot-projects/${account.project_slug}/listings/${Number(account.lot_project_listing_id)}/accounts/${accountId}`,
      currentListing: `/portal/lot-projects/${account.project_slug}/listings/${Number(account.lot_project_listing_id)}`,
    };

    return report;
  });
};

const toSummaryRecord = (report) => ({
  id: report.id,
  accountId: report.accountId,
  accountReference: report.accountReference,
  accountStatus: report.accountStatus,
  projectId: report.projectId,
  projectName: report.projectName,
  projectSlug: report.projectSlug,
  listingId: report.listingId,
  unitId: report.unitId,
  buyerName: report.buyerName,
  reservationDate: report.reservationDate,
  accountStartingDate: report.accountStartingDate,
  isHistorical: report.isHistorical,
  isCurrent: report.isCurrent,
  status: report.status,
  differenceAmount: report.differenceAmount,
  issueCounts: report.issueCounts,
  issueCount: report.issues.length,
  topIssues: report.issues.slice(0, 3),
  financial: report.financial,
  adjustments: report.adjustments,
  counts: report.counts,
  links: report.links,
});

const buildSummary = (reports = []) => {
  const summary = {
    totalAccounts: reports.length,
    balanced: 0,
    review: 0,
    critical: 0,
    adjustedAccounts: 0,
    historicalAccounts: 0,
    totalDifference: 0,
    categories: {
      accounts: { label: 'Buyer Accounts', checked: reports.length, issues: 0, status: 'balanced' },
      paymentsSoa: { label: 'Payments & SOA', checked: reports.length, issues: 0, status: 'balanced' },
      adjustments: { label: 'Discounts & Adjustments', checked: 0, issues: 0, status: 'balanced' },
      commissions: { label: 'Commissions', checked: 0, issues: 0, status: 'balanced' },
      proofOfIncome: { label: 'Proof of Income', checked: 0, issues: 0, status: 'balanced' },
      documentsFiles: { label: 'Documents & Files', checked: 0, issues: 0, status: 'balanced' },
    },
  };

  for (const report of reports) {
    summary[report.status] += 1;
    if (report.adjustments?.hasAdjustments) summary.adjustedAccounts += 1;
    if (report.isHistorical) summary.historicalAccounts += 1;
    summary.totalDifference = roundMoney(summary.totalDifference + report.differenceAmount);
    summary.categories.adjustments.checked += report.adjustments?.hasAdjustments ? 1 : 0;
    summary.categories.commissions.checked += Number(report.counts?.commissions || 0);
    summary.categories.proofOfIncome.checked += Number(report.counts?.receipts || 0);
    summary.categories.documentsFiles.checked += Number(report.counts?.activeFiles || 0);

    for (const issue of report.issues) {
      const category = summary.categories[issue.category];
      if (!category) continue;
      category.issues += 1;
      category.status = strongerStatus(category.status, issue.severity);
    }
  }

  summary.overallStatus = summary.critical > 0 ? 'critical' : summary.review > 0 ? 'review' : 'balanced';
  return summary;
};

const parseReportFilters = (req) => ({
  projectSlug: clean(req.query.projectSlug || req.query.project || ''),
  accountId: Number(req.query.accountId || 0),
});

export const getDataIntegrityReport = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const dataset = await loadIntegrityDataset(connection, parseReportFilters(req));
    const reports = buildAccountReports(dataset);
    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: buildSummary(reports),
      records: reports.map(toSummaryRecord),
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getDataIntegritySummary = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const dataset = await loadIntegrityDataset(connection, parseReportFilters(req));
    const reports = buildAccountReports(dataset);
    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: buildSummary(reports),
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getDataIntegrityAccount = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const accountId = Number(req.params.accountId || 0);
    if (!accountId) return res.status(400).json({ message: 'Account id is required.' });
    const dataset = await loadIntegrityDataset(connection, { accountId });
    const report = buildAccountReports(dataset)[0];
    if (!report) return res.status(404).json({ message: 'Buyer account not found.' });

    // Reuse the canonical read-only SOA renderer for the detailed view. It reads
    // current penalty relief/discount state without updating any financial rows.
    const accountRow = dataset.accounts[0];
    const verifiedPayments = dataset.payments
      .filter((row) => row.lot_project_payment_status === 'Verified')
      .map((row) => ({
        id: row.lot_project_payment_id,
        paymentId: row.lot_project_payment_id,
        paymentType: row.lot_project_payment_type,
        paymentTypeValue: row.lot_project_payment_type,
        type: row.lot_project_payment_type,
        amount: toNumber(row.lot_project_payment_amount),
        paymentDate: dateOnly(row.lot_project_payment_date),
        referenceId: row.lot_project_payment_reference_id,
      }));
    try {
      report.canonicalSoaRows = await getListingSoaRows(
        connection,
        Number(accountRow.lot_project_id),
        Number(accountRow.lot_project_listing_id),
        accountRow,
        verifiedPayments,
        { accountId, readOnly: true }
      );
    } catch (soaError) {
      report.canonicalSoaRows = [];
      addIssue(report, makeIssue({
        category: 'paymentsSoa', severity: 'review', title: 'Canonical SOA detail could not be rendered',
        message: getErrorMessage(soaError), entityType: 'account', entityId: accountId,
      }));
    }

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      data: report,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
