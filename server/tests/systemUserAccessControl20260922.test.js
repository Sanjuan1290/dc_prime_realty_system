import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('server/migrations/20260922_system_user_access_control.sql');
const serverPermissions = read('server/config/permissions.js');
const clientPermissions = read('client/src/config/permissions.js');
const projectAccess = read('server/services/adminProjectAccess.service.js');
const accessController = read('server/controllers/System/accessControl.controller.js');
const usersController = read('server/controllers/System/users.controllers.js');
const usersRouter = read('server/routers/System/users.routers.js');
const settingsPage = read('client/src/pages/System/Settings.jsx');
const usersPage = read('client/src/pages/System/Users.jsx');

const roles = ['super_admin', 'admin', 'marketing', 'sales', 'accounting', 'operations'];

test('system roles and account codes follow the approved role model', () => {
  for (const role of roles) {
    assert.match(serverPermissions, new RegExp(`['\"]${role}['\"]`));
    assert.match(clientPermissions, new RegExp(`['\"]${role}['\"]`));
  }
  assert.match(serverPermissions, /marketing:\s*'MKT'/);
  assert.match(serverPermissions, /sales:\s*'SS'/);
  assert.match(serverPermissions, /accounting:\s*'ACC'/);
  assert.match(serverPermissions, /operations:\s*'OPS'/);
  assert.match(migration, /division_manager[\s\S]*sales_director[\s\S]*unit_manager[\s\S]*sales_agent[\s\S]*external_group/);
});

test('Admin is database-permission based and Super Admin is the only full-access bypass', () => {
  assert.match(serverPermissions, /isFullAccessAdministrator[\s\S]*role === 'super_admin'/);
  assert.doesNotMatch(serverPermissions, /actor\.role === 'admin'\) return allPermissions/);
  assert.match(serverPermissions, /return normalizedPermissionSet\(actor\)\.has\(permission\)/);
  assert.match(clientPermissions, /return permissionSet\(actor\)\.has\(permission\)/);
});

test('role defaults, per-user permissions and generalized project scope are database backed', () => {
  for (const table of ['role_permission_defaults', 'user_permissions', 'user_project_access']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(projectAccess, /SYSTEM_USER_ROLES/);
  assert.match(projectAccess, /all_projects_access/);
  assert.match(projectAccess, /user_project_access/);
  assert.match(projectAccess, /isOperationalAdmin = \(user = \{\}\) => SYSTEM_USER_ROLES\.includes/);
  assert.match(accessController, /Existing accounts were not changed/);
});

test('approved Admin default includes listing CRUD and payment CRUD but not project delete or commission release', () => {
  for (const key of [
    'lot_project.listings.create', 'lot_project.listings.edit', 'lot_project.listings.delete',
    'lot_project.payments.create', 'lot_project.payments.edit', 'lot_project.payments.delete',
  ]) assert.match(migration, new RegExp(`\\('admin','${key.replaceAll('.', '\\.')}',1\\)`));
  assert.doesNotMatch(migration, /\('admin','system\.projects\.delete',1\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.commissions\.release',1\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.commissions\.hold',1\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.commissions\.unhold',1\)/);
});

test('system-role accounts are immutable, permanent deactivation is enforced, and position change is atomic', () => {
  assert.match(usersController, /A system account role cannot be changed/);
  assert.match(usersController, /ACCOUNT_DEACTIVATED_PERMANENTLY/);
  assert.match(usersController, /auth_version = COALESCE\(auth_version, 0\) \+ 1/);
  assert.match(usersController, /export const changeUserPosition/);
  assert.match(usersController, /beginTransaction\(\)/);
  assert.match(usersController, /await connection\.commit\(\)/);
  assert.match(usersController, /await connection\.rollback\(\)/);
  assert.match(usersRouter, /change-position\/:id[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(usersPage, /Change Position/);
});

test('same-person historical accounts support role sequences and reusable active email login', () => {
  assert.match(migration, /person_key/);
  assert.match(migration, /role_sequence/);
  assert.match(migration, /uq_users_person_role_sequence/);
  assert.match(migration, /DROP INDEX uq_users_email/);
  assert.match(migration, /active_login_email/);
  assert.match(usersController, /getNextRoleSequence/);
  assert.match(usersController, /generateUniqueAccountCode/);
  assert.match(usersController, /account_code = \?/);
});

test('Role & Access Control UI is SuperAdmin-owned and documents default-copy behavior', () => {
  assert.match(settingsPage, /RoleAccessControl/);
  assert.match(settingsPage, /user\?\.role === 'super_admin'/);
  assert.match(read('client/src/components/System/settingsComponents/RoleAccessControl.jsx'), /Editing a role default does not silently change existing users/);
});

