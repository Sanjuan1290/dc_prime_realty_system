import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PERMISSIONS,
  getAuditorEnforcedPermissions,
  roleHasPermission,
  canActorManageUserRole,
  canActorCreateUserRole,
  canActorChangeUserRole,
} from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const workflowRouter = read('routers/System/workflow.routers.js');
const workflowController = read('controllers/System/workflow.controller.js');
const ownerSettingsRouter = read('routers/System/systemSettings.routers.js');
const auditRouter = read('routers/System/auditLogs.router.js');
const projectsRouter = read('routers/System/projects.routers.js');
const legacyDocumentsRouter = read('routers/System/documents.router.js');
const compatibilityProjectAccess = read('services/adminProjectAccess.service.js');
const authoritativeProjectAccess = read('services/projectAccess.service.js');
const protectedChange = read('services/protectedChange.service.js');
const accessController = read('controllers/System/accessControl.controller.js');

const normalWritePermissions = [
  PERMISSIONS.SYSTEM_PROJECTS_CREATE,
  PERMISSIONS.SYSTEM_PROJECTS_EDIT,
  PERMISSIONS.SYSTEM_PROJECTS_DELETE,
  PERMISSIONS.SYSTEM_DOCUMENTS_CREATE,
  PERMISSIONS.SYSTEM_DOCUMENTS_EDIT,
  PERMISSIONS.SYSTEM_DOCUMENTS_DELETE,
  PERMISSIONS.SYSTEM_USERS_CREATE,
  PERMISSIONS.SYSTEM_USERS_EDIT,
  PERMISSIONS.SYSTEM_USERS_DEACTIVATE,
  PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
  PERMISSIONS.EMPLOYEES_MANAGE,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.LOT_LISTINGS_CREATE,
  PERMISSIONS.LOT_LISTINGS_EDIT,
  PERMISSIONS.LOT_LISTINGS_DELETE,
  PERMISSIONS.LOT_RESERVATIONS_CREATE,
  PERMISSIONS.LOT_BUYER_PROFILE_EDIT,
  PERMISSIONS.LOT_PAYMENTS_CREATE,
  PERMISSIONS.LOT_PAYMENTS_EDIT,
  PERMISSIONS.LOT_PAYMENT_DELETE,
  PERMISSIONS.LOT_COMMISSIONS_ADJUST,
  PERMISSIONS.LOT_COMMISSIONS_RELEASE,
  PERMISSIONS.LOT_SETTINGS_MANAGE,
  PERMISSIONS.LOT_PENALTY_CORRECT,
];

test('Auditor is hard-enforced read-only for normal business mutations', () => {
  const enforced = new Set(getAuditorEnforcedPermissions());
  for (const permission of normalWritePermissions) {
    assert.equal(enforced.has(permission), false, permission);
    assert.equal(roleHasPermission({ role: 'auditor', permissions: [permission] }, permission), false, permission);
  }
  for (const permission of [
    PERMISSIONS.WORKFLOW_AUDIT_REVIEW,
    PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE,
    PERMISSIONS.WORKFLOW_AUDIT_CASE_RESOLVE,
    PERMISSIONS.WORKFLOW_AUDIT_CORRECTION_VERIFY,
  ]) assert.equal(roleHasPermission({ role: 'auditor' }, permission), true, permission);
});

test('System Admin can administer Auditor and department roles but cannot manage or promote to Super Admin/System Admin', () => {
  const actor = { role: 'system_admin' };
  assert.equal(canActorManageUserRole(actor, 'auditor'), true);
  assert.equal(canActorCreateUserRole(actor, 'auditor'), true);
  assert.equal(canActorManageUserRole(actor, 'system_admin'), false);
  assert.equal(canActorCreateUserRole(actor, 'system_admin'), false);
  assert.equal(canActorManageUserRole(actor, 'super_admin'), false);
  assert.equal(canActorCreateUserRole(actor, 'super_admin'), false);
  assert.equal(canActorChangeUserRole(actor, 'accounting_staff', 'accounting_head'), true);
  assert.equal(canActorChangeUserRole(actor, 'accounting_staff', 'auditor'), true);
  assert.equal(canActorChangeUserRole(actor, 'accounting_head', 'system_admin'), false);
});

