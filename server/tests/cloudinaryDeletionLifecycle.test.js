import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Cloudinary destroy helper treats ok and not found as successful idempotent outcomes', () => {
  const cloudinary = read('server/services/secureCloudinary.service.js');
  assert.match(cloudinary, /export const destroyCloudinaryAssets/);
  assert.match(cloudinary, /\['ok', 'not found'\]/);
  assert.match(cloudinary, /CLOUDINARY_DELETE_FAILED/);
  assert.match(cloudinary, /CLOUDINARY_PUBLIC_ID_MISSING/);
});

test('clearing a buyer document destroys active Cloudinary assets before marking database files removed', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/Documents.controller.js');
  const clearStart = controller.indexOf('export const clearLotProjectListingDocument');
  const clearSource = controller.slice(clearStart);
  const destroyIndex = clearSource.indexOf('await destroyCloudinaryAssets(');
  const removedIndex = clearSource.indexOf("file_row.file_status = 'removed'");

  assert.ok(destroyIndex >= 0, 'document clear must call destroyCloudinaryAssets');
  assert.ok(removedIndex > destroyIndex, 'database removal must happen after Cloudinary cleanup');
  assert.match(clearSource, /cloudinary_delivery_type/);
  assert.match(clearSource, /FOR UPDATE/);
  assert.match(clearSource, /writeAuditLog/);
  assert.match(clearSource, /cloudinaryDeletedCount/);
});

test('payment proof deletion requires Cloudinary deletion before changing proof status', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/PaymentProofs.controller.js');
  const deleteStart = controller.indexOf('export const deleteLotProjectPaymentProof');
  const deleteSource = controller.slice(deleteStart);
  const destroyIndex = deleteSource.indexOf('await destroyCloudinaryAssets(');
  const removedIndex = deleteSource.indexOf("SET proof_status = 'removed'");

  assert.ok(destroyIndex >= 0, 'payment proof delete must call destroyCloudinaryAssets');
  assert.ok(removedIndex > destroyIndex, 'proof status must change after Cloudinary cleanup');
  assert.doesNotMatch(deleteSource, /Cloudinary cleanup failed/);
  assert.match(deleteSource, /cloudinary_delivery_type/);
  assert.match(deleteSource, /deleted from Cloudinary/);
});
