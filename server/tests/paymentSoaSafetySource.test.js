import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sharedPath = new URL('../controllers/Lot_Projects/_shared/lotProject.shared.js', import.meta.url);
const controllerPath = new URL('../controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js', import.meta.url);
const modalPath = new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx', import.meta.url);

const shared = await readFile(sharedPath, 'utf8');
const controller = await readFile(controllerPath, 'utf8');
const modal = await readFile(modalPath, 'utf8');

test('payment writes use row locks and retryable transactions', () => {
  assert.match(controller, /runTransactionWithRetry\(db/);
  assert.match(controller, /getListingForPayment\([^\n]*forUpdate:\s*true/);
  assert.match(controller, /lockPaymentAccountForListing\(connection, listing\)/);
  assert.match(controller, /lockPaymentSchedulesForListing\(connection, listing\)/);
  assert.match(shared, /FOR UPDATE/);
});

test('cash references are based on payment primary key instead of COUNT', () => {
  const start = shared.indexOf('export const getNextCashReference');
  const end = shared.indexOf('export const mapPaymentRow', start);
  const helper = shared.slice(start, end);
  assert.doesNotMatch(helper, /COUNT\s*\(/i);
  assert.match(helper, /numericPaymentId/);
});

test('schedule mutation paths lock account-scoped schedule rows', () => {
  const applyStart = shared.indexOf('export const applyPaymentToSchedules');
  const reverseStart = shared.indexOf('export const reversePaymentAllocations');
  const getPaymentStart = shared.indexOf('export const getPaymentById');
  const apply = shared.slice(applyStart, reverseStart);
  const reverse = shared.slice(reverseStart, getPaymentStart);
  assert.match(apply, /lot_project_account_id/);
  assert.match(apply, /FOR UPDATE/);
  assert.match(reverse, /lot_project_account_id/);
  assert.match(reverse, /FOR UPDATE/);
});

test('payment modal blocks immediate duplicate submits and reuses request key after recoverable errors', () => {
  assert.match(modal, /submitLockRef\.current/);
  assert.match(modal, /requestKeyRef/);
  assert.match(modal, /requestKey:\s*isEdit\s*\?\s*undefined\s*:\s*requestKeyRef\.current/);
});
