import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeDocumentRequirement,
  resolveDocumentRequirement,
} from '../../client/src/utils/documentRequirement.js';
import { resolveDocumentRequiredFlag } from '../utils/documentRequirement.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('document requirement normalizer preserves Optional across boolean and TiDB numeric shapes', () => {
  for (const value of [false, 0, '0', 'optional', 'Optional', 'false']) {
    assert.equal(normalizeDocumentRequirement(value), 'optional');
  }

  for (const value of [true, 1, '1', 'required', 'Required', 'true']) {
    assert.equal(normalizeDocumentRequirement(value), 'required');
  }
});

test('document requirement resolver uses the most specific saved requirement before library fallback', () => {
  assert.equal(resolveDocumentRequirement({ document_is_required: 0 }), 'optional');
  assert.equal(resolveDocumentRequirement({ lot_project_default_document_is_required: 0, document_is_required: 1 }), 'optional');
  assert.equal(resolveDocumentRequirement({ lot_project_listing_document_is_required: 0, lot_project_default_document_is_required: 1 }), 'optional');
  assert.equal(resolveDocumentRequirement({ requirement: 'required', lot_project_listing_document_is_required: 0 }), 'required');
});

test('server payload normalizer preserves zero and optional as not required', () => {
  assert.equal(resolveDocumentRequiredFlag({ is_required: 0 }), 0);
  assert.equal(resolveDocumentRequiredFlag({ is_required: '0' }), 0);
  assert.equal(resolveDocumentRequiredFlag({ requirement: 'optional' }), 0);
  assert.equal(resolveDocumentRequiredFlag({ requirement: 'required' }), 1);
});

test('listing document picker inherits the Document Library requirement instead of forcing Required', () => {
  const editDocuments = read('client/src/components/Lot_Projects/ListingComponents/EditListingDocumentsModal/EditListingDocumentsModal.jsx');
  const addListing = read('client/src/components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal.jsx');
  const editListing = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/EditUnitStatusModal.jsx');
  const reserveListing = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');

  assert.match(editDocuments, /resolveDocumentRequirement\(document\)/);
  assert.doesNotMatch(editDocuments, /source: 'Document Library', requirement: 'required'/);
  assert.match(addListing, /resolveDocumentRequirement\(document\)/);
  assert.match(editListing, /resolveDocumentRequirement\(document\)/);
  assert.match(reserveListing, /resolveDocumentRequirement\(document\)/);
});
