import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountContext } from '../services/accountContext.service.js';
import {
  buildAccountFinancialSnapshot,
  summarizeContractFinancials,
  summarizeSoaFinancials,
} from '../services/accountFinancialSnapshot.service.js';
import {
  reconcileCommission,
  reconcileCommissionCohort,
} from '../services/commissionReconciliation.service.js';

test('account context keeps historical entry, account history, and cancellation separate', () => {
  const historicalCurrent = buildAccountContext({
    account: { lot_project_account_id: 10, current_account_id: 10, account_status: 'active', soa_is_historical_entry: 1 },
    listing: { current_account_id: 10, lot_project_listing_status: 'sold' },
  });
  assert.equal(historicalCurrent.isHistoricalEntry, true);
  assert.equal(historicalCurrent.isAccountHistory, false);
  assert.equal(historicalCurrent.isCancelled, false);

  const cancelledHistory = buildAccountContext({
    account: { lot_project_account_id: 9, current_account_id: 10, account_status: 'cancelled', soa_is_historical_entry: 0 },
    listing: { current_account_id: 10, lot_project_listing_status: 'sold' },
  });
  assert.equal(cancelledHistory.isHistoricalEntry, false);
  assert.equal(cancelledHistory.isAccountHistory, true);
  assert.equal(cancelledHistory.isCancelled, true);
  assert.equal(cancelledHistory.isReadOnly, true);
});

test('SOA financial summary is one source for outstanding, LMF, and overdue reconciliation', () => {
  const summary = summarizeSoaFinancials({
    asOfDate: '2026-09-13',
    payments: [
      { status: 'Verified', amount: 173750 },
      { status: 'Pending', amount: 10000 },
    ],
    soaRows: [
      {
        scheduleType: 'downpayment', dueDate: '2025-09-01', status: 'Partial',
        totalDue: 100000, amountPaid: 60000, penalty: 5000, paidPenaltyAmount: 1000,
        outstandingPenaltyAmount: 4000, endingBalance: 700000,
      },
      {
        scheduleType: 'monthly', dueDate: '2026-08-01', status: 'Overdue',
        totalDue: 60000, amountPaid: 10000, penalty: 10000, paidPenaltyAmount: 0,
        outstandingPenaltyAmount: 10000, endingBalance: 651250,
      },
      {
        scheduleType: 'legal_misc', dueDate: '2026-10-01', status: 'Unpaid',
        totalDue: 25000, amountPaid: 0, penalty: 0, outstandingPenaltyAmount: 0, endingBalance: 651250,
      },
      {
        scheduleType: 'monthly', dueDate: '2026-09-13', status: 'Unpaid',
        totalDue: 30000, amountPaid: 0, penalty: 0, outstandingPenaltyAmount: 0, endingBalance: 651250,
      },
    ],
  });

  assert.equal(summary.verifiedCollections, 173750);
  assert.equal(summary.remainingLotPrincipal, 651250);
  assert.equal(summary.outstandingLmf, 25000);
  assert.equal(summary.totalAccountOutstanding, 145000);
  assert.equal(summary.overdueExcludingPenalty, 76000);
  assert.equal(summary.outstandingPenalty, 14000);
  assert.equal(summary.totalOverdueIncludingPenalty, 90000);
  assert.equal(summary.overdueRowCount, 2);
});



test('SOA summary uses an explicit principal fallback and never assumes an unverified payment is collected', () => {
  const summary = summarizeSoaFinancials({
    asOfDate: '2026-09-13',
    fallbackRemainingPrincipal: 651250,
    soaRows: [],
    payments: [
      { status: 'Verified', amount: 100000 },
      { amount: 50000 },
      { status: 'Pending', amount: 25000 },
    ],
  });

  assert.equal(summary.verifiedCollections, 100000);
  assert.equal(summary.remainingLotPrincipal, 651250);
  assert.equal(summary.totalAccountOutstanding, 0);
});

test('commission reconciliation guarantees gross less deductions and non-payable equals net payable', () => {
  const result = reconcileCommission({
    grossCommission: 93600,
    releases: [
      { status: 'Released', grossAmount: 12480, netAmount: 12480, deductionAmount: 0 },
      { status: 'Eligible', grossAmount: 18720, netAmount: 18720, deductionAmount: 0 },
      { status: 'Pending', grossAmount: 31200, netAmount: 31200, deductionAmount: 0 },
      { status: 'Forfeited on Cancellation', grossAmount: 31200, netAmount: 31200, deductionAmount: 0 },
    ],
  });

  assert.equal(result.grossCommission, 93600);
  assert.equal(result.forfeitedOnCancellation, 31200);
  assert.equal(result.released, 12480);
  assert.equal(result.remaining, 49920);
  assert.equal(result.netPayable, 62400);
  assert.equal(result.reconciliationDifference, 0);
  assert.equal(result.isBalanced, true);
});

test('commission cohort uses the same canonical equation across multiple commission rows', () => {
  const result = reconcileCommissionCohort({
    commissions: [{ grossCommission: 50000 }, { gross_commission_amount: 43600 }],
    releases: [
      { status: 'Released', netAmount: 12480, deductionAmount: 0 },
      { status: 'Pending', netAmount: 49920, deductionAmount: 0 },
      { status: 'Forfeited on Cancellation', netAmount: 31200, deductionAmount: 0 },
    ],
  });
  assert.equal(result.grossCommission, 93600);
  assert.equal(result.netPayable, 62400);
  assert.equal(result.nonPayable, 31200);
  assert.equal(result.reconciliationDifference, 0);
});

test('contract financial summary uses the same active-account receivable definition as reports', () => {
  const result = summarizeContractFinancials({
    account: {
      contract_tcp: 825000,
      dp_discount_amount: 25000,
      soa_lmf_waived_amount: 0,
      cumulative_paid: 173750,
      refunded_to_date: 0,
      cancellation_date: null,
    },
    asOfDate: '2026-09-30',
  });
  assert.equal(result.contractValue, 800000);
  assert.equal(result.cumulativePaid, 173750);
  assert.equal(result.outstandingContractReceivable, 626250);
  assert.equal(result.activeAsOf, true);
});

test('full account snapshot exposes one canonical object for context, cash, receivable and commission', () => {
  const snapshot = buildAccountFinancialSnapshot({
    account: {
      lot_project_account_id: 10,
      current_account_id: 10,
      account_status: 'active',
      soa_is_historical_entry: 1,
      soa_selected_tcp: 825000,
    },
    listing: { current_account_id: 10, lot_project_listing_status: 'sold' },
    payments: [{ status: 'Verified', amount: 173750 }],
    soaRows: [{ scheduleType: 'monthly', dueDate: '2026-08-01', status: 'Overdue', totalDue: 50000, amountPaid: 0, penalty: 5000, outstandingPenaltyAmount: 5000, endingBalance: 651250 }],
    commissions: [{ gross_commission_amount: 93600 }],
    releases: [
      { release_status: 'Released', net_release_amount: 12480 },
      { release_status: 'Pending', net_release_amount: 81120 },
    ],
    asOfDate: '2026-09-13',
  });

  assert.equal(snapshot.context.isHistoricalEntry, true);
  assert.equal(snapshot.cash.verifiedCollections, 173750);
  assert.equal(snapshot.receivable.remainingLotPrincipal, 651250);
  assert.equal(snapshot.receivable.totalOverdueIncludingPenalty, 50000);
  assert.equal(snapshot.commission.grossCommission, 93600);
  assert.equal(snapshot.commission.netPayable, 93600);
});
