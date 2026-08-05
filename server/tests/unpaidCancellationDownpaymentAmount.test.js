import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('SOA due date and date-paid cells stay on one line', () => {
  const source = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  assert.match(source, /whitespace-nowrap[\s\S]{0,180}\{formatDate\(row\.dueDate\)\}/);
  assert.match(source, /whitespace-nowrap[\s\S]{0,180}\{formatDate\(row\.datePaid\)\}/);
  assert.match(source, /className="whitespace-nowrap px-4 py-3 text-left/);
});

test('Reserve Listing supports an exact downpayment amount and sends it to the API', () => {
  const terms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const utils = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/reserveUtils.js');
  const controller = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const migration = read('server/migrations/20260805_downpayment_amount_mode.sql');

  assert.match(terms, /<option value="amount">Actual Amount<\/option>/);
  assert.match(terms, /Actual Downpayment Amount/);
  assert.match(modal, /customDownpaymentAmount/);
  assert.match(modal, /downpaymentInputMode: paymentCalculations\.downpaymentInputMode/);
  assert.match(modal, /downpaymentAmount: paymentCalculations\.downpaymentAmount/);
  assert.match(utils, /usesActualDownpaymentAmount/);
  assert.match(utils, /dpTarget = isCash[\s\S]*requestedDownpaymentAmount/);
  assert.match(controller, /soa_downpayment_input_mode/);
  assert.match(controller, /soa_downpayment_amount/);
  assert.match(shared, /downpaymentInputMode === 'amount'[\s\S]*savedDownpaymentAmount/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS `soa_downpayment_input_mode`[\s\S]*ENUM\('percentage','amount'\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS `soa_downpayment_amount`[\s\S]*DECIMAL\(14,2\)/);
});

test('unpaid cancellation offers keep-history and void-without-history paths', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/CancellationSettlementModal.jsx');
  const unitStatus = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const transitions = read('server/controllers/Lot_Projects/Listings/listingStatusTransitions.js');
  const controller = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const service = read('server/services/lotProjectAccount.service.js');

  assert.match(modal, /Keep in Buyer Account History/);
  assert.match(modal, /Void Without Account History/);
  assert.match(modal, /cancellationAccountHistoryTreatment/);
  assert.match(unitStatus, /void_unpaid_cancellation/);
  assert.match(transitions, /VOID_UNPAID_CANCELLATION/);
  assert.match(controller, /voidUnpaidLotProjectAccount/);
  assert.match(service, /export const voidUnpaidLotProjectAccount/);
  assert.match(service, /already has a payment record/);
  assert.match(service, /Uploaded buyer documents exist/);
  assert.match(service, /DELETE FROM lot_project_reservation_history/);
  assert.match(service, /DELETE FROM lot_project_accounts/);
});
