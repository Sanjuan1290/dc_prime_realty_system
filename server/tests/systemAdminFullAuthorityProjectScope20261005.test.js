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

// Intentional rule change: the former "System Admin = full authority" model was
// retired by the Staff/Head/Auditor redesign. Super Admin is the only break-glass
// full-access identity; System Admin is permission-backed and handles governed
// administration plus Auditor-authorized corrections.
test('Super Admin is the only full-access identity while System Admin remains permission-backed', () => {
  assert.equal(isFullAccessAdministrator({ role: 'super_admin' }), true);
  assert.equal(isFullAccessAdministrator({ role: 'system_admin' }), false);
  assert.equal(roleHasPermission({ role: 'system_admin', permissions: [] }, PERMISSIONS.SYSTEM_REPORTS_VIEW), false);
  assert.equal(roleHasPermission({ role: 'system_admin', permissions: [PERMISSIONS.SYSTEM_REPORTS_VIEW] }, PERMISSIONS.SYSTEM_REPORTS_VIEW), true);
});

test('System Admin ceiling contains governed correction authority but excludes owner and Auditor authority', () => {
  const policy = getStaticRolePolicy('system_admin');
  assert.ok(policy.required.includes(PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE));
  assert.ok(policy.required.includes(PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY));
  assert.ok(policy.ceiling.includes(PERMISSIONS.SYSTEM_REPORTS_VIEW));
  assert.equal(policy.ceiling.includes(PERMISSIONS.SYSTEM_SETTINGS_MANAGE), false);
  assert.equal(policy.ceiling.includes(PERMISSIONS.AUDIT_LOGS_ARCHIVE), false);
  assert.equal(policy.ceiling.includes(PERMISSIONS.WORKFLOW_AUDIT_REVIEW), false);
  assert.equal(policy.ceiling.includes(PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE), false);
});

test('System Admin can manage department Staff/Head but protected governance identities stay owner-controlled', () => {
  const actor = { role: 'system_admin' };
  assert.equal(canActorManageUserRole(actor, 'marketing_staff'), true);
  assert.equal(canActorManageUserRole(actor, 'sales_head'), true);
  assert.equal(canActorManageUserRole(actor, 'auditor'), false);
  assert.equal(canActorManageUserRole(actor, 'system_admin'), false);
  assert.equal(canActorManageUserRole(actor, 'super_admin'), false);
});

test('governed actions distinguish Head approval and Super Admin emergency instead of System Admin direct approval', () => {
  assert.match(workflowService, /EMERGENCY_SUPER_ADMIN: 'emergency_super_admin'/);
  assert.match(workflowService, /HEAD_PREAPPROVED: 'head_preapproved'/);
  assert.doesNotMatch(workflowService, /SYSTEM_ADMIN_DIRECT: 'system_admin_direct'/);
  assert.match(workflowService, /actor\.role === 'super_admin'/);
});


test('System Admin uses configurable project scope while Super Admin and Auditor remain globally scoped', () => {
  assert.match(projectAccess, /\['super_admin', 'auditor'\]\.includes\(String\(user\?\.role/);
  assert.doesNotMatch(projectAccess, /\['super_admin', 'system_admin', 'auditor'\]/);
  assert.match(usersController, /if \(\['super_admin', 'auditor'\]\.includes\(role\)\) return;/);
  assert.match(usersController, /const projectAccess = \['super_admin', 'auditor'\]\.includes\(role\)/);
  assert.match(usersController, /const forcedAllProjects = newRole === 'auditor'/);
  assert.match(clientPermissions, /\['super_admin', 'auditor'\]\.includes\(user\.role\)/);
  assert.doesNotMatch(createSystemUser, /\['super_admin','system_admin','auditor'\]/);
  assert.doesNotMatch(usersPage, /\['super_admin','system_admin','auditor'\]\.includes\(user\.role\)/);
});
