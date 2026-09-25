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

const admin = { role: 'admin', permissions: [] };
const superAdmin = { role: 'super_admin', permissions: [] };

test('Admin uses persisted per-account permissions and is not an implicit full-access role', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(admin, permission), false, permission);
  }

  const delegated = {
    role: 'admin',
    permissions: [PERMISSIONS.SYSTEM_REPORTS_VIEW, PERMISSIONS.LOT_LISTINGS_EDIT],
  };
  assert.equal(roleHasPermission(delegated, PERMISSIONS.SYSTEM_REPORTS_VIEW), true);
  assert.equal(roleHasPermission(delegated, PERMISSIONS.LOT_LISTINGS_EDIT), true);
  assert.equal(roleHasPermission(delegated, PERMISSIONS.LOT_PAYMENT_DELETE), false);
  assert.equal(isFullAccessAdministrator(admin), false);
  assert.equal(isFullAccessAdministrator(delegated), false);
});

test('user-management helpers honor granular permissions while Super Admin targets stay owner-only', () => {
  const manager = {
    role: 'admin',
    permissions: [PERMISSIONS.SYSTEM_USERS_EDIT, PERMISSIONS.SYSTEM_USERS_CREATE],
  };

  assert.equal(canActorManageUserRole(manager, 'admin'), true);
  assert.equal(canActorManageUserRole(manager, 'marketing'), true);
  assert.equal(canActorCreateUserRole(manager, 'sales_agent'), true);
  assert.equal(canActorManageUserRole(manager, 'super_admin'), false);
  assert.equal(canActorCreateUserRole(manager, 'super_admin'), false);

  // Existing internal-system roles are immutable; a position change creates a new account.
  assert.equal(canActorChangeUserRole(manager, 'marketing', 'sales'), false);
  assert.equal(canActorChangeUserRole(superAdmin, 'marketing', 'sales'), false);
  assert.equal(canActorChangeUserRole(manager, 'marketing', 'marketing'), true);

  // Seller hierarchy roles retain their existing role-change behavior.
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
