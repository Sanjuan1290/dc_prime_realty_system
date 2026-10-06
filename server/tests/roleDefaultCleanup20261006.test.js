import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERMISSIONS } from '../config/permissions.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from '../config/recommendedRolePermissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const migration = read('migrations/20261006_batch8_role_default_cleanup.sql');
const sql = migration.replace(/\/\*[\s\S]*?\*\//g, '');
const accessControl = read('controllers/System/accessControl.controller.js');
const createSystemUser = read('../client/src/components/System/userComponents/CreateSystemUserModal.jsx');

const keptKeys = (role) => {
  const match = sql.match(new RegExp(`WHERE role = '${role}'\\s+AND permission_key NOT IN \\(([^)]*)\\)`));
  assert.ok(match, `cleanup for ${role}`);
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map(([, key]) => key));
};

test('cleanup keeps every in-ceiling key, so no effective System Admin or Auditor default is removed', () => {
  for (const role of ['system_admin', 'auditor']) {
    const kept = keptKeys(role);
    for (const key of getStaticRolePolicy(role).ceiling) assert.ok(kept.has(key), `${role} keeps ${key}`);
    for (const key of RECOMMENDED_ROLE_PERMISSIONS[role]) assert.ok(kept.has(key), `${role} keeps recommended ${key}`);
  }
});

test('cleanup removes the legacy Admin rows that sit outside the System Admin ceiling', () => {
  const kept = keptKeys('system_admin');
  for (const key of [PERMISSIONS.SYSTEM_PROJECTS_CREATE, PERMISSIONS.EMPLOYEES_MANAGE, PERMISSIONS.PAYROLL_FINALIZE, PERMISSIONS.LOT_PAYMENTS_CREATE]) {
    assert.equal(kept.has(key), false, key);
  }
});

test('System Admin default gains Data Integrity, which is now visible in the permission grid', () => {
  assert.ok(RECOMMENDED_ROLE_PERMISSIONS.system_admin.includes(PERMISSIONS.SYSTEM_DATA_INTEGRITY_VIEW));
  assert.match(sql, /\('system_admin', 'system\.data_integrity\.view', 1, NULL\)/);
  assert.match(accessControl, /\['View Data Integrity', PERMISSIONS\.SYSTEM_DATA_INTEGRITY_VIEW\]/);
});

test('cleanup only touches role defaults, never existing account permissions', () => {
  assert.doesNotMatch(sql, /user_permissions/);
  assert.doesNotMatch(sql, /WHERE role IN \(/);
});

test('Create System User starts every configurable role from its saved default and reports the true total', () => {
  assert.doesNotMatch(createSystemUser, /if \(\['super_admin','auditor'\]\.includes\(form\.role\)\) \{\s*setPermissions\(\[\]\)/);
  assert.match(createSystemUser, /setPermissions\(roleData\?\.defaults\?\.\[form\.role\] \|\| \[\]\)/);
  assert.match(createSystemUser, /const effectivePermissions = useMemo/);
  assert.match(createSystemUser, /usingRoleDefaults = sameSet\(effectivePermissions, roleDefaults\)/);
  assert.doesNotMatch(createSystemUser, /plus \$\{rolePolicy\.required\.length\} required/);
  assert.match(createSystemUser, /Role default permissions are still loading/);
});
