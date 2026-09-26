import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const usersController = read('../controllers/System/users.controllers.js');
const accessController = read('../controllers/System/accessControl.controller.js');
const usersRouter = read('../routers/System/users.routers.js');
const usersPage = read('../../client/src/pages/System/Users.jsx');
const settingsPage = read('../../client/src/pages/System/Settings.jsx');
const roleAccess = read('../../client/src/components/System/settingsComponents/RoleAccessControl.jsx');
const createSystemUser = read('../../client/src/components/System/userComponents/CreateSystemUserModal.jsx');
const editSystemUser = read('../../client/src/components/System/userComponents/EditSystemUserModal.jsx');
const userAccess = read('../../client/src/components/System/userComponents/UserAccessModal.jsx');
const permissionMatrix = read('../../client/src/components/System/userComponents/PermissionMatrix.jsx');
const recommendedDefaults = read('../config/recommendedRolePermissions.js');

test('RBAC endpoints remain Super-Admin-only', () => {
  for (const route of [
    "router.get('/access-control/roles', authenticateUser, requireExactRole('super_admin')",
    "router.put('/access-control/roles/:role', authenticateUser, requireExactRole('super_admin')",
    "router.get('/access-control/users/:id', authenticateUser, requireExactRole('super_admin')",
    "router.put('/access-control/users/:id', authenticateUser, requireExactRole('super_admin')",
    "router.post('/access-control/users/:id/apply-role-defaults', authenticateUser, requireExactRole('super_admin')",
  ]) assert.ok(usersRouter.includes(route), route);
});

test('internal system account creation is Super-Admin-only server-side', () => {
  assert.match(usersController, /if \(systemUserRoles\.has\(role\)\) \{\s*if \(req\.authUser\?\.role !== 'super_admin'\)/);
  assert.match(usersController, /SYSTEM_ACCESS_SUPER_ADMIN_ONLY/);
  assert.match(usersController, /Only Super Admin can create internal system accounts/);
});

test('project-scope assignment helper rejects non-Super-Admin actors', () => {
  assert.match(usersController, /Only Super Admin can assign project scope for internal system accounts/);
  assert.match(usersController, /error\.statusCode = 403/);
});

test('system roles remain immutable in edit endpoint', () => {
  assert.match(usersController, /SYSTEM_ROLE_IMMUTABLE/);
  assert.match(usersController, /Use Change Position \/ Create New Account instead/);
});

test('System Users UI only offers Create System User to Super Admin', () => {
  assert.match(usersPage, /isSuperAdmin && canCreate/);
  assert.match(createSystemUser, /Only Super Admin can create internal system accounts/);
});

test('system user edit UI shows immutable role instead of editable role selector', () => {
  assert.match(editSystemUser, /Role is locked after creation/);
  assert.match(editSystemUser, /To change position, use Change Position \/ Create New Account/);
  assert.doesNotMatch(editSystemUser, /<select[^>]*value=\{form\.role\}/);
});

test('Role & Access Settings uses a compact Super Admin card and expands the large editor on demand', () => {
  assert.match(settingsPage, /Role & Access Control/);
  assert.match(settingsPage, /Manage Role & Access|Close Role & Access/);
  assert.match(settingsPage, /canManage && showRoleAccess \? <RoleAccessControl \/> : null/);
  assert.match(roleAccess, /Save Role Defaults/);
});

test('Role & Access Control exposes Super Admin as a locked sixth tab', () => {
  assert.match(roleAccess, /\[\.\.\.\(data\?\.roles \|\| \[\]\), 'super_admin'\]/);
  assert.match(roleAccess, /Full System Access/);
  assert.match(roleAccess, /Permissions cannot be restricted or disabled/);
  assert.match(roleAccess, /isSuperAdminRole \?/);
});

test('per-account access UI uses explicit Reset to Role Default semantics', () => {
  assert.match(userAccess, /Reset to Role Default/);
  assert.match(userAccess, /Project scope will not change/);
  assert.match(userAccess, /Per-account permissions are authoritative/);
  assert.match(accessController, /Permissions reset to the current role default\. Project scope was not changed\./);
});

test('role-default editor provides grouped parent controls, Select All, Clear, and recommended reset', () => {
  assert.match(permissionMatrix, /toggleGroup/);
  assert.match(permissionMatrix, /Select All/);
  assert.match(permissionMatrix, />Clear</);
  assert.match(roleAccess, /Reset to Recommended Defaults/);
  assert.match(accessController, /recommendedDefaults: RECOMMENDED_ROLE_PERMISSIONS/);
  assert.match(recommendedDefaults, /RECOMMENDED_ROLE_PERMISSIONS/);
});

test('system-user creation includes server-backed account-code preview and final review', () => {
  assert.match(usersRouter, /account-code-preview/);
  assert.match(usersController, /previewSystemAccountCode/);
  assert.match(createSystemUser, /Account Code Preview/);
  assert.match(createSystemUser, /Final Review/);
  assert.match(createSystemUser, /Customize Permissions/);
  assert.match(createSystemUser, /Project Access/);
});

test('Super Admin user-access representation is read-only Full System Access', () => {
  assert.match(userAccess, /Super Admin permissions cannot be restricted/);
  assert.match(accessController, /permissions: Object\.values\(PERMISSIONS\), all_projects_access: true/);
});

test('recommended role defaults stay aligned with the 20260925 migration template', async () => {
  const { RECOMMENDED_ROLE_PERMISSIONS } = await import('../config/recommendedRolePermissions.js');
  const migration = read('../migrations/20260925_system_rbac_roles_and_access.sql');
  for (const [role, permissions] of Object.entries(RECOMMENDED_ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      assert.ok(migration.includes(`('${role}','${permission}')`), `${role}: ${permission}`);
    }
  }
});
