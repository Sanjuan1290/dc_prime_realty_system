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

test('System Admin has full permission authority while project scope remains the operating boundary', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(admin, permission), true, permission);
  }

  const scopedAdmin = {
    role: 'system_admin',
    permissions: [],
    all_projects_access: false,
    project_ids: [11],
  };
  assert.equal(roleHasPermission(scopedAdmin, PERMISSIONS.SYSTEM_REPORTS_VIEW), true);
  assert.equal(roleHasPermission(scopedAdmin, PERMISSIONS.LOT_LISTINGS_EDIT), true);
  assert.equal(roleHasPermission(scopedAdmin, PERMISSIONS.LOT_PAYMENT_DELETE), true);
  assert.equal(isFullAccessAdministrator(admin), true);
  assert.equal(isFullAccessAdministrator(scopedAdmin), true);
});

test('user-management helpers let System Admin administer lower roles while Super Admin identity stays protected', () => {
  const manager = { role: 'system_admin', permissions: [] };

  assert.equal(canActorManageUserRole(manager, 'accounting_staff'), true);
  assert.equal(canActorManageUserRole(manager, 'accounting_head'), true);
  assert.equal(canActorCreateUserRole(manager, 'sales_staff'), true);
  assert.equal(canActorManageUserRole(manager, 'auditor'), true);
  assert.equal(canActorCreateUserRole(manager, 'auditor'), true);
  assert.equal(canActorManageUserRole(manager, 'system_admin'), false);
  assert.equal(canActorManageUserRole(manager, 'super_admin'), false);
  assert.equal(canActorCreateUserRole(manager, 'super_admin'), false);

  assert.equal(canActorChangeUserRole(manager, 'marketing_staff', 'marketing_head'), true);
  assert.equal(canActorChangeUserRole(manager, 'marketing_head', 'sales_staff'), true);
  assert.equal(canActorChangeUserRole(manager, 'auditor', 'operations_staff'), true);
  assert.equal(canActorChangeUserRole(manager, 'accounting_head', 'system_admin'), false);
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
