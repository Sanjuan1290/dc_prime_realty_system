import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Add Payment exposes audited payment-specific penalty handling', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx');
  const paymentReview = read('client/src/components/Shared/DoubleCheckComponents/PaymentDoubleCheck.jsx');
  assert.match(modal, /Penalty Handling/);
  assert.match(modal, /Waive penalty for this payment/);
  assert.match(modal, /penaltyWaiverReason/);
  assert.match(paymentReview, /Calculated Penalty to Waive/);
});

test('payment create and edit persist payment-linked full waivers using the payment date', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  assert.match(controller, /savePaymentLinkedPenaltyWaiver/);
  assert.match(controller, /effectiveDate: paymentDate/);
  assert.match(shared, /relief\.effective_date \|\| relief\.created_at/);
  assert.match(shared, /excludePenaltyReliefId/);
});

test('SOA terms support a penalty policy effective date for historical accounts', () => {
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const reserve = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const migration = read('server/migrations/20260819_payment_penalty_waiver_effective_date.sql');
  assert.match(payments, /Penalty Effective From \(Optional\)/);
  assert.match(reserve, /Penalty Effective From \(Optional\)/);
  assert.match(migration, /ADD COLUMN soa_penalty_effective_from DATE NULL/);
  assert.match(migration, /ADD COLUMN effective_date DATE NULL/);
  assert.match(migration, /ADD COLUMN lot_project_payment_id INT UNSIGNED NULL/);
});
