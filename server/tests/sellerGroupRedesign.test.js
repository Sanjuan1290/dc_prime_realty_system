import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeGroupAnalyticsTimeline,
  normalizeGroupAnalyticsRange,
  normalizeGroupProjectRates,
} from '../controllers/System/sellerGroup.controller.js';

test('Network accreditation keeps only explicitly selected projects and derives role allocation', () => {
  const projects = [
    { lot_project_id: 1, lot_project_name: 'Bailen Project' },
    { lot_project_id: 2, lot_project_name: 'Prime Enclave Project' },
  ];

  const [rate] = normalizeGroupProjectRates([{
    lot_project_id: 2,
    seller_group_pool_rate: 9,
    company_profit_rate: 0,
  }], projects);

  assert.equal(rate.lot_project_id, 2);
  assert.equal(rate.seller_group_pool_rate, 9);
  assert.equal(rate.company_profit_rate, 0);
  assert.equal(rate.distribution_pool_rate, 9);
  assert.equal(rate.division_manager_rate, 1.2762);
  assert.equal(rate.sales_director_rate, 1.4238);
  assert.equal(rate.unit_manager_rate, 1.8);
  assert.equal(rate.sales_agent_rate, 4.5);
  assert.equal(rate.allocated_rate, 9);
  assert.equal(rate.remaining_rate, 0);
});

test('Network accreditation requires a project and validates pool rates', () => {
  const projects = [{ lot_project_id: 1, lot_project_name: 'Bailen Project' }];

  assert.throws(
    () => normalizeGroupProjectRates([], projects),
    /select at least one accredited project/i
  );
  assert.throws(
    () => normalizeGroupProjectRates([{ lot_project_id: 1, seller_group_pool_rate: 5, company_profit_rate: 0 }], projects),
    /between 6%? and 15%?/i
  );
  assert.throws(
    () => normalizeGroupProjectRates([{ lot_project_id: 99, seller_group_pool_rate: 8, company_profit_rate: 0 }], projects),
    /unavailable or inactive/i
  );
});



test('Company Profit is deducted before the role pool is distributed', () => {
  const projects = [{ lot_project_id: 1, lot_project_name: 'Bailen Project' }];
  const [rate] = normalizeGroupProjectRates([{
    lot_project_id: 1,
    seller_group_pool_rate: 8,
    company_profit_rate: 2,
  }], projects);

  assert.equal(rate.distribution_pool_rate, 6);
  assert.equal(rate.division_manager_rate, 0.8508);
  assert.equal(rate.sales_director_rate, 0.9492);
  assert.equal(rate.unit_manager_rate, 1.2);
  assert.equal(rate.sales_agent_rate, 3);
  assert.equal(rate.allocated_rate, 6);
  assert.equal(rate.total_accounted_rate, 8);
});

test('Company Profit must be lower than the Network project Pool Rate', () => {
  const projects = [{ lot_project_id: 1, lot_project_name: 'Bailen Project' }];
  assert.throws(
    () => normalizeGroupProjectRates([{ lot_project_id: 1, seller_group_pool_rate: 8, company_profit_rate: 8 }], projects),
    /Company Profit must be lower/i
  );
});

test('group analytics validates inclusive date ranges', () => {
  assert.deepEqual(
    normalizeGroupAnalyticsRange('2026-01-01', '2026-01-31'),
    { fromDate: '2026-01-01', toDate: '2026-01-31', dayCount: 31 }
  );
  assert.throws(
    () => normalizeGroupAnalyticsRange('2026-02-01', '2026-01-31'),
    /cannot be after/i
  );
});

test('group analytics merges sales and commission periods without mock data', () => {
  assert.deepEqual(
    mergeGroupAnalyticsTimeline(
      [{ period_start: '2026-01', sales_count: 2, sales_amount: 1500000 }],
      [
        { period_start: '2026-01', gross_commission: 120000, released_commission: 24000 },
        { period_start: '2026-02', gross_commission: 40000, released_commission: 0 },
      ]
    ),
    [
      {
        period: '2026-01',
        salesCount: 2,
        salesAmount: 1500000,
        grossCommission: 120000,
        releasedCommission: 24000,
      },
      {
        period: '2026-02',
        salesCount: 0,
        salesAmount: 0,
        grossCommission: 40000,
        releasedCommission: 0,
      },
    ]
  );
});


test('group analytics preserves daily periods for short ranges', () => {
  assert.deepEqual(
    mergeGroupAnalyticsTimeline(
      [{ period_start: '2026-07-17', sales_count: 1, sales_amount: 700000 }],
      [{ period_start: '2026-07-18', gross_commission: 56000, released_commission: 11200 }]
    ),
    [
      {
        period: '2026-07-17',
        salesCount: 1,
        salesAmount: 700000,
        grossCommission: 0,
        releasedCommission: 0,
      },
      {
        period: '2026-07-18',
        salesCount: 0,
        salesAmount: 0,
        grossCommission: 56000,
        releasedCommission: 11200,
      },
    ]
  );
});

test('Network project selection rejects duplicate accreditations', () => {
  const projects = [{ lot_project_id: 1, lot_project_name: 'Bailen Project' }];
  assert.throws(
    () => normalizeGroupProjectRates([
      { lot_project_id: 1, seller_group_pool_rate: 8, company_profit_rate: 0 },
      { lot_project_id: 1, seller_group_pool_rate: 9, company_profit_rate: 0 },
    ], projects),
    /selected more than once/i
  );
});

test('group analytics rejects ranges longer than ten years', () => {
  assert.throws(
    () => normalizeGroupAnalyticsRange('2010-01-01', '2026-01-01'),
    /cannot exceed 10 years/i
  );
});
