import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIGURABLE_SYSTEM_ROLES, ROLE_PARENT } from '../config/permissions.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from '../config/recommendedRolePermissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const migration = readFileSync(new URL('../migrations/20261006_batch9_seed_missing_role_defaults.sql', import.meta.url), 'utf8');
const sql = migration.replace(/\/\*[\s\S]*?\*\//g, '');

const seeded = new Map(CONFIGURABLE_SYSTEM_ROLES.map((role) => [role, []]));
for (const [, role, key] of sql.matchAll(/^\('([a-z_]+)', '([a-z_.]+)'\)/gm)) seeded.get(role).push(key);

// Batch 9 seeds direct rows (the pre-2026-10-06 shape); Batch 10 then turns
// them into complete templates. Simulate that chain: Staff = seed + required;
// Head = Staff seed + Staff required + Head seed + Head required; Auditor =
// seed + core. The result must equal each role's new recommended template.
const batch10 = readFileSync(new URL('../migrations/20261006_batch10_single_permission_model.sql', import.meta.url), 'utf8');
const requiredBlock = batch10.slice(batch10.indexOf('INSERT INTO rbac_20261006_required'), batch10.indexOf(';', batch10.indexOf('INSERT INTO rbac_20261006_required')));
const batch10Required = new Map();
for (const [, role, key] of requiredBlock.matchAll(/\('([a-z_]+)', '([a-z_.]+)'\)/g)) {
  if (!batch10Required.has(role)) batch10Required.set(role, []);
  batch10Required.get(role).push(key);
}
const afterBatch10 = (role) => {
  const own = [...(seeded.get(role) || []), ...(batch10Required.get(role) || [])];
  const staffRole = ROLE_PARENT[role];
  const fromStaff = staffRole ? [...(seeded.get(staffRole) || []), ...(batch10Required.get(staffRole) || [])] : [];
  return [...new Set([...fromStaff, ...own])].sort();
};

test('Batch 9 seed followed by Batch 10 gives every non-owner role exactly its recommended template', () => {
  for (const role of CONFIGURABLE_SYSTEM_ROLES.filter((r) => r !== 'system_admin')) {
    assert.deepEqual(afterBatch10(role), [...getStaticRolePolicy(role).recommended].sort(), role);
  }
});

test('Batch 9 seeds direct rows only; Heads and Auditor get theirs from Batch 10', () => {
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
