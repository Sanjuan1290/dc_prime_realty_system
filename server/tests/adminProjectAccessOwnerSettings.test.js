import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin project access is database-backed and enforced by project slug/id middleware', () => {
  const service = read('server/services/adminProjectAccess.service.js');
  const middleware = read('server/middleware/auth.middleware.js');
  const router = read('server/routers/System/projects.routers.js');
  const projects = read('server/controllers/System/projects.controller.js');
  const reports = read('server/controllers/System/reports.controller.js');

  assert.match(service, /getAdminProjectAccess/);
  assert.match(service, /admin_project_access/);
  assert.match(service, /admin_all_projects/);
  assert.match(service, /replaceAdminProjectAccess/);
  assert.match(middleware, /requireProjectAccessBySlug/);
  assert.match(middleware, /requireProjectAccessById/);
  assert.match(router, /router\.param\('projectSlug', requireProjectAccessBySlug\)/);
  assert.match(router, /lot-projects\/:id\/edit-preflight'[\s\S]*requireProjectAccessById/);
  assert.match(projects, /getAccessibleProjectIds/);
  assert.match(projects, /grantAdminProjectAccess/);
  assert.match(reports, /buildScope\(req, accessibleProjectIds/);
  assert.match(reports, /sellerOptionScope/);
  assert.match(reports, /report_seller_rate\.lot_project_id IN/);
  assert.match(reports, /You do not have access to the selected project/);
});

test('Notifications and seller-group project data respect assigned Admin projects', () => {
  const notifications = read('server/controllers/System/notifications.controller.js');
  const groups = read('server/controllers/System/sellerGroup.controller.js');

  assert.match(notifications, /appendProjectAccessFilter/);
  assert.match(notifications, /canAccessProject\(user, Number\(row\.lot_project_id/);
  assert.match(notifications, /canAccessProject\(user, Number\(context\.projectId/);
  assert.match(groups, /assertCanMutateWholeGroup/);
  assert.match(groups, /projects outside your Admin access/);
  assert.match(groups, /deactivateLegacyIndividualRates\(connection, groupId, \[projectId\]\)/);
  assert.match(groups, /canAccessProject\(req\.authUser, projectId, connection\)/);
});

test('System and Lot Project Settings require exact Super Admin password plus email-code verification', () => {
  const systemRouter = read('server/routers/System/systemSettings.routers.js');
  const projectRouter = read('server/routers/System/projects.routers.js');
  const systemController = read('server/controllers/System/systemSettings.controller.js');
  const projectController = read('server/controllers/Lot_Projects/Settings/Settings.controller.js');
  const systemPage = read('client/src/pages/System/Settings.jsx');
  const projectPage = read('client/src/pages/Lot_Projects/Settings.jsx');
  const authorizationModal = read('client/src/components/Shared/SettingsAuthorizationModal.jsx');
  const settingsReview = read('client/src/components/Shared/DoubleCheckComponents/SettingsDoubleCheck.jsx');
  const auditDetails = read('client/src/components/System/auditLogsComponents/AuditLogDetailsModal.jsx');

  assert.match(systemRouter, /post\('\/code'[\s\S]*requireExactRole\('super_admin'\)[\s\S]*requireCurrentPassword/);
  assert.match(projectRouter, /settings\/code'[\s\S]*requireExactRole\('super_admin'\)[\s\S]*requireCurrentPassword/);
  assert.match(systemController, /SYSTEM_SETTINGS_ACTION/);
  assert.match(systemController, /verifyAndConsumeSensitiveAction/);
  assert.match(projectController, /LOT_PROJECT_SETTINGS_ACTION/);
  assert.match(projectController, /verifyAndConsumeSensitiveAction/);
  assert.match(authorizationModal, /Reason for change/);
  assert.match(authorizationModal, /Super Admin Password/);
  assert.match(authorizationModal, /Email Verification Code/);
  assert.match(systemPage, /disabled=\{!canManage/);
  assert.match(projectPage, /disabled=\{!canEdit/);
  assert.match(settingsReview, /Owner Authorization/);
  assert.match(settingsReview, /Reason for Change/);
  assert.match(settingsReview, /— Before/);
  assert.match(settingsReview, /— After/);
  assert.match(auditDetails, /Settings Changes/);
  assert.match(auditDetails, />Before</);
  assert.match(auditDetails, />After</);
  assert.match(auditDetails, /Super Admin password \+ email verification/);
  assert.match(auditDetails, /Verification secrets and email codes are never displayed in Audit Logs/);
});

test('Owner-only operational controls stay visible but disabled for Admin', () => {
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const accountHistory = read('client/src/components/Lot_Projects/ListingProfileComponents/AccountHistory/AccountHistoryPanel.jsx');
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const correction = read('client/src/components/Lot_Projects/ListingProfileComponents/ReservationCorrection/ReservationCorrectionModal.jsx');
  const users = read('client/src/pages/System/Users.jsx');

  assert.match(payments, /disabled[\s\S]*Only the Super Admin can edit a recorded payment/);
  assert.match(payments, /disabled[\s\S]*Only the Super Admin can void a recorded payment/);
  assert.match(accountHistory, /disabled=\{!isSuperAdmin\}/);
  assert.match(unitStatus, /disabled=\{!canAdjustCommission \|\| isAdjustingCommission\}/);
  assert.match(correction, /disabled=\{!isSuperAdmin \|\| busy\}/);
  assert.match(users, /Only the Super Admin can edit a Super Admin account/);
  assert.match(users, /Only the Super Admin can activate or deactivate a Super Admin account/);
  assert.doesNotMatch(users, /Only the Super Admin can regenerate credentials for a Super Admin account/);
  assert.doesNotMatch(users, />Credentials<\/button>/);
  assert.doesNotMatch(users, /resetPassword/);
  assert.doesNotMatch(users, />Super Admin only</i);
});
