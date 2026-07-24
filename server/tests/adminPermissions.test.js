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

const ordinaryUserRoles = ['admin', 'broker_network_manager', 'broker', 'manager', 'agent'];
const admin1 = { role: 'admin', admin_type: 'admin_1' };
const superAdmin = { role: 'super_admin', admin_type: null };

test('Admin 1 receives every declared operational permission while future admin types receive none', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(admin1, permission), true, permission);
    assert.equal(roleHasPermission({ role: 'admin', admin_type: 'admin_2' }, permission), false, permission);
    assert.equal(roleHasPermission({ role: 'admin', admin_type: 'admin_3' }, permission), false, permission);
  }

  assert.equal(isFullAccessAdministrator(admin1), true);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: null }), true);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_2' }), false);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_3' }), false);
});

test('Admin 1 manages ordinary accounts but cannot create or change Super Admin accounts', () => {
  for (const role of ordinaryUserRoles) {
    assert.equal(canActorManageUserRole(admin1, role), true, role);
    assert.equal(canActorCreateUserRole(admin1, role), true, role);
  }

  assert.equal(canActorManageUserRole(admin1, 'super_admin'), false);
  assert.equal(canActorCreateUserRole(admin1, 'super_admin'), false);

  for (const currentRole of ordinaryUserRoles) {
    for (const requestedRole of ordinaryUserRoles) {
      assert.equal(
        canActorChangeUserRole(admin1, currentRole, requestedRole),
        true,
        `${currentRole} -> ${requestedRole}`
      );
    }
    assert.equal(canActorChangeUserRole(admin1, currentRole, 'super_admin'), false);
  }

  for (const requestedRole of [...ordinaryUserRoles, 'super_admin']) {
    assert.equal(canActorChangeUserRole(admin1, 'super_admin', requestedRole), false);
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
