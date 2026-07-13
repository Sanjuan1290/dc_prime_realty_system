import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  canActorManageUserRole,
  roleHasPermission,
} from '../config/permissions.js';

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

test('Admin can manage seller user accounts but not Admin or Super Admin accounts', () => {
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_CREATE), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_EDIT), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_CHANGE_STATUS), true);

  assert.equal(canActorManageUserRole('admin', 'broker_network_manager'), true);
  assert.equal(canActorManageUserRole('admin', 'broker'), true);
  assert.equal(canActorManageUserRole('admin', 'manager'), true);
  assert.equal(canActorManageUserRole('admin', 'agent'), true);
  assert.equal(canActorManageUserRole('admin', 'admin'), false);
  assert.equal(canActorManageUserRole('admin', 'super_admin'), false);
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

  for (const role of ['super_admin', 'admin', 'broker_network_manager', 'broker', 'manager', 'agent']) {
    assert.equal(canActorManageUserRole('super_admin', role), true, role);
  }
});
