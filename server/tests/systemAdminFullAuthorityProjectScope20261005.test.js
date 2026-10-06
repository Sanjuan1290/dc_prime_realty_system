import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PERMISSIONS,
  canActorManageUserRole,
  isFullAccessAdministrator,
  roleHasPermission,
} from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const workflowService = read('services/operationalReview.service.js');
const projectAccess = read('services/projectAccess.service.js');
const usersController = read('controllers/System/users.controllers.js');
const clientPermissions = read('../client/src/config/permissions.js');
const createSystemUser = read('../client/src/components/System/userComponents/CreateSystemUserModal.jsx');
const usersPage = read('../client/src/pages/System/Users.jsx');

// 2026-10-06 rule change: System Admin is the owner's right hand and has the
// same access as Super Admin (full access, all projects, owner-only actions).
// The only difference: System Admin cannot create or manage Super Admin or
// System Admin accounts.
test('Super Admin and System Admin are both full-access owner identities', () => {
  assert.equal(isFullAccessAdministrator({ role: 'super_admin' }), true);
  assert.equal(isFullAccessAdministrator({ role: 'system_admin' }), true);
  assert.equal(isFullAccessAdministrator({ role: 'auditor' }), false);
  assert.equal(roleHasPermission({ role: 'system_admin', permissions: [] }, PERMISSIONS.SYSTEM_REPORTS_VIEW), true);
  assert.equal(roleHasPermission({ role: 'system_admin', permissions: [] }, PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE), true);
});

test('System Admin holds owner and Auditor authority', () => {
  const policy = getStaticRolePolicy('system_admin');
  for (const key of [
    PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE,
    PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY,
    PERMISSIONS.SYSTEM_REPORTS_VIEW,
    PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_LOGS_ARCHIVE,
    PERMISSIONS.WORKFLOW_AUDIT_REVIEW,
    PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE,
  ]) assert.ok(policy.required.includes(key), key);
});

test('System Admin manages Staff, Head and Auditor accounts but never owner accounts', () => {
  const actor = { role: 'system_admin' };
  assert.equal(canActorManageUserRole(actor, 'marketing_staff'), true);
  assert.equal(canActorManageUserRole(actor, 'sales_head'), true);
  assert.equal(canActorManageUserRole(actor, 'auditor'), true);
  assert.equal(canActorManageUserRole(actor, 'system_admin'), false);
  assert.equal(canActorManageUserRole(actor, 'super_admin'), false);
});

test('governed actions distinguish Head approval and Super Admin emergency instead of System Admin direct approval', () => {
  assert.match(workflowService, /EMERGENCY_SUPER_ADMIN: 'emergency_super_admin'/);
  assert.match(workflowService, /HEAD_PREAPPROVED: 'head_preapproved'/);
  assert.doesNotMatch(workflowService, /SYSTEM_ADMIN_DIRECT: 'system_admin_direct'/);
  assert.match(workflowService, /const isEmergency = isOwnerAdministrator\(actor\)/);
});


test('Super Admin, System Admin and Auditor are always scoped to All Projects', () => {
  assert.match(projectAccess, /GLOBAL_PROJECT_ROLES = Object\.freeze\(\['super_admin', 'system_admin', 'auditor'\]\)/);
  assert.match(projectAccess, /hasForcedAllProjectsAccess = \(user = \{\}\) => GLOBAL_PROJECT_ROLES\.includes/);
  assert.match(usersController, /if \(\['super_admin', 'system_admin', 'auditor'\]\.includes\(role\)\) return;/);
  assert.match(usersController, /const projectAccess = \['super_admin', 'system_admin', 'auditor'\]\.includes\(role\)/);
  assert.doesNotMatch(usersController, /changeUserPosition|forcedAllProjects[\s\S]*newRole/);
  assert.match(clientPermissions, /\['super_admin', 'system_admin', 'auditor'\]\.includes\(user\.role\)/);
  assert.match(createSystemUser, /GLOBAL_PROJECT_ROLES = \['super_admin', 'system_admin', 'auditor'\]/);
  assert.match(usersPage, /\['super_admin','system_admin','auditor'\]\.includes\(user\.role\)/);
});

