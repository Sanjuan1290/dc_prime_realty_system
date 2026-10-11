import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PERMISSIONS,
  canActorCreateUserRole,
  canActorManageUserRole,
  roleHasPermission,
} from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const readClient = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

// Intentional policy change: department role templates are recommendations, not
// hard business-permission ceilings. Governance authority remains role-bound.
test('department roles can be explicitly granted ordinary permissions from another department', () => {
  const marketingPolicy = getStaticRolePolicy('marketing_staff');
  assert.ok(marketingPolicy.ceiling.includes(PERMISSIONS.LOT_RESERVATIONS_CREATE));
  assert.ok(marketingPolicy.ceiling.includes(PERMISSIONS.LOT_BUYER_PROFILE_EDIT));
  assert.ok(!marketingPolicy.recommended.includes(PERMISSIONS.LOT_RESERVATIONS_CREATE));

  const marketingWithSalesAccess = {
    role: 'marketing_staff',
    permissions: [PERMISSIONS.LOT_RESERVATIONS_CREATE, PERMISSIONS.LOT_BUYER_PROFILE_EDIT],
  };
  assert.equal(roleHasPermission(marketingWithSalesAccess, PERMISSIONS.LOT_RESERVATIONS_CREATE), true);
  assert.equal(roleHasPermission(marketingWithSalesAccess, PERMISSIONS.LOT_BUYER_PROFILE_EDIT), true);
});

test('owner-level authority is assignable to any role but never part of a department default, and is flagged', () => {
  const policy = getStaticRolePolicy('marketing_staff');
  const ownerLevel = new Set(policy.ownerLevel);
  for (const key of [
    PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE,
    PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY,
    PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE,
    PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
  ]) {
    assert.ok(policy.ceiling.includes(key), key);
    assert.ok(!policy.recommended.includes(key), key);
    assert.ok(ownerLevel.has(key), key);
  }
  assert.ok(!policy.recommended.includes(PERMISSIONS.WORKFLOW_AUDIT_REVIEW));

  const head = getStaticRolePolicy('marketing_head');
  assert.ok(head.recommended.includes(PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW));
  assert.ok(!policy.recommended.includes(PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW));
});

test('seller user-management authority follows explicit permissions rather than the Marketing role name', () => {
  const salesActor = {
    role: 'sales_staff',
    permissions: [PERMISSIONS.SYSTEM_USERS_CREATE, PERMISSIONS.SYSTEM_USERS_EDIT],
  };
  assert.equal(canActorCreateUserRole(salesActor, 'sales_agent'), true);
  assert.equal(canActorManageUserRole(salesActor, 'sales_agent'), true);
  assert.equal(canActorCreateUserRole(salesActor, 'system_admin'), false);
  assert.equal(canActorManageUserRole(salesActor, 'auditor'), false);
});

test('permission UI warns on unusual access instead of disabling normal business permissions', () => {
  const matrix = readClient('components/System/userComponents/PermissionMatrix.jsx');
  assert.match(matrix, /Outside normal role/);
  assert.match(matrix, /This is allowed for cross-department responsibilities/);
  assert.match(matrix, /Usually System Admin only/);
  assert.doesNotMatch(matrix, /Restricted governance/);
  assert.doesNotMatch(matrix, /Fixed by role/);
  assert.doesNotMatch(matrix, />Not Allowed</);
});

