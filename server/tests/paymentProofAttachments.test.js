import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (url) => readFileSync(url, 'utf8');

test('payment proof migration stores protected attachment metadata against a payment', () => {
  const migration = read(new URL('../migrations/20260803_payment_proofs.sql', import.meta.url));
  assert.match(migration, /CREATE TABLE IF NOT EXISTS lot_project_payment_proofs/i);
  assert.match(migration, /lot_project_payment_id INT UNSIGNED NOT NULL/i);
  assert.match(migration, /cloudinary_public_id VARCHAR\(255\) NOT NULL/i);
  assert.match(migration, /proof_status ENUM\('active','removed'\)/i);
  assert.match(migration, /FOREIGN KEY \(lot_project_payment_id\)/i);
});

test('payment proof uploads use authenticated Cloudinary delivery', () => {
  const cloudinary = read(new URL('../services/secureCloudinary.service.js', import.meta.url));
  const controller = read(new URL('../controllers/Lot_Projects/ListingProfile/PaymentProofs.controller.js', import.meta.url));
  assert.match(cloudinary, /createAuthenticatedPaymentProofUploadSignature/);
  assert.match(cloudinary, /dc_prime,payment_proof,authenticated/);
  assert.match(controller, /verifyAuthenticatedCloudinaryAsset/);
  assert.match(controller, /createAuthenticatedAccessUrl/);
  assert.doesNotMatch(controller, /secure_url/);
});

test('payment proof routes separate view, upload, and delete permissions', () => {
  const router = read(new URL('../routers/System/projects.routers.js', import.meta.url));
  assert.match(router, /payments\/:paymentId\/proofs'.*LOT_LISTINGS_VIEW/);
  assert.match(router, /proofs\/upload-signature'.*LOT_LISTINGS_MANAGE/);
  assert.match(router, /proofs\/:proofId\/access-url'.*LOT_LISTINGS_VIEW/);
  assert.match(router, /proofs\/:proofId\/delete'.*LOT_PAYMENT_DELETE/);
});

test('payments UI exposes proof management separately from payment editing', () => {
  const payments = read(new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx', import.meta.url));
  const modal = read(new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx', import.meta.url));
  assert.match(payments, /Upload Proof/);
  assert.match(payments, /PaymentProofModal/);
  assert.match(modal, /supporting files, not official receipts/i);
  assert.match(modal, /MAX_FILES = 5/);
  assert.match(modal, /MAX_FILE_BYTES = 15 \* 1024 \* 1024/);
});

