import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readServerRelative = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readClient = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

test('listing document editor exposes templates with confirmation and safe undo', () => {
  const modal = readClient('components/Lot_Projects/ListingComponents/EditListingDocumentsModal/EditListingDocumentsModal.jsx');

  assert.match(modal, /documentTemplates = \[\]/);
  assert.match(modal, /templateDocuments = \[\]/);
  assert.match(modal, />Document Templates</);
  assert.match(modal, /Add Document Template\?/);
  assert.match(modal, /Confirm & Add/);
  assert.match(modal, /Undo Template Add/);
  assert.match(modal, /Existing selected documents will not be replaced or changed/);
  assert.match(modal, /template_document_list_is_required|resolveDocumentRequirement\(row\)/);
  assert.match(modal, /resolveDocumentResponsibleParty\(row\)/);
});

test('new listing and existing listing document editors both receive template data', () => {
  const listings = readClient('pages/Lot_Projects/Listings.jsx');
  const addListing = readClient('components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal.jsx');
  const profile = readClient('pages/Lot_Projects/ListingProfile.jsx');
  const documents = readClient('components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');

  assert.match(listings, /useFetch\('\/documents\/getTemplates'\)/);
  assert.match(listings, /documentTemplates=\{templatesData\?\.templates \|\| \[\]\}/);
  assert.match(listings, /templateDocuments=\{templatesData\?\.template_documents \|\| \[\]\}/);
  assert.match(addListing, /documentTemplates=\{documentTemplates\}/);
  assert.match(addListing, /templateDocuments=\{templateDocuments\}/);
  assert.match(profile, /documentTemplates=\{documentTemplates\}/);
  assert.match(profile, /templateDocuments=\{templateDocuments\}/);
  assert.match(documents, /title="Edit Document Requirements"/);
  assert.match(documents, /documentTemplates=\{documentTemplates\}/);
  assert.match(documents, /templateDocuments=\{templateDocuments\}/);
});
