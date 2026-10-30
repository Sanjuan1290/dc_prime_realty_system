import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BULK_FIELDS, normalizedListing, normalizeBulkInput, listingChanges, prepareBulkListingRow,
  getProtectedFieldErrors,
} from '../controllers/Lot_Projects/Listings/listingBulkFields.js';

const baseRow = (i) => ({
  lot_project_listing_unit_id: `LA-${String(i + 400).padStart(4, '0')}`,
  lot_project_listing_old_unit_ids: null,
  cadastral_lots: '1306',
  lot_project_listing_unit_type: 'Inner',
  lot_project_listing_area_sqm: 300,
  lot_project_listing_installment_price_per_sqm: 1300,
  lot_project_listing_cash_price_per_sqm: 1000,
  lot_project_listing_reservation_fee: 50000,
  lot_project_listing_lmf_rate: 10,
  annual_interest_rate: 0,
});

test('old Unit ID placeholders (-, — and blanks) mean no aliases, not edits or duplicate IDs', () => {
  const before = normalizedListing(baseRow(1));
  for (const placeholder of ['-', '—', '', '  ', null]) {
    const values = { ...before, oldUnitIds: placeholder };
    assert.equal(normalizeBulkInput(values, before).oldUnitIds, '');
    assert.equal(normalizeBulkInput(values, {}).oldUnitIds, '');
    assert.deepEqual(listingChanges(before, normalizeBulkInput(values, before)), {});
  }
  assert.deepEqual(getProtectedFieldErrors({}, 'sold'), []);
});

test('a 63-row legacy template with 61 empty Old Unit IDs recognizes exactly two price updates', () => {
  const changed = [];
  const phantomIds = new Map();
  for (let i = 0; i < 63; i++) {
    const before = normalizedListing(baseRow(i));
    const originalFromWorkbook = { ...before, oldUnitIds: '-' };
    // All unchanged original values should match the current DB when aliases are blank.
    const baseline = normalizeBulkInput(originalFromWorkbook, {});
    assert.deepEqual(BULK_FIELDS.filter((field) => baseline[field] !== before[field]), []);
    const prices = i === 0 ? { installmentPricePerSqm: 1500, cashPricePerSqm: 1200 }
      : i === 1 ? { installmentPricePerSqm: 2100, cashPricePerSqm: 1800 } : {};
    const edited = normalizeBulkInput({ ...originalFromWorkbook, ...prices }, before);
    const diff = listingChanges(before, edited);
    if (Object.keys(diff).length) {
      changed.push({ i, diff });
      const codes = [edited.unitCode, ...(edited.oldUnitIds ? edited.oldUnitIds.split(', ') : [])];
      for (const code of codes) {
        assert.equal(phantomIds.has(code), false, `False duplicate Unit ID: ${code}`);
        phantomIds.set(code, i);
      }
    }
  }
  assert.equal(changed.length, 2);
  assert.deepEqual(changed.map((item) => Object.keys(item.diff)), [
    ['installmentPricePerSqm', 'cashPricePerSqm'],
    ['installmentPricePerSqm', 'cashPricePerSqm'],
  ]);
});

test('the importer retains real alias changes while ignoring placeholder markers', () => {
  const before = normalizedListing({ ...baseRow(2), lot_project_listing_old_unit_ids: 'LA-0123' });
  const after = normalizeBulkInput({ ...before, oldUnitIds: 'LA-0123, -, LA-0456' }, before);
  assert.equal(after.oldUnitIds, 'LA-0123, LA-0456');
  assert.deepEqual(Object.keys(listingChanges(before, after)), ['oldUnitIds']);
});

test('two separate import choices respect distinct permissions, preserving Add and Bulk workflows', () => {
  const listings = readFileSync(new URL('../../../CLIENT/SYSTEM/src/pages/Lot_Projects/Listings.jsx', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('../../../CLIENT/SYSTEM/src/components/Lot_Projects/ListingComponents/ListingImportChoiceModal.jsx', import.meta.url), 'utf8');
  assert.match(listings, /showImportChoice && \(canImport \|\| canBulkEdit\)/);
  assert.match(listings, /canCreateListings=\{canImport\}/);
  assert.match(listings, /canEditListings=\{canBulkEdit\}/);
  assert.match(picker, /Import New Listings/);
  assert.match(picker, /Bulk Edit Existing Listings/);
  assert.doesNotMatch(listings, />Bulk Edit Listings<\/button>/);
});

test('untouched workbook rows never overwrite newer database values or trigger a stale conflict', () => {
  const original = normalizedListing(baseRow(2));
  const currentInDatabase = { ...original, cashPricePerSqm: 1750 };
  const untouchedWorkbook = { ...original, oldUnitIds: '-' };
  const prepared = prepareBulkListingRow(currentInDatabase, untouchedWorkbook, untouchedWorkbook);
  assert.equal(prepared.intendedEdits, false);
  assert.equal(prepared.stale, false);
  assert.deepEqual(prepared.after, currentInDatabase);
  assert.deepEqual(listingChanges(currentInDatabase, prepared.after), {});
});

test('a real edit to a stale listing remains blocked so newer values are not overwritten', () => {
  const original = normalizedListing(baseRow(1));
  const currentInDatabase = { ...original, cashPricePerSqm: 1750 };
  const editedWorkbook = { ...original, oldUnitIds: '-', installmentPricePerSqm: 1800 };
  const prepared = prepareBulkListingRow(currentInDatabase, { ...original, oldUnitIds: '-' }, editedWorkbook);
  assert.equal(prepared.intendedEdits, true);
  assert.equal(prepared.stale, true);
});