test('System Admin permission ceiling is full while project scope and Super Admin account protection remain separate controls', () => {
  const policy = getStaticRolePolicy('system_admin');
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(policy.ceiling.includes(permission), true, permission);
    assert.equal(policy.required.includes(permission), true, permission);
  }
  assert.equal(policy.fixed, true);
});

test('generic System Admin correction acknowledgement endpoint is removed', () => {
  assert.doesNotMatch(workflowRouter, /audit-cases\/:caseId\/correction-applied/);
  assert.doesNotMatch(workflowController, /markAuditCorrectionApplied/);
  for (const handler of ['correctReservationUnit','adjustLotProjectListingCommission','updateLotProjectSettings','updateLotProjectListingPayment','deleteLotProjectListingPayment','restoreSeparateLegalMiscFeeFromAuditCase']) assert.ok(projectsRouter.includes(handler), handler);
});

test('day-to-day protected administration accepts System Admin while Super Admin remains the owner identity', () => {
  assert.match(ownerSettingsRouter, /requireExactRole\('super_admin','system_admin'\)/);
  assert.match(auditRouter, /archive\/request[\s\S]*requireExactRole\('super_admin','system_admin'\)/);
  assert.match(auditRouter, /archive\/confirm[\s\S]*requireExactRole\('super_admin','system_admin'\)/);
  assert.match(projectsRouter, /purge-code[^\n]*requireExactRole\('super_admin','system_admin'\)/);
  assert.match(projectsRouter, /accounts\/:accountId\/purge'[^\n]*requireExactRole\('super_admin','system_admin'\)/);
});

test('legacy document router can never become an unauthenticated mutation backdoor', () => {
  assert.match(legacyDocumentsRouter, /router\.use\(authenticateUser\)/);
  for (const permission of [
    'SYSTEM_DOCUMENTS_CREATE', 'SYSTEM_DOCUMENTS_EDIT', 'SYSTEM_DOCUMENTS_DELETE',
    'SYSTEM_DOCUMENT_TEMPLATES_CREATE', 'SYSTEM_DOCUMENT_TEMPLATES_EDIT', 'SYSTEM_DOCUMENT_TEMPLATES_DELETE',
  ]) assert.ok(legacyDocumentsRouter.includes(`PERMISSIONS.${permission}`), permission);
});

test('legacy project-access imports delegate to the authoritative project-scoped System Admin service', () => {
  assert.match(compatibilityProjectAccess, /authoritative implementation lives in projectAccess\.service\.js/);
  assert.match(compatibilityProjectAccess, /replaceAdminProjectAccess = replaceUserProjectAccess/);
  assert.match(compatibilityProjectAccess, /hydrateAdminProjectAccess = hydrateUserProjectAccess/);
  assert.match(authoritativeProjectAccess, /persisted account role wins/);
  assert.match(authoritativeProjectAccess, /\['super_admin', 'auditor'\]/);
  assert.doesNotMatch(authoritativeProjectAccess, /\['super_admin', 'system_admin', 'auditor'\]/);
});

test('Head approval is single-requester, exact-record, exact-action and exact-payload', () => {
  assert.match(protectedChange, /requested_by_user_id\)!==Number\(actor\?\.id\)/);
  assert.match(protectedChange, /row\.action_key!==actionKey/);
  assert.match(protectedChange, /row\.entity_type!==entityType/);
  assert.match(protectedChange, /String\(row\.entity_id\)!==String\(entityId\)/);
  assert.match(protectedChange, /hash!==row\.request_payload_hash/);
  assert.match(protectedChange, /status='used',used_at=NOW\(\)/);
});

test('Role & Access fixes System Admin to full permissions while Super Admin controls its per-account project scope', () => {
  assert.match(accessController, /\[\.\.\.ROLE_DEFAULT_EDITABLE_ROLES, 'auditor'\]/);
  assert.match(accessController, /if \(actor\?\.role === 'super_admin'\)/);
  assert.match(accessController, /targetRole !== 'super_admin'/);
  assert.match(accessController, /targetRole === 'system_admin'/);
  assert.match(accessController, /actor\?\.role === 'system_admin'[\s\S]*targetRole !== 'system_admin'/);
});
