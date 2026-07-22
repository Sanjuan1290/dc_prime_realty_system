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

const allUserRoles = ['super_admin', 'admin', 'broker_network_manager', 'broker', 'manager', 'agent'];

test('Admin 1 receives every declared permission', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission('admin', permission), true, permission);
  }

  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_1' }), true);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: null }), true);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_2' }), false);
  assert.equal(isFullAccessAdministrator({ role: 'admin', admin_type: 'admin_3' }), false);
});

test('Admin 1 can create, edit, and manage every declared user role', () => {
  for (const role of allUserRoles) {
    assert.equal(canActorManageUserRole('admin', role), true, role);
    assert.equal(canActorCreateUserRole('admin', role), true, role);
  }

  for (const currentRole of allUserRoles) {
    for (const requestedRole of allUserRoles) {
      assert.equal(
        canActorChangeUserRole('admin', currentRole, requestedRole),
        true,
        `${currentRole} -> ${requestedRole}`
      );
    }
  }
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
