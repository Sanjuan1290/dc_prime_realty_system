import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('project scope is generalized for configurable system roles and enforced by slug/id middleware', () => {
  const service = read('SERVER/SYSTEM/services/projectAccess.service.js');
  const compatibility = read('SERVER/SYSTEM/services/adminProjectAccess.service.js');
  const middleware = read('SERVER/SYSTEM/middleware/auth.middleware.js');
  const router = read('SERVER/SYSTEM/routers/System/projects.routers.js');
  const projects = read('SERVER/SYSTEM/controllers/System/projects.controller.js');
  const reports = read('SERVER/SYSTEM/controllers/System/reports.controller.js');

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
  const notifications = read('SERVER/SYSTEM/controllers/System/notifications.controller.js');
  const groups = read('SERVER/SYSTEM/controllers/System/sellerGroup.controller.js');

  assert.match(notifications, /appendProjectAccessFilter/);
  assert.match(notifications, /canAccessProject\(user, Number\(row\.lot_project_id/);
  assert.match(notifications, /canAccessProject\(user, Number\(context\.projectId/);
  assert.match(groups, /assertCanMutateWholeGroup/);
  assert.match(groups, /canAccessProject\(req\.authUser, projectId, connection\)/);
});

test('System Settings stay owner-only while Lot Project Settings keep department/Auditor governance', () => {
  const systemRouter = read('SERVER/SYSTEM/routers/System/systemSettings.routers.js');
  const projectRouter = read('SERVER/SYSTEM/routers/System/projects.routers.js');
  const systemController = read('SERVER/SYSTEM/controllers/System/systemSettings.controller.js');
  const projectController = read('SERVER/SYSTEM/controllers/Lot_Projects/Settings/Settings.controller.js');
  const systemPage = read('CLIENT/SYSTEM/src/pages/System/Settings.jsx');
  const projectPage = read('CLIENT/SYSTEM/src/pages/Lot_Projects/Settings.jsx');
  const authorizationModal = read('CLIENT/SYSTEM/src/components/Lot_Projects/SettingsComponents/ProjectSettingsAuthorizationModal.jsx');
  const settingsReview = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/SettingsDoubleCheck.jsx');

  assert.match(systemRouter, /post\('\/code'[\s\S]*SYSTEM_SETTINGS_MANAGE[\s\S]*requireExactRole\('super_admin', 'system_admin'\)[\s\S]*requireCurrentPassword/);
  assert.match(projectRouter, /settings\/code'[\s\S]*LOT_SETTINGS_MANAGE[\s\S]*requestLotProjectSettingsCode/);
  assert.doesNotMatch(projectRouter, /settings\/code'[^\n]*requireCurrentPassword/);
  assert.doesNotMatch(projectRouter, /settings\/code'[^\n]*requireExactRole/);
  assert.match(systemController, /SYSTEM_SETTINGS_ACTION/);
  assert.match(systemController, /Only Super Admin can edit system settings/);
  assert.match(systemController, /verifyAndConsumeSensitiveAction/);
  assert.match(projectController, /PROJECT_SETTINGS_REVIEW_ACTION/);
  assert.match(projectController, /operations_staff/);
  assert.match(projectController, /operations_head/);
  assert.match(projectController, /isOwnerAdministrator\(/);
  assert.match(projectController, /super_admin_emergency/);
  assert.match(authorizationModal, /Operations Head Approval/);
  assert.match(authorizationModal, /Auditor Case/);
  assert.match(authorizationModal, /Super Admin Emergency Override/);
  assert.match(authorizationModal, /Email Verification Code/);
  assert.match(systemPage, /const canManage = \['super_admin', 'system_admin'\]\.includes\(actor\.role\)/);
  assert.match(systemPage, /disabled=\{!canManage/);
  assert.match(projectPage, /ProjectSettingsAuthorizationModal/);
  assert.match(projectPage, /disabled=\{!canEdit/);
  assert.match(settingsReview, /Reason for Change/);
});

test('System Admin can perform permission-backed administration while owner-only destructive actions stay protected', () => {
  const payments = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const accountHistory = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/AccountHistory/AccountHistoryPanel.jsx');
  const unitStatus = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const correction = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/ReservationCorrection/ReservationCorrectionModal.jsx');
  const users = read('CLIENT/SYSTEM/src/pages/System/Users.jsx');

  assert.match(payments, /canEdit = false/);
  assert.match(payments, /canDelete = false/);
  assert.match(payments, /You do not have permission to edit recorded payments/);
  assert.match(payments, /You do not have permission to void recorded payments/);
  assert.match(accountHistory, /canPermanentlyDelete = false/);
  assert.match(unitStatus, /disabled=\{\(!canAdjustCommission && !canChangeAssignedSeller\) \|\| isAdjustingCommission\}/);
  assert.match(unitStatus, /disabled=\{!canAdjustCommission\}/);
  assert.match(unitStatus, /disabled=\{!canChangeAssignedSeller\}/);
  assert.match(correction, /sales_staff|sales_head/);
  assert.match(users, /canCreate && \['super_admin','system_admin'\]\.includes\(actor\.role\)/);
  assert.match(users, /canViewAccess && user\.status === 'active'/);
  assert.match(users, /canManageTarget/);
  assert.doesNotMatch(users, /open\('reset'/);
  assert.doesNotMatch(users, />Reset<\/button>/);
  assert.match(users, /canDeactivate && canManageTarget\(user\) && user\.status === 'active'/);
});



