import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const modal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
const print = read('client/src/components/Lot_Projects/CommissionComponents/CommissionReceiptPreview.jsx');
const lookup = read('server/controllers/Lot_Projects/Commissions/CommissionReleaseReceipt.controller.js');
const accredited = read('server/controllers/System/accredited.controller.js');
const routes = read('server/routers/System/accredited.routers.js');

test('One receipt is printed in a separate page, not from the Commission Details DOM', () => {
  assert.match(print, /openElementInPdfPrintWindow\(receiptRef\.current/);
  assert.match(print, /data-single-fund-release-receipt="true"/);
  assert.match(print, /<CommissionReceiptPrint seller=\{seller\} receipt=\{receipt\}/);
  assert.doesNotMatch(print, /window\.print\(\)/);
  assert.doesNotMatch(print, /body \* \{ visibility: hidden/);
  assert.doesNotMatch(print, /position: absolute !important/);
});

test('Missing legacy receipt is linked from the completed seller milestone without a second release', () => {
  assert.match(lookup, /RELEASE_RECEIPT_NOT_FOUND/);
  assert.match(lookup, /legacyReceipt: \{ commissionId, releaseId: stageId, sellerId/);
  assert.match(lookup, /commission\.lot_project_id = \?/);
  assert.match(lookup, /stage\.release_status = 'Released'/);
  assert.match(modal, /error\.code === 'RELEASE_RECEIPT_NOT_FOUND'/);
  assert.match(modal, /setMissingReceiptChoice/);
  assert.match(modal, /Record missing Proof of Income/);
  assert.match(modal, /releaseIds: \[missingReceiptChoice\.releaseId\]/);
  assert.match(modal, /\/accredited\/\$\{missingReceiptChoice\.sellerId\}\/proof-of-income-receipts/);
  assert.match(modal, /Review & Link Receipt/);
  assert.match(modal, /canUploadSigned/);
  assert.match(modal, /doubleCheck:/);
  assert.doesNotMatch(modal, /postJson\(.*commissions\/.*release_stage/);
});

test('Receipt creation uses the existing role-controlled Accredited Sellers endpoint and unique stage', () => {
  assert.match(routes, /proof-of-income-receipts', requirePermission\(PERMISSIONS\.SYSTEM_ACCREDITED_UPLOAD_PROOF\)/);
  assert.match(accredited, /uq_commission_receipt_release \(lot_project_commission_release_id\)/);
  assert.match(accredited, /row\.lot_project_commission_receipt_item_id/);
  assert.match(accredited, /await connection\.beginTransaction\(\)/);
  assert.match(accredited, /await connection\.commit\(\)/);
});

test('Older grouped receipts display every actual paid tranche associated with the receipt', () => {
  assert.match(lookup, /FROM lot_project_commission_receipt_items item/);
  assert.match(lookup, /item\.lot_project_commission_receipt_id = \?/);
  assert.match(lookup, /commission\.lot_project_commission_id = \?/);
  assert.match(lookup, /stage\.release_status = 'Released'/);
  assert.match(lookup, /releasePercent: includedReleases\.reduce/);
  assert.match(lookup, /cumulativeTargetPercent: Math\.max/);
  assert.match(lookup, /releases: includedReleases/);
});

