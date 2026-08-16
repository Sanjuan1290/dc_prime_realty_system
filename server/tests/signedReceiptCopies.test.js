import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('signed receipt migration creates account-scoped protected file tables', () => {
  const migration = read('server/migrations/20260814_signed_receipt_copies.sql');
  assert.match(migration, /USE `dc_prime_realty_system_db`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS lot_project_commission_receipt_files/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS lot_project_payment_acknowledgement_files/);
  assert.match(migration, /lot_project_account_id BIGINT UNSIGNED NOT NULL/);
  assert.match(migration, /malware_scan_status/);
  assert.match(migration, /file_status ENUM\('active','replaced','removed'\)/);
});

test('signed receipt Cloudinary folders use immutable storage identities, not Unit IDs', () => {
  const secure = read('server/services/secureCloudinary.service.js');
  const storage = read('server/services/storageCodes.service.js');
  assert.match(secure, /buildCommissionReceiptSignedCopyFolder/);
  assert.match(secure, /buildPaymentAcknowledgementSignedCopyFolder/);
  assert.match(secure, /commission-receipts\/\$\{receipt\}\/signed/);
  assert.match(secure, /payments\/\$\{payment\}\/acknowledgement\/signed/);
  assert.match(secure, /createAuthenticatedSignedCopyUploadSignature/);
  assert.match(storage, /buildSignedCopyStoredFileName/);
  const folderWindow = secure.slice(secure.indexOf('export const buildCommissionReceiptSignedCopyFolder'), secure.indexOf('export const createAuthenticatedUploadSignature'));
  assert.doesNotMatch(folderWindow, /unit[_A-Za-z]*id/i);
});

test('proof of income signed copies are receipt-specific, scanned, versioned, and routable', () => {
  const controller = read('server/controllers/System/ProofOfIncomeSignedCopies.controller.js');
  const router = read('server/routers/System/accredited.routers.js');
  const accredited = read('server/controllers/System/accredited.controller.js');
  assert.match(controller, /lot_project_commission_receipt_id = \?/);
  assert.match(controller, /file_status = 'replaced'/);
  assert.match(controller, /verifyAuthenticatedCloudinaryAsset/);
  assert.match(controller, /getCloudinaryMalwareScanState/);
  assert.match(controller, /MALWARE_SCAN_PENDING/);
  assert.match(router, /proof-of-income-receipts\/:receiptId\/signed-copy\/upload-signature/);
  assert.match(router, /proof-of-income-receipts\/:receiptId\/signed-copy\/access-url/);
  assert.match(accredited, /signedCopy: row\.signed_copy_id/);
  assert.match(accredited, /lot_project_account_id,/);
  assert.match(accredited, /GROUP BY lot_project_commission_receipt_id/);
  assert.match(accredited, /latest_signed_file\.lot_project_commission_receipt_id = receipt\.lot_project_commission_receipt_id/);
  assert.doesNotMatch(accredited, /WHERE active_file\.lot_project_commission_receipt_id = receipt\.lot_project_commission_receipt_id/);
});

test('acknowledgement signed copies attach to the exact verified payment', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/SignedAcknowledgement.controller.js');
  const router = read('server/routers/System/projects.routers.js');
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  assert.match(controller, /p\.lot_project_payment_id = \?/);
  assert.match(controller, /p\.lot_project_payment_status = 'Verified'/);
  assert.match(controller, /lot_project_payment_acknowledgement_files/);
  assert.match(controller, /file_status = 'replaced'/);
  assert.match(router, /payments\/:paymentId\/acknowledgement-signed-copy\/upload-signature/);
  assert.match(router, /payments\/:paymentId\/acknowledgement-signed-copy\/access-url/);
  assert.match(shared, /acknowledgementSignedCopy: row\.ack_signed_copy_id/);
  assert.match(shared, /GROUP BY lot_project_payment_id/);
  assert.match(shared, /latest_ack_file\.lot_project_payment_id = p\.lot_project_payment_id/);
  assert.doesNotMatch(shared, /WHERE active_ack\.lot_project_payment_id = p\.lot_project_payment_id/);
});

test('signed copy malware webhook and account purge cover both new protected file tables', () => {
  const webhook = read('server/controllers/System/cloudinaryWebhook.controller.js');
  const accounts = read('server/controllers/Lot_Projects/Accounts/Accounts.controller.js');
  for (const table of ['lot_project_commission_receipt_files', 'lot_project_payment_acknowledgement_files']) {
    assert.match(webhook, new RegExp(table));
    assert.match(accounts, new RegExp(table));
  }
});

test('proof and acknowledgement UI clearly separates unsigned printing from signed copies', () => {
  const accredited = read('client/src/pages/System/Accredited.jsx');
  const printouts = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/Printouts.jsx');
  const manager = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/AcknowledgementReceiptsModal.jsx');
  const signedModal = read('client/src/components/Shared/SignedCopyUploadModal.jsx');
  const ackPrint = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PaymentAcknowledgementReceiptsPrintPage.jsx');
  assert.match(accredited, /Print All Unsigned Receipts/);
  assert.match(accredited, /Print All Signed Receipts/);
  assert.match(accredited, />Print<\/button>/);
  assert.match(accredited, /Unsigned Receipt/);
  assert.match(accredited, /Signed Receipt/);
  assert.match(accredited, /Signed Proof of Income/);
  assert.match(manager, /Print All Unsigned/);
  assert.match(manager, /Print Unsigned/);
  assert.match(manager, /Upload Signed Copy/);
  assert.match(manager, /View \/ Signed Copy/);
  assert.doesNotMatch(manager, /Unsigned only/i);
  assert.match(manager, /viewLabel="View"/);
  assert.match(signedModal, /viewLabel = 'View \/ Print'/);
  assert.match(signedModal, /Upload Without Scan/);
  assert.match(ackPrint, /selectedPaymentId/);
});

test('signed copy verification script checks ownership and duplicate active versions', () => {
  const verify = read('server/scripts/verify-signed-receipt-copies.sql');
  assert.match(verify, /lot_project_commission_receipt_files/);
  assert.match(verify, /lot_project_payment_acknowledgement_files/);
  assert.match(verify, /HAVING COUNT\(\*\) > 1/);
  assert.match(verify, /lot_project_payment_status <> 'Verified'/);
});
