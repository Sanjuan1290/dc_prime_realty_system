import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('SOA live queries keep only the newest active schedule generation', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const payments = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');

  assert.match(shared, /getLatestActiveScheduleGenerationPredicate/);
  assert.match(shared, /MAX\(latest_schedule\.created_at\)/);
  assert.match(shared, /recomputeListingScheduleBalances[\s\S]*getLatestActiveScheduleGenerationPredicate\('s'\)/);
  assert.match(payments, /SET schedule_status = 'Cancelled'[\s\S]*INSERT INTO lot_project_payment_schedules/);
});

test('reservation and editable due dates use Manila time with controlled historical encoding', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const paymentTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const paymentController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');

  assert.match(modal, /timeZone: 'Asia\/Manila'/);
  assert.match(paymentTerms, /Encode an existing or historical client account/);
  assert.match(paymentTerms, /min=\{startingDateMinimum\}/);
  assert.match(paymentTerms, /min=\{firstDueMinimum\}/);
  assert.match(reserveController, /Historical Starting Date must be from/);
  assert.match(reserveController, /First Due Date cannot be before the Starting Date/);
  assert.match(paymentController, /Historical First Due Date must be from/);
});

test('paid penalty remains accumulated and visible in SOA and dashboards', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const dashboard = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js');
  const soa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const systemDashboard = read('client/src/pages/System/Dashboard.jsx');

  assert.match(shared, /event\.kind === 'payment'[\s\S]*addCalendarDays\(event\.date, 1\)/);
  assert.match(dashboard, /GREATEST\(s\.paid_penalty_amount, 0\) \+ GREATEST\(s\.penalty_amount - s\.paid_penalty_amount, 0\)/);
  assert.match(soa, /Paid \{money\(row\.paidPenaltyAmount\)\}/);
  assert.match(soa, /Outstanding \{money\(row\.outstandingPenaltyAmount\)\}/);
  assert.match(systemDashboard, /Paid penalties \+ outstanding penalties/);
});



