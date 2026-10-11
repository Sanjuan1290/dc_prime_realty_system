import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('payment notification setting is project-specific and uses the project Company Email', () => {
  const projectController = read('server/controllers/Lot_Projects/Settings/Settings.controller.js');
  const projectPage = read('client/src/pages/Lot_Projects/Settings.jsx');
  const projectModal = read('client/src/components/Lot_Projects/SettingsComponents/EditSettingsModal/EditSettingsModal.jsx');
  const systemController = read('server/controllers/System/systemSettings.controller.js');
  const systemPage = read('client/src/pages/System/Settings.jsx');
  const systemForm = read('client/src/components/System/settingsComponents/SystemSettingsForm.jsx');
  const migration = read('server/migrations/20260927_project_payment_entry_notifications.sql');

  assert.match(projectController, /payment_entry_email_notification_enabled/);
  assert.match(projectController, /PROJECT_COMPANY_EMAIL_REQUIRED_FOR_PAYMENT_NOTIFICATIONS/);
  assert.match(projectController, /Enter a valid Project Company Email before enabling payment entry notifications/);
  assert.match(projectController, /payment_entry_email_notification_enabled = VALUES\(payment_entry_email_notification_enabled\)/);
  assert.match(projectPage, /Payment Entry Notifications/);
  assert.match(projectPage, /Recipient: \{settings\.companyEmail/);
  assert.match(projectModal, /Email this project's Company Email when a payment is added/);
  assert.match(projectModal, /Project Company Email/);
  assert.doesNotMatch(systemPage, /paymentEntryEmailNotificationEnabled/);
  assert.doesNotMatch(systemForm, /Payment Entry Notifications/);
  assert.doesNotMatch(systemController, /paymentEntryEmailNotificationEnabled/);
  assert.match(migration, /ALTER TABLE lot_project_settings/);
  assert.match(migration, /payment_entry_email_notification_enabled/);
});

test('new payments notify Company Email after the transaction without rolling back payment when email fails', () => {
  const payments = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');

  assert.match(payments, /const sendPaymentEntryCompanyNotification = async/);
  assert.match(payments, /SELECT company_name, company_email, payment_entry_email_notification_enabled[\s\S]*FROM lot_project_settings[\s\S]*WHERE lot_project_id = \?/);
  assert.match(payments, /idempotencyKey: `payment-entry-\$\{payment\.paymentId\}`/);
  assert.match(payments, /Payment was saved, but the Company Email notification could not be sent/);
  assert.match(payments, /result\.idempotentReplay[\s\S]*sendPaymentEntryCompanyNotification/);
  assert.match(payments, /payment_notification: paymentNotification/);
  assert.match(payments, /Project:/);
  assert.match(payments, /Payment date:/);
  assert.match(payments, /Reference:/);
  assert.match(payments, /Entered by:/);
  assert.match(payments, /formatPaymentRecordedAt/);
  assert.match(payments, /timeZone: 'Asia\/Manila'/);
  assert.match(payments, /weekday: 'long'/);
  assert.match(payments, /second: '2-digit'/);
  assert.match(payments, /Recorded at:/);
  assert.match(payments, /const projectId = Number\(project\?\.lot_project_id/);
  assert.doesNotMatch(payments, /FROM system_settings[\s\S]*payment_entry_email_notification_enabled/);
  assert.match(payments, /PAYMENT_EMAIL_DEFAULT_LOGO_URL/);
  assert.match(payments, /Verified Payment Recorded/);
  assert.match(payments, /Double-check required:/);
});

test('cancellation permissions are granular and intentionally absent from recommended role defaults', () => {
  const permissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const accessControl = read('server/controllers/System/accessControl.controller.js');
  const recommended = read('server/config/recommendedRolePermissions.js');
  const migration = read('server/migrations/20260926_payment_notifications_and_cancellation_access.sql');

  for (const key of [
    'lot_project.cancellations.manage',
    'lot_project.cancellations.settle',
    'lot_project.cancellations.release_unit',
  ]) {
    assert.ok(permissions.includes(key));
    assert.ok(clientPermissions.includes(key));
    assert.ok(migration.includes(key));
    assert.ok(!recommended.includes(key));
  }

  assert.match(accessControl, /Manage Cancellation/);
  assert.match(accessControl, /Process Cancellation Settlement \/ Refund/);
  assert.match(accessControl, /Return Cancelled Unit to Available/);
});

test('cancellation sensitive actions require exact permission plus current password and email code', () => {
  const router = read('server/routers/System/projects.routers.js');
  const controller = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const service = read('server/services/cancellationVerification.service.js');
  const profile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/CancellationAuthorizationModal.jsx');

  assert.match(service, /START: 'start_cancellation'/);
  assert.match(service, /CANCEL: 'cancel_cancellation'/);
  assert.match(service, /SETTLE: 'settle_cancellation'/);
  assert.match(service, /VOID_UNPAID: 'void_unpaid_cancellation'/);
  assert.match(service, /RELEASE_UNIT: 'reset_to_available'/);
  assert.match(service, /PERMISSIONS\.LOT_CANCELLATIONS_MANAGE/);
  assert.match(service, /PERMISSIONS\.LOT_CANCELLATIONS_SETTLE/);
  assert.match(service, /PERMISSIONS\.LOT_CANCELLATIONS_RELEASE_UNIT/);
  assert.match(service, /cancellationActionRequiresVerification/);

  assert.match(router, /cancellation-code'[\s\S]*requireCancellationActionPermission[\s\S]*requireCurrentPassword/);
  assert.match(controller, /verifyAndConsumeSensitiveAction/);
  assert.match(controller, /Current-password verification and the six-digit email code are required for this cancellation action/);
  assert.match(controller, /roleHasPermission\(req\.authUser, cancellationPermission\)/);

  assert.match(profile, /PERMISSIONS\.LOT_CANCELLATIONS_MANAGE/);
  assert.match(profile, /PERMISSIONS\.LOT_CANCELLATIONS_SETTLE/);
  assert.match(profile, /PERMISSIONS\.LOT_CANCELLATIONS_RELEASE_UNIT/);
  assert.match(unitStatus, /statusTransitionAction: 'start_cancellation'/);
  assert.match(unitStatus, /statusTransitionAction: 'cancel_cancellation'/);
  assert.match(unitStatus, /statusTransitionAction: 'reset_to_available'/);
  assert.match(unitStatus, /CancellationAuthorizationModal/);
  assert.match(modal, /Current Account Password/);
  assert.match(modal, /Email Verification Code/);
  assert.match(modal, /Verify Password & Send Code/);
});

