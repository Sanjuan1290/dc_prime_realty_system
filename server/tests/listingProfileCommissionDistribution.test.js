import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), 'utf8');

test('listing profile exposes saved commission distribution details', async () => {
  const [unitStatusSource, distributionSource, controllerSource] = await Promise.all([
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/CommissionDistribution.jsx'),
    readSource('../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js'),
  ]);

  assert.match(distributionSource, /Saved Commission Distribution/);
  assert.match(unitStatusSource, /CommissionDistribution[\s\S]*rows=\{commissionRows\}/);
  assert.match(distributionSource, /Commission Base/);
  assert.match(distributionSource, /Gross Commission/);
  assert.match(distributionSource, /Released/);
  assert.match(distributionSource, /Deductions/);
  assert.match(distributionSource, /Remaining/);
  assert.match(distributionSource, /Commission Type/);
  assert.match(distributionSource, /Reports Under/);
  assert.match(controllerSource, /cashAdvanceDeduction/);
  assert.match(controllerSource, /remainingAmount/);
  assert.match(controllerSource, /commissionType/);
  assert.match(controllerSource, /commissionSnapshot\.releaseRows/);
});

