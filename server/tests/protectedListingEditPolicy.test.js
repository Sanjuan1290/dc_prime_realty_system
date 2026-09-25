import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const listingController = read('../controllers/Lot_Projects/Listings/Listings.controller.js');
const documentsController = read('../controllers/Lot_Projects/ListingProfile/Documents.controller.js');
const listingProfile = read('../../client/src/pages/Lot_Projects/ListingProfile.jsx');
const unitStatus = read('../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
const editModal = read('../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/EditUnitStatusModal.jsx');

test('Available and Hold remain freely editable inventory states', () => {
  assert.match(listingController, /\['available', 'hold'\]\.includes\(currentListingStatus\)/);
  assert.match(listingProfile, /\['available', 'hold'\]\.includes\(listingInventoryStatus\)/);
});

test('protected listing edits require Super Admin on the server', () => {
  assert.match(listingController, /PROTECTED_LISTING_EDIT_REQUIRES_SUPER_ADMIN/);
  assert.match(listingController, /isProtectedListing && !isSuperAdmin/);
});

test('protected listing financial fields are rejected and never written by generic edit', () => {
  assert.match(listingController, /PROTECTED_LISTING_CONTRACT_FIELDS_LOCKED/);
  assert.match(listingController, /if \(!isProtectedListing\) \{/);
  assert.match(listingController, /lot_project_listing_installment_price_per_sqm = \?/);
  assert.match(listingController, /lot_project_listing_cash_price_per_sqm = \?/);
  assert.match(listingController, /lot_project_listing_reservation_fee = \?/);
  assert.match(listingController, /const annualInterestChanged = hasAnnualInterestRate/);
  assert.match(listingController, /protectedContractFieldChanges\.push\('Annual Interest Rate'\)/);
});

test('protected Unit ID correction keeps current account and reservation history identity aligned', () => {
  assert.match(listingController, /UPDATE lot_project_accounts[\s\S]*SET unit_id_snapshot = \?/);
  assert.match(listingController, /UPDATE lot_project_reservation_history[\s\S]*SET unit_id_snapshot = \?/);
});

test('listing document requirements lock after reservation on both routes', () => {
  assert.match(documentsController, /PROTECTED_LISTING_DOCUMENT_REQUIREMENTS_LOCKED/);
  assert.match(documentsController, /\['available', 'hold'\]\.includes\(listingStatus\)/);
  assert.match(listingController, /Listing document requirements are locked after this listing has been reserved/);
});

test('frontend exposes protected administrative edit only to Super Admin and locks contract inputs', () => {
  assert.match(listingProfile, /canEditListing = Boolean\(!readOnly && canEditListingPermission && \(listingIsFreelyEditableInventory \|\| isSuperAdmin\)\)/);
  assert.match(unitStatus, /disabled=\{isSaving \|\| !canEditListing\}/);
  assert.match(editModal, /const isProtectedListing = !\['available', 'hold'\]\.includes\(currentStatus\)/);
  assert.match(editModal, /disabled=\{isProtectedListing\}/);
  assert.match(editModal, /Protected listing: pricing, lot area, reservation fee, LMF, interest rate/);
});

