import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBuyerFormToken,
  hashBuyerFormToken,
  sanitizeBuyerProfilePayload,
  validateBuyerProfilePayload,
} from '../controllers/Lot_Projects/BuyerForms/buyerForm.shared.js';

const completePrincipal = {
  buyerType: 'single',
  buyerFirstName: 'Juan',
  buyerLastName: 'Dela Cruz',
  birthDate: '1995-06-15',
  placeOfBirth: 'Cavite',
  citizenship: 'Filipino',
  gender: 'Male',
  civilStatus: 'Single',
  contactNo: '09171234567',
  presentAddress: 'Indang, Cavite',
  presentZipCode: '4122',
  employmentStatus: 'Employed - Private',
  monthlyIncome: '35000',
};

test('buyer form tokens are random and only stable after hashing', () => {
  const first = createBuyerFormToken();
  const second = createBuyerFormToken();

  assert.notEqual(first, second);
  assert.equal(hashBuyerFormToken(first), hashBuyerFormToken(first));
  assert.notEqual(hashBuyerFormToken(first), hashBuyerFormToken(second));
  assert.equal(hashBuyerFormToken(first).length, 64);
});

test('complete single-buyer profiles pass validation and receive a display name', () => {
  const result = validateBuyerProfilePayload(completePrincipal);
  assert.equal(result.ok, true);
  assert.equal(result.profile.buyerName, 'Juan Dela Cruz');
});

test('spouse profiles require the second buyer fields', () => {
  const result = validateBuyerProfilePayload({ ...completePrincipal, buyerType: 'spouses' });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'secondBuyerFirstName');
});

test('single-buyer sanitization clears hidden second buyer values', () => {
  const profile = sanitizeBuyerProfilePayload({
    ...completePrincipal,
    secondBuyerFirstName: 'Should',
    secondBuyerLastName: 'Clear',
    secondBuyerMonthlyIncome: '99999',
  });

  assert.equal(profile.secondBuyerFirstName, '');
  assert.equal(profile.secondBuyerLastName, '');
  assert.equal(profile.secondBuyerMonthlyIncome, '');
});

test('future birth dates and negative income are rejected', () => {
  const future = validateBuyerProfilePayload({ ...completePrincipal, birthDate: '2999-01-01' });
  assert.equal(future.ok, false);
  assert.equal(future.field, 'birthDate');

  const negative = validateBuyerProfilePayload({ ...completePrincipal, monthlyIncome: '-1' });
  assert.equal(negative.ok, false);
  assert.equal(negative.field, 'monthlyIncome');
});
