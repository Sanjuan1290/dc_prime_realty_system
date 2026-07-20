import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SELLER_INCOME_RANGE_QUERY,
  mapSellerIncomeRangeRow,
  normalizeSellerIncomeRange,
  summarizeSellerIncomeRangeRows,
} from '../controllers/System/accredited.controller.js';

test('income range accepts inclusive dates and calculates day count', () => {
  assert.deepEqual(
    normalizeSellerIncomeRange('2025-07-18', '2026-07-18'),
    {
      startDate: '2025-07-18',
      endDate: '2026-07-18',
      dayCount: 366,
    }
  );
});

test('income range rejects invalid order and ranges above ten years', () => {
  assert.throws(
    () => normalizeSellerIncomeRange('2026-07-19', '2026-07-18'),
    /Start date cannot be after end date/i
  );

  assert.throws(
    () => normalizeSellerIncomeRange('2010-01-01', '2026-07-18'),
    /cannot exceed 10 years/i
  );
});

test('income range mapper and summary use released net income values', () => {
  const entries = [
    mapSellerIncomeRangeRow({
      lot_project_commission_release_id: 10,
      lot_project_commission_id: 4,
      lot_project_id: 1,
      lot_project_listing_id: 3,
      lot_project_client_profile_id: 3,
      lot_project_name: 'Bailen Project',
      lot_project_location: 'Pantihan, Cavite',
      lot_project_listing_unit_id: 'LA-0103',
      buyer_full_name: 'Buyer One',
      commission_role: 'agent',
      commission_seller_type: 'selling_agent',
      commission_rate_type: 'direct',
      commission_rate: 4,
      gross_commission_amount: 26000,
      release_stage: '1st Release',
      release_trigger_percent: 20,
      release_percent: 20,
      gross_release_amount: 5200,
      deduction_amount: 200,
      net_release_amount: 5000,
      actual_release_date: '2026-07-18',
      lot_project_commission_receipt_id: 1,
      receipt_date: '2026-07-18',
      reference_number: 'REF-001',
    }),
    mapSellerIncomeRangeRow({
      lot_project_commission_release_id: 11,
      lot_project_commission_id: 5,
      lot_project_id: 1,
      lot_project_listing_id: 3,
      lot_project_client_profile_id: 3,
      lot_project_name: 'Bailen Project',
      lot_project_location: 'Pantihan, Cavite',
      lot_project_listing_unit_id: 'LA-0103',
      buyer_full_name: 'Buyer One',
      commission_role: 'manager',
      commission_seller_type: 'hierarchy_seller',
      commission_rate_type: 'override',
      commission_rate: 1,
      gross_commission_amount: 6500,
      release_stage: '1st Release',
      release_trigger_percent: 20,
      release_percent: 20,
      gross_release_amount: 1300,
      deduction_amount: 50,
      net_release_amount: 1250,
      actual_release_date: '2026-07-18',
    }),
  ];

  const summary = summarizeSellerIncomeRangeRows(entries);

  assert.equal(entries[0].triggerPercent, 20);
  assert.equal(entries[0].releasePercent, 20);
  assert.equal(entries[0].cumulativeGrossTarget, 5200);
  assert.equal(summary.releaseCount, 2);
  assert.equal(summary.commissionCount, 2);
  assert.equal(summary.propertyCount, 1);
  assert.equal(summary.receiptedReleaseCount, 1);
  assert.equal(summary.grossIncome, 6500);
  assert.equal(summary.deductions, 250);
  assert.equal(summary.netIncome, 6250);
  assert.equal(summary.directIncome, 5000);
  assert.equal(summary.overrideIncome, 1250);
  assert.deepEqual(summary.monthlyTotals, [{
    month: '2026-07',
    releaseCount: 2,
    grossIncome: 6500,
    deductions: 250,
    netIncome: 6250,
  }]);
});

test('second release keeps a 20 percent tranche and exposes the 40 percent cumulative target', () => {
  const entry = mapSellerIncomeRangeRow({
    lot_project_commission_release_id: 12,
    lot_project_commission_id: 4,
    gross_commission_amount: 31200,
    release_stage: '2nd Release',
    release_trigger_percent: 40,
    release_percent: 20,
    gross_release_amount: 6240,
    deduction_amount: 0,
    net_release_amount: 6240,
    actual_release_date: '2026-07-19',
  });

  assert.equal(entry.releasePercent, 20);
  assert.equal(entry.triggerPercent, 40);
  assert.equal(entry.grossAmount, 6240);
  assert.equal(entry.cumulativeGrossTarget, 12480);
});

test('income range query filters released stages by actual release date', () => {
  assert.match(SELLER_INCOME_RANGE_QUERY, /r\.release_status = 'Released'/);
  assert.match(SELLER_INCOME_RANGE_QUERY, /r\.actual_release_date BETWEEN \? AND \?/);
  assert.match(SELLER_INCOME_RANGE_QUERY, /c\.accredited_seller_id = \?/);
  assert.match(SELLER_INCOME_RANGE_QUERY, /c\.sale_owner_accredited_seller_id = \?/);
  assert.match(SELLER_INCOME_RANGE_QUERY, /c\.commission_rate_type = 'direct'/);
  assert.match(SELLER_INCOME_RANGE_QUERY, /commission_rate_type/);
  assert.match(SELLER_INCOME_RANGE_QUERY, /c\.gross_commission_amount/);
  assert.match(SELLER_INCOME_RANGE_QUERY, /r\.release_trigger_percent/);
});
