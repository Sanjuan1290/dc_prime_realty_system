import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeGroupAnalyticsTimeline,
  normalizeGroupAnalyticsRange,
  normalizeGroupProjectRates,
} from '../controllers/System/sellerGroup.controller.js';

test('seller group accreditation keeps only explicitly selected projects', () => {
  const projects = [
    { lot_project_id: 1, lot_project_name: 'Bailen Project' },
    { lot_project_id: 2, lot_project_name: 'Prime Enclave Project' },
  ];

  assert.deepEqual(
    normalizeGroupProjectRates([
      { lot_project_id: 2, seller_group_pool_rate: 9 },
    ], projects),
    [{ lot_project_id: 2, seller_group_pool_rate: 9 }]
  );
});

test('seller group accreditation requires a project and validates pool rates', () => {
  const projects = [{ lot_project_id: 1, lot_project_name: 'Bailen Project' }];

  assert.throws(
    () => normalizeGroupProjectRates([], projects),
    /select at least one accredited project/i
  );
  assert.throws(
    () => normalizeGroupProjectRates([{ lot_project_id: 1, seller_group_pool_rate: 5 }], projects),
    /between 6 and 15/i
  );
  assert.throws(
    () => normalizeGroupProjectRates([{ lot_project_id: 99, seller_group_pool_rate: 8 }], projects),
    /unavailable or inactive/i
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

test('seller group project selection rejects duplicate accreditations', () => {
  const projects = [{ lot_project_id: 1, lot_project_name: 'Bailen Project' }];
  assert.throws(
    () => normalizeGroupProjectRates([
      { lot_project_id: 1, seller_group_pool_rate: 8 },
      { lot_project_id: 1, seller_group_pool_rate: 9 },
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


