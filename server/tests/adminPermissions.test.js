import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  canActorChangeUserRole,
  canActorCreateUserRole,
  canActorManageUserRole,
  roleHasPermission,
} from '../config/permissions.js';

const sellerRoles = ['broker_network_manager', 'broker', 'manager', 'agent'];
const allUserRoles = ['super_admin', 'admin', ...sellerRoles];

test('Admin receives operational access to notifications, employees, attendance, and payroll', () => {
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_NOTIFICATIONS_MANAGE), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.EMPLOYEES_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.EMPLOYEES_MANAGE), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.ATTENDANCE_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.ATTENDANCE_MANAGE), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.PAYROLL_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.PAYROLL_MANAGE), true);
});

test('Admin cannot view or manage employee cash advances', () => {
  assert.equal(roleHasPermission('admin', PERMISSIONS.EMPLOYEE_CASH_ADVANCES_VIEW), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.EMPLOYEE_CASH_ADVANCES_MANAGE), false);
});

test('Admin has full existing-user and seller-group management access', () => {
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_CREATE), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_EDIT), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_CHANGE_STATUS), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), true);

  for (const role of allUserRoles) {
    assert.equal(canActorManageUserRole('admin', role), true, role);
  }
});

test('Admin can create seller accounts but cannot create Admin or Super Admin accounts', () => {
  for (const role of sellerRoles) {
    assert.equal(canActorCreateUserRole('admin', role), true, role);
  }

  assert.equal(canActorCreateUserRole('admin', 'admin'), false);
  assert.equal(canActorCreateUserRole('admin', 'super_admin'), false);
});

test('Admin cannot assign privileged roles through user editing', () => {
  assert.equal(canActorChangeUserRole('admin', 'agent', 'manager'), true);
  assert.equal(canActorChangeUserRole('admin', 'manager', 'broker'), true);
  assert.equal(canActorChangeUserRole('admin', 'agent', 'admin'), false);
  assert.equal(canActorChangeUserRole('admin', 'agent', 'super_admin'), false);

  assert.equal(canActorChangeUserRole('admin', 'admin', 'admin'), true);
  assert.equal(canActorChangeUserRole('admin', 'super_admin', 'super_admin'), true);
  assert.equal(canActorChangeUserRole('admin', 'admin', 'agent'), false);
  assert.equal(canActorChangeUserRole('admin', 'super_admin', 'admin'), false);
});

test('Admin still cannot perform restricted project, audit, commission, or settings writes', () => {
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_PROJECTS_MANAGE), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_SETTINGS_MANAGE), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.AUDIT_LOGS_DELETE), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.LOT_COMMISSIONS_VIEW), false);
});

test('Super Admin retains every declared permission and can manage every user role', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission('super_admin', permission), true, permission);
  }

  for (const role of allUserRoles) {
    assert.equal(canActorManageUserRole('super_admin', role), true, role);
    assert.equal(canActorCreateUserRole('super_admin', role), true, role);
    assert.equal(canActorChangeUserRole('super_admin', role, role), true, role);
  }
});
