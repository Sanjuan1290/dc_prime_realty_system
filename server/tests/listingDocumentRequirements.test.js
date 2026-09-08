import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Review Buyer Form & Reserve starts from the listing saved requirements', async () => {
  const [profilePage, reserveModal, checklist] = await Promise.all([
    read('../../client/src/pages/Lot_Projects/ListingProfile.jsx'),
    read('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx'),
    read('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveDocumentChecklistModal.jsx'),
  ]);

  assert.match(profilePage, /listingDocuments=\{documents\}/);
  assert.match(reserveModal, /listingDocuments: listingDocumentsProp = \[\]/);
  assert.match(reserveModal, /const savedListingDocuments = listingDocumentsProp/);
  assert.match(reserveModal, /if \(savedListingDocuments\.length\) return savedListingDocuments/);
  assert.match(checklist, /saved document requirements are selected automatically/);
  assert.match(checklist, /Reset to Project Defaults/);
});

test('reservation checklist can change Required or Optional without loading defaults', async () => {
  const [reserveModal, checklist] = await Promise.all([
    read('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx'),
    read('../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveDocumentChecklistModal.jsx'),
  ]);

  assert.match(reserveModal, /const updateDocumentRequirement = \(documentId, requirement\) =>/);
  assert.match(checklist, /updateDocumentRequirement\(documentId, event\.target\.value\)/);
  assert.match(checklist, /<option value="required">Required<\/option>/);
  assert.match(checklist, /<option value="optional">Optional<\/option>/);
});

test('Edit Listing exposes and saves Listing Document Requirements', async () => {
  const [profilePage, unitStatus, editListing] = await Promise.all([
    read('../../client/src/pages/Lot_Projects/ListingProfile.jsx'),
    read('../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx'),
    read('../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/EditUnitStatusModal.jsx'),
  ]);

  assert.match(profilePage, /listingDocuments=\{documents\}/);
  assert.match(profilePage, /libraryDocuments=\{documentLibrary\}/);
  assert.match(unitStatus, /listingDocuments=\{listingDocuments\}/);
  assert.match(editListing, /Listing Document Requirements/);
  assert.match(editListing, /<EditListingDocumentsModal/);
  assert.match(editListing, /documentRequirements,/);
  assert.match(editListing, /Save Changes to apply them/);
});

test('listing update persists edited requirements and empty input falls back to project defaults', async () => {
  const controller = await read('../controllers/Lot_Projects/Listings/Listings.controller.js');

  assert.match(controller, /const replaceListingDocumentRequirements = async/);
  assert.match(controller, /Array\.isArray\(req\.body\.documentRequirements\)/);
  assert.match(controller, /req\.body\.documentRequirements\.length/);
  assert.match(controller, /await getProjectDefaultDocuments\(project\.lot_project_id\)/);
  assert.match(controller, /ON DUPLICATE KEY UPDATE/);
});

test('reservation backend falls back to listing requirements before project defaults', async () => {
  const controller = await read('../controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');

  assert.match(controller, /const getSavedListingDocumentRequirements = async/);
  assert.match(controller, /await getSavedListingDocumentRequirements\(connection, projectId, listingId\)/);
  assert.match(controller, /if \(!sourceDocuments\.length\) sourceDocuments = await getProjectDefaultDocuments\(projectId\)/);
});

