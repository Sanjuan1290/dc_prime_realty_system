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

// 2026-10-06 policy change: System Admin is owner-level (full access). Auditor
// uses the same adjustable model as every other non-owner role: its default is
// the core read-only + audit workflow set, and anything else is a flagged grant.
test('System Admin is owner-level with every permission', () => {
  const policy = getStaticRolePolicy('system_admin');
  assert.equal(policy.fullAccess, true);
  for (const key of Object.values(PERMISSIONS)) assert.ok(policy.required.includes(key), key);
});

test('Auditor default is the core read-only and audit workflow set; every permission is adjustable', () => {
  const policy = getStaticRolePolicy('auditor');
  const core = new Set(getAuditorEnforcedPermissions());
  const optional = new Set(getAuditorOptionalPermissions());
  assert.ok(core.has(PERMISSIONS.LOT_PAYMENTS_VIEW));
  assert.ok(core.has(PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE));
  assert.ok(optional.has(PERMISSIONS.SYSTEM_REPORTS_EXPORT));
  assert.deepEqual(new Set(policy.recommended), core);
  assert.equal(policy.required.length, 0);
  assert.deepEqual(new Set(policy.ceiling), new Set(Object.values(PERMISSIONS)));
  assert.equal(policy.recommended.includes(PERMISSIONS.LOT_PAYMENTS_EDIT), false);
  assert.ok(getAuditorAllowedPermissions().length >= core.size);
});

test('Auditor holds exactly its saved permissions: export only when assigned, writes only when explicitly granted', () => {
  const baselineAuditor = { role: 'auditor', permissions: getAuditorEnforcedPermissions() };
  assert.equal(roleHasPermission(baselineAuditor, PERMISSIONS.LOT_PAYMENTS_VIEW), true);
  assert.equal(roleHasPermission(baselineAuditor, PERMISSIONS.SYSTEM_REPORTS_EXPORT), false);
  assert.equal(roleHasPermission(baselineAuditor, PERMISSIONS.LOT_PAYMENTS_EDIT), false);

  const auditorWithExport = { role: 'auditor', permissions: [PERMISSIONS.SYSTEM_REPORTS_EXPORT] };
  assert.equal(roleHasPermission(auditorWithExport, PERMISSIONS.SYSTEM_REPORTS_EXPORT), true);
});

