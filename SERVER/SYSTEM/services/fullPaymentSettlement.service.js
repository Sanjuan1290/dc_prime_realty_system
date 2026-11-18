// Monetary amounts are calculated in cents. A settlement is a cash payment plus
// explicit adjustments; forgiven interest must never become a cash allocation.
const cents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100);
const amount = (value) => value / 100;
export const normalizeFullPaymentReview = (review = {}) => ({
  interest: String(review?.interest || 'review'),
  penalties: String(review?.penalties || 'review'),
  reason: String(review?.reason || '').trim(),
});
const dateOnly = (value) => value instanceof Date
  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  : String(value || '').slice(0, 10);

export const readFullPaymentSettlement = (value) => {
  if (!value) return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed.version !== 1 || !Array.isArray(parsed.rows)) throw new Error('Unsupported Full Payment settlement record.');
  return parsed;
};

export const calculateFullPaymentSettlement = ({ rows = [], snapshots = new Map(), paymentDate, legalMiscFeeMode, review = {} }) => {
  review = normalizeFullPaymentReview(review);
  let principal = 0, dueInterest = 0, futureInterest = 0, penalties = 0, separateLmf = 0;
  const resultRows = rows.filter((row) => String(row.schedule_status).toLowerCase() !== 'cancelled').map((row) => {
    const scheduleId = Number(row.lot_project_payment_schedule_id);
    const snapshot = snapshots.get(scheduleId);
    if (!snapshot) throw new Error('A payment-date penalty snapshot is required for every active SOA row.');
    const unpaidBase = Math.max(cents(snapshot.unpaidBaseAmount), 0);
    const basePaid = Math.max(cents(snapshot.baseDueAmount) - unpaidBase, 0);
    const interest = Math.max(cents(row.interest_amount), 0);
    // The penalty engine separates penalty allocations from base cash, then
    // base cash pays interest before principal, matching SOA posting.
    const unpaidInterest = Math.min(unpaidBase, Math.max(interest - basePaid, 0));
    const dueDate = dateOnly(row.due_date);
    const isFuture = Boolean(dueDate && dueDate > paymentDate);
    const unresolvedDate = !dueDate && unpaidInterest > 0;
    const lmf = /legal|misc|lmf/i.test(String(row.description || ''));
    const basePrincipal = unpaidBase - unpaidInterest;
    if (lmf && legalMiscFeeMode === 'separate_soa_row') separateLmf += basePrincipal;
    else principal += basePrincipal;
    if (isFuture) futureInterest += unpaidInterest;
    else dueInterest += unpaidInterest;
    const penalty = Math.max(cents(snapshot.outstandingPenaltyAmount), 0);
    penalties += penalty;
    const interestAdjustment = isFuture || review.interest === 'not_collectible' ? unpaidInterest : 0;
    const penaltyAdjustment = review.penalties === 'not_collectible' ? penalty : 0;
    return {
      scheduleId, dueDate, unresolvedDate,
      originalDueAmount: Number(row.due_amount || 0), originalInterestAmount: amount(interest),
      originalPrincipalAmount: Number(row.principal_amount || 0),
      originalMonthlyAmount: Number(row.monthly_amortization_amount || 0),
      interestAdjustment: amount(interestAdjustment), penaltyAdjustment: amount(penaltyAdjustment),
    };
  });
  const reviewReasons = [];
  if (dueInterest > 0 && !['collectible', 'not_collectible'].includes(review.interest)) reviewReasons.push('Review whether already-due interest is collectible under this account’s rules.');
  if (penalties > 0 && !['collectible', 'not_collectible'].includes(review.penalties)) reviewReasons.push('Review whether outstanding penalties are collectible under this account’s rules.');
  if ((dueInterest > 0 || penalties > 0) && review.reason.length < 5) reviewReasons.push('Record the applicable rule or approved basis for the charge treatment.');
  if (resultRows.some((row) => row.unresolvedDate)) reviewReasons.push('Interest on an SOA row without a due date needs an Accounting review.');
  const collectibleInterest = review.interest === 'collectible' ? dueInterest : 0;
  const collectiblePenalties = review.penalties === 'collectible' ? penalties : 0;
  return {
    version: 1, paymentDate, principalOutstanding: amount(principal),
    interestOutstanding: amount(dueInterest), penaltyOutstanding: amount(penalties),
    collectibleInterest: amount(collectibleInterest), collectiblePenalties: amount(collectiblePenalties),
    excludedDueInterest: amount(review.interest === 'not_collectible' ? dueInterest : 0),
    excludedPenalties: amount(review.penalties === 'not_collectible' ? penalties : 0),
    separateLmfOutstanding: amount(separateLmf), lmfIncludedInPrincipal: legalMiscFeeMode !== 'separate_soa_row',
    excludedFutureInterest: amount(futureInterest), unpaidScheduledInterest: amount(dueInterest + futureInterest),
    totalPayable: amount(principal + separateLmf + collectibleInterest + collectiblePenalties),
    reviewRequired: reviewReasons.length > 0, reviewReasons,
    review,
    rows: resultRows,
  };
};
