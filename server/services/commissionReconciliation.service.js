const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const roundFinancialMoney = (value) =>
  Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;

const dateOnly = (value) => value ? String(value).slice(0, 10) : null;
const clean = (value = '') => String(value ?? '').trim();

const numberFrom = (row = {}, keys = []) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return toNumber(row[key]);
  }
  return 0;
};

const textFrom = (row = {}, keys = [], fallback = '') => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return String(row[key]);
  }
  return fallback;
};

export const normalizeCommissionRelease = (row = {}) => ({
  id: Number(row.lot_project_commission_release_id || row.releaseId || row.id || 0) || null,
  commissionId: Number(row.lot_project_commission_id || row.commissionId || 0) || null,
  stage: textFrom(row, ['release_stage', 'stage'], '-'),
  triggerPercent: numberFrom(row, ['release_trigger_percent', 'triggerPercent']),
  releasePercent: numberFrom(row, ['release_percent', 'releasePercent']),
  grossAmount: numberFrom(row, ['gross_release_amount', 'grossAmount']),
  deductionAmount: numberFrom(row, ['deduction_amount', 'deductionAmount']),
  netAmount: numberFrom(row, ['net_release_amount', 'netAmount', 'amount']),
  status: textFrom(row, ['status', 'release_status'], 'Pending'),
  actualReleaseDate: dateOnly(row.actualReleaseDate || row.actual_release_date),
  scheduledReleaseDate: dateOnly(row.scheduledReleaseDate || row.scheduled_release_date),
  cancellationDate: dateOnly(row.cancellationDate || row.cancellation_date),
  paymentPercent: numberFrom(row, ['paymentPercent', 'payment_percent']),
  eligibleAsOf: Boolean(row.eligibleAsOf),
});

/**
 * Reconstructs the business status of a release at a historical cutoff when
 * enough facts are available. This is the same rule Reports uses, now in one place.
 */
export const resolveCommissionReleaseStatusAsOf = (release = {}, asOfDate = null) => {
  const row = normalizeCommissionRelease(release);
  const cutoff = dateOnly(asOfDate);
  if (!cutoff) return row.status;

  const currentStatus = clean(row.status) || 'Pending';
  const releasedByCutoff = currentStatus === 'Released' && row.actualReleaseDate && row.actualReleaseDate <= cutoff;
  if (releasedByCutoff) return 'Released';

  const cancelledByCutoff = row.cancellationDate && row.cancellationDate <= cutoff;
  if (cancelledByCutoff && ['Earned on Cancellation', 'Forfeited on Cancellation', 'Cancelled'].includes(currentStatus)) {
    return currentStatus;
  }

  if (currentStatus === 'On Hold') return 'On Hold';

  const triggerReached = row.paymentPercent + 0.0001 >= row.triggerPercent;
  const retentionReady = String(row.stage).toLowerCase() !== 'retention' || row.paymentPercent >= 99.999;
  return triggerReached && retentionReady ? 'Eligible' : 'Pending';
};

/**
 * Canonical reconciliation for one commission or an already-scoped commission cohort.
 *
 * Gross - Deductions - Non-payable = Net payable
 * Net payable = Released + Remaining
 */
export const reconcileCommission = ({
  grossCommission = 0,
  releases = [],
  fallbackReleased = 0,
  asOfDate = null,
} = {}) => {
  const normalized = releases.map((release) => {
    const row = normalizeCommissionRelease(release);
    const status = asOfDate ? resolveCommissionReleaseStatusAsOf(release, asOfDate) : row.status;
    return { ...row, status };
  });

  const gross = roundFinancialMoney(grossCommission);
  const deductions = roundFinancialMoney(normalized.reduce((sum, row) => sum + row.deductionAmount, 0));
  const released = roundFinancialMoney(
    normalized.length
      ? normalized.filter((row) => row.status === 'Released').reduce((sum, row) => sum + row.netAmount, 0)
      : fallbackReleased
  );
  const forfeited = roundFinancialMoney(
    normalized.filter((row) => row.status === 'Forfeited on Cancellation').reduce((sum, row) => sum + row.netAmount, 0)
  );
  const cancelled = roundFinancialMoney(
    normalized.filter((row) => row.status === 'Cancelled').reduce((sum, row) => sum + row.netAmount, 0)
  );
  const earnedOnCancellation = roundFinancialMoney(
    normalized.filter((row) => row.status === 'Earned on Cancellation').reduce((sum, row) => sum + row.netAmount, 0)
  );
  const eligibleUnreleased = roundFinancialMoney(
    normalized
      .filter((row) => row.status !== 'Released' && (row.status === 'Eligible' || row.status === 'Earned on Cancellation' || row.eligibleAsOf))
      .reduce((sum, row) => sum + row.netAmount, 0)
  );
  const remaining = roundFinancialMoney(
    normalized.length
      ? normalized
          .filter((row) => !['Released', 'Cancelled', 'Forfeited on Cancellation'].includes(row.status))
          .reduce((sum, row) => sum + row.netAmount, 0)
      : Math.max(gross - released - deductions, 0)
  );
  const nonPayable = roundFinancialMoney(forfeited + cancelled);
  const netPayable = roundFinancialMoney(released + remaining);
  const difference = roundFinancialMoney(gross - deductions - nonPayable - netPayable);

  return {
    grossCommission: gross,
    deductions,
    released,
    remaining,
    eligibleUnreleased,
    earnedOnCancellation,
    forfeitedOnCancellation: forfeited,
    cancelled,
    nonPayable,
    netPayable,
    reconciliationDifference: difference,
    isBalanced: Math.abs(difference) <= 0.01,
    releases: normalized,
  };
};

export const reconcileCommissionCohort = ({ commissions = [], releases = [], asOfDate = null } = {}) => {
  const grossCommission = roundFinancialMoney(
    commissions.reduce((sum, commission) => sum + numberFrom(commission, ['grossCommission', 'gross_commission_amount']), 0)
  );
  return reconcileCommission({ grossCommission, releases, asOfDate });
};

export default reconcileCommission;
