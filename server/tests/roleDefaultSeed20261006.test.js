import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
// Phase 7 introduced post-template grants. Subsequent additive migrations can
// extend recommended defaults (such as the Oct 25 empty-manager permission).
// Read *all* additive migrations from Phase 7 onward instead of hardcoding only
// one migration. The final assertion stays strict: a new recommended permission
// still fails if there is no corresponding SQL grant.
const additiveMigrationFiles = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((file) => /^20\d{6}_.+\.sql$/.test(file) && file.slice(0, 8) >= '20261018')
  .sort();

const readAdditiveDefaultGrants = (source, fileName) => {
  const grants = [];
  const uncommented = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '');

  for (const statement of uncommented.split(';')) {
    if (!/\bINSERT\s+(?:IGNORE\s+)?INTO\s+`?role_permission_defaults`?/i.test(statement)) continue;
    const insert = statement.match(/\bINSERT\s+(?:IGNORE\s+)?INTO\s+`?role_permission_defaults`?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*)/i);
    assert.ok(insert, `${fileName}: unsupported role-default INSERT. Update the migration test parser instead of ignoring this grant.`);
    const columns = insert[1].replace(/`/g, '').split(',').map((value) => value.trim().toLowerCase());
    assert.deepEqual(columns, ['role', 'permission_key', 'allowed', 'updated_by_user_id'], `${fileName}: changed role-default column order`);
    const rows = [...insert[2].matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([a-z0-9_.]+)'\s*,\s*1\s*,\s*NULL\s*\)/gi)];
    assert.ok(rows.length, `${fileName}: role-default INSERT has no recognized enabled permission rows`);
    grants.push(...rows.map(([, role, key]) => [role, key]));
  }
  return grants;
};

const addedDefaultGrants = new Map();
for (const filename of additiveMigrationFiles) {
  const source = readFileSync(new URL(`../migrations/${filename}`, import.meta.url), 'utf8');
  for (const [role, key] of readAdditiveDefaultGrants(source, filename)) {
    if (!addedDefaultGrants.has(role)) addedDefaultGrants.set(role, []);
    addedDefaultGrants.get(role).push(key);
  }
}

const STAFF_ROLES = new Set(['marketing_staff', 'sales_staff', 'accounting_staff', 'operations_staff']);
const afterCurrentMigrations = (role) => {
  const after12 = afterBatch10(role).filter((key) => !(STAFF_ROLES.has(role) && key === 'workflow.review_center.view'));
  return STAFF_ROLES.has(role) ? [...new Set([...after12, 'workflow.review_center.view'])].sort() : after12.sort();
};

test('role defaults including later additive migrations match every non-owner current recommended template', () => {
  assert.match(batch12, /DELETE FROM `role_permission_defaults`[\s\S]*workflow\.review_center\.view/);
  assert.match(batch13, /INSERT INTO `role_permission_defaults`[\s\S]*workflow\.review_center\.view/);
  assert.match(batch13, /INSERT INTO `user_permissions`[\s\S]*marketing_staff/);
  assert.deepEqual(addedDefaultGrants.get('accounting_staff'), ['lot_project.commissions.change_seller', 'company_finances.view', 'company_finances.record', 'company_finances.edit_manual']);
  assert.deepEqual(addedDefaultGrants.get('accounting_head'), ['lot_project.commissions.change_seller', 'company_finances.view', 'company_finances.record', 'company_finances.edit_manual', 'company_finances.categories.manage', 'company_finances.opening_balance.manage']);
  assert.deepEqual(addedDefaultGrants.get('marketing_staff'), ['system.seller_groups.members.deactivate_empty_manager']);
  assert.deepEqual(addedDefaultGrants.get('marketing_head'), ['system.seller_groups.members.deactivate_empty_manager']);
  for (const role of CONFIGURABLE_SYSTEM_ROLES.filter((r) => r !== 'system_admin')) {
    const actual = [...new Set([...afterCurrentMigrations(role), ...(addedDefaultGrants.get(role) || [])])].sort();
    assert.deepEqual(actual, [...getStaticRolePolicy(role).recommended].sort(), `${role}: migration defaults must match the current recommended permissions`);
  }
});

test('migration parser handles new grants and rejects unrecognized permission INSERT formats', () => {
  const fixture = `-- This migration adds another permission
    INSERT IGNORE INTO role_permission_defaults
      (role, permission_key, allowed, updated_by_user_id)
    VALUES
      ('marketing_staff', 'system.example.future_permission', 1, NULL),
      ('marketing_head','system.example.future_permission',1,NULL);`;
  assert.deepEqual(readAdditiveDefaultGrants(fixture, 'future.sql'), [
    ['marketing_staff', 'system.example.future_permission'],
    ['marketing_head', 'system.example.future_permission'],
  ]);
  assert.throws(
    () => readAdditiveDefaultGrants(
      "INSERT INTO role_permission_defaults (role, permission_key) VALUES ('marketing_staff', 'system.example.future_permission');",
      'unsupported.sql'
    ),
    /changed role-default column order/,
  );
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








