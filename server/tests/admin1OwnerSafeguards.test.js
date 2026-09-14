import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin has full operational permissions and project access replaces legacy Admin Type', () => {
  const serverPermissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const usersController = read('server/controllers/System/users.controllers.js');
  const createUser = read('client/src/components/System/userComponents/CreateUserModal.jsx');
  const editUser = read('client/src/components/System/userComponents/EditUserModal.jsx');
  const migration = read('server/migrations/20260914_admin_project_access.sql');

  assert.match(serverPermissions, /admin: adminPermissions/);
  assert.match(serverPermissions, /permission !== PERMISSIONS\.SYSTEM_DATA_INTEGRITY_VIEW/);
  assert.match(serverPermissions, /if \(target === 'super_admin'\) return actor\.role === 'super_admin'/);
  assert.doesNotMatch(clientPermissions, /ADMIN_TYPES/);
  assert.match(usersController, /replaceAdminProjectAccess/);
  assert.match(createUser, /Projects this Admin can manage|AdminProjectAccessFields/);
  assert.match(editUser, /Projects this Admin can manage|AdminProjectAccessFields/);
  assert.doesNotMatch(createUser, />Admin Type</);
  assert.doesNotMatch(editUser, />Admin Type</);
  assert.match(migration, /admin_all_projects/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_project_access/);
  assert.match(migration, /WHERE role = 'admin'/);
});

test('Super Admin accounts and password plus email-code owner actions stay owner-only', () => {
  const router = read('server/routers/System/projects.routers.js');
  const settingsRouter = read('server/routers/System/systemSettings.routers.js');
  const middleware = read('server/middleware/auth.middleware.js');
  const listingProfile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');

  assert.match(middleware, /export const requireExactRole/);
  assert.match(router, /purge-preview'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /commission-adjustment-code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /reservation-correction\/code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /payments\/:paymentId\/correction-code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(settingsRouter, /\/code'[\s\S]*requireExactRole\('super_admin'\)[\s\S]*requireCurrentPassword/);
  assert.match(listingProfile, /isSuperAdmin=\{currentUserData\?\.user\?\.role === 'super_admin'\}/);
  assert.match(payments, /Only the Super Admin can edit a recorded payment/);
  assert.match(payments, /Only the Super Admin can void a recorded payment/);
});

test('Admin dashboard ranges now match Super Admin operational capability', () => {
  const controller = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js');
  const systemDashboard = read('client/src/pages/System/Dashboard.jsx');
  const lotDashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx');

  assert.doesNotMatch(controller, /Admin 1 dashboard reports are limited to 12 months/);
  assert.match(controller, /\['super_admin', 'admin'\]\.includes\(actor\.role\) && isOverOneYear/);
  assert.doesNotMatch(systemDashboard, /adminRangeBlocked/);
  assert.doesNotMatch(lotDashboard, /adminRangeBlocked/);
  assert.match(systemDashboard, /administratorNeedsConfirmation/);
  assert.match(lotDashboard, /const canLoadDateRange = !hasInvalidDateRange/);
});
