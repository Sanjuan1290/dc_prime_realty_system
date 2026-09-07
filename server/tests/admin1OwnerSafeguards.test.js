import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin 1 keeps full operational permissions while Admin 2 and Admin 3 remain disabled', () => {
  const serverPermissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const usersController = read('server/controllers/System/users.controllers.js');

  assert.match(serverPermissions, /isAdmin1/);
  assert.match(serverPermissions, /admin_1: allPermissions/);
  assert.match(serverPermissions, /if \(target === 'super_admin'\) return actor\.role === 'super_admin'/);
  assert.match(clientPermissions, /value: 'admin_2'[\s\S]*disabled: true/);
  assert.match(clientPermissions, /value: 'admin_3'[\s\S]*disabled: true/);
  assert.match(usersController, /supportedAdminTypes = new Set\(\['admin_1'\]\)/);
  assert.match(usersController, /canActorManageUserRole\(req\.authUser, targetRole\)/);
  assert.match(usersController, /canActorCreateUserRole\(req\.authUser, targetRole\)/);
});

test('Super Admin accounts and permanent account purge stay owner-only', () => {
  const router = read('server/routers/System/projects.routers.js');
  const middleware = read('server/middleware/auth.middleware.js');
  const usersPage = read('client/src/pages/System/Users.jsx');
  const listingProfile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');

  assert.match(middleware, /export const requireExactRole/);
  assert.match(router, /purge-preview'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /purge-code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /accounts\/:accountId\/purge'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(usersPage, /role !== "super_admin"/);
  assert.match(usersPage, /canManageUserRole\(actorUser, user\?\.role\)/);
  assert.match(listingProfile, /isSuperAdmin=\{currentUserData\?\.user\?\.role === 'super_admin'\}/);
});

test('Admin 1 is limited to 12 months in System and Lot dashboards', () => {
  const controller = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js');
  const systemDashboard = read('client/src/pages/System/Dashboard.jsx');
  const lotDashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx');

  assert.match(controller, /Admin 1 dashboard reports are limited to 12 months \(1 year\)/);
  assert.match(controller, /resolveDashboardDateRange\(req\.query, req\.authUser\)/);
  assert.match(systemDashboard, /adminRangeBlocked = isAdmin1 && isLongerThanTwelveMonths/);
  assert.match(lotDashboard, /adminRangeBlocked = isAdmin1 && exceedsTwelveMonths\(dateFrom, dateTo\)/);
  assert.match(lotDashboard, /enabled: Boolean\(projectSlug\) && canLoadDateRange/);
});
