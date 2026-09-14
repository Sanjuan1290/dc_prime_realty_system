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

const ordinaryUserRoles = ['admin', 'division_manager', 'sales_director', 'unit_manager', 'sales_agent'];
const admin = { role: 'admin', admin_type: null };
const superAdmin = { role: 'super_admin', admin_type: null };

test('Admin receives every operational permission except hidden owner-only Data Integrity regardless of legacy Admin Type', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    const expected = permission !== PERMISSIONS.SYSTEM_DATA_INTEGRITY_VIEW;
    assert.equal(roleHasPermission(admin, permission), expected, permission);
    assert.equal(roleHasPermission({ role: 'admin', admin_type: 'admin_1' }, permission), expected, permission);
    assert.equal(roleHasPermission({ role: 'admin', admin_type: 'admin_2' }, permission), expected, permission);
    assert.equal(roleHasPermission({ role: 'admin', admin_type: 'admin_3' }, permission), expected, permission);
  }

  assert.equal(isFullAccessAdministrator(admin), true);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_1' }), true);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_2' }), true);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_3' }), true);
});

test('Admin manages ordinary accounts but cannot create or change Super Admin accounts', () => {
  for (const role of ordinaryUserRoles) {
    assert.equal(canActorManageUserRole(admin, role), true, role);
    assert.equal(canActorCreateUserRole(admin, role), true, role);
  }

  assert.equal(canActorManageUserRole(admin, 'super_admin'), false);
  assert.equal(canActorCreateUserRole(admin, 'super_admin'), false);

  for (const currentRole of ordinaryUserRoles) {
    for (const requestedRole of ordinaryUserRoles) {
      assert.equal(
        canActorChangeUserRole(admin, currentRole, requestedRole),
        true,
        `${currentRole} -> ${requestedRole}`
      );
    }
    assert.equal(canActorChangeUserRole(admin, currentRole, 'super_admin'), false);
  }

  for (const requestedRole of [...ordinaryUserRoles, 'super_admin']) {
    assert.equal(canActorChangeUserRole(admin, 'super_admin', requestedRole), false);
  }
});

test('Super Admin retains every permission and owner-only account authority', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(superAdmin, permission), true, permission);
  }

  for (const role of [...ordinaryUserRoles, 'super_admin']) {
    assert.equal(canActorManageUserRole(superAdmin, role), true, role);
    assert.equal(canActorCreateUserRole(superAdmin, role), true, role);
    assert.equal(canActorChangeUserRole(superAdmin, role, role), true, role);
  }
});
