// Optional, fail-closed backfill for an import that predates the batch ledger.
// Usage after applying 20261010_network_member_import_undo.sql:
//   LEGACY_IMPORT_REVIEW_ID=1 node scripts/backfill-legacy-network-member-import.js
// Only all-CREATE, completely untouched imports can be reconstructed.
// This script NEVER performs an undo or deletes a member.
import { db } from '../db/connect.js';
import { IMPORT_USER_COLUMNS, IMPORT_SELLER_COLUMNS, snapshotImportFields } from '../controllers/System/networkMemberUndo.service.js';

const reviewId = Number(process.env.LEGACY_IMPORT_REVIEW_ID || 0);
if (!Number.isSafeInteger(reviewId) || reviewId < 1) {
  throw new Error('Set LEGACY_IMPORT_REVIEW_ID to the exact historical import Operational Review ID.');
}
const json = (value) => typeof value === 'string' ? JSON.parse(value) : value || {};
const fail = (message) => { throw new Error(`Backfill cancelled: ${message}`); };
const connection = await db.getConnection();
let transaction = false;
try {
  await connection.beginTransaction(); transaction = true;
  const [reviewRows] = await connection.query(
    `SELECT * FROM operational_reviews WHERE operational_review_id = ? AND action_key = 'network.members.import' FOR UPDATE`,
    [reviewId]
  );
  if (reviewRows.length !== 1) fail('Matching Network member import Review not found.');
  const review = reviewRows[0];
  const snapshot = json(review.after_snapshot_json);
  const processed = snapshot.processed || [];
  const expected = Number(snapshot.importedCount || 0);
  if (!expected || expected > 100 || processed.length !== expected || Number(snapshot.summary?.create) !== expected
      || processed.some((item) => item.action !== 'CREATE')) {
    fail('This import includes updates/transfers or its original Review has incomplete member IDs.');
  }
  const groupId = Number(snapshot.groupId || review.entity_id || 0);
  if (!groupId || groupId !== Number(review.entity_id)) fail('Group ID did not match the original Review.');
  const [groupRows] = await connection.query('SELECT seller_group_type FROM seller_groups WHERE seller_group_id = ? FOR UPDATE', [groupId]);
  if (groupRows[0]?.seller_group_type !== 'in_house') fail('In-House Network does not exist.');
  const [overlap] = await connection.query(
    `SELECT 1 FROM network_member_import_items WHERE user_id IN (${processed.map(() => '?').join(',')})
       OR accredited_seller_id IN (${processed.map(() => '?').join(',')}) LIMIT 1`,
    [...processed.map((item) => Number(item.user_id)), ...processed.map((item) => Number(item.accredited_seller_id))]
  );
  if (overlap.length) fail('One or more accounts already belong to a tracked import.');
  const importedAt = new Date(review.created_at).getTime();
  const items = [];
  for (const entry of processed) {
    const [[user]] = await connection.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [entry.user_id]);
    const [[seller]] = await connection.query('SELECT * FROM accredited_sellers WHERE accredited_seller_id = ? FOR UPDATE', [entry.accredited_seller_id]);
    if (!user || !seller || Number(seller.user_id) !== Number(entry.user_id)
      || Number(seller.seller_group_id) !== groupId
      || String(user.email).toLowerCase() !== String(entry.email).toLowerCase()) {
      fail(`Seller identity for ${entry.email} no longer matches the original review.`);
    }
    const userCreated = new Date(user.created_at).getTime();
    const sellerCreated = new Date(seller.accredited_seller_created_at).getTime();
    if (!Number.isFinite(importedAt) || !Number.isFinite(userCreated) || !Number.isFinite(sellerCreated)
      || Math.abs(userCreated - importedAt) > 10 * 60_000
      || Math.abs(sellerCreated - importedAt) > 10 * 60_000
      || user.updated_at !== user.created_at
      || seller.accredited_seller_updated_at !== seller.accredited_seller_created_at
      || user.last_login) {
      fail(`Account ${entry.email} was used/edited later or was not created at import time.`);
    }
    const [employees] = await connection.query('SELECT employee_id FROM employees WHERE LOWER(TRIM(email)) = LOWER(?) AND linked_user_id IS NOT NULL LIMIT 1', [entry.email]);
    if (employees.length) fail(`Cannot reconstruct employee-link changes for ${entry.email}.`);
    const [managers] = await connection.query('SELECT manager_accredited_seller_id FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id = ?', [entry.accredited_seller_id]);
    items.push({ sourceRow: entry.row, user, seller, managers: managers.map((row) => Number(row.manager_accredited_seller_id)) });
  }
  const [result] = await connection.query(
    `INSERT INTO network_member_import_batches (seller_group_id, imported_by_user_id, member_count, imported_at)
     VALUES (?, ?, ?, ?)`, [groupId, review.initiated_by_user_id, items.length, review.created_at]
  );
  for (const item of items) {
    await connection.query(
      `INSERT INTO network_member_import_items (
        batch_id, source_row, user_id, accredited_seller_id, member_email, import_action,
        user_created, seller_created, before_user_json, after_user_json, before_seller_json,
        after_seller_json, linked_employee_ids_json, before_managers_json, after_managers_json
      ) VALUES (?, ?, ?, ?, ?, 'CREATE', 1, 1, NULL, ?, NULL, ?, '[]', '[]', ?)`,
      [result.insertId, item.sourceRow, item.user.id, item.seller.accredited_seller_id, item.user.email,
        JSON.stringify(snapshotImportFields(item.user, IMPORT_USER_COLUMNS)),
        JSON.stringify(snapshotImportFields(item.seller, IMPORT_SELLER_COLUMNS)), JSON.stringify(item.managers)]
    );
  }
  await connection.commit(); transaction = false;
  console.log(`Backfilled ${items.length} previously created members as import batch #${result.insertId} (Network ${groupId}).`);
} catch (error) {
  if (transaction) await connection.rollback();
  console.error(error.message); process.exitCode = 1;
} finally {
  connection.release(); await db.end();
}

