import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const usersRouter = read('../routers/System/users.routers.js');
const usersController = read('../controllers/System/users.controllers.js');
const accessController = read('../controllers/System/accessControl.controller.js');
const permissions = read('../config/permissions.js');
const rolePolicies = read('../config/rolePolicies.js');
const roleAccess = read('../../client/src/components/System/settingsComponents/RoleAccessControl.jsx');
const usersPage = read('../../client/src/pages/System/Users.jsx');
const userAccess = read('../../client/src/components/System/userComponents/UserAccessModal.jsx');
const permissionMatrix = read('../../client/src/components/System/userComponents/PermissionMatrix.jsx');
const migration = read('../migrations/20261004_batch1_staff_head_auditor_rbac.sql');

const expectedRoles = [
  'super_admin','system_admin','auditor',
  'marketing_staff','marketing_head','sales_staff','sales_head',
  'accounting_staff','accounting_head','operations_staff','operations_head',
];

test('new Staff/Head/System Admin/Auditor role model is shared by server and migration', () => {
  for (const role of expectedRoles) {
    assert.match(permissions, new RegExp(`['\"]${role}['\"]`), role);
    assert.match(migration, new RegExp(role), role);
  }
  assert.match(migration, /admin[\s\S]*system_admin/);
  assert.match(migration, /marketing[\s\S]*marketing_staff/);
  assert.match(migration, /sales[\s\S]*sales_staff/);
  assert.match(migration, /accounting[\s\S]*accounting_staff/);
  assert.match(migration, /operations[\s\S]*operations_staff/);
});

test('Role & Access endpoints are permission-governed instead of exact-Super-Admin-only', () => {
  for (const route of [
    "router.get('/access-control/roles'",
    "router.put('/access-control/roles/:role'",
    "router.get('/access-control/users/:id'",
    "router.put('/access-control/users/:id'",
    "router.post('/access-control/users/:id/apply-role-defaults'",
  ]) assert.ok(usersRouter.includes(route), route);
  assert.match(usersRouter, /SYSTEM_ACCESS_CONTROL_VIEW/);
  assert.match(usersRouter, /SYSTEM_ACCESS_CONTROL_MANAGE/);
  assert.doesNotMatch(usersRouter, /access-control\/roles'[\s\S]{0,160}requireExactRole\('super_admin'\)/);
});

test('System Admin can manage Staff/Head accounts but governance roles remain constrained', () => {
  assert.match(permissions, /SYSTEM_ADMIN_MANAGEABLE_ROLES/);
  assert.match(permissions, /marketing_staff[\s\S]*marketing_head[\s\S]*sales_staff[\s\S]*sales_head[\s\S]*accounting_staff[\s\S]*accounting_head[\s\S]*operations_staff[\s\S]*operations_head/);
  assert.match(permissions, /canActorCreateUserRole/);
  assert.match(permissions, /actor\.role !== 'system_admin'/);
  assert.match(accessController, /actor\?\.role === 'system_admin'/);
  assert.match(accessController, /SYSTEM_ADMIN_MANAGEABLE_ROLES/);
  assert.match(usersPage, /canManageTarget/);
  assert.match(usersPage, /SYSTEM_ADMIN_MANAGEABLE_ROLES/);
});

test('Auditor core access stays enforced while only whitelisted export/print extras are configurable by Super Admin', () => {
  assert.match(permissions, /AUDITOR_ENFORCED_PERMISSIONS/);
  assert.match(permissions, /AUDITOR_OPTIONAL_PERMISSIONS/);
  assert.match(permissions, /if \(!AUDITOR_OPTIONAL_PERMISSIONS\.has\(permission\)\) return false/);
  assert.match(rolePolicies, /auditorCeiling/);
  assert.match(accessController, /\[\.\.\.ROLE_DEFAULT_EDITABLE_ROLES, 'system_admin', 'auditor'\]/);
  assert.match(accessController, /actor\?\.role === 'super_admin'/);
});

test('Head roles structurally inherit Staff defaults', () => {
  assert.match(permissions, /ROLE_PARENT/);
  assert.match(permissions, /marketing_head:\s*'marketing_staff'/);
  assert.match(permissions, /sales_head:\s*'sales_staff'/);
  assert.match(permissions, /accounting_head:\s*'accounting_staff'/);
  assert.match(permissions, /operations_head:\s*'operations_staff'/);
  assert.match(accessController, /getRolePolicyForAccessControl/);
});

test('Role & Access UI groups governance and department roles clearly', () => {
  for (const label of ['SYSTEM','AUDIT','MARKETING','SALES','ACCOUNTING','OPERATIONS','OWNER']) {
    assert.match(roleAccess, new RegExp(label));
  }
  assert.match(roleAccess, /system_admin/);
  assert.match(roleAccess, /auditor/);
  assert.match(roleAccess, /super_admin/);
  assert.match(permissionMatrix, /Required/);
  // Intentional UI change: cross-department business access is warning-based,
  // while only governance/security restrictions remain locked.
  assert.match(permissionMatrix, /From Staff Role/);
  assert.match(permissionMatrix, /Outside normal role/);
  assert.match(permissionMatrix, /Restricted governance/);
  assert.doesNotMatch(permissionMatrix, />Not Allowed</);
  assert.doesNotMatch(permissionMatrix, />Optional<\/span>/);
  assert.doesNotMatch(permissionMatrix, />Select All Optional<\/button>/);
  assert.doesNotMatch(permissionMatrix, />Clear Optional<\/button>/);
});

test('per-account access UI keeps Super Admin full access and governed Auditor policy visible', () => {
  assert.match(userAccess, /All Projects · Required/);
  assert.match(userAccess, /governed at a higher authority level/);
  assert.match(userAccess, /auditor|Auditor/);
  assert.match(userAccess, /all_projects_access|All Projects/);
});

test('change-position routes use granular Edit Users permission and same-account role transition', () => {
  assert.match(usersRouter, /change-position\/:id\/preview[\s\S]*SYSTEM_USERS_EDIT/);
  assert.match(usersRouter, /change-position\/:id'[\s\S]*SYSTEM_USERS_EDIT/);
  assert.match(usersController, /same_account:\s*true/);
  assert.match(usersController, /INSERT INTO user_role_history/);
});
