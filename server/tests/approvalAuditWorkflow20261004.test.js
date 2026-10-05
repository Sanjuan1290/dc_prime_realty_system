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
import { RECOMMENDED_ROLE_PERMISSIONS } from '../config/recommendedRolePermissions.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readClient = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

const batch1 = read('migrations/20261004_batch1_staff_head_auditor_rbac.sql');
const batch2 = read('migrations/20261004_batch2_operational_review_engine.sql');
const batch3 = read('migrations/20261004_batch3_payment_audit_cases.sql');
const batch4 = read('migrations/20261004_batch4_head_approvals_review_center.sql');
const workflowService = read('services/operationalReview.service.js');
const protectedChangeService = read('services/protectedChange.service.js');
const paymentController = read('controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
const reservationController = read('controllers/Lot_Projects/ListingProfile/ReservationCorrection.controller.js');
const listingProfileController = read('controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
const accessController = read('controllers/System/accessControl.controller.js');
const usersRouter = read('routers/System/users.routers.js');
const projectsRouter = read('routers/System/projects.routers.js');
const workflowRouter = read('routers/System/workflow.routers.js');
const roleAccessUi = readClient('components/System/settingsComponents/RoleAccessControl.jsx');
const reviewCenterUi = readClient('pages/System/ReviewCenter.jsx');
const systemLayout = readClient('layout/SystemLayout.jsx');

const expectedSystemRoles = [
  'super_admin','system_admin','auditor',
  'marketing_staff','marketing_head','sales_staff','sales_head',
  'accounting_staff','accounting_head','operations_staff','operations_head',
];

test('Batch 1 migrates the legacy internal roles in place to the Staff/Head governance model', () => {
  assert.deepEqual(SYSTEM_USER_ROLES, expectedSystemRoles);
  for (const [oldRole, newRole] of [
    ['admin','system_admin'],['marketing','marketing_staff'],['sales','sales_staff'],['accounting','accounting_staff'],['operations','operations_staff'],
  ]) {
    assert.match(batch1, new RegExp(`UPDATE users SET role = '${newRole}' WHERE role = '${oldRole}'`));
  }
  assert.match(batch1, /CREATE TABLE IF NOT EXISTS user_role_history/);
});

test('new role codes and structural Head inheritance are explicit', () => {
  assert.equal(ROLE_CODES.system_admin, 'ADM');
  assert.equal(ROLE_CODES.auditor, 'AUD');
  assert.equal(ROLE_CODES.marketing_head, 'MKH');
  assert.equal(ROLE_CODES.sales_head, 'SLH');
  assert.equal(ROLE_CODES.accounting_head, 'ACH');
  assert.equal(ROLE_CODES.operations_head, 'OPH');
  assert.equal(ROLE_PARENT.accounting_head, 'accounting_staff');
  assert.equal(ROLE_PARENT.sales_head, 'sales_staff');
});

test('Auditor is enforced read-only for normal business permissions even if a write key is injected', () => {
  const auditor = { role: 'auditor', permissions: [PERMISSIONS.LOT_PAYMENTS_EDIT, PERMISSIONS.SYSTEM_PROJECTS_EDIT] };
  assert.equal(roleHasPermission(auditor, PERMISSIONS.LOT_PAYMENTS_VIEW), true);
  assert.equal(roleHasPermission(auditor, PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE), true);
  assert.equal(roleHasPermission(auditor, PERMISSIONS.LOT_PAYMENTS_EDIT), false);
  assert.equal(roleHasPermission(auditor, PERMISSIONS.SYSTEM_PROJECTS_EDIT), false);
  assert.ok(getAuditorEnforcedPermissions().every((key) => !key.endsWith('.edit') && !key.endsWith('.create') || key.startsWith('workflow.audit.')));
});

// Intentional policy change: System Admin is no longer a second full-access owner.
test('System Admin has a governance/case-correction ceiling instead of full operational access', () => {
  const policy = getStaticRolePolicy('system_admin');
  for (const required of [
    PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE,
    PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY,
    PERMISSIONS.LOT_PAYMENTS_EDIT,
    PERMISSIONS.LOT_PAYMENT_DELETE,
    PERMISSIONS.LOT_RESERVATION_CORRECT,
    PERMISSIONS.LOT_COMMISSIONS_ADJUST,
    PERMISSIONS.LOT_PENALTY_CORRECT,
  ]) assert.ok(policy.required.includes(required), required);
  assert.ok(policy.required.includes(PERMISSIONS.LOT_SETTINGS_MANAGE));
  assert.ok(!policy.ceiling.includes(PERMISSIONS.SYSTEM_SETTINGS_MANAGE));
  assert.ok(!policy.ceiling.includes(PERMISSIONS.AUDIT_LOGS_ARCHIVE));
  assert.ok(!policy.ceiling.includes(PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE));
  assert.ok(!RECOMMENDED_ROLE_PERMISSIONS.system_admin.includes(PERMISSIONS.LOT_PAYMENTS_CREATE));
  assert.ok(!RECOMMENDED_ROLE_PERMISSIONS.system_admin.includes(PERMISSIONS.LOT_LISTINGS_CREATE));
});

test('System Admin can manage department Staff/Head but not Auditor, System Admin, or Super Admin', () => {
  const actor = { role: 'system_admin' };
  assert.equal(canActorManageUserRole(actor, 'accounting_staff'), true);
  assert.equal(canActorManageUserRole(actor, 'accounting_head'), true);
  assert.equal(canActorManageUserRole(actor, 'auditor'), false);
  assert.equal(canActorManageUserRole(actor, 'system_admin'), false);
  assert.equal(canActorManageUserRole(actor, 'super_admin'), false);
});

test('Batches 2-4 create the review, immutable event, notification, Audit Case, and exact-payload approval structures', () => {
  assert.match(batch2, /CREATE TABLE IF NOT EXISTS operational_reviews/);
  assert.match(batch2, /CREATE TABLE IF NOT EXISTS operational_review_events/);
  assert.match(batch2, /CREATE TABLE IF NOT EXISTS internal_notifications/);
  assert.match(batch3, /CREATE TABLE IF NOT EXISTS audit_cases/);
  assert.match(batch4, /CREATE TABLE IF NOT EXISTS protected_change_requests/);
  assert.match(batch4, /request_payload_hash CHAR\(64\) NOT NULL/);
});

test('review engine skips Head self-review, routes Staff to project-aware Head, and locks active review states', () => {
  assert.match(workflowService, /actor\.role === expectedHeadRole[\s\S]*pending_auditor_review/);
  assert.match(workflowService, /notifyDepartmentHeads\(connection, \{ department, projectId/);
  assert.match(workflowService, /pending_head_review','pending_auditor_review','audit_case_open','correction_required','pending_auditor_recheck/);
  assert.match(workflowService, /initiated_by_user_id/);
});

test('protected changes are tied to the exact payload and cannot be reused for a changed mutation', () => {
  assert.match(protectedChangeService, /buildReviewPayloadHash\(payload\)/);
  assert.match(protectedChangeService, /request_payload_hash/);
  assert.match(protectedChangeService, /The proposed change no longer matches what the Head approved/);
  assert.match(protectedChangeService, /status='used'/);
});

test('Accounting Payment pilot saves normal entries then creates an independent review', () => {
  assert.match(paymentController, /actionKey: 'payment\.create'/);
  assert.match(paymentController, /department: 'accounting'/);
  assert.match(paymentController, /createOperationalReview\(connection/);
  assert.match(paymentController, /pending_auditor_review|headPreApprovedByUserId/);
});

test('recorded payment corrections use Head approval or Auditor-approved System Admin cases, with Super Admin only as emergency fallback', () => {
  assert.match(paymentController, /Accounting Staff can correct a recorded payment only after the Accounting Head returns its review for correction/);
  assert.match(paymentController, /authorizationType: 'head_approval'/);
  assert.match(paymentController, /authorizationType: 'audit_case'/);
  assert.match(paymentController, /authorizationType: 'emergency_super_admin'/);
  assert.match(paymentController, /advanceAuditCaseToRecheck|pending_auditor_recheck/);
});

test('penalty and LMF adjustments no longer hard-code routine Super Admin-only authorization', () => {
  assert.doesNotMatch(paymentController, /Only Super Admin can manage penalty relief/);
  assert.doesNotMatch(paymentController, /Only Super Admin can waive a Legal \/ Misc Fee/);
  assert.doesNotMatch(paymentController, /Only a full-access administrator can correct a penalty/);
  assert.match(paymentController, /payment\.lmf_waiver/);
  assert.match(paymentController, /payment\.penalty_extension\.create/);
  assert.match(paymentController, /payment\.penalty_correction\.create/);
  assert.match(paymentController, /payment\.penalty_waiver\.create/);
  assert.match(paymentController, /payment\.penalty_restore/);
  for (const fragment of ['lmf-waiver','penalty-extension','penalty-waiver']) {
    const line = projectsRouter.split('\n').find((value) => value.includes(fragment));
    assert.match(line || '', /LOT_PENALTY_CORRECT/);
  }
});

test('Sales reservation correction and Accounting commission adjustment use the same governed Head/Auditor model', () => {
  assert.match(reservationController, /createProtectedChangeRequest/);
  assert.match(reservationController, /department: 'sales'/);
  assert.match(reservationController, /A valid Auditor-approved case is required for a System Admin reservation correction/);
  assert.match(listingProfileController, /createProtectedChangeRequest/);
  assert.match(listingProfileController, /department: 'accounting'/);
  assert.match(listingProfileController, /A valid Auditor-approved case is required for a System Admin commission correction/);
});

test('Review Center exposes the required Head, Auditor, case, correction, approval and notification endpoints', () => {
  for (const route of [
    '/reviews', '/reviews/:id/claim', '/reviews/:id/head-confirm', '/reviews/:id/return',
    '/reviews/:id/auditor-verify', '/reviews/:id/audit-case', '/audit-cases/:caseId/head-response',
    '/audit-cases/:caseId/resolve', '/protected-changes', '/notifications',
  ]) assert.ok(workflowRouter.includes(route), route);
  assert.match(reviewCenterUi, /Protected Approvals/);
  assert.match(reviewCenterUi, /Internal Notifications/);
  assert.match(systemLayout, /Review Center/);
});

test('Role & Access Control UI groups System, Audit, Staff/Head departments and Owner separately', () => {
  for (const label of ['SYSTEM','AUDIT','MARKETING','SALES','ACCOUNTING','OPERATIONS','OWNER']) assert.ok(roleAccessUi.includes(`'${label}'`), label);
  assert.match(roleAccessUi, /Auditor · Governed Global Read-Only/);
  assert.match(roleAccessUi, /Head inheritance/);
  assert.match(accessController, /Correct Reservation \(Governed\)/);
  assert.match(accessController, /Penalty \/ LMF Adjustment \(Governed\)/);
  assert.match(accessController, /Adjust Distribution \(Governed\)/);
});

test('routine Role & Access administration is no longer exact-Super-Admin-only', () => {
  assert.doesNotMatch(usersRouter, /access-control\/roles[^\n]*requireExactRole\('super_admin'\)/);
  assert.match(accessController, /actor\?\.role === 'system_admin'/);
  assert.match(accessController, /SYSTEM_ADMIN_MANAGEABLE_ROLES/);
});

test('true owner-level gates remain Super Admin only', () => {
  const auditRouter = read('routers/System/auditLogs.router.js');
  const settingsRouter = read('routers/System/systemSettings.routers.js');
  assert.match(auditRouter, /archive\/request[^\n]*requireExactRole\('super_admin'\)/);
  assert.match(projectsRouter, /purge-code[^\n]*requireExactRole\('super_admin'\)/);
  assert.match(settingsRouter, /\/code'[^\n]*requireExactRole\('super_admin'\)/);
});
