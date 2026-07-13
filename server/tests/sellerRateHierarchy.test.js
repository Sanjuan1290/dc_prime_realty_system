import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSellerHierarchyRateSnapshot } from '../controllers/System/sellerRateHierarchy.service.js';

test('rejects an agent rate above the manager rate', () => {
  assert.throws(
    () => validateSellerHierarchyRateSnapshot({
      projectName: 'Bailen Project',
      sellerName: 'Agent1 NorthStar',
      sellerRate: 7,
      groupPoolRate: 8,
      parent: { name: 'Manager1 NorthStar', rate: 6 },
    }),
    /cannot be greater than Manager1 NorthStar rate \(6%\)/
  );
});

test('rejects lowering a parent below an existing child rate', () => {
  assert.throws(
    () => validateSellerHierarchyRateSnapshot({
      projectName: 'Bailen Project',
      sellerName: 'Manager1 NorthStar',
      sellerRate: 2,
      groupPoolRate: 8,
      parent: { name: 'Broker1 NorthStar', rate: 7 },
      children: [{ name: 'Agent1 NorthStar', rate: 3 }],
    }),
    /cannot be lower than Agent1 NorthStar rate \(3%\)/
  );
});

test('rejects any seller rate above the group pool', () => {
  assert.throws(
    () => validateSellerHierarchyRateSnapshot({
      projectName: 'Bailen Project',
      sellerName: 'Broker Network Manager',
      sellerRate: 9,
      groupPoolRate: 8,
    }),
    /cannot be higher than the Bailen Project group pool rate \(8%\)/
  );
});

test('accepts a descending hierarchy within the group pool', () => {
  assert.equal(
    validateSellerHierarchyRateSnapshot({
      projectName: 'Bailen Project',
      sellerName: 'Manager1 NorthStar',
      sellerRate: 6,
      groupPoolRate: 8,
      parent: { name: 'Broker1 NorthStar', rate: 7 },
      children: [{ name: 'Agent1 NorthStar', rate: 3 }],
    }),
    true
  );
});

test('allows equal parent and child ceiling rates', () => {
  assert.equal(
    validateSellerHierarchyRateSnapshot({
      projectName: 'Bailen Project',
      sellerName: 'Manager1 NorthStar',
      sellerRate: 6,
      groupPoolRate: 8,
      parent: { name: 'Broker1 NorthStar', rate: 7 },
      children: [{ name: 'Agent1 NorthStar', rate: 6 }],
    }),
    true
  );
});
