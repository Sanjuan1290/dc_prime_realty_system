import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('project scope is generalized for configurable system roles and enforced by slug/id middleware', () => {
  const service = read('server/services/projectAccess.service.js');
  const compatibility = read('server/services/adminProjectAccess.service.js');
  const middleware = read('server/middleware/auth.middleware.js');
  const router = read('server/routers/System/projects.routers.js');
  const projects = read('server/controllers/System/projects.controller.js');
  const reports = read('server/controllers/System/reports.controller.js');

  assert.match(service, /getUserProjectAccess/);
  assert.match(service, /user_project_access/);
  assert.match(service, /all_projects_access/);
  assert.match(service, /replaceUserProjectAccess/);
  assert.match(compatibility, /getAdminProjectAccess/);
  assert.match(compatibility, /replaceAdminProjectAccess/);
  assert.match(middleware, /requireProjectAccessBySlug/);
  assert.match(middleware, /requireProjectPermission/);
  assert.match(router, /router\.param\('projectSlug', requireProjectAccessBySlug\)/);
  assert.match(router, /lot-projects\/:id\/edit-preflight'[\s\S]*requireProjectPermission\(PERMISSIONS\.SYSTEM_PROJECTS_EDIT/);
  assert.match(projects, /getAccessibleProjectIds/);
  assert.match(projects, /grantAdminProjectAccess/);
  assert.match(reports, /buildScope\(req, accessibleProjectIds/);
  assert.match(reports, /You do not have access to the selected project/);
});

test('notifications and seller-group project data respect assigned project scope', () => {
  const notifications = read('server/controllers/System/notifications.controller.js');
  const groups = read('server/controllers/System/sellerGroup.controller.js');

  assert.match(notifications, /appendProjectAccessFilter/);
  assert.match(notifications, /canAccessProject\(user, Number\(row\.lot_project_id/);
  assert.match(notifications, /canAccessProject\(user, Number\(context\.projectId/);
  assert.match(groups, /assertCanMutateWholeGroup/);
  assert.match(groups, /canAccessProject\(req\.authUser, projectId, connection\)/);
});

test('System Settings stay Super Admin-only while Lot Project Settings are permission-delegated with password plus email verification', () => {
  const systemRouter = read('server/routers/System/systemSettings.routers.js');
  const projectRouter = read('server/routers/System/projects.routers.js');
  const systemController = read('server/controllers/System/systemSettings.controller.js');
  const projectController = read('server/controllers/Lot_Projects/Settings/Settings.controller.js');
  const systemPage = read('client/src/pages/System/Settings.jsx');
  const projectPage = read('client/src/pages/Lot_Projects/Settings.jsx');
  const authorizationModal = read('client/src/components/Shared/SettingsAuthorizationModal.jsx');
  const settingsReview = read('client/src/components/Shared/DoubleCheckComponents/SettingsDoubleCheck.jsx');

  assert.match(systemRouter, /post\('\/code'[\s\S]*SYSTEM_SETTINGS_MANAGE[\s\S]*requireExactRole\('super_admin'\)[\s\S]*requireCurrentPassword/);
  assert.match(projectRouter, /settings\/code'[\s\S]*LOT_SETTINGS_MANAGE[\s\S]*requireCurrentPassword/);
  assert.doesNotMatch(projectRouter, /settings\/code'[^\n]*requireExactRole/);
  assert.match(systemController, /SYSTEM_SETTINGS_ACTION/);
  assert.match(systemController, /verifyAndConsumeSensitiveAction/);
  assert.match(projectController, /LOT_PROJECT_SETTINGS_ACTION/);
  assert.match(projectController, /canEditProjectSettings/);
  assert.match(projectController, /verifyAndConsumeSensitiveAction/);
  assert.match(authorizationModal, /authorizationLabel = 'Super Admin'/);
  assert.match(authorizationModal, /Email Verification Code/);
  assert.match(systemPage, /disabled=\{!canManage/);
  assert.match(projectPage, /authorizationLabel="Current Account"/);
  assert.match(projectPage, /disabled=\{!canEdit/);
  assert.match(settingsReview, /Reason for Change/);
});

test('owner-level destructive controls stay owner-only while normal payment and user actions follow granular permissions', () => {
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const accountHistory = read('client/src/components/Lot_Projects/ListingProfileComponents/AccountHistory/AccountHistoryPanel.jsx');
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const correction = read('client/src/components/Lot_Projects/ListingProfileComponents/ReservationCorrection/ReservationCorrectionModal.jsx');
  const users = read('client/src/pages/System/Users.jsx');

  assert.match(payments, /canEdit = false/);
  assert.match(payments, /canDelete = false/);
  assert.match(payments, /You do not have permission to edit recorded payments/);
  assert.match(payments, /You do not have permission to void recorded payments/);
  assert.match(accountHistory, /disabled=\{!isSuperAdmin\}/);
  assert.match(unitStatus, /disabled=\{!canAdjustCommission \|\| isAdjustingCommission\}/);
  assert.match(correction, /disabled=\{!isSuperAdmin \|\| busy\}/);
  assert.match(users, /isSuperAdmin && canCreate/);
  assert.match(users, /isSuperAdmin && user\.status === 'active' \? <button onClick=\{\(\) => open\('access',user\)\}/);
  assert.doesNotMatch(users, /open\('reset'/);
  assert.doesNotMatch(users, />Reset<\/button>/);
  assert.match(users, /canDeactivate && user\.status === 'active'/);
});
