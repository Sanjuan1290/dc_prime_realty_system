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
    /Allocate the remaining 1\.0000%/i
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
    /exceeds the 8\.0000% Unit Network Distribution Rate by 1\.0000%/i
  );
});

test('an individual role cannot exceed the editable Unit Network Distribution Rate', () => {
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
    /Sales Agent rate cannot be greater than the 8\.0000% Unit Network Distribution Rate/i
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


test('unit commission adjustment preserves four-decimal rates and allows a CP-reduced distribution below 6%', () => {
  const rows = [
    { commissionId: 21, role: 'sales_agent', roleLabel: 'Sales Agent', rate: 2.5 },
    { commissionId: 22, role: 'unit_manager', roleLabel: 'Unit Manager', rate: 1 },
    { commissionId: 23, role: 'sales_director', roleLabel: 'Sales Director', rate: 0.791 },
    { commissionId: 24, role: 'division_manager', roleLabel: 'Division Manager', rate: 0.709 },
  ];
  const result = normalizeUnitCommissionAdjustment({
    groupRate: 5,
    currentRows: rows,
    rates: [
      { commissionId: 21, rate: 2.5 },
      { commissionId: 22, rate: 1 },
      { commissionId: 23, rate: 0.791 },
      { commissionId: 24, rate: 0.709 },
    ],
  });
  assert.equal(result.groupRate, 5);
  assert.equal(result.allocatedRate, 5);
  assert.equal(result.rates.find((row) => row.commissionId === 23).rate, 0.791);
  const payload = buildUnitCommissionAdjustmentPayload({ groupRate: 5, rates: result.rates });
  assert.equal(payload.rates.find((row) => row.commissionId === 23).rate, 0.791);
});

