import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, roleHasPermission } from '../config/permissions.js';

test('Admin receives the requested read-only system permissions', () => {
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_PROJECTS_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_SETTINGS_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.EMPLOYEES_VIEW), true);
  assert.equal(roleHasPermission('admin', PERMISSIONS.LOT_LISTINGS_MANAGE), true);
});

test('Admin cannot perform restricted system, audit, commission, or settings writes', () => {
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_PROJECTS_MANAGE), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_USERS_MANAGE), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.SYSTEM_SETTINGS_MANAGE), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.AUDIT_LOGS_DELETE), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.LOT_COMMISSIONS_VIEW), false);
  assert.equal(roleHasPermission('admin', PERMISSIONS.EMPLOYEES_MANAGE), false);
});

test('Super Admin retains every declared permission', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission('super_admin', permission), true, permission);
  }
});
