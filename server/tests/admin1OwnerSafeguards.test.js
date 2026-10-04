import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin is permission-backed and generalized project access replaces legacy Admin Type', () => {
  const serverPermissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const usersController = read('server/controllers/System/users.controllers.js');
  const projectAccess = read('server/services/projectAccess.service.js');
  const createUser = read('client/src/components/System/userComponents/CreateSystemUserModal.jsx');
  const editUser = read('client/src/components/System/userComponents/EditSystemUserModal.jsx');
  const accessModal = read('client/src/components/System/userComponents/UserAccessModal.jsx');
  const migration = read('server/migrations/20260925_system_rbac_roles_and_access.sql');

  assert.match(serverPermissions, /if \(actor\.role === 'super_admin'\) return allPermissions\.has\(permission\)/);
  assert.match(serverPermissions, /return normalizedPermissionSet\(actor\)\.has\(permission\)/);
  assert.match(serverPermissions, /isFullAccessAdministrator[\s\S]*role === 'super_admin'/);
  assert.doesNotMatch(clientPermissions, /ADMIN_TYPES/);
  assert.match(usersController, /replaceAdminProjectAccess/);
  assert.match(projectAccess, /user_project_access/);
  assert.match(projectAccess, /all_projects_access/);
  assert.match(createUser, /AdminProjectAccessFields/);
  assert.match(accessModal, /AdminProjectAccessFields/);
  assert.match(editUser, /Role is locked after creation/);
  assert.doesNotMatch(createUser, />Admin Type</);
  assert.doesNotMatch(editUser, />Admin Type</);
  assert.match(migration, /INSERT IGNORE INTO user_project_access[\s\S]*FROM admin_project_access/);
});

test('owner-only operations remain Super Admin-only while delegated payment corrections retain password plus email verification', () => {
  const router = read('server/routers/System/projects.routers.js');
  const settingsRouter = read('server/routers/System/systemSettings.routers.js');
  const middleware = read('server/middleware/auth.middleware.js');
  const paymentController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');

  assert.match(middleware, /export const requireExactRole/);
  assert.match(router, /purge-preview'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /commission-adjustment-code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /reservation-correction\/code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(settingsRouter, /\/code'[\s\S]*requireExactRole\('super_admin'\)[\s\S]*requireCurrentPassword/);

  assert.match(router, /payments\/:paymentId\/correction-code'[\s\S]*requirePaymentCorrectionPermission[\s\S]*requireCurrentPassword/);
  assert.doesNotMatch(router, /payments\/:paymentId\/correction-code'[^\n]*requireExactRole/);
  assert.match(paymentController, /verifyAndConsumeSensitiveAction/);
  assert.match(payments, /You do not have permission to edit recorded payments/);
  assert.match(payments, /You do not have permission to void recorded payments/);
});

test('Admin dashboard ranges now match delegated operational capability', () => {
  const controller = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js');
  const systemReports = read('client/src/pages/System/Reports.jsx');
  const lotDashboard = read('client/src/pages/Lot_Projects/Reports.jsx');

  assert.doesNotMatch(controller, /Admin 1 dashboard reports are limited to 12 months/);
  assert.match(controller, /\['super_admin', 'admin'\]\.includes\(actor\.role\) && isOverOneYear/);
  assert.doesNotMatch(systemReports, /adminRangeBlocked/);
  assert.doesNotMatch(lotDashboard, /adminRangeBlocked/);
  assert.match(systemReports, /administratorNeedsConfirmation/);
  assert.match(lotDashboard, /const canLoadDateRange = !hasInvalidDateRange/);
});
