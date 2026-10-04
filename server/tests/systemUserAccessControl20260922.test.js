import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const batch1 = read('server/migrations/20261004_batch1_staff_head_auditor_rbac.sql');
const permissions = read('server/config/permissions.js');
const projectAccess = read('server/services/adminProjectAccess.service.js');
const accessController = read('server/controllers/System/accessControl.controller.js');
const usersController = read('server/controllers/System/users.controllers.js');
const usersRouter = read('server/routers/System/users.routers.js');
const settingsPage = read('client/src/pages/System/Settings.jsx');
const roleAccess = read('client/src/components/System/settingsComponents/RoleAccessControl.jsx');

const roles = ['super_admin','system_admin','auditor','marketing_staff','marketing_head','sales_staff','sales_head','accounting_staff','accounting_head','operations_staff','operations_head'];

test('system roles and account codes follow the Staff/Head governance model', () => {
  for (const role of roles) assert.match(permissions, new RegExp(`['\"]${role}['\"]`), role);
  assert.match(permissions, /system_admin:\s*'ADM'/);
  assert.match(permissions, /auditor:\s*'AUD'/);
  assert.match(permissions, /marketing_staff:\s*'MKT'/);
  assert.match(permissions, /marketing_head:\s*'MKH'/);
  assert.match(permissions, /accounting_head:\s*'ACH'/);
  assert.match(batch1, /division_manager[\s\S]*sales_director[\s\S]*unit_manager[\s\S]*sales_agent[\s\S]*external_group/);
});

test('System Admin is permission-backed, Auditor is enforced read-only, and Super Admin is the only full-access bypass', () => {
  assert.match(permissions, /isFullAccessAdministrator[\s\S]*role === 'super_admin'/);
  assert.match(permissions, /AUDITOR_ENFORCED_PERMISSIONS/);
  assert.match(permissions, /return normalizedPermissionSet\(actor\)\.has\(permission\)/);
  assert.doesNotMatch(permissions, /actor\.role === 'system_admin'\) return allPermissions/);
});

test('role defaults, per-user permissions and generalized project scope remain database backed', () => {
  for (const table of ['role_permission_defaults', 'user_permissions', 'user_project_access']) {
    assert.match(batch1 + read('server/migrations/20260922_system_user_access_control.sql'), new RegExp(table));
  }
  assert.match(projectAccess, /authoritative implementation lives in projectAccess\.service\.js/);
  assert.match(projectAccess, /replaceAdminProjectAccess = replaceUserProjectAccess/);
  assert.match(projectAccess, /hydrateAdminProjectAccess = hydrateUserProjectAccess/);
  const authoritativeProjectAccess = read('server/services/projectAccess.service.js');
  assert.match(authoritativeProjectAccess, /CONFIGURABLE_SYSTEM_ROLES/);
  assert.match(authoritativeProjectAccess, /all_projects_access/);
  assert.match(authoritativeProjectAccess, /user_project_access/);
  assert.match(authoritativeProjectAccess, /persisted account role wins/);
  assert.match(accessController, /getRoleAccessDefaults/);
});

test('Head defaults inherit Staff permissions and add review/approval authority', () => {
  assert.match(permissions, /ROLE_PARENT/);
  assert.match(permissions, /accounting_head:\s*'accounting_staff'/);
  assert.match(permissions, /sales_head:\s*'sales_staff'/);
  assert.match(permissions, /operations_head:\s*'operations_staff'/);
  assert.match(permissions, /marketing_head:\s*'marketing_staff'/);
});

test('system-role position changes preserve the same account and record role history', () => {
  assert.match(usersController, /export const changeUserPosition/);
  assert.match(usersController, /UPDATE users[\s\S]*SET role = \?/);
  assert.match(usersController, /INSERT INTO user_role_history/);
  assert.match(usersController, /same_account:\s*true/);
  assert.match(usersRouter, /change-position\/:id[\s\S]*SYSTEM_USERS_EDIT/);
});

test('legacy system roles migrate without touching accredited seller roles', () => {
  assert.match(batch1, /admin[\s\S]*system_admin/);
  assert.match(batch1, /marketing[\s\S]*marketing_staff/);
  assert.match(batch1, /sales[\s\S]*sales_staff/);
  assert.match(batch1, /accounting[\s\S]*accounting_staff/);
  assert.match(batch1, /operations[\s\S]*operations_staff/);
  assert.match(batch1, /division_manager/);
  assert.match(batch1, /sales_director/);
});

test('Role & Access Control is permission-managed while protected System Settings remain owner-controlled', () => {
  assert.match(settingsPage, /SYSTEM_ACCESS_CONTROL_MANAGE/);
  assert.match(settingsPage, /canManageRoleAccess/);
  assert.match(settingsPage, /only the Super Admin can use it with password and email verification/i);
  assert.match(roleAccess, /SYSTEM|AUDIT|MARKETING|SALES|ACCOUNTING|OPERATIONS|OWNER/);
});
