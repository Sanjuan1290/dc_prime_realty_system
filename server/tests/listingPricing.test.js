import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateContractPricing,
  getListingPricingForMode,
} from '../controllers/Lot_Projects/_shared/listingPricing.js';

test('sale discount uses the base selling price while LMF stays based on the original base', () => {
  const result = calculateContractPricing({
    lotAreaSqm: 1000,
    pricePerSqm: 1000,
    legalMiscRate: 10,
    saleDiscountPercentage: 10,
  });

  assert.deepEqual(result, {
    pricePerSqm: 1000,
    lotAreaSqm: 1000,
    legalMiscRate: 10,
    baseSellingPrice: 1_000_000,
    saleDiscountPercentage: 10,
    saleDiscountAmount: 100_000,
    netSellingPrice: 900_000,
    lmfAmount: 100_000,
    tcp: 1_000_000,
  });
});

test('a 20 percent sale discount produces a 900,000 TCP for the supplied example', () => {
  const result = calculateContractPricing({
    lotAreaSqm: 1000,
    pricePerSqm: 1000,
    legalMiscRate: 10,
    saleDiscountPercentage: 20,
  });

  assert.equal(result.saleDiscountAmount, 200_000);
  assert.equal(result.netSellingPrice, 800_000);
  assert.equal(result.lmfAmount, 100_000);
  assert.equal(result.tcp, 900_000);
});

test('reservation mode selects the matching listing price per SQM', () => {
  const listing = {
    lot_project_listing_area_sqm: 200,
    lot_project_listing_lmf_rate: 10,
    lot_project_listing_price_per_sqm: 1300,
    lot_project_listing_installment_price_per_sqm: 1300,
    lot_project_listing_cash_price_per_sqm: 1100,
  };

  const installment = getListingPricingForMode(listing, 'installment', 0);
  const cash = getListingPricingForMode(listing, 'cash', 0);

  assert.equal(installment.pricePerSqm, 1300);
  assert.equal(installment.tcp, 286_000);
  assert.equal(cash.pricePerSqm, 1100);
  assert.equal(cash.tcp, 242_000);
});

test('legacy listings fall back to the old price for both modes', () => {
  const listing = {
    lot_project_listing_area_sqm: 100,
    lot_project_listing_lmf_rate: 10,
    lot_project_listing_price_per_sqm: 1000,
  };

  assert.equal(getListingPricingForMode(listing, 'installment').pricePerSqm, 1000);
  assert.equal(getListingPricingForMode(listing, 'cash').pricePerSqm, 1000);
});

