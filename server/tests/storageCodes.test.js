import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDocumentStoredFileName,
  buildPaymentProofStoredFileName,
  createListingStorageCode,
  createPaymentStorageCode,
  createProjectStorageCode,
  createReadableCloudinaryPublicId,
  deriveStoredFileNameFromPublicId,
  normalizeDocumentCode,
  validateDocumentCode,
} from '../services/storageCodes.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('project and listing storage codes use immutable database primary keys only', () => {
  assert.equal(createProjectStorageCode(1, 'LA'), 'PRJ-1');
  assert.equal(createProjectStorageCode(30003, 'PE'), 'PRJ-30003');
  assert.equal(createProjectStorageCode(1, 'LAE'), 'PRJ-1');
  assert.equal(createListingStorageCode(42), 'LST-42');
  assert.equal(createPaymentStorageCode(61, '2026-08-10'), 'PAY-2026-000061');
});

test('document codes normalize to permanent DOC codes and reject invalid empty values', () => {
  assert.equal(normalizeDocumentCode('itb'), 'DOC-ITB');
  assert.equal(normalizeDocumentCode('DOC-gov id'), 'DOC-GOV-ID');
  assert.deepEqual(validateDocumentCode('DOC-CRF-SELLER'), {
    valid: true,
    code: 'DOC-CRF-SELLER',
    message: '',
  });
  assert.equal(validateDocumentCode('').valid, false);
});

test('canonical filenames stay readable while Cloudinary public IDs remain collision resistant', () => {
  const documentName = buildDocumentStoredFileName({
    documentCode: 'DOC-GOV-ID',
    accountReference: 'ACC-2026-000018',
    version: 1,
    sequence: 2,
    totalFiles: 2,
    extension: 'jpg',
  });
  assert.equal(documentName, 'DOC-GOV-ID__ACC-2026-000018__V01-02.jpg');

  const paymentName = buildPaymentProofStoredFileName({
    paymentStorageCode: 'PAY-2026-000061',
    sequence: 1,
    extension: 'png',
  });
  assert.equal(paymentName, 'PAY-2026-000061__PROOF-01.png');

  const publicId = createReadableCloudinaryPublicId(documentName);
  assert.match(publicId, /^DOC-GOV-ID__ACC-2026-000018__V01-02__[A-F0-9]{8}$/);
  assert.equal(deriveStoredFileNameFromPublicId(publicId, 'jpg'), documentName);
});

test('new Cloudinary hierarchy uses project, listing, account and document/payment codes without buyer names or unit names', () => {
  const cloudinary = read('server/services/secureCloudinary.service.js');
  assert.match(cloudinary, /`\$\{root\}\/protected\/\$\{project\}\/\$\{listing\}\/\$\{account\}\/documents\/\$\{document\}\/files`/);
  assert.match(cloudinary, /`\$\{root\}\/protected\/\$\{project\}\/\$\{listing\}\/\$\{account\}\/payments\/\$\{payment\}\/proofs`/);
  assert.doesNotMatch(cloudinary, /buyerName/);
  assert.doesNotMatch(cloudinary, /unitId/);
});

test('Document Library exposes a permanent Document Code below Document Name and locks it after creation', () => {
  const add = read('client/src/components/System/documentComponents/AddDocument.jsx');
  const edit = read('client/src/components/System/documentComponents/EditDocument.jsx');
  const library = read('client/src/components/System/documentComponents/DocumentLibrary.jsx');
  const doubleCheck = read('client/src/components/Shared/DoubleCheckComponents/DocumentDoubleCheck.jsx');

  assert.match(add, /Document Code/);
  assert.match(add, /suggestDocumentCode/);
  assert.match(add, /data-example="DOC-GOV-ID"/);
  assert.match(edit, /Document Code/);
  assert.match(edit, /readOnly/);
  assert.match(edit, /cannot be changed after the document is created/);
  assert.match(library, /document\.document_code/);
  assert.match(doubleCheck, /Document Code/);
});

test('database migration adds permanent unique storage codes and canonical file metadata', () => {
  const migration = read('server/migrations/20260810_storage_codes_and_canonical_file_names.sql');
  assert.match(migration, /documents[\s\S]*document_code VARCHAR\(80\)/i);
  assert.match(migration, /uq_documents_document_code/i);
  assert.match(migration, /lot_project_storage_code VARCHAR\(40\)/i);
  assert.match(migration, /lot_project_listing_storage_code VARCHAR\(40\)/i);
  assert.match(migration, /lot_project_payment_storage_code VARCHAR\(40\)/i);
  assert.match(migration, /file_version INT UNSIGNED/i);
  assert.match(migration, /file_sequence INT UNSIGNED/i);
  assert.match(migration, /stored_file_name VARCHAR\(255\)/i);
  assert.match(migration, /proof_sequence INT UNSIGNED/i);
  assert.match(migration, /CONCAT\('PRJ-', lot_project_id\)/i);
  assert.match(migration, /CONCAT\('LST-', lot_project_listing_id\)/i);
});

test('existing Cloudinary migration is still dry-run by default and upgrades assets to storage-code paths', () => {
  const script = read('server/scripts/migrate-cloudinary-buyer-documents.js');
  assert.match(script, /const apply = args\.has\('--apply'\)/);
  assert.match(script, /migrateLiveDocuments/);
  assert.match(script, /migrateArchivedDocuments/);
  assert.match(script, /migratePaymentProofs/);
  assert.match(script, /resolveProjectStorageCode/);
  assert.match(script, /buildDocumentStoredFileName/);
  assert.match(script, /buildPaymentProofStoredFileName/);
  assert.match(script, /Run 20260810_storage_codes_and_canonical_file_names\.sql first/);
});




test('storage-id v3 migration is dry-run first and updates database codes only after Cloudinary moves succeed', () => {
  const script = read('server/scripts/migrate-cloudinary-storage-ids-v3.js');
  assert.match(script, /const apply = args\.has\('--apply'\)/);
  assert.match(script, /createProjectStorageCode\(row\.lot_project_id\)/);
  assert.match(script, /createListingStorageCode\(row\.lot_project_listing_id\)/);
  assert.match(script, /if \(summary\.failed > 0\)/);
  assert.match(script, /UPDATE lot_projects[\s\S]*lot_project_storage_code = CONCAT\('PRJ-', lot_project_id\)/i);
  assert.match(script, /UPDATE lot_project_listings[\s\S]*lot_project_listing_storage_code = CONCAT\('LST-', lot_project_listing_id\)/i);
});

test('project and listing screens expose Cloudinary folder references beside human-readable identity', () => {
  const projectDetails = read('client/src/components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal.jsx');
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  assert.match(projectDetails, /Cloudinary Project Folder/);
  assert.match(unitStatus, /Cloudinary Project Folder/);
  assert.match(unitStatus, /Cloudinary Listing Folder/);
  assert.match(unitStatus, /Current Account Folder/);
  assert.match(unitStatus, /Unit ID/);
});
