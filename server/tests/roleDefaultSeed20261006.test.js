import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIGURABLE_SYSTEM_ROLES, ROLE_PARENT } from '../config/permissions.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from '../config/recommendedRolePermissions.js';
import { filterToRoleCeiling, getRequiredPermissionsForRole } from '../config/rolePolicies.js';

const migration = readFileSync(new URL('../migrations/20261006_batch9_seed_missing_role_defaults.sql', import.meta.url), 'utf8');
const sql = migration.replace(/\/\*[\s\S]*?\*\//g, '');

const seeded = new Map(CONFIGURABLE_SYSTEM_ROLES.map((role) => [role, []]));
for (const [, role, key] of sql.matchAll(/^\('([a-z_]+)', '([a-z_.]+)'\)/gm)) seeded.get(role).push(key);

// Mirrors accessControl.service getRoleDefaultPermissionKeys for a given set of stored rows.
const effective = (role, stored) => filterToRoleCeiling(role, [
  ...(ROLE_PARENT[role] ? effective(ROLE_PARENT[role], stored) : []),
  ...(stored.get(role) || []),
  ...getRequiredPermissionsForRole(role),
]);
const recommended = (role) => filterToRoleCeiling(role, [
  ...(ROLE_PARENT[role] ? recommended(ROLE_PARENT[role]) : []),
  ...(RECOMMENDED_ROLE_PERMISSIONS[role] || []),
  ...getRequiredPermissionsForRole(role),
]);

test('seeding an empty role_permission_defaults gives every role its recommended default', () => {
  for (const role of CONFIGURABLE_SYSTEM_ROLES) {
    assert.deepEqual(effective(role, seeded).sort(), recommended(role).sort(), role);
  }
});

test('seed stores only direct keys: no inherited or required duplicates, Heads and Auditor have no rows', () => {
  for (const role of CONFIGURABLE_SYSTEM_ROLES) {
    const required = new Set(getRequiredPermissionsForRole(role));
    for (const key of seeded.get(role)) assert.equal(required.has(key), false, `${role} ${key}`);
  }
  for (const role of ['auditor', 'marketing_head', 'sales_head', 'accounting_head', 'operations_head']) {
    assert.deepEqual(seeded.get(role), [], role);
  }
});

test('seed skips roles saved from Role & Access Control and never overwrites or removes rows', () => {
  assert.match(sql, /INSERT IGNORE INTO role_permission_defaults/);
  assert.match(sql, /WHERE updated_by_user_id IS NOT NULL/);
  assert.match(sql, /WHERE customised\.role IS NULL/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+role_permission_defaults/i);
  assert.doesNotMatch(sql, /ON DUPLICATE KEY UPDATE/);
  assert.doesNotMatch(sql, /user_permissions/);
});
