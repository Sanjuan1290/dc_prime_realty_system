import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUnitCommissionAdjustmentPayload,
  normalizeUnitCommissionAdjustment,
} from '../services/unitCommissionAdjustment.service.js';

const currentRows = [
  { commissionId: 11, role: 'sales_agent', roleLabel: 'Sales Agent', rate: 5 },
  { commissionId: 12, role: 'unit_manager', roleLabel: 'Unit Manager', rate: 1 },
  { commissionId: 13, role: 'sales_director', roleLabel: 'Sales Director', rate: 1 },
  { commissionId: 14, role: 'division_manager', roleLabel: 'Division Manager', rate: 1 },
];

test('unit commission adjustment allows editing group and role rates when allocation is exact', () => {
  const result = normalizeUnitCommissionAdjustment({
    groupRate: 10,
    currentRows,
    rates: [
      { commissionId: 11, rate: 7 },
      { commissionId: 12, rate: 1 },
      { commissionId: 13, rate: 1 },
      { commissionId: 14, rate: 1 },
    ],
  });

  assert.equal(result.groupRate, 10);
  assert.equal(result.allocatedRate, 10);
  assert.equal(result.unallocatedRate, 0);
});

test('underallocated unit commission can exist while editing but is invalid to save', () => {
  assert.throws(
    () => normalizeUnitCommissionAdjustment({
      groupRate: 10,
      currentRows,
      rates: [
        { commissionId: 11, rate: 6 },
        { commissionId: 12, rate: 1 },
        { commissionId: 13, rate: 1 },
        { commissionId: 14, rate: 1 },
      ],
    }),
    /Allocate the remaining 1\.00%/i
  );
});

test('overallocated unit commission is invalid to save', () => {
  assert.throws(
    () => normalizeUnitCommissionAdjustment({
      groupRate: 8,
      currentRows,
      rates: [
        { commissionId: 11, rate: 6 },
        { commissionId: 12, rate: 1 },
        { commissionId: 13, rate: 1 },
        { commissionId: 14, rate: 1 },
      ],
    }),
    /exceeds the 8\.00% Unit Group Rate by 1\.00%/i
  );
});

test('an individual role cannot exceed the editable Unit Group Rate', () => {
  assert.throws(
    () => normalizeUnitCommissionAdjustment({
      groupRate: 8,
      currentRows,
      rates: [
        { commissionId: 11, rate: 9 },
        { commissionId: 12, rate: 1 },
        { commissionId: 13, rate: 1 },
        { commissionId: 14, rate: 1 },
      ],
    }),
    /Sales Agent rate cannot be greater than the 8\.00% Unit Group Rate/i
  );
});

test('adjustment must preserve the exact saved commission recipients', () => {
  assert.throws(
    () => normalizeUnitCommissionAdjustment({
      groupRate: 8,
      currentRows,
      rates: [
        { commissionId: 11, rate: 5 },
        { commissionId: 12, rate: 1 },
        { commissionId: 13, rate: 2 },
      ],
    }),
    /Every saved commission recipient/i
  );
});

test('verification payload is deterministic and scoped to one buyer account', () => {
  const payload = buildUnitCommissionAdjustmentPayload({
    listingId: 55,
    accountId: 91,
    clientProfileId: 81,
    groupRate: 10,
    rates: [
      { commissionId: 14, rate: 1 },
      { commissionId: 11, rate: 7 },
      { commissionId: 13, rate: 1 },
      { commissionId: 12, rate: 1 },
    ],
    reason: 'Special event commission',
    userId: 1,
  });

  assert.equal(payload.accountId, 91);
  assert.deepEqual(payload.rates.map((row) => row.commissionId), [11, 12, 13, 14]);
  assert.equal(payload.groupRate, 10);
});
