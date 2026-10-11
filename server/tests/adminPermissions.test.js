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

// 2026-10-06 rule change: System Admin is owner-level (same access as Super Admin)
// and only differs in which accounts it may create or manage.
test('System Admin is owner-level and holds every permission regardless of stored rows', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(admin, permission), true, permission);
    assert.equal(roleHasPermission(superAdmin, permission), true, permission);
  }
  assert.equal(isFullAccessAdministrator(admin), true);
  assert.equal(isFullAccessAdministrator(superAdmin), true);
  assert.equal(isFullAccessAdministrator({ role: 'auditor' }), false);
  assert.equal(isFullAccessAdministrator({ role: 'accounting_head' }), false);
});

test('System Admin manages every non-owner account but never Super Admin or System Admin accounts', () => {
  const manager = { role: 'system_admin', permissions: [PERMISSIONS.SYSTEM_USERS_EDIT, PERMISSIONS.SYSTEM_USERS_CREATE] };

  assert.equal(canActorManageUserRole(manager, 'accounting_staff'), true);
  assert.equal(canActorManageUserRole(manager, 'accounting_head'), true);
  assert.equal(canActorCreateUserRole(manager, 'sales_staff'), true);
  assert.equal(canActorManageUserRole(manager, 'auditor'), true);
  assert.equal(canActorCreateUserRole(manager, 'auditor'), true);
  assert.equal(canActorManageUserRole(manager, 'system_admin'), false);
  assert.equal(canActorCreateUserRole(manager, 'system_admin'), false);
  assert.equal(canActorCreateUserRole(superAdmin, 'system_admin'), true);
  assert.equal(canActorManageUserRole(manager, 'super_admin'), false);
  assert.equal(canActorCreateUserRole(manager, 'super_admin'), false);

  assert.equal(canActorChangeUserRole(manager, 'marketing_staff', 'marketing_head'), true);
  assert.equal(canActorChangeUserRole(manager, 'marketing_head', 'sales_staff'), true);
  assert.equal(canActorChangeUserRole(manager, 'auditor', 'operations_staff'), true);
  assert.equal(canActorChangeUserRole(manager, 'marketing_staff', 'system_admin'), false);
  assert.equal(canActorChangeUserRole(manager, 'system_admin', 'marketing_staff'), false);
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

