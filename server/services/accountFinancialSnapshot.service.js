import { buildAccountContext } from './accountContext.service.js';
import { reconcileCommissionCohort, roundFinancialMoney } from './commissionReconciliation.service.js';

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clean = (value = '') => String(value ?? '').trim().toLowerCase();
const dateOnly = (value) => value ? String(value).slice(0, 10) : null;

const pickNumber = (source = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') return toNumber(source[key]);
  }
  return toNumber(fallback);
};

const rowStatus = (row = {}) => clean(row.status || row.schedule_status);
const rowType = (row = {}) => clean(row.scheduleType || row.schedule_type || row.description);
const rowDueDate = (row = {}) => dateOnly(row.dueDate || row.due_date);
const rowPaid = (row = {}) => pickNumber(row, ['amountPaid', 'amount_paid']);
const rowPenaltyPaid = (row = {}) => pickNumber(row, ['paidPenaltyAmount', 'paid_penalty_amount']);
const rowPenalty = (row = {}) => pickNumber(row, ['penalty', 'penaltyAmount', 'penalty_amount']);
const rowOutstandingPenalty = (row = {}) => Math.max(
  pickNumber(row, ['outstandingPenaltyAmount', 'outstanding_penalty_amount']),
  rowPenalty(row) - rowPenaltyPaid(row),
  0
);

const rowTotalDue = (row = {}) => {
  if (row.totalDue !== undefined || row.total_due !== undefined) {
    return Math.max(pickNumber(row, ['totalDue', 'total_due']), 0);
  }
  // Canonical SOA rows normally contain totalDue. This fallback supports older
  // payloads without inventing interest twice.
  return Math.max(pickNumber(row, ['dueAmount', 'due_amount']), 0);
};

const rowOutstanding = (row = {}) => Math.max(rowTotalDue(row) - rowPaid(row), 0);

export const todayManilaDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

export const summarizeSoaFinancials = ({ soaRows = [], payments = [], asOfDate = todayManilaDate(), fallbackRemainingPrincipal = 0 } = {}) => {
  const cutoff = dateOnly(asOfDate) || todayManilaDate();
  const activeRows = soaRows.filter((row) => rowStatus(row) !== 'cancelled');
  const outstandingRows = activeRows.map((row) => ({ row, outstanding: rowOutstanding(row) }));
  const finalBalanceRow = [...activeRows].reverse().find((row) => Number.isFinite(Number(row.endingBalance ?? row.ending_balance)));

  let overdueExcludingPenalty = 0;
  let overduePenalty = 0;
  let overdueIncludingPenalty = 0;
  let overdueRowCount = 0;
  let outstandingLmf = 0;

  for (const { row, outstanding } of outstandingRows) {
    if (outstanding <= 0.009) continue;

    if (rowType(row) === 'legal_misc' || rowType(row).includes('legal misc')) {
      outstandingLmf += outstanding;
    }

    const dueDate = rowDueDate(row);
    if (!dueDate || dueDate >= cutoff) continue;

    const penaltyOutstanding = Math.min(outstanding, rowOutstandingPenalty(row));
    overduePenalty += penaltyOutstanding;
    overdueExcludingPenalty += Math.max(outstanding - penaltyOutstanding, 0);
    overdueIncludingPenalty += outstanding;
    overdueRowCount += 1;
  }

  const verifiedCollections = roundFinancialMoney(
    payments
      .filter((payment) => clean(payment.status || payment.lot_project_payment_status) === 'verified')
      .reduce((sum, payment) => sum + pickNumber(payment, ['amount', 'lot_project_payment_amount']), 0)
  );

  return {
    verifiedCollections,
    remainingLotPrincipal: roundFinancialMoney(
      finalBalanceRow
        ? pickNumber(finalBalanceRow, ['endingBalance', 'ending_balance'])
        : fallbackRemainingPrincipal
    ),
    outstandingLmf: roundFinancialMoney(outstandingLmf),
    totalAccountOutstanding: roundFinancialMoney(outstandingRows.reduce((sum, item) => sum + item.outstanding, 0)),
    overdueExcludingPenalty: roundFinancialMoney(overdueExcludingPenalty),
    outstandingPenalty: roundFinancialMoney(overduePenalty),
    totalOverdueIncludingPenalty: roundFinancialMoney(overdueIncludingPenalty),
    overdueRowCount,
    asOfDate: cutoff,
  };
};

