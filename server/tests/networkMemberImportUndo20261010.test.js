import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IMPORT_USER_COLUMNS, IMPORT_SELLER_COLUMNS, snapshotImportFields,
  sameImportFields, importUndoBlockMessage,
} from '../controllers/System/networkMemberUndo.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('snapshots capture exactly the imported user and seller fields', () => {
  const user = { first_name: 'Original', last_name: 'Seller', status: 'active', role: 'sales_agent', last_login: 'never' };
  const snapshot = snapshotImportFields(user, IMPORT_USER_COLUMNS);
  assert.deepEqual(Object.keys(snapshot), IMPORT_USER_COLUMNS);
  assert.equal('role' in snapshot, false);
  assert.equal('last_login' in snapshot, false);
  assert.ok(sameImportFields(user, snapshot, IMPORT_USER_COLUMNS));
  assert.equal(sameImportFields({ ...user, first_name: 'Changed' }, snapshot, IMPORT_USER_COLUMNS), false);
  assert.ok(sameImportFields({ accredited_seller_accreditation_date: '2026-10-09' },
    { accredited_seller_accreditation_date: '2026-10-09T00:00:00Z' }, ['accredited_seller_accreditation_date']));
  assert.ok(IMPORT_SELLER_COLUMNS.includes('seller_group_id'));
});

test('one or more sales blocks undo of the whole batch', () => {
  assert.match(importUndoBlockMessage({ sales: 1 }), /entire import cannot be undone/i);
  assert.match(importUndoBlockMessage({ sales: 2 }), /sales, commission, or historical release/);
  assert.equal(importUndoBlockMessage({ sales: 0, changed: false, reports: 0, usage: false }), '');
});

test('later member modifications or dependent members also block undo', () => {
  assert.match(importUndoBlockMessage({ changed: true }), /changed since this import/i);
  assert.match(importUndoBlockMessage({ reports: 1 }), /reporting hierarchy/i);
  assert.match(importUndoBlockMessage({ usage: true }), /prevent data loss/i);
});

test('batch tracking is atomic with import and captures UPDATE/TRANSFER pre-state', () => {
  const source = read('server/controllers/System/sellerGroup.controller.js');
  assert.match(source, /await connection\.beginTransaction\(\);[\s\S]*INSERT INTO network_member_import_batches/);
  assert.match(source, /before_user_json, after_user_json/);
  assert.match(source, /before_seller_json, after_seller_json/);
  assert.match(source, /import_batch_id: batchId/);
  assert.match(source, /await connection\.commit\(\)/);
});

test('server-side undo rechecks global sales and blocks changed history', () => {
  const source = read('server/controllers/System/sellerGroup.controller.js');
  for (const name of ['lot_project_client_profiles', 'lot_project_commissions', 'lot_project_archived_commission_releases']) {
    assert.ok(source.includes(`FROM ${name}`), `Expected guarded ${name} query`);
  }
  assert.match(source, /getImportUndoEligibility\(connection, entry, true\)/);
  assert.match(source, /if \(!eligibility\.canUndo\)/);
  assert.match(source, /newer\.batch_id > \?/);
  assert.match(source, /INSERT INTO accredited_seller_managed_sellers/);
  assert.match(source, /status = 'undone'/);
});

test('undo is permission protected, review registered, and modal confirms exact batch', () => {
  const routes = read('server/routers/System/sellerGroup.routers.js');
  const actions = read('server/config/reviewActions.js');
  const modal = read('client/src/components/System/sellerGroupComponents/NetworkMemberImportHistoryModal.jsx');
  assert.match(routes, /members\/import\/:batchId\/undo/);
  assert.match(routes, /PERMISSIONS\.SYSTEM_SELLER_GROUPS_MANAGE/);
  assert.match(actions, /'network\.members\.import\.undo'/);
  assert.match(modal, /confirmation\.trim\(\) !== `UNDO \$\{selected\.batch_id\}`/);
  assert.match(modal, /\/undo`/);
});
