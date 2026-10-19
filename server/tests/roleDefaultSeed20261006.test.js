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
// them into complete templates. Batch 12 removed Review Center from Staff;
// Batch 13 restores it because Staff must action returned corrections.
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

const batch12 = readFileSync(new URL('../migrations/20261006_batch12_role_specific_review_queues.sql', import.meta.url), 'utf8');
const batch13 = readFileSync(new URL('../migrations/20261006_batch13_staff_correction_review_center.sql', import.meta.url), 'utf8');
// Phase 7 (Oct 18) added assigned-seller correction permission to Accounting
// staff and head templates. Include later additive migrations when comparing the
// *current* recommended defaults; do not rewrite the historical Batch 9 seed.
const phase7 = readFileSync(new URL('../migrations/20261018_phase7_assigned_seller_change_tidb.sql', import.meta.url), 'utf8');
const phase7DefaultsStart = phase7.indexOf('INSERT IGNORE INTO role_permission_defaults');
assert.ok(phase7DefaultsStart >= 0, 'Phase 7 default-permission seed is missing');
const phase7Defaults = phase7.slice(phase7DefaultsStart, phase7.indexOf(';', phase7DefaultsStart));
const addedDefaultGrants = new Map();
for (const [, role, key] of phase7Defaults.matchAll(/\('([a-z_]+)','([a-z_.]+)',1,NULL\)/g)) {
  if (!addedDefaultGrants.has(role)) addedDefaultGrants.set(role, []);
  addedDefaultGrants.get(role).push(key);
}

const STAFF_ROLES = new Set(['marketing_staff', 'sales_staff', 'accounting_staff', 'operations_staff']);
const afterCurrentMigrations = (role) => {
  const after12 = afterBatch10(role).filter((key) => !(STAFF_ROLES.has(role) && key === 'workflow.review_center.view'));
  return STAFF_ROLES.has(role) ? [...new Set([...after12, 'workflow.review_center.view'])].sort() : after12.sort();
};

test('role defaults through Phase 7 match every non-owner current recommended template', () => {
  assert.match(batch12, /DELETE FROM `role_permission_defaults`[\s\S]*workflow\.review_center\.view/);
  assert.match(batch13, /INSERT INTO `role_permission_defaults`[\s\S]*workflow\.review_center\.view/);
  assert.match(batch13, /INSERT INTO `user_permissions`[\s\S]*marketing_staff/);
  assert.deepEqual(addedDefaultGrants.get('accounting_staff'), ['lot_project.commissions.change_seller']);
  assert.deepEqual(addedDefaultGrants.get('accounting_head'), ['lot_project.commissions.change_seller']);
  for (const role of CONFIGURABLE_SYSTEM_ROLES.filter((r) => r !== 'system_admin')) {
    const actual = [...new Set([...afterCurrentMigrations(role), ...(addedDefaultGrants.get(role) || [])])].sort();
    assert.deepEqual(actual, [...getStaticRolePolicy(role).recommended].sort(), `${role}: migration defaults must match the current recommended permissions`);
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



