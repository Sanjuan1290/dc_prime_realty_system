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
    'Listing Status',
  ]) {
    assert.match(printSource, new RegExp(heading.replace(/[()]/g, '\\$&')));
  }

  assert.match(printSource, /const STRAIGHT_PAYMENT_MONTHS = 20/);
  assert.match(printSource, /installmentSellingPrice - reservationFee/);
  assert.match(printSource, /netAfterReservation \/ STRAIGHT_PAYMENT_MONTHS/);
  assert.match(printSource, /pageOrientation="landscape"/);
  assert.doesNotMatch(printSource, />Installment TCP</);
  assert.doesNotMatch(printSource, />Cash TCP</);
  assert.doesNotMatch(printSource, />LMF Rate</);
  assert.match(printSource, /listing\.status/);
  assert.match(printSource, /colSpan=\{13\}/);
});
