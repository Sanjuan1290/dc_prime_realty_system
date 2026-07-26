import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXTERNAL_GROUP_ROLE,
  getRequiredParentRole,
  getRoleRateLabel,
  getRoleRateType,
  isCommissionRecipientRole,
  isGroupHeadRole,
  isValidDirectReportingPair,
  validateSellerReportingChain,
} from '../controllers/System/sellerHierarchyRules.js';

test('in-house reporting hierarchy follows Division Manager to Sales Director to Unit Manager to Sales Agent', () => {
  assert.equal(getRequiredParentRole('sales_director'), 'division_manager');
  assert.equal(getRequiredParentRole('unit_manager'), 'sales_director');
  assert.equal(getRequiredParentRole('sales_agent'), 'unit_manager');
  assert.equal(getRequiredParentRole('division_manager'), null);

  assert.equal(isValidDirectReportingPair('sales_director', 'division_manager'), true);
  assert.equal(isValidDirectReportingPair('unit_manager', 'sales_director'), true);
  assert.equal(isValidDirectReportingPair('sales_agent', 'unit_manager'), true);
  assert.equal(isValidDirectReportingPair('sales_agent', 'sales_director'), false);
});

test('only Division Manager and Sales Director can head an in-house group', () => {
  assert.equal(isGroupHeadRole('division_manager'), true);
  assert.equal(isGroupHeadRole('sales_director'), true);
  assert.equal(isGroupHeadRole('unit_manager'), false);
  assert.equal(isGroupHeadRole('sales_agent'), false);
  assert.equal(isGroupHeadRole(EXTERNAL_GROUP_ROLE), false);
});

test('Sales Agents and External Groups receive sales rates while in-house parent positions receive override rates', () => {
  assert.equal(getRoleRateType('sales_agent'), 'sales');
  assert.equal(getRoleRateLabel('sales_agent'), 'Sales commission rate');
  assert.equal(getRoleRateType('external_group'), 'sales');
  assert.equal(getRoleRateLabel('external_group'), 'External group pool rate');
  assert.equal(isCommissionRecipientRole('external_group'), true);

  for (const role of ['unit_manager', 'sales_director', 'division_manager']) {
    assert.equal(getRoleRateType(role), 'override');
    assert.equal(getRoleRateLabel(role), 'Override commission rate');
  }
});

test('live in-house reservation chains reject skipped positions and require a group head', () => {
  const seller = (id, role, extra = {}) => ({
    accredited_seller_id: id,
    seller_group_id: 7,
    full_name: `${role}-${id}`,
    role,
    ...extra,
  });

  assert.throws(
    () => validateSellerReportingChain([
      seller(1, 'sales_agent'),
      seller(2, 'sales_director', { is_group_head: true }),
    ], { requireGroupHead: true }),
    /can only report under a Unit Manager/i
  );

  assert.throws(
    () => validateSellerReportingChain([
      seller(1, 'sales_agent'),
      seller(2, 'unit_manager'),
      seller(3, 'sales_director'),
    ], { requireGroupHead: true }),
    /assign a Division Manager or Sales Director as the In-House Group Head/i
  );

  assert.equal(validateSellerReportingChain([
    seller(1, 'sales_agent'),
    seller(2, 'unit_manager'),
    seller(3, 'sales_director'),
    seller(4, 'division_manager', { is_group_head: true }),
  ], { requireGroupHead: true }), true);
});
