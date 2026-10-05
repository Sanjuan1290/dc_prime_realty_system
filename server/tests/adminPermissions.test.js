import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  canActorChangeUserRole,
  canActorCreateUserRole,
  canActorManageUserRole,
  isFullAccessAdministrator,
  roleHasPermission,
} from '../config/permissions.js';

const admin = { role: 'system_admin', permissions: [] };
const superAdmin = { role: 'super_admin', permissions: [] };

test('System Admin uses persisted per-account permissions and is not an implicit full-access role', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(admin, permission), false, permission);
  }

  const delegated = {
    role: 'system_admin',
    permissions: [PERMISSIONS.SYSTEM_REPORTS_VIEW, PERMISSIONS.LOT_LISTINGS_EDIT],
  };
  assert.equal(roleHasPermission(delegated, PERMISSIONS.SYSTEM_REPORTS_VIEW), true);
  assert.equal(roleHasPermission(delegated, PERMISSIONS.LOT_LISTINGS_EDIT), true);
  assert.equal(roleHasPermission(delegated, PERMISSIONS.LOT_PAYMENT_DELETE), false);
  assert.equal(isFullAccessAdministrator(admin), false);
  assert.equal(isFullAccessAdministrator(delegated), false);
});

test('user-management helpers enforce System Admin Staff/Head boundaries and owner governance', () => {
  const manager = { role: 'system_admin', permissions: [PERMISSIONS.SYSTEM_USERS_EDIT, PERMISSIONS.SYSTEM_USERS_CREATE] };

  assert.equal(canActorManageUserRole(manager, 'accounting_staff'), true);
  assert.equal(canActorManageUserRole(manager, 'accounting_head'), true);
  assert.equal(canActorCreateUserRole(manager, 'sales_staff'), true);
  assert.equal(canActorManageUserRole(manager, 'auditor'), false);
  assert.equal(canActorManageUserRole(manager, 'system_admin'), false);
  assert.equal(canActorManageUserRole(manager, 'super_admin'), false);
  assert.equal(canActorCreateUserRole(manager, 'super_admin'), false);

  assert.equal(canActorChangeUserRole(manager, 'marketing_staff', 'marketing_head'), true);
  assert.equal(canActorChangeUserRole(manager, 'marketing_head', 'sales_staff'), true);
  assert.equal(canActorChangeUserRole(manager, 'auditor', 'operations_staff'), false);
  assert.equal(canActorChangeUserRole(superAdmin, 'marketing_staff', 'sales_head'), true);

  // Seller hierarchy roles retain their existing role-change behavior for authorized actors.
  assert.equal(canActorChangeUserRole(manager, 'sales_agent', 'unit_manager'), true);
});

test('Super Admin retains every permission and owner-only account authority', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(superAdmin, permission), true, permission);
  }

  assert.equal(isFullAccessAdministrator(superAdmin), true);
  assert.equal(canActorManageUserRole(superAdmin, 'super_admin'), true);
  assert.equal(canActorCreateUserRole(superAdmin, 'super_admin'), true);
});
