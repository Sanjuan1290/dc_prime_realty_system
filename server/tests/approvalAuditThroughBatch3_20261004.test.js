import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SYSTEM_USER_ROLES,
  ROLE_CODES,
  ROLE_PARENT,
  PERMISSIONS,
  roleHasPermission,
  canActorManageUserRole,
  getAuditorEnforcedPermissions,
} from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readClient = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

const batch1 = read('migrations/20261004_batch1_staff_head_auditor_rbac.sql');
const batch2 = read('migrations/20261004_batch2_operational_review_engine.sql');
const batch3 = read('migrations/20261004_batch3_payment_audit_cases.sql');
const workflowService = read('services/operationalReview.service.js');
const workflowController = read('controllers/System/workflow.controller.js');
const paymentController = read('controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
const paymentUi = readClient('components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
const reviewCenterUi = readClient('pages/System/ReviewCenter.jsx');
const listingProfileUi = readClient('pages/Lot_Projects/ListingProfile.jsx');
const workflowRouter = read('routers/System/workflow.routers.js');
const roleAccessUi = readClient('components/System/settingsComponents/RoleAccessControl.jsx');
const systemLayout = readClient('layout/SystemLayout.jsx');

const expectedSystemRoles = [
  'super_admin','system_admin','auditor',
  'marketing_staff','marketing_head','sales_staff','sales_head',
  'accounting_staff','accounting_head','operations_staff','operations_head',
];

test('Batch 1 migrates legacy internal roles in place to Staff/Head governance roles', () => {
  assert.deepEqual(SYSTEM_USER_ROLES, expectedSystemRoles);
  for (const [oldRole, newRole] of [
    ['admin','system_admin'],['marketing','marketing_staff'],['sales','sales_staff'],['accounting','accounting_staff'],['operations','operations_staff'],
  ]) assert.match(batch1, new RegExp(`UPDATE users SET role = '${newRole}' WHERE role = '${oldRole}'`));
  assert.match(batch1, /CREATE TABLE IF NOT EXISTS user_role_history/);
  assert.equal(ROLE_CODES.system_admin, 'ADM');
  assert.equal(ROLE_CODES.auditor, 'AUD');
  assert.equal(ROLE_PARENT.accounting_head, 'accounting_staff');
});

test('Auditor is enforced read-only for normal business permissions', () => {
  const auditor = { role: 'auditor', permissions: [PERMISSIONS.LOT_PAYMENTS_EDIT, PERMISSIONS.SYSTEM_PROJECTS_EDIT] };
  assert.equal(roleHasPermission(auditor, PERMISSIONS.LOT_PAYMENTS_VIEW), true);
  assert.equal(roleHasPermission(auditor, PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE), true);
  assert.equal(roleHasPermission(auditor, PERMISSIONS.LOT_PAYMENTS_EDIT), false);
  assert.equal(roleHasPermission(auditor, PERMISSIONS.SYSTEM_PROJECTS_EDIT), false);
  assert.ok(getAuditorEnforcedPermissions().includes(PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE));
});

test('System Admin can manage department Staff/Head but not protected governance roles', () => {
  const actor = { role: 'system_admin' };
  assert.equal(canActorManageUserRole(actor, 'accounting_staff'), true);
  assert.equal(canActorManageUserRole(actor, 'accounting_head'), true);
  assert.equal(canActorManageUserRole(actor, 'auditor'), false);
  assert.equal(canActorManageUserRole(actor, 'system_admin'), false);
  assert.equal(canActorManageUserRole(actor, 'super_admin'), false);
  const policy = getStaticRolePolicy('system_admin');
  assert.ok(policy.required.includes(PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY));
  assert.ok(policy.required.includes(PERMISSIONS.LOT_PAYMENTS_EDIT));
  assert.ok(policy.required.includes(PERMISSIONS.LOT_PAYMENT_DELETE));
  assert.ok(policy.required.includes(PERMISSIONS.LOT_RESERVATION_CORRECT));
  assert.ok(policy.required.includes(PERMISSIONS.LOT_COMMISSIONS_ADJUST));
  assert.ok(policy.required.includes(PERMISSIONS.LOT_PENALTY_CORRECT));
  assert.ok(policy.required.includes(PERMISSIONS.LOT_SETTINGS_MANAGE));
  assert.ok(!policy.ceiling.includes(PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE));
});

test('Batch 2 creates reviews, immutable events and internal notifications', () => {
  assert.match(batch2, /CREATE TABLE IF NOT EXISTS operational_reviews/);
  assert.match(batch2, /CREATE TABLE IF NOT EXISTS operational_review_events/);
  assert.match(batch2, /CREATE TABLE IF NOT EXISTS internal_notifications/);
  assert.match(workflowService, /actor\.role === expectedHeadRole[\s\S]*pending_auditor_review/);
  assert.match(workflowService, /notifyDepartmentHeads\(connection, \{ department, projectId/);
  assert.match(workflowService, /pending_head_review','pending_auditor_review','audit_case_open','correction_required','pending_auditor_recheck/);
});

test('Review visibility prevents ordinary Staff from seeing the whole department queue', () => {
  assert.match(workflowService, /\['super_admin','system_admin','auditor'\]\.includes\(actor\.role\)/);
  assert.match(workflowService, /Number\(review\.initiated_by_user_id \|\| 0\) !== Number\(actor\.id \|\| 0\)/);
});

test('Batch 3 creates Audit Cases with Head explanation and System Admin correction states', () => {
  assert.match(batch3, /CREATE TABLE IF NOT EXISTS audit_cases/);
  for (const state of ['awaiting_head_response','under_auditor_review','finding_invalid','pending_system_admin_correction','pending_auditor_recheck','closed']) {
    assert.ok(batch3.includes(`'${state}'`), state);
  }
  assert.match(workflowController, /ORIGINAL_HEAD_RESPONSE_REQUIRED/);
  assert.match(workflowController, /pending_system_admin_correction/);
  assert.match(workflowController, /pending_auditor_recheck/);
});

test('Accounting Payment create saves first then creates Head/Auditor review', () => {
  assert.match(paymentController, /actionKey: 'payment\.create'/);
  assert.match(paymentController, /department: 'accounting'/);
  assert.match(paymentController, /createOperationalReview\(connection/);
  assert.match(paymentController, /review: result\.operationalReview \|\| null/);
});

test('Accounting Staff correction requires a returned Head review', () => {
  assert.match(paymentController, /status='returned_for_correction'/);
  assert.match(paymentController, /authorizationType: 'returned_review'/);
  assert.match(paymentController, /Accounting Staff can correct a recorded payment only after the Accounting Head returns its review for correction/);
  assert.match(paymentController, /status='pending_head_review'/);
  assert.match(paymentController, /staff_correction_submitted|staff_void_submitted/);
});

test('Accounting Head correction skips self-review and goes to Auditor', () => {
  assert.match(paymentController, /actor\.role === 'accounting_head'/);
  assert.match(paymentController, /authorizationType: 'department_head'/);
  assert.match(paymentController, /headPreApprovedByUserId: actor\.id/);
  assert.match(paymentUi, /Accounting Head corrections skip self-review and go directly to the Auditor/);
});

test('System Admin correction is restricted to the exact Auditor-approved payment case', () => {
  assert.match(paymentController, /actor\.role === 'system_admin' && auditCaseId/);
  assert.match(paymentController, /auditCase\.status !== 'pending_system_admin_correction'/);
  assert.match(paymentController, /auditCase\.entity_type !== 'lot_project_payment'/);
  assert.match(paymentController, /String\(auditCase\.entity_id\) !== String\(existingPayment\.lot_project_payment_id\)/);
  assert.match(paymentController, /authorizationType: 'audit_case'/);
  assert.match(paymentController, /status='pending_auditor_recheck'/);
});

test('Super Admin remains emergency fallback with password and email code only', () => {
  assert.match(paymentController, /actor\.role === 'super_admin'/);
  assert.match(paymentController, /bcrypt\.compare\(password, actor\.password_hash\)/);
  assert.match(paymentController, /Emergency verification code sent/);
  assert.match(paymentController, /authorizationType: 'emergency_super_admin'/);
  assert.match(paymentUi, /Super Admin is emergency fallback only/);
});

test('Payment correction UI sends Review/Audit Case IDs and supports direct authority without an email code', () => {
  assert.match(paymentUi, /workflowReviewId/);
  assert.match(paymentUi, /workflowAuditCaseId/);
  assert.match(paymentUi, /paymentCorrectionAuthorization\?\.approved/);
  assert.match(paymentUi, /Check Correction Authority/);
  assert.match(paymentUi, /auditCaseId: paymentCorrectionAuthorization\?\.auditCaseId \|\| workflowAuditCaseId/);
  assert.match(listingProfileUi, /\['payment_correction','penalty_adjustment','lmf_correction'\]\.includes\(workflowAction\)/);
});

test('Review Center preserves Batches 1-3 endpoints and adds Batch 4 protected-change approvals', () => {
  for (const route of [
    '/reviews', '/reviews/:id/claim', '/reviews/:id/head-confirm', '/reviews/:id/return',
    '/reviews/:id/auditor-verify', '/reviews/:id/audit-case', '/audit-cases/:caseId/head-response',
    '/audit-cases/:caseId/resolve', '/notifications',
  ]) assert.ok(workflowRouter.includes(route), route);
  assert.ok(workflowRouter.includes('/protected-changes'));
  assert.ok(!workflowRouter.includes('/audit-cases/:caseId/correction-applied'), 'generic correction acknowledgement route must stay removed; domain controllers apply exact corrections');
  assert.match(reviewCenterUi, /Internal Notifications/);
  assert.match(reviewCenterUi, /Protected Approvals/);
  assert.match(systemLayout, /Review Center/);
});

test('Role & Access UI includes the new governance groups', () => {
  for (const label of ['SYSTEM','AUDIT','MARKETING','SALES','ACCOUNTING','OPERATIONS','OWNER']) assert.ok(roleAccessUi.includes(`'${label}'`), label);
  assert.match(roleAccessUi, /Auditor · Enforced Global Read-Only/);
  assert.match(roleAccessUi, /Head inheritance/);
});
