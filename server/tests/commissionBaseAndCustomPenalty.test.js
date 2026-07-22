import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveCommissionBaseAmount,
  roundCommissionMoney,
} from '../controllers/Lot_Projects/Commissions/commissionBase.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('commission base uses lot area multiplied by the selected price per SQM before discount', () => {
  const commissionBase = resolveCommissionBaseAmount({
    lot_project_listing_area_sqm: 300,
    soa_selected_price_per_sqm: 1000,
    lot_project_listing_net_selling_price: 270000,
    lot_project_listing_tcp: 300000,
  });

  assert.equal(commissionBase, 300000);
  assert.equal(roundCommissionMoney(commissionBase * 0.04), 12000);
});

test('saved base-selling-price snapshot takes priority over discounted net selling price and TCP', () => {
  assert.equal(resolveCommissionBaseAmount({
    soa_selected_base_selling_price: 1482000,
    lot_project_listing_net_selling_price: 1407900,
    lot_project_listing_tcp: 1556100,
  }), 1482000);
});

test('reservation preview and save pass the before-discount base into commission generation', () => {
  const previewController = read('server/controllers/Lot_Projects/Commissions/CommissionConfiguration.controller.js');
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const hierarchyService = read('server/controllers/Lot_Projects/Commissions/commissionHierarchy.service.js');

  assert.match(previewController, /listing\.commissionBase = contractPricing\.baseSellingPrice/);
  assert.match(reserveController, /listing\.commissionBase = contractPricing\.baseSellingPrice/);
  assert.match(hierarchyService, /resolveCommissionBaseAmount\(listing\)/);
  assert.doesNotMatch(hierarchyService, /lot_project_listing_net_selling_price \|\|[\s\S]{0,100}commissionBase/);
});

test('commission screens identify the saved amount as the before-discount base', () => {
  const preview = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const commissionPage = read('client/src/pages/Lot_Projects/Commission.jsx');
  const distribution = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/CommissionDistribution.jsx');
  const details = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');

  for (const source of [preview, commissionPage, distribution, details]) {
    assert.match(source, /Commission Base \(Before Discount\)/);
  }
  assert.match(commissionPage, /record\.commissionBase/);
});

test('reservation and SOA editing support a custom daily penalty rate from 0 to 100 percent', () => {
  const reserveTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const reserveModal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const soaPage = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const soaController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');

  assert.match(reserveTerms, /<option value="custom">Custom<\/option>/);
  assert.match(reserveTerms, /Custom Daily Penalty Rate \(%\)/);
  assert.match(soaPage, /<option value="custom">Custom<\/option>/);
  assert.match(soaPage, /Custom Daily Penalty Rate \(%\)/);
  assert.match(reserveModal, /dailyPenaltyRate < 0 \|\| dailyPenaltyRate > 100/);
  assert.match(reserveController, /dailyPenaltyRate < 0 \|\| dailyPenaltyRate > 100/);
  assert.match(soaController, /dailyPenaltyRate < 0 \|\| dailyPenaltyRate > 100/);
  assert.doesNotMatch(reserveController, /allowedDailyPenaltyRates/);
  assert.doesNotMatch(soaController, /allowedDailyPenaltyRates/);
});
