import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getListingPricingForMode } from '../controllers/Lot_Projects/_shared/listingPricing.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const listing = {
  lot_project_listing_area_sqm: 195,
  lot_project_listing_installment_price_per_sqm: 7600,
  lot_project_listing_cash_price_per_sqm: 7300,
  lot_project_listing_lmf_rate: 10,
};

test('reservation pricing accepts a buyer-specific LMF rate without changing the listing default', () => {
  const pricing = getListingPricingForMode(listing, 'installment', 0, 5);

  assert.equal(pricing.lotAreaSqm, 195);
  assert.equal(pricing.pricePerSqm, 7600);
  assert.equal(pricing.legalMiscRate, 5);
  assert.equal(pricing.baseSellingPrice, 1_482_000);
  assert.equal(pricing.lmfAmount, 74_100);
  assert.equal(pricing.tcp, 1_556_100);
  assert.equal(listing.lot_project_listing_lmf_rate, 10);
});

test('omitting the reservation LMF override keeps the listing rate', () => {
  const pricing = getListingPricingForMode(listing, 'installment', 0);
  assert.equal(pricing.legalMiscRate, 10);
  assert.equal(pricing.lmfAmount, 148_200);
});

test('Reserve Listing displays lot area and editable LMF and interest fields', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const paymentTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const shared = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveShared.jsx');

  assert.match(paymentTerms, /label="Lot Area"/);
  assert.match(paymentTerms, /label="LMF Rate \(%\)"/);
  assert.match(paymentTerms, /onChange=\{\(value\) => updatePaymentField\('legalMiscFeeRate', value\)\}/);
  assert.match(paymentTerms, /label="Annual Interest Rate \(%\)"/);
  assert.match(paymentTerms, /onChange=\{\(value\) => updatePaymentField\('interestRate', value\)\}/);
  assert.doesNotMatch(paymentTerms, /label="Interest Rate"[\s\S]{0,160}disabled/);
  assert.match(modal, /paymentForm\.legalMiscFeeRate/);
  assert.match(modal, /legalMiscFeeRate: Number\(effectivePaymentForm\.legalMiscFeeRate/);
  assert.match(shared, /step=\{step\}/);
});

test('reservation API validates and saves the selected LMF and interest rates', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const profileMapper = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');

  assert.match(controller, /LMF rate must be between 0 and 100/);
  assert.match(controller, /Interest rate must be between 0 and 100/);
  assert.match(controller, /getListingPricingForMode\([\s\S]*selectedLmfRate/);
  assert.match(controller, /soa_selected_lmf_amount', contractPricing\.lmfAmount/);
  assert.match(controller, /soa_interest_rate_overridden', interestRateOverridden/);
  assert.match(profileMapper, /lmfAmount \/ baseSellingPrice/);
  assert.match(profileMapper, /listingLmfRate/);
  assert.match(profileMapper, /isOverridden[\s\S]*soa_annual_interest_rate/);
  assert.match(controller, /soa_interest_rate_overridden: profileTerms\.interestRateOverridden \? 1 : 0/);
});
