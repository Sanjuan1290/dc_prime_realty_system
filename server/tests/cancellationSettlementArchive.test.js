import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateCancellationSettlement,
  normalizeCancellationRefundType,
} from '../controllers/Lot_Projects/Listings/Listings.controller.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('cancellation settlement calculates refund and discontinued amounts from verified collections', () => {
  assert.equal(normalizeCancellationRefundType('PARTIAL_REFUND'), 'partial_refund');

  const partial = calculateCancellationSettlement({
    cashCollected: 500000,
    body: {
      cancellationRefundType: 'partial_refund',
      refundAmount: 250000,
      refundDate: '2026-07-19',
      refundReference: 'REF-250K',
    },
  });
  assert.equal(partial.refundAmount, 250000);
  assert.equal(partial.discontinuedAmount, 250000);
  assert.equal(partial.legacyCancellationType, 'discontinued');

  const full = calculateCancellationSettlement({
    cashCollected: 500000,
    body: { cancellationRefundType: 'full_refund', refundAmount: 1 },
  });
  assert.equal(full.refundAmount, 500000);
  assert.equal(full.discontinuedAmount, 0);
  assert.equal(full.legacyCancellationType, 'refunded');

  const none = calculateCancellationSettlement({
    cashCollected: 500000,
    body: { cancellationRefundType: 'no_refund', refundAmount: 500000 },
  });
  assert.equal(none.refundAmount, 0);
  assert.equal(none.discontinuedAmount, 500000);
});

test('partial refund rejects zero, full, and overpayment values', () => {
  assert.throws(
    () => calculateCancellationSettlement({ cashCollected: 500000, body: { cancellationRefundType: 'partial_refund', refundAmount: 0 } }),
    /greater than zero/i
  );
  assert.throws(
    () => calculateCancellationSettlement({ cashCollected: 500000, body: { cancellationRefundType: 'partial_refund', refundAmount: 500000 } }),
    /less than verified payments/i
  );
  assert.throws(
    () => calculateCancellationSettlement({ cashCollected: 500000, body: { cancellationRefundType: 'partial_refund', refundAmount: 500001 } }),
    /cannot exceed verified payments/i
  );
});

test('migration stores settlement amounts and immutable cancelled-sale archives', () => {
  const migration = read('server/migrations/20260719_cancellation_settlement_financial_archive.sql');
  assert.match(migration, /ADD COLUMN refund_amount DECIMAL\(14,2\)/i);
  assert.match(migration, /ADD COLUMN discontinued_amount DECIMAL\(14,2\)/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS lot_project_cancelled_sale_archives/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS lot_project_archived_commission_releases/i);
  assert.match(migration, /UNIQUE KEY uq_archived_commission_source_release/i);
});

test('Change to Available archives financial data before clearing active sale rows', () => {
  const controller = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const archiveIndex = controller.indexOf('archiveListingSaleDataForAvailable(connection');
  const deleteReceiptIndex = controller.indexOf('DELETE item\n        FROM lot_project_commission_receipt_items');
  const deleteReleaseIndex = controller.indexOf('DELETE cr\n        FROM lot_project_commission_releases');

  assert.ok(archiveIndex >= 0);
  assert.ok(deleteReceiptIndex > archiveIndex);
  assert.ok(deleteReleaseIndex > deleteReceiptIndex);
  assert.match(controller, /INSERT IGNORE INTO lot_project_archived_commission_releases/i);
  assert.match(controller, /AND r\.release_status = 'Released'/i);
  assert.match(controller, /r\.release_status <> 'Released'/i);
});

test('Lot Project Business Snapshot exposes refunded and discontinued totals', () => {
  const dashboardController = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js');
  const dashboardPage = read('client/src/pages/Lot_Projects/Dashboard.jsx');

  assert.match(dashboardController, /AS totalRefundedAmount/i);
  assert.match(dashboardController, /AS totalDiscontinuedAmount/i);
  assert.match(dashboardController, /totalRefundedAmount: toNumber/i);
  assert.match(dashboardController, /totalDiscontinuedAmount: toNumber/i);
  assert.match(dashboardPage, /label: 'Refunded Amount'/i);
  assert.match(dashboardPage, /label: 'Discontinued Amount'/i);
});

test('seller income and receipt reports include archived released commissions', () => {
  const accreditedController = read('server/controllers/System/accredited.controller.js');
  assert.match(accreditedController, /FROM lot_project_archived_commission_releases archived/i);
  assert.match(accreditedController, /UNION ALL/i);
  assert.match(accreditedController, /isArchived/i);
});
