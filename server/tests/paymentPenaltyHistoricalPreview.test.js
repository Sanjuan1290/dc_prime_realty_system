import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (url) => readFileSync(url, 'utf8');

const controller = read(new URL('../controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js', import.meta.url));
const shared = read(new URL('../controllers/Lot_Projects/_shared/lotProject.shared.js', import.meta.url));
const router = read(new URL('../routers/System/projects.routers.js', import.meta.url));
const modal = read(new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx', import.meta.url));
const payments = read(new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx', import.meta.url));

test('payment preview route calculates using selected payment date', () => {
  assert.match(router, /payments\/preview/);
  assert.match(controller, /previewLotProjectListingPayment/);
  assert.match(controller, /getListingPenaltySnapshots\([\s\S]*paymentDate[\s\S]*excludePaymentId/);
  assert.match(controller, /Future payment dates are blocked/);
});

test('historical allocations are replayed in effective-date order after payment mutations', () => {
  assert.match(shared, /rebuildListingPaymentAllocationsChronologically/);
  assert.match(shared, /ORDER BY lot_project_payment_date ASC, lot_project_payment_id ASC/);
  assert.match(shared, /DELETE FROM lot_project_payment_allocations/);
  const replayCalls = (controller.match(/rebuildListingPaymentAllocationsChronologically\(/g) || []).length;
  assert.ok(replayCalls >= 3, `expected replay on create, update, and delete; got ${replayCalls}`);
});

test('penalty engine ignores payments after the selected as-of date and exposes day count', () => {
  assert.match(shared, /plainDate\(allocation\.payment_date\) <= cleanAsOfDate/);
  assert.match(shared, /chargeablePenaltyDays \+= days/);
  assert.match(shared, /penaltyDays: chargeablePenaltyDays/);
});

test('modal uses Manila date, server preview, separate penalty, and total payable cards', () => {
  assert.match(modal, /timeZone: 'Asia\/Manila'/);
  assert.match(modal, /onPreview/);
  assert.match(payments, /payments\/preview/);
  assert.match(modal, />Total Payable</);
  assert.match(modal, /penalty day\(s\)/);
  assert.doesNotMatch(modal, /Payment status is removed here because admin-added payments are saved as verified automatically/);
});

