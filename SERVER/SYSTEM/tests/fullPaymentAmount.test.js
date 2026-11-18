import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFullPaymentSettlement, readFullPaymentSettlement } from '../services/fullPaymentSettlement.service.js';
import { getUnpaidScheduledInterest } from '../../../CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/paymentAmountUtils.js';
const row = (id, date, due, interest, description = 'Monthly') => ({ lot_project_payment_schedule_id: id, due_date: date, due_amount: due, interest_amount: interest, principal_amount: due - interest, monthly_amortization_amount: due, description, schedule_status: 'Unpaid' });
const quote = (rows, snapshots, review = {}) => calculateFullPaymentSettlement({ rows, snapshots: new Map(snapshots), paymentDate: '2026-11-18', legalMiscFeeMode: 'include_in_monthly', review });
test('early payoff excludes future interest and preserves cash principal', () => {
  const result = quote([row(1, '2026-12-01', 1100, 100)], [[1, { baseDueAmount: 1100, unpaidBaseAmount: 1100 }]]);
  assert.equal(result.totalPayable, 1000); assert.equal(result.excludedFutureInterest, 100); assert.equal(result.reviewRequired, false);
  assert.equal(result.rows[0].interestAdjustment, 100);
  assert.deepEqual(readFullPaymentSettlement(JSON.stringify(result)), result);
});
test('partially paid future interest is not forgiven twice or counted as principal', () => {
  const result = quote([row(1, '2026-12-01', 1100, 100)], [[1, { baseDueAmount: 1100, unpaidBaseAmount: 1060 }]]);
  assert.equal(result.totalPayable, 1000); assert.equal(result.excludedFutureInterest, 60); assert.equal(result.rows[0].originalInterestAmount, 100);
});
test('due interest and net penalties require an explicit rule review', () => {
  const rows = [row(1, '2026-11-18', 1100, 100)];
  const snapshots = [[1, { baseDueAmount: 1100, unpaidBaseAmount: 1080, outstandingPenaltyAmount: 25 }]];
  const pending = quote(rows, snapshots);
  assert.equal(pending.totalPayable, 1000); assert.equal(pending.interestOutstanding, 80); assert.equal(pending.penaltyOutstanding, 25); assert.equal(pending.reviewRequired, true);
  const collect = quote(rows, snapshots, { interest: 'collectible', penalties: 'collectible', reason: 'Approved applicable contract rule' });
  assert.equal(collect.totalPayable, 1105); assert.equal(collect.reviewRequired, false); assert.equal(collect.rows[0].interestAdjustment, 0);
  const exclude = quote(rows, snapshots, { interest: 'not_collectible', penalties: 'not_collectible', reason: 'Approved accounting decision' });
  assert.equal(exclude.totalPayable, 1000); assert.equal(exclude.rows[0].interestAdjustment, 80); assert.equal(exclude.rows[0].penaltyAdjustment, 25);
});
test('separate LMF is added once while included LMF stays within principal', () => {
  const rows = [row(1, '2026-12-01', 1100, 100), row(2, '2027-01-01', 200, 0, 'Legal / Misc Fee')];
  const snapshots = new Map([[1, { baseDueAmount: 1100, unpaidBaseAmount: 1100 }], [2, { baseDueAmount: 200, unpaidBaseAmount: 150 }]]);
  const result = calculateFullPaymentSettlement({ rows, snapshots, paymentDate: '2026-11-18', legalMiscFeeMode: 'separate_soa_row' });
  assert.equal(result.principalOutstanding, 1000); assert.equal(result.separateLmfOutstanding, 150); assert.equal(result.totalPayable, 1150); assert.equal(result.lmfIncludedInPrincipal, false);
  const included = quote([row(1, '2026-12-01', 1300, 100)], [[1, { baseDueAmount: 1300, unpaidBaseAmount: 1300 }]]);
  assert.equal(included.totalPayable, 1200); assert.equal(included.separateLmfOutstanding, 0); assert.equal(included.lmfIncludedInPrincipal, true);
});
test('cancelled rows stay excluded and undated interest requires review', () => {
  const cancelled = { ...row(1, '2026-12-01', 1100, 100), schedule_status: 'Cancelled' };
  assert.equal(quote([cancelled], []).totalPayable, 0);
  const undated = quote([row(2, null, 1100, 100)], [[2, { baseDueAmount: 1100, unpaidBaseAmount: 1100 }]], { interest: 'collectible', reason: 'Reviewed' });
  assert.equal(undated.reviewRequired, true); assert.match(undated.reviewReasons.join(' '), /without a due date/);
});
test('unpaid scheduled interest excludes paid interest and cancelled rows', () => {
  assert.equal(getUnpaidScheduledInterest([
    { interest: 1234.56, paidInterestAmount: 1234.56, status: 'Paid' },
    { interest: 2345.67, paidInterestAmount: 1000, status: 'Partial' },
    { interest: 3456.78, amountPaid: 0, status: 'Unpaid' },
    { interest: 99999.99, status: 'Cancelled' },
  ]), 4802.45);
});
