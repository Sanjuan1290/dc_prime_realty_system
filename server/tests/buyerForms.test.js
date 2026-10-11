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



test('buyer profile text is saved in formal title case without changing contact identifiers', () => {
  const profile = sanitizeBuyerProfilePayload({
    ...completePrincipal,
    buyerFirstName: 'robert renby',
    buyerMiddleName: 'cortez',
    buyerLastName: 'san juan',
    buyerSuffix: 'iii',
    placeOfBirth: 'imus',
    citizenship: 'filipino',
    presentAddress: 'b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite',
    employerBusinessName: 'd&c prime realty',
    natureOfWorkBusiness: 'it services',
    occupationPositionTitle: 'it manager',
    email: 'Robert.Test+Buyer@Example.com',
    contactNo: '09094545',
    tin: '123-456-789-000',
    presentZipCode: '4107',
  });

  assert.equal(profile.buyerFirstName, 'Robert Renby');
  assert.equal(profile.buyerMiddleName, 'Cortez');
  assert.equal(profile.buyerLastName, 'San Juan');
  assert.equal(profile.buyerSuffix, 'III');
  assert.equal(profile.buyerName, 'Robert Renby Cortez San Juan III');
  assert.equal(profile.placeOfBirth, 'Imus');
  assert.equal(profile.presentAddress, 'B70 L44 Cremona St. Cluster 5, Bella Vista, Brgy. Santiago, General Trias, Cavite');
  assert.equal(profile.employerBusinessName, 'D&C Prime Realty');
  assert.equal(profile.natureOfWorkBusiness, 'IT Services');
  assert.equal(profile.occupationPositionTitle, 'IT Manager');
  assert.equal(profile.email, 'Robert.Test+Buyer@Example.com');
  assert.equal(profile.contactNo, '09094545');
  assert.equal(profile.tin, '123-456-789-000');
  assert.equal(profile.presentZipCode, '4107');
});

test('second buyer formal text is normalized before public-link submission data is stored', () => {
  const profile = sanitizeBuyerProfilePayload({
    ...completePrincipal,
    buyerType: 'spouses',
    secondBuyerRole: 'spouse',
    secondBuyerFirstName: 'maria',
    secondBuyerMiddleName: 'del rosario',
    secondBuyerLastName: "o'connor-santos",
    secondBuyerSuffix: 'jr.',
    secondBuyerBirthDate: '1996-04-02',
    secondBuyerPlaceOfBirth: 'general trias',
    secondBuyerCitizenship: 'filipino',
    secondBuyerGender: 'female',
    secondBuyerCivilStatus: 'married',
    secondBuyerContactNo: '09170000000',
    secondBuyerPresentAddress: 'imus, cavite',
    secondBuyerPresentZipCode: '4103',
    secondBuyerEmploymentStatus: 'employed - private',
    secondBuyerMonthlyIncome: '40000',
  });

  assert.equal(profile.secondBuyerFirstName, 'Maria');
  assert.equal(profile.secondBuyerMiddleName, 'Del Rosario');
  assert.equal(profile.secondBuyerLastName, "O'Connor-Santos");
  assert.equal(profile.secondBuyerSuffix, 'Jr.');
  assert.equal(profile.secondBuyerName, "Maria Del Rosario O'Connor-Santos Jr.");
  assert.equal(profile.secondBuyerPlaceOfBirth, 'General Trias');
  assert.equal(profile.secondBuyerPresentAddress, 'Imus, Cavite');
  assert.equal(profile.secondBuyerEmploymentStatus, 'Employed - Private');
});

