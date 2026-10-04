import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('server/migrations/20260925_system_rbac_roles_and_access.sql');
const accessService = read('server/services/accessControl.service.js');
const projectAccess = read('server/services/projectAccess.service.js');
const compatibilityProjectAccess = read('server/services/adminProjectAccess.service.js');
const authMiddleware = read('server/middleware/auth.middleware.js');

const configuredRoles = ['admin', 'marketing', 'sales', 'accounting', 'operations'];

test('20260925 migration changes role defaults without rewriting existing account permissions', () => {
  assert.match(migration, /role_permission_defaults/);
  assert.match(migration, /Existing user_permissions are NOT rewritten/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+user_permissions/i);
  assert.doesNotMatch(migration, /UPDATE\s+user_permissions/i);
  for (const role of configuredRoles) assert.match(migration, new RegExp(`\\('${role}'`));
});

test('Admin destructive defaults requested off remain off in the forward template', () => {
  assert.doesNotMatch(migration, /\('admin','system\.projects\.delete'\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.listings\.delete'\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.payments\.delete'\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.commissions\.release'\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.commissions\.hold'\)/);
  assert.doesNotMatch(migration, /\('admin','lot_project\.commissions\.unhold'\)/);
});

test('Operations keeps project report export off unless Super Admin explicitly adds it', () => {
  assert.doesNotMatch(migration, /\('operations','lot_project\.reports\.export'\)/);
});

test('Super Admin is forced to all-project scope and legacy Admin assignments are preserved', () => {
  assert.match(migration, /SET all_projects_access = 1[\s\S]*WHERE role = 'super_admin'/);
  assert.match(migration, /INSERT IGNORE INTO user_project_access[\s\S]*FROM admin_project_access/);
});

test('project access is generalized and validates the persisted role', () => {
  assert.match(projectAccess, /CONFIGURABLE_SYSTEM_ROLES/);
  assert.match(projectAccess, /loadProjectScopeIdentity/);
  assert.match(projectAccess, /Project access role does not match the persisted user role/);
  assert.match(projectAccess, /user_project_access/);
  assert.match(projectAccess, /all_projects_access/);
  assert.match(compatibilityProjectAccess, /getAdminProjectAccess/);
  assert.match(compatibilityProjectAccess, /replaceAdminProjectAccess/);
});

test('permission submissions are validated against canonical permission keys', () => {
  assert.match(accessService, /validatePermissionKeys/);
  assert.match(accessService, /INVALID_PERMISSION_KEY/);
  assert.match(accessService, /validPermissionKeys\.has/);
  assert.match(accessService, /export const hasPermission/);
});

test('combined server-side permission plus project-scope middleware exists for route hardening', () => {
  assert.match(authMiddleware, /export const requireProjectPermission/);
  assert.match(authMiddleware, /roleHasPermission\(req\.authUser, permission\)/);
  assert.match(authMiddleware, /canAccessProject\(req\.authUser, projectId\)/);
});
