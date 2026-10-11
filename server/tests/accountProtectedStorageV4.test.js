import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const secure = read('server/services/secureCloudinary.service.js');
const storage = read('server/services/accountProtectedStorage.service.js');
const correction = read('server/controllers/Lot_Projects/ListingProfile/ReservationCorrection.controller.js');

test('V4 protected folders are rooted by project and account, never by listing or Unit ID', () => {
  const folderWindow = secure.slice(
    secure.indexOf('export const buildAccountProtectedRoot'),
    secure.indexOf('export const createAuthenticatedUploadSignature')
  );
  assert.match(folderWindow, /return `\$\{root\}\/protected\/\$\{project\}\/accounts\/\$\{account\}`/);
  assert.match(folderWindow, /return `\$\{accountRoot\}\/documents\/\$\{document\}\/files`/);
  assert.match(folderWindow, /return `\$\{accountRoot\}\/payments\/\$\{payment\}\/proofs`/);
  assert.match(folderWindow, /return `\$\{accountRoot\}\/payments\/\$\{payment\}\/acknowledgement\/signed`/);
  assert.match(folderWindow, /return `\$\{accountRoot\}\/commission-receipts\/\$\{receipt\}\/signed`/);
  assert.doesNotMatch(folderWindow, /listingStorageCode|listingId|unitId|buyerName/);
});

test('account storage reconciliation covers buyer documents, payment proofs, and signed-copy tables without renaming public IDs', () => {
  for (const table of [
    'lot_project_client_document_files',
    'lot_project_payment_proofs',
    'lot_project_payment_acknowledgement_files',
    'lot_project_commission_receipt_files',
  ]) assert.match(storage, new RegExp(table));
  assert.match(storage, /moveAuthenticatedAssetFolder/);
  const mover = secure.slice(
    secure.indexOf('export const moveAuthenticatedAssetFolder'),
    secure.indexOf('export const destroyCloudinaryAsset')
  );
  assert.match(mover, /cloudinary\.uploader\.explicit/);
  assert.match(mover, /asset_folder: safeTargetFolder/);
  assert.doesNotMatch(mover, /uploader\.rename/);
});

test('V4 migration is dry-run first and has a dedicated package script plus read-only verifier', () => {
  const migration = read('server/scripts/migrate-cloudinary-account-storage-v4.js');
  const verify = read('server/scripts/verify-cloudinary-account-storage-v4.sql');
  const pkg = read('server/package.json');
  assert.match(migration, /const apply = args\.has\('--apply'\)/);
  assert.match(migration, /dryRun: !apply/);
  assert.match(migration, /reconcileAccountProtectedStorage/);
  assert.match(pkg, /migrate:cloudinary-account-storage/);
  assert.match(verify, /\/protected\/PRJ-.*\/accounts\//);
  assert.match(verify, /lot_project_payment_proofs/);
  assert.match(verify, /lot_project_client_document_files/);
});

test('controlled correction preserves generic account files and blocks signed acknowledgement artifacts', () => {
  assert.match(correction, /reconcileAccountProtectedStorage\(connection, \{ accountId \}\)/);
  assert.match(correction, /UPDATE lot_project_client_documents SET lot_project_listing_id = \?/);
  assert.match(correction, /retargetAccountProtectedFileMetadata/);
  assert.doesNotMatch(correction, /Uploaded buyer documents exist\. Unit-specific files must not be silently moved/);
  assert.match(correction, /Legacy buyer document files must be migrated to protected account storage/);
  assert.match(correction, /signed payment acknowledgement already exists/i);
  assert.match(correction, /protectedStorage/);
  assert.match(correction, /protectedFileMetadata/);
});

