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

test('storage codes use stable recognizable business prefixes', () => {
  assert.equal(createProjectStorageCode(1, 'LA'), 'PRJ-LA-001');
  assert.equal(createProjectStorageCode(12, 'Bailen West'), 'PRJ-BAILEN-WEST-012');
  assert.equal(createListingStorageCode(42), 'LST-000042');
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
