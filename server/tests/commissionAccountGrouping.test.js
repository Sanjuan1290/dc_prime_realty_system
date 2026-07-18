import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { groupCommissionRecords } from '../../client/src/utils/commissionRecords.js';

const sampleRecords = [
  {
    id: 11,
    commissionId: 11,
    listingId: 50,
    clientProfileId: 8,
    unit: 'LA-0103',
    client: 'Buyer One',
    project: 'Bailen Project',
    seller: 'Agent One',
    sellerGroup: 'North Star Group',
    role: 'Agent',
    rawRole: 'agent',
    commissionType: 'Direct',
    commissionBase: 630000,
    grossCommission: 25200,
    released: 5040,
    eligibleToRelease: 5040,
    netRemaining: 20160,
    paymentPercent: 40,
  },
  {
    id: 12,
    commissionId: 12,
    listingId: 50,
    clientProfileId: 8,
    unit: 'LA-0103',
    client: 'Buyer One',
    project: 'Bailen Project',
    seller: 'Manager One',
    sellerGroup: 'North Star Group',
    role: 'Manager',
    rawRole: 'manager',
    commissionType: 'Override',
    commissionBase: 630000,
    grossCommission: 6300,
    released: 0,
    eligibleToRelease: 1260,
    netRemaining: 6300,
    paymentPercent: 40,
  },
  {
    id: 20,
    commissionId: 20,
    listingId: 51,
    clientProfileId: 9,
    unit: 'LA-0104',
    client: 'Buyer Two',
    project: 'Bailen Project',
    seller: 'Agent Two',
    sellerGroup: 'North Star Group',
    role: 'Agent',
    rawRole: 'agent',
    commissionType: 'Direct',
    commissionBase: 700000,
    grossCommission: 28000,
    released: 0,
    eligibleToRelease: 0,
    netRemaining: 28000,
    paymentPercent: 10,
  },
];

test('commission lines group into one main record per listing', () => {
  const groups = groupCommissionRecords(sampleRecords);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].unit, 'LA-0103');
  assert.equal(groups[0].sellerCount, 2);
  assert.equal(groups[0].grossCommission, 31500);
  assert.equal(groups[0].released, 5040);
  assert.equal(groups[0].eligibleToRelease, 6300);
  assert.equal(groups[0].netRemaining, 26460);
  assert.deepEqual(groups[0].sellers.map((seller) => seller.seller), ['Agent One', 'Manager One']);
});

test('commission page and modal expose one-row accounts and seller selector', async () => {
  const [pageSource, modalSource, controllerSource] = await Promise.all([
    readFile(new URL('../../client/src/pages/Lot_Projects/Commission.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../../client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../controllers/Lot_Projects/Commissions/Commissions.controller.js', import.meta.url), 'utf8'),
  ]);

  assert.match(pageSource, /One row per unit and buyer/);
  assert.match(pageSource, /\['Unit', 'Client', 'Sellers', 'Group Name', 'Commission Base', 'Total Gross'/);
  assert.match(pageSource, /commissionGroup=\{selected\}/);
  assert.match(modalSource, /Commission Seller/);
  assert.match(modalSource, /Select commission seller/);
  assert.match(modalSource, /commissionGroup\?\.unit/);
  assert.match(controllerSource, /return every commission recipient for the/);
  assert.match(controllerSource, /searchCommission\.lot_project_listing_id = c\.lot_project_listing_id/);
});
