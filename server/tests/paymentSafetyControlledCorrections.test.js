import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashSensitiveActionPayload,
  sensitiveActionCodeMatches,
  hashSensitiveActionCode,
} from '../services/sensitiveActionVerification.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const paymentsController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
const reservationController = read('server/controllers/Lot_Projects/ListingProfile/ReservationCorrection.controller.js');
const router = read('server/routers/System/projects.routers.js');
const paymentsUi = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
const addPayment = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx');
const listingProfile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
const accountController = read('server/controllers/Lot_Projects/Accounts/Accounts.controller.js');
const sensitiveVerification = read('server/services/sensitiveActionVerification.service.js');


test('Add Payment always performs account/recent-payment preflight before opening the entry form', () => {
  assert.match(router, /payments\/preflight/);
  assert.match(paymentsController, /getLotProjectListingPaymentPreflight/);
  assert.match(paymentsController, /lot_project_payment_status = 'Verified'/);
  assert.match(paymentsController, /lot_project_payment_date >= \?/);
  assert.match(paymentsUi, /PaymentAccountConfirmationModal/);
  assert.match(paymentsUi, /Recent verified payment detected/);
  assert.match(paymentsUi, /No recent verified payment detected/);
  assert.match(paymentsUi, /I confirmed that/);
  assert.match(paymentsUi, /paymentPreflightMutation\.mutate\(\)/);
});

test('manual amount changes are visibly warned and must be acknowledged before payment save', () => {
  assert.match(addPayment, /hasAmountOverrideWarning/);
  assert.match(addPayment, /Payment amount changed from the calculated amount due/);
  assert.match(addPayment, /Suggested/);
  assert.match(addPayment, /Entered/);
  assert.match(addPayment, /Difference/);
  assert.match(addPayment, /amountOverrideAcknowledged/);
  assert.match(addPayment, /Confirm the payment amount override before saving/);
});

test('recorded payment edits and voids are exact-Super-Admin actions with password plus email code', () => {
  assert.match(router, /payments\/:paymentId\/correction-code[\s\S]*requireExactRole\('super_admin'\)[\s\S]*requireCurrentPassword/);
  assert.match(router, /payments\/:paymentId'[\s\S]*requireExactRole\('super_admin'\)[\s\S]*updateLotProjectListingPayment/);
  assert.match(router, /payments\/:paymentId\/delete'[\s\S]*requireExactRole\('super_admin'\)[\s\S]*deleteLotProjectListingPayment/);
  assert.match(paymentsController, /requirePaymentCorrectionVerification/);
  assert.match(paymentsController, /createSensitiveActionVerification/);
  assert.match(paymentsController, /verifyAndConsumeSensitiveAction/);
  assert.match(paymentsUi, /Only an exact Super Admin can change an already recorded verified payment/);
  assert.match(paymentsUi, /Verify Password & Send Code/);
  assert.match(paymentsUi, /Email Verification Code/);
});

test('voiding a payment retains the row as Cancelled instead of physically deleting financial history', () => {
  const start = paymentsController.indexOf('export const deleteLotProjectListingPayment');
  const end = paymentsController.indexOf('export const grantPaymentSchedulePenaltyExtension', start);
  const source = paymentsController.slice(start, end);
  assert.match(source, /SET lot_project_payment_status = 'Cancelled'/);
  assert.doesNotMatch(source, /DELETE FROM lot_project_payments/);
  assert.match(source, /Voided verified payment/);
});

test('cancelled payments no longer block simple unit correction but verified payments require controlled correction', () => {
  const start = reservationController.indexOf('const getCorrectionSafety');
  const end = reservationController.indexOf('const normalizeTerms', start);
  const source = reservationController.slice(start, end);
  assert.match(source, /lot_project_payment_status = 'Verified'/);
  assert.match(source, /lot_project_payment_status = 'Cancelled'/);
  assert.match(source, /controlledEligible:\s*hardReasons\.length === 0 && paymentCount > 0/);
  assert.match(source, /eligible:\s*hardReasons\.length === 0 && paymentCount === 0/);
  assert.match(source, /Use Controlled Unit Correction with Super Admin password and email verification/);
});

test('controlled unit correction preserves payment facts, retargets the account payment rows, and replays verified payments', () => {
  assert.match(reservationController, /Controlled Unit Correction can only be completed by an exact Super Admin/);
  assert.match(reservationController, /verifyAndConsumeSensitiveAction/);
  assert.match(reservationController, /UPDATE lot_project_payments[\s\S]*SET lot_project_listing_id = \?[\s\S]*WHERE lot_project_account_id = \?/);
  assert.match(reservationController, /rebuildListingPaymentAllocationsChronologically/);
  assert.match(reservationController, /syncCommissionProgressForListing/);
  assert.match(reservationController, /DELETE FROM lot_project_soa_statements[\s\S]*COALESCE\(sent_count, 0\) = 0/);
  assert.match(reservationController, /Amount\/date\/reference/i, 'source comment should explain payment facts are preserved');
});

test('listing header shows buyer identity and account history distinguishes verified from voided payments', () => {
  assert.match(listingProfile, /listing\.buyer_name \|\| listing\.buyerName \|\| listing\.clientName \|\| account\?\.buyerName/);
  assert.match(accountController, /lot_project_payment_status = 'Verified'\) AS payment_count/);
  assert.match(accountController, /lot_project_payment_status = 'Cancelled'\) AS voided_payment_count/);
  assert.match(read('client/src/components/Lot_Projects/ListingProfileComponents/AccountHistory/AccountHistoryPanel.jsx'), /voidedPaymentCount/);
});


test('failed email-code attempts persist verification state instead of being rolled back with financial mutations', () => {
  assert.match(sensitiveVerification, /return \{[\s\S]*ok: false,[\s\S]*Verification code is incorrect/);
  assert.match(paymentsController, /authorizationError/);
  assert.match(reservationController, /Commit only the verification attempt\/expiry state/);
});

test('sensitive verification hashes bind the code and exact proposed payload', () => {
  const oldSecret = process.env.DESTRUCTIVE_ACTION_CODE_SECRET;
  process.env.DESTRUCTIVE_ACTION_CODE_SECRET = 'test-sensitive-action-secret';
  try {
    const codeHash = hashSensitiveActionCode('123456');
    assert.equal(sensitiveActionCodeMatches('123456', codeHash), true);
    assert.equal(sensitiveActionCodeMatches('654321', codeHash), false);
    assert.notEqual(
      hashSensitiveActionPayload({ paymentId: 1, amount: 100 }),
      hashSensitiveActionPayload({ paymentId: 1, amount: 101 })
    );
  } finally {
    if (oldSecret === undefined) delete process.env.DESTRUCTIVE_ACTION_CODE_SECRET;
    else process.env.DESTRUCTIVE_ACTION_CODE_SECRET = oldSecret;
  }
});
