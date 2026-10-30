import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BULK_FIELDS, PROTECTED_IDENTITY_FIELDS, isContractProtected,
  getProtectedFieldErrors, listingChanges, normalizedListing, normalizeBulkInput,
} from '../controllers/Lot_Projects/Listings/listingBulkFields.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const backend = read('../controllers/Lot_Projects/Listings/ListingBulk.controller.js');
const excel = read('../../../CLIENT/SYSTEM/src/utils/listingBulkExcel.js');
const ui = read('../../../CLIENT/SYSTEM/src/components/Lot_Projects/ListingComponents/BulkEditListingsModal.jsx');
const original = normalizedListing({
  lot_project_listing_unit_id: 'LA-0401',
  lot_project_listing_old_unit_ids: 'LA-0100',
  lot_project_listing_unit_type: 'Inner',
  lot_project_listing_area_sqm: 300,
  lot_project_listing_installment_price_per_sqm: 1800,
  lot_project_listing_cash_price_per_sqm: 1500,
  lot_project_listing_reservation_fee: 10000,
  lot_project_listing_lmf_rate: 10,
  annual_interest_rate: 8,
});

const errorsFor = (changes, status) => getProtectedFieldErrors(listingChanges(original, { ...original, ...changes }), status);

test('available and hold can change all existing bulk listing fields', () => {
  for (const status of ['available', 'hold']) {
    assert.equal(isContractProtected(status), false);
    assert.deepEqual(errorsFor({ lotAreaSqm: 285, installmentPricePerSqm: 2000 }, status), []);
  }
});

test('sold, fully paid, pending cancellation and cancelled inventory is contract protected', () => {
  for (const status of ['sold', 'pending_for_cancellation', 'cancelled']) assert.equal(isContractProtected(status), true);
  assert.deepEqual(PROTECTED_IDENTITY_FIELDS, ['unitCode', 'oldUnitIds', 'cadastralLots', 'lotType']);
});

test('contract-protected units may correct Unit ID, old IDs, cadastral lots, and lot type', () => {
  const reSurveyed = normalizeBulkInput({ ...original, unitCode: 'LA-0401A', cadastralLots: 'BLK-4', lotType: 'Corner' }, original);
  const diff = listingChanges(original, reSurveyed);
  assert.deepEqual(Object.keys(diff).sort(), ['cadastralLots', 'lotType', 'oldUnitIds', 'unitCode']);
  for (const status of ['sold', 'pending_for_cancellation', 'cancelled']) assert.deepEqual(getProtectedFieldErrors(diff, status), []);
  assert.match(reSurveyed.oldUnitIds, /LA-0401/);
  assert.match(reSurveyed.oldUnitIds, /LA-0100/);
});

test('every financial and surveyed area field gives a clear field-specific contract warning', () => {
  const changed = {
    lotAreaSqm: 285, installmentPricePerSqm: 1900, cashPricePerSqm: 1600,
    reservationFee: 15000, legalMiscRate: 12, annualInterestRate: 9,
  };
  const errors = errorsFor(changed, 'sold');
  assert.equal(errors.length, 6);
  for (const field of Object.keys(changed)) assert.ok(BULK_FIELDS.includes(field));
  for (const label of ['Lot Area (SQM)', 'Installment Price / SQM', 'Cash Price / SQM', 'Reservation Fee', 'Legal / Misc Rate', 'Annual Interest Rate']) {
    assert.ok(errors.some((text) => text.includes(label)), `Missing user-friendly label: ${label}`);
  }
  assert.ok(errors.every((text) => text.includes('Restore the original value in Excel')));
  assert.deepEqual(getProtectedFieldErrors({}, 'sold'), []); // unchanged protected rows always export/import
});

test('bulk approval is preflighted and committed without saving any listing changes', () => {
  assert.match(backend, /actionKey: 'listing\.protected_edit'/);
  assert.match(backend, /consume: false/);
  assert.match(backend, /if \(approvalPending\.length\) \{[\s\S]*?connection\.commit\(\); committed = true;[\s\S]*?res\.status\(202\)/);
  assert.match(backend, /approvalRequestId: governance\.approvalRequestId, consume: true/);
  assert.match(backend, /headPreApprovedByUserId/);
});

test('protected updates write only identity fields and synchronize current buyer unit snapshots', () => {
  const protectedBranch = backend.split('if (item.contractProtected) {')[1].split('} else {')[0];
  assert.ok(protectedBranch);
  assert.match(protectedBranch, /UPDATE lot_project_listings SET lot_project_listing_unit_id = \?/);
  assert.match(protectedBranch, /lot_project_listing_old_unit_ids = \?/);
  assert.match(protectedBranch, /lot_project_listing_unit_type = \?/);
  assert.doesNotMatch(protectedBranch, /SET[^`]*lot_project_listing_area_sqm = \?/);
  assert.doesNotMatch(protectedBranch, /SET[^`]*lot_project_listing_tcp = \?/);
  assert.doesNotMatch(protectedBranch, /SET[^`]*lot_project_listing_installment_price_per_sqm = \?/);
  assert.match(protectedBranch, /UPDATE lot_project_accounts SET unit_id_snapshot = \?/);
  assert.match(protectedBranch, /UPDATE lot_project_reservation_history SET unit_id_snapshot = \?/);
  assert.match(backend, /BEGIN|beginTransaction\(\)/);
  assert.match(backend, /No changes were saved/);
});

test('Excel remains editable while protected cells are clearly marked and server remains authority', () => {
  assert.match(excel, /Contract Protection/);
  assert.match(excel, /isProtectedListingRow/);
  assert.match(excel, /PROTECTED_IDENTITY_FIELDS\.includes\(field\)/);
  assert.doesNotMatch(excel, /sheet\['!protect'\]\s*=/)
  assert.doesNotMatch(excel, /protection:\s*\{\s*locked:/)
  assert.match(excel, /allowed \? \{ fill:/)
  assert.match(excel, /rgb: 'E5E7EB'/)
  assert.match(excel, /cellStyles: true/)
  assert.match(excel, /BLUE cells/)
  assert.match(excel, /GREY cells/)
  assert.doesNotMatch(ui, /Sold, fully paid and cancelled units: only Unit ID/); // requested banner removed; server protection remains
  assert.match(excel, /originalRow\.Status/);
  assert.match(ui, /Excel Row/);
  assert.match(ui, /Head approval required/);
  assert.match(ui, /Apply Approved Changes/);
  assert.match(ui, /No units were updated/);
});


