import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  getAuditorAllowedPermissions,
  getAuditorEnforcedPermissions,
  getAuditorOptionalPermissions,
  roleHasPermission,
} from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

test('System Admin has required governance baseline plus adjustable permissions within its safe ceiling', () => {
  const policy = getStaticRolePolicy('system_admin');
  assert.ok(policy.required.includes(PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE));
  assert.ok(policy.required.includes(PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY));
  assert.ok(policy.ceiling.includes(PERMISSIONS.SYSTEM_REPORTS_VIEW));
  assert.ok(!policy.required.includes(PERMISSIONS.SYSTEM_REPORTS_VIEW));
  assert.ok(!policy.ceiling.includes(PERMISSIONS.SYSTEM_SETTINGS_MANAGE));
  assert.ok(!policy.ceiling.includes(PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE));
});

test('Auditor core permissions are mandatory and optional ceiling is export/print only', () => {
  const policy = getStaticRolePolicy('auditor');
  const required = new Set(getAuditorEnforcedPermissions());
  const optional = new Set(getAuditorOptionalPermissions());
  const allowed = new Set(getAuditorAllowedPermissions());

  assert.ok(required.has(PERMISSIONS.LOT_PAYMENTS_VIEW));
  assert.ok(required.has(PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE));
  assert.ok(optional.has(PERMISSIONS.SYSTEM_REPORTS_EXPORT));
  assert.ok(optional.has(PERMISSIONS.LOT_REPORTS_EXPORT));
  assert.ok(optional.has(PERMISSIONS.LOT_PRINTOUTS_USE));
  assert.equal(optional.has(PERMISSIONS.LOT_PAYMENTS_EDIT), false);
  assert.equal(optional.has(PERMISSIONS.SYSTEM_PROJECTS_EDIT), false);
  assert.equal(optional.has(PERMISSIONS.AUDIT_LOGS_ARCHIVE), false);
  assert.equal(policy.required.includes(PERMISSIONS.SYSTEM_REPORTS_EXPORT), false);
  assert.equal(policy.ceiling.includes(PERMISSIONS.SYSTEM_REPORTS_EXPORT), true);
  assert.deepEqual(new Set(policy.ceiling), allowed);
});

test('Auditor optional export must be explicitly assigned while writes stay blocked even if injected', () => {
  const baselineAuditor = { role: 'auditor', permissions: [] };
  assert.equal(roleHasPermission(baselineAuditor, PERMISSIONS.LOT_PAYMENTS_VIEW), true);
  assert.equal(roleHasPermission(baselineAuditor, PERMISSIONS.SYSTEM_REPORTS_EXPORT), false);

  const auditorWithExport = { role: 'auditor', permissions: [PERMISSIONS.SYSTEM_REPORTS_EXPORT] };
  assert.equal(roleHasPermission(auditorWithExport, PERMISSIONS.SYSTEM_REPORTS_EXPORT), true);

  const injected = { role: 'auditor', permissions: [PERMISSIONS.LOT_PAYMENTS_EDIT, PERMISSIONS.SYSTEM_PROJECTS_EDIT] };
  assert.equal(roleHasPermission(injected, PERMISSIONS.LOT_PAYMENTS_EDIT), false);
  assert.equal(roleHasPermission(injected, PERMISSIONS.SYSTEM_PROJECTS_EDIT), false);
});
