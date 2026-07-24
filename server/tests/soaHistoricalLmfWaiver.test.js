import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('reservation and Edit SOA support controlled historical dates', () => {
  const reserveTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const reserveModal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const paymentsSoa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const paymentsController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');

  assert.match(reserveTerms, /Encode an existing or historical client account/);
  assert.match(reserveTerms, /historicalMinimum/);
  assert.match(reserveModal, /Historical Starting Date must be from/);
  assert.match(paymentsSoa, /Historical First Due Date must be from/);
  assert.match(reserveController, /soa_is_historical_entry/);
  assert.match(paymentsController, /soa_is_historical_entry/);
});

test('separate Legal Misc Fee can be waived with an audit record', () => {
  const paymentsSoa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const paymentsController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
  const router = read('server/routers/System/projects.routers.js');
  const migration = read('server/migrations/20260724_soa_dp_discount_historical_lmf_waiver.sql');

  assert.match(paymentsSoa, /Waive Legal \/ Misc Fee/);
  assert.match(paymentsSoa, /Outstanding LMF/);
  assert.match(paymentsController, /waiveSeparateLegalMiscFee/);
  assert.match(paymentsController, /already has a recorded payment/);
  assert.match(paymentsController, /lot_project_contract_adjustments/);
  assert.match(router, /lmf-waiver/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS lot_project_contract_adjustments/);
  assert.match(migration, /discount_amount/);
});

test('Lot Pricing shows the saved DP discount breakdown', () => {
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');

  assert.match(unitStatus, /DP Target/);
  assert.match(unitStatus, /DP Discount/);
  assert.match(unitStatus, /DP After Discount/);
  assert.match(unitStatus, /Remaining DP Payable/);
  assert.match(unitStatus, /DP per Term/);
});

test('Lot Pricing separates installment and cash computations into two columns', () => {
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');

  assert.match(unitStatus, /Installment Pricing/);
  assert.match(unitStatus, /Cash Pricing/);
  assert.match(unitStatus, /grid gap-4 lg:grid-cols-2/);
  assert.match(unitStatus, /installmentNetSellingPrice/);
  assert.match(unitStatus, /cashNetSellingPrice/);
  assert.match(unitStatus, /installmentLmfAmount/);
  assert.match(unitStatus, /cashLmfAmount/);
  assert.match(unitStatus, /Selected Contract Computation/);
});


test('paid separate LMF is never treated as lot principal and old rows self-repair', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');

  assert.match(shared, /const isLegalMiscFee = scheduleType === 'legal_misc'/);
  assert.match(shared, /const paidPrincipal = isLegalMiscFee\s*\? 0/);
  assert.match(shared, /const principalReduction = isLegalMiscFee\s*\? 0/);
  assert.match(shared, /hasLegacyLegalMiscPrincipalReduction/);
});
