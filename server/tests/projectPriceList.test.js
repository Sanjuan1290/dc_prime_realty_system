  import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readDashboardController = () =>
  readFile(new URL('../controllers/Lot_Projects/Dashboard/Dashboard.controller.js', import.meta.url), 'utf8');

const getPriceListSource = (source) => {
  const start = source.indexOf('export const getLotProjectPriceList');
  assert.notEqual(start, -1, 'getLotProjectPriceList must exist');
  return source.slice(start);
};

test('project price list uses listing inventory pricing without an out-of-scope TCP expression', async () => {
  const source = getPriceListSource(await readDashboardController());

  assert.doesNotMatch(source, /effectiveTcpExpr/);
  assert.match(source, /SELECT\s+l\.\*,\s+\$\{cadastralSelect\}/s);
  assert.match(source, /listings:\s*rows\.map\(mapListingRow\)/);
  assert.match(source, /requestedStatus = String\(req\.query\.status \|\| 'available'\)/);
  assert.match(source, /supportedStatuses = new Set\(\['available', 'all', 'hold', 'sold', 'fully_paid', 'pending_for_cancellation', 'cancelled'\]\)/);
  assert.match(source, /statusFilter === 'all'/);
  assert.match(source, /statusFilter === 'fully_paid'/);
  assert.match(source, /statusFilter === 'sold'/);
  assert.match(source, /statusFilter,/);
});

test('project price list response still exposes dual cash and installment values through mapListingRow', async () => {
  const sharedSource = await readFile(
    new URL('../controllers/Lot_Projects/_shared/lotProject.shared.js', import.meta.url),
    'utf8'
  );

  assert.match(sharedSource, /installmentPricePerSqm:\s*installmentPricing\.pricePerSqm/);
  assert.match(sharedSource, /cashPricePerSqm:\s*cashPricing\.pricePerSqm/);
  assert.match(sharedSource, /installmentTcp:\s*installmentPricing\.tcp/);
  assert.match(sharedSource, /cashTcp:\s*cashPricing\.tcp/);
});

test('project unit price list matches the inventory sheet columns and straight-payment formula', async () => {
  const printSource = await readFile(
    new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/Printouts/ProjectPriceListPrintPage.jsx', import.meta.url),
    'utf8'
  );

  for (const heading of [
    'Orientation',
    'Cash Price per SQM',
    'Cash Selling Price (w/o LMF)',
    'Installment Price per SQM',
    'Installment Selling Price (w/o LMF)',
    'Reservation Fee',
    'Net After Reservation',
    'Straight Payment (Months)',
    'Straight Payment (Monthly)',
  ]) {
    assert.match(printSource, new RegExp(heading.replace(/[()]/g, '\\$&')));
  }

  assert.match(printSource, /const DEFAULT_STRAIGHT_PAYMENT_MONTHS = 20/);
  assert.match(printSource, /installmentSellingPrice - reservationFee/);
  assert.match(printSource, /const searchParams = new URLSearchParams\(window\.location\.search\)/);
  assert.match(printSource, /searchParams\.get\('straightPaymentMonths'\)/);
  assert.match(printSource, /searchParams\.get\('status'\)/);
  assert.match(printSource, /getPriceListValues\(listing, straightPaymentMonths\)/);
  assert.match(printSource, /netAfterReservation \/ straightPaymentMonths/);
  assert.match(printSource, /pageOrientation="landscape"/);
  assert.doesNotMatch(printSource, />Installment TCP</);
  assert.doesNotMatch(printSource, />Cash TCP</);
  assert.doesNotMatch(printSource, />LMF Rate</);
  assert.match(printSource, /const listings = payload\.listings \|\| \[\]/);
  assert.match(printSource, /PRICE_LIST_STATUS_LABELS/);
  assert.match(printSource, />Status<\/th>/);
  assert.match(printSource, /listing\.status \|\| '-'/);
  assert.match(printSource, /No listings found for the selected status/);
  assert.doesNotMatch(printSource, /const availableListings = listings\.filter/);
  assert.match(printSource, /colSpan=\{13\}/);
});
