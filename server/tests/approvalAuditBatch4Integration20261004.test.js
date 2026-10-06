import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERMISSIONS } from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const client = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

const migration = read('migrations/20261004_batch4_head_approvals_review_center.sql');
const settingsController = read('controllers/Lot_Projects/Settings/Settings.controller.js');
const paymentController = read('controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
const reservationController = read('controllers/Lot_Projects/ListingProfile/ReservationCorrection.controller.js');
const commissionController = read('controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
const projectsRouter = read('routers/System/projects.routers.js');
const workflowRouter = read('routers/System/workflow.routers.js');
const reviewCenter = client('pages/System/ReviewCenter.jsx');
const projectSettingsUi = client('pages/Lot_Projects/Settings.jsx');
const projectSettingsAuthUi = client('components/Lot_Projects/SettingsComponents/ProjectSettingsAuthorizationModal.jsx');
const paymentsUi = client('components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');

const routeLine = (fragment) => projectsRouter.split('\n').find((line) => line.includes(fragment)) || '';

test('Batch 4 persists exact-payload protected approvals and governed permission grants', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS protected_change_requests/);
  assert.match(migration, /request_payload_hash CHAR\(64\) NOT NULL/);
  for (const pair of [
    ['sales_staff', 'lot_project.reservation.correct'],
    ['accounting_staff', 'lot_project.commissions.adjust'],
    ['accounting_staff', 'lot_project.penalties.correct'],
    ['operations_staff', 'lot_project.settings.manage'],
    ['system_admin', 'lot_project.settings.manage'],
  ]) assert.ok(migration.includes(`('${pair[0]}', '${pair[1]}'`), pair.join(':'));
});

test('System Admin is owner-level and holds every Batch 4 governed correction and owner permission', () => {
  const policy = getStaticRolePolicy('system_admin');
  assert.equal(policy.fullAccess, true);
  for (const key of [PERMISSIONS.LOT_RESERVATION_CORRECT, PERMISSIONS.LOT_COMMISSIONS_ADJUST, PERMISSIONS.LOT_PENALTY_CORRECT, PERMISSIONS.LOT_SETTINGS_MANAGE, PERMISSIONS.SYSTEM_SETTINGS_MANAGE, PERMISSIONS.AUDIT_LOGS_ARCHIVE, PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE]) {
    assert.ok(policy.required.includes(key), key);
  }
});

test('Project Settings follows Operations Staff -> Head -> Auditor and exact Audit Case correction', () => {
  assert.match(settingsController, /actor\.role === 'operations_staff'/);
  assert.match(settingsController, /actor\.role === 'operations_head'/);
  assert.match(settingsController, /isOwnerAdministrator\(actor\) && Number\(req\.body\?\.auditCaseId/);
  assert.match(settingsController, /if \(!isOwnerAdministrator\(actor\)\) \{/);
  assert.match(settingsController, /createProtectedChangeRequest/);
  assert.match(settingsController, /consumeProtectedChange/);
  assert.match(settingsController, /entityType: PROJECT_SETTINGS_REVIEW_ENTITY/);
  assert.match(settingsController, /createOperationalReview/);
  assert.match(settingsController, /advanceAuditCaseToRecheck/);
  assert.match(settingsController, /bcrypt\.compare\(password, actor\.password_hash\)/);
  assert.doesNotMatch(routeLine("settings/code"), /requireCurrentPassword/);
});

test('Project Settings UI uses Head approval / Audit Case / emergency owner modes rather than routine Super Admin credentials', () => {
  assert.match(projectSettingsUi, /ProjectSettingsAuthorizationModal/);
  assert.match(projectSettingsUi, /workflowAuditCaseId/);
  assert.match(projectSettingsAuthUi, /Request Head Approval/);
  assert.match(projectSettingsAuthUi, /Check Head Approval/);
  assert.match(projectSettingsAuthUi, /Operations Head Authority/);
  assert.match(projectSettingsAuthUi, /Auditor Case Correction/);
  assert.match(projectSettingsAuthUi, /Super Admin Emergency Override/);
});

test('Reservation, commission, penalty and LMF protected changes share governed workflow and System Admin exact-case correction', () => {
  assert.match(reservationController, /createProtectedChangeRequest/);
  assert.match(reservationController, /department: 'sales'/);
  assert.match(reservationController, /getPendingAuditCorrectionCase/);
  assert.match(commissionController, /createProtectedChangeRequest/);
  assert.match(commissionController, /department: 'accounting'/);
  assert.match(commissionController, /getPendingAuditCorrectionCase/);
  assert.match(paymentController, /authorizeAccountingAdjustment/);
  assert.match(paymentController, /ACCOUNTING_ADJUSTMENT_ENTITY/);
  assert.match(paymentController, /ACCOUNTING_LMF_ENTITY/);
  assert.match(paymentController, /getPendingAuditCorrectionCase/);
});

test('LMF Audit Case has an executable controlled restoration path and returns to Auditor recheck', () => {
  assert.match(paymentController, /restoreSeparateLegalMiscFeeFromAuditCase/);
  assert.match(paymentController, /Only System Admin can restore an LMF from a valid Auditor correction case/);
  assert.match(paymentController, /pre-waiver LMF snapshot/);
  assert.match(paymentController, /advanceAuditCaseToRecheck/);
  assert.match(routeLine('lmf-restore'), /LOT_PENALTY_CORRECT/);
  assert.match(paymentsUi, /lmf_correction/);
  assert.match(paymentsUi, /restoreLmfFromAuditMutation/);
});

test('Review Center deep-links every Batch 4 correction class to the exact record', () => {
  assert.match(reviewCenter, /penalty_adjustment/);
  assert.match(reviewCenter, /lmf_correction/);
  assert.match(reviewCenter, /project_settings_correction/);
  assert.match(reviewCenter, /scheduleId=/);
  assert.match(reviewCenter, /Open Project Settings Correction/);
  assert.match(reviewCenter, /Open LMF Correction/);
});

test('owner-level destructive/system governance remains outside routine Head approvals', () => {
  assert.match(projectsRouter, /purge-code[^\n]*requireExactRole\('super_admin', 'system_admin'\)/);
  assert.match(workflowRouter, /protected-changes/);
});

