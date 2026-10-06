import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONFIGURABLE_SYSTEM_ROLES,
  OWNER_ROLES,
  PERMISSIONS,
  canActorCreateUserRole,
  canActorManageUserRole,
  roleHasPermission,
} from '../config/permissions.js';
import { getOwnerLevelPermissions, getStaticRolePolicy } from '../config/rolePolicies.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const migration = read('migrations/20261006_batch10_single_permission_model.sql');
const sql = migration.replace(/\/\*[\s\S]*?\*\//g, '');
const matrix = read('../client/src/components/System/userComponents/PermissionMatrix.jsx');
const createUser = read('../client/src/components/System/userComponents/CreateSystemUserModal.jsx');
const service = read('services/accessControl.service.js');
const ALL = Object.values(PERMISSIONS);

test('Super Admin and System Admin are the owner roles with every permission', () => {
  assert.deepEqual([...OWNER_ROLES], ['super_admin', 'system_admin']);
  for (const role of OWNER_ROLES) {
    for (const key of ALL) assert.equal(roleHasPermission({ role, permissions: [] }, key), true, `${role} ${key}`);
  }
});

test('only Super Admin can create or manage System Admin accounts', () => {
  assert.equal(canActorCreateUserRole({ role: 'super_admin' }, 'system_admin'), true);
  assert.equal(canActorManageUserRole({ role: 'super_admin' }, 'system_admin'), true);
  assert.equal(canActorCreateUserRole({ role: 'system_admin' }, 'system_admin'), false);
  assert.equal(canActorManageUserRole({ role: 'system_admin' }, 'system_admin'), false);
  assert.equal(canActorCreateUserRole({ role: 'system_admin' }, 'super_admin'), false);
  for (const role of CONFIGURABLE_SYSTEM_ROLES.filter((r) => r !== 'system_admin')) {
    assert.equal(canActorCreateUserRole({ role: 'system_admin' }, role), true, role);
  }
});

test('every non-owner role uses the same model: nothing required, nothing restricted, a default template', () => {
  for (const role of CONFIGURABLE_SYSTEM_ROLES.filter((r) => !OWNER_ROLES.includes(r))) {
    const policy = getStaticRolePolicy(role);
    assert.equal(policy.fullAccess, false, role);
    assert.deepEqual(policy.required, [], role);
    assert.equal(policy.parentRole, null, role);
    assert.deepEqual(new Set(policy.ceiling), new Set(ALL), role);
    assert.ok(policy.recommended.length > 0, role);
    for (const key of getOwnerLevelPermissions()) assert.ok(!policy.recommended.includes(key), `${role} default excludes ${key}`);
  }
});

test('non-owner accounts hold exactly their saved rows; nothing is inherited or force-added at runtime', () => {
  assert.match(service, /no runtime inheritance and nothing is force-added/);
  assert.doesNotMatch(service, /getRequiredPermissionsForRole/);
  assert.doesNotMatch(service, /ROLE_PARENT/);
  for (const role of ['auditor', 'marketing_head', 'operations_staff']) {
    assert.equal(roleHasPermission({ role, permissions: [] }, PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW), false, role);
  }
});

test('permission grid shows the same checkboxes for every role and only warns', () => {
  for (const removed of ['Fixed by role', 'Restricted governance', 'From Staff Role', 'Role baseline', '>Required<']) {
    assert.doesNotMatch(matrix, new RegExp(removed), removed);
  }
  assert.match(matrix, /Outside normal role/);
  assert.match(matrix, /Usually System Admin only/);
  assert.match(createUser, /FULL_ACCESS_ROLES = \['super_admin', 'system_admin'\]/);
});

test('Batch 10 converts data without changing access: drops ignored rows, stores runtime keys, completes templates', () => {
  assert.match(sql, /START TRANSACTION;/);
  assert.match(sql, /COMMIT;/);
  // 1. rows the old rules ignored
  assert.match(sql, /DELETE up FROM user_permissions up INNER JOIN users u ON u\.id = up\.user_id\nWHERE u\.role = 'marketing_staff'/);
  // 2. runtime-added keys become stored rows
  assert.match(sql, /INSERT IGNORE INTO user_permissions[\s\S]*INNER JOIN rbac_20261006_required r ON r\.role = u\.role/);
  assert.match(sql, /WHEN 'marketing_head' THEN 'marketing_staff'/);
  // 3. templates completed; Heads copied from Staff before Staff changes
  assert.ok(sql.indexOf('rbac_20261006_head_from_staff (role, permission_key)') < sql.indexOf('SELECT role, permission_key, 1, NULL FROM rbac_20261006_required'));
  // 4. owner rows removed
  assert.match(sql, /WHERE u\.role IN \('super_admin', 'system_admin'\)/);
  // only INSERT IGNORE, so a re-run is a no-op
  assert.doesNotMatch(sql, /ON DUPLICATE KEY UPDATE/);
});