export const summarizeContractFinancials = ({ account = {}, listing = {}, cumulativePaid = null, refundedToDate = null, asOfDate = todayManilaDate() } = {}) => {
  const tcp = pickNumber(account, ['soa_selected_tcp', 'contract_tcp', 'tcp', 'tcp_snapshot'], pickNumber(listing, ['lot_project_listing_tcp', 'tcpAmount', 'tcp']));
  const dpDiscount = pickNumber(account, ['dp_discount_amount_snapshot', 'dp_discount_amount', 'soa_dp_discount_amount', 'dpDiscountAmount']);
  const lmfWaived = pickNumber(account, ['soa_lmf_waived_amount', 'lmf_waived_amount', 'lmfWaivedAmount']);
  const contractValue = roundFinancialMoney(Math.max(tcp - dpDiscount - lmfWaived, 0));
  const paid = roundFinancialMoney(cumulativePaid ?? pickNumber(account, ['cumulative_paid', 'total_paid', 'verifiedPaymentTotal']));
  const refunded = roundFinancialMoney(refundedToDate ?? pickNumber(account, ['refunded_to_date', 'refund_amount', 'refundAmount']));
  const cancellationDate = dateOnly(account.cancellation_date || account.cancellationDate);
  const activeAsOf = !cancellationDate || cancellationDate > String(asOfDate).slice(0, 10);

  return {
    originalTcp: roundFinancialMoney(tcp),
    dpDiscount: roundFinancialMoney(dpDiscount),
    lmfWaived: roundFinancialMoney(lmfWaived),
    contractValue,
    cumulativePaid: paid,
    refundedToDate: refunded,
    netCashPosition: roundFinancialMoney(paid - refunded),
    outstandingContractReceivable: activeAsOf ? roundFinancialMoney(Math.max(contractValue - paid, 0)) : 0,
    activeAsOf,
  };
};

export const buildAccountFinancialSnapshot = ({
  account = {},
  listing = {},
  soaRows = [],
  payments = [],
  commissions = [],
  releases = [],
  asOfDate = todayManilaDate(),
  readOnly = false,
} = {}) => {
  const context = buildAccountContext({ account, listing, readOnly });
  const receivable = summarizeSoaFinancials({
    soaRows,
    payments,
    asOfDate,
    fallbackRemainingPrincipal: pickNumber(listing, ['balanceAmount', 'balance', 'actual_remaining_balance']),
  });
  const contract = summarizeContractFinancials({ account, listing, asOfDate });
  // Listing/account snapshots use the release rows' current persisted business status.
  // Historical cutoffs are applied explicitly by report callers that also provide
  // payment progress and cancellation timing for the selected date.
  const commission = reconcileCommissionCohort({ commissions, releases });

  const refundAmount = roundFinancialMoney(pickNumber(account, ['refund_amount', 'refundAmount']));
  const discontinuedAmount = roundFinancialMoney(pickNumber(account, ['discontinued_amount', 'discontinuedAmount']));

  return {
    version: 1,
    asOfDate: dateOnly(asOfDate) || todayManilaDate(),
    context,
    contract,
    cash: {
      verifiedCollections: receivable.verifiedCollections,
      refundAmount,
      retainedCash: discontinuedAmount,
      netCash: roundFinancialMoney(receivable.verifiedCollections - refundAmount),
    },
    receivable,
    cancellation: {
      isCancelled: context.isCancelled,
      cancelledValue: roundFinancialMoney(pickNumber(account, ['cancelled_value', 'cancelledValue'], contract.contractValue)),
      refundAmount,
      discontinuedAmount,
      commissionableRetainedAmount: roundFinancialMoney(pickNumber(account, ['commissionable_retained_amount', 'commissionableRetainedAmount'], discontinuedAmount)),
    },
    commission,
  };
};

export default buildAccountFinancialSnapshot;
