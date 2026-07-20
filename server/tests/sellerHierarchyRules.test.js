import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRequiredParentRole,
  getRoleRateLabel,
  getRoleRateType,
  isGroupHeadRole,
  isValidDirectReportingPair,
  validateSellerReportingChain,
} from '../controllers/System/sellerHierarchyRules.js';

test('seller reporting hierarchy follows BNM to Broker to Manager to Agent', () => {
  assert.equal(getRequiredParentRole('broker'), 'broker_network_manager');
  assert.equal(getRequiredParentRole('manager'), 'broker');
  assert.equal(getRequiredParentRole('agent'), 'manager');
  assert.equal(getRequiredParentRole('broker_network_manager'), null);

  assert.equal(isValidDirectReportingPair('broker', 'broker_network_manager'), true);
  assert.equal(isValidDirectReportingPair('manager', 'broker'), true);
  assert.equal(isValidDirectReportingPair('agent', 'manager'), true);

  assert.equal(isValidDirectReportingPair('agent', 'broker'), false);
  assert.equal(isValidDirectReportingPair('agent', 'broker_network_manager'), false);
  assert.equal(isValidDirectReportingPair('manager', 'broker_network_manager'), false);
  assert.equal(isValidDirectReportingPair('broker', 'manager'), false);
});

test('only BNM and Broker can be seller group heads', () => {
  assert.equal(isGroupHeadRole('broker_network_manager'), true);
  assert.equal(isGroupHeadRole('broker'), true);
  assert.equal(isGroupHeadRole('manager'), false);
  assert.equal(isGroupHeadRole('agent'), false);
});

test('agents own sales rates while parent roles own override rates', () => {
  assert.equal(getRoleRateType('agent'), 'sales');
  assert.equal(getRoleRateLabel('agent'), 'Sales commission rate');

  for (const role of ['manager', 'broker', 'broker_network_manager']) {
    assert.equal(getRoleRateType(role), 'override');
    assert.equal(getRoleRateLabel(role), 'Override commission rate');
  }
});

test('live reservation chains reject skipped roles and require a valid group head', () => {
  const seller = (id, role, extra = {}) => ({
    accredited_seller_id: id,
    seller_group_id: 7,
    full_name: `${role}-${id}`,
    role,
    ...extra,
  });

  assert.throws(
    () => validateSellerReportingChain([
      seller(1, 'agent'),
      seller(2, 'broker', { is_group_head: true }),
    ], { requireGroupHead: true }),
    /can only report under a Manager/i
  );

  assert.throws(
    () => validateSellerReportingChain([
      seller(1, 'agent'),
      seller(2, 'manager'),
      seller(3, 'broker'),
    ], { requireGroupHead: true }),
    /assign a Broker Network Manager or Broker as the seller group head/i
  );

  assert.equal(validateSellerReportingChain([
    seller(1, 'agent'),
    seller(2, 'manager'),
    seller(3, 'broker'),
    seller(4, 'broker_network_manager', { is_group_head: true }),
  ], { requireGroupHead: true }), true);
});

