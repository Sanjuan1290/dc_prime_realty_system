import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin informational access banner is no longer displayed on Users', () => {
  const users = read('client/src/pages/System/Users.jsx');

  assert.doesNotMatch(users, /Admin operational access/);
  assert.doesNotMatch(users, /Admins have full operational access within their assigned projects/);
  assert.doesNotMatch(users, /Dashboard reports are limited to 12 months/);
});

test('Archive Old Audit Logs is an exact Super Admin action with password plus email verification', () => {
  const page = read('client/src/pages/System/AuditLogs.jsx');
  const modal = read('client/src/components/System/auditLogsComponents/ArchiveAuditLogsModal.jsx');
  const router = read('server/routers/System/auditLogs.router.js');
  const controller = read('server/controllers/System/auditLogs.controller.js');

  assert.match(page, /const isSuperAdmin = currentUserData\?\.user\?\.role === 'super_admin'/);
  assert.match(page, /disabled=\{!isSuperAdmin\}/);
  assert.match(page, /Only the Super Admin can archive old audit logs/);
  assert.match(router, /archive\/request'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /archive\/confirm'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(router, /archive\/exports\/:batchId'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(controller, /if \(user\.role !== 'super_admin'\)/);
  assert.match(controller, /Only the Super Admin can archive audit logs/);
  assert.match(controller, /bcrypt\.compare/);
  assert.match(modal, /Super Admin password/);
  assert.match(modal, /Verify Password & Send Code/);
  assert.match(modal, /6-digit email code/);
  assert.match(modal, /requestData\.maskedEmail/);
});

test('Cancellation actions are permission-based while sensitive settlement and release remain password + email protected', () => {
  const profile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/CancellationAuthorizationModal.jsx');
  const router = read('server/routers/System/projects.routers.js');
  const controller = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');

  assert.match(profile, /PERMISSIONS\.LOT_CANCELLATIONS_MANAGE/);
  assert.match(profile, /PERMISSIONS\.LOT_CANCELLATIONS_SETTLE/);
  assert.match(profile, /PERMISSIONS\.LOT_CANCELLATIONS_RELEASE_UNIT/);

  assert.match(unitStatus, /statusTransitionAction: 'start_cancellation'/);
  assert.match(unitStatus, /statusTransitionAction: 'cancel_cancellation'/);
  assert.match(unitStatus, /statusTransitionAction: 'reset_to_available'/);
  assert.match(unitStatus, /CancellationAuthorizationModal/);

  assert.match(router, /cancellation-code'[\s\S]*requireCancellationActionPermission[\s\S]*requireCurrentPassword/);
  assert.match(controller, /roleHasPermission\(req\.authUser, cancellationPermission\)/);
  assert.match(controller, /verifyAndConsumeSensitiveAction/);
  assert.match(modal, /Current Account Password/);
  assert.match(modal, /Email Verification Code/);
});
