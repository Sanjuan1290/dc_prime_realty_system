import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  COMMISSION_RELEASE_STAGES,
  roundCommissionMoney,
} from '../controllers/Lot_Projects/Commissions/commissionHierarchy.service.js';

test('commission release stages total exactly 100 percent', () => {
  const total = COMMISSION_RELEASE_STAGES.reduce(
    (sum, stage) => sum + Number(stage.percent || 0),
    0
  );

  assert.equal(total, 100);
});

test('second release is a 40 percent cumulative milestone but only a 20 percent new tranche', () => {
  const second = COMMISSION_RELEASE_STAGES.find((stage) => stage.stage === '2nd Release');
  const grossCommission = 31200;
  const firstReleased = roundCommissionMoney(grossCommission * 0.20);
  const secondTranche = roundCommissionMoney(grossCommission * (second.percent / 100));
  const cumulativeTarget = roundCommissionMoney(grossCommission * (second.trigger / 100));

  assert.equal(second.trigger, 40);
  assert.equal(second.percent, 20);
  assert.equal(firstReleased, 6240);
  assert.equal(secondTranche, 6240);
  assert.equal(cumulativeTarget, 12480);
  assert.equal(firstReleased + secondTranche, cumulativeTarget);
});

test('income report and receipt show tranche and cumulative values separately', async () => {
  const [pageSource, receiptSource, controllerSource] = await Promise.all([
    readFile(new URL('../../client/src/pages/System/Accredited.jsx', import.meta.url), 'utf8'),
    readFile(
      new URL(
        '../../client/src/components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage.jsx',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(new URL('../controllers/System/accredited.controller.js', import.meta.url), 'utf8'),
  ]);

  assert.match(pageSource, /This Release/);
  assert.match(pageSource, /Cumulative Gross/);
  assert.match(pageSource, /% tranche · .*% cumulative/);
  assert.match(receiptSource, /TRANCHE RELEASE/);
  assert.match(receiptSource, /CUMULATIVE OF 100%/);
  assert.match(receiptSource, /CUMULATIVE GROSS TARGET/);
  assert.match(controllerSource, /release_trigger_percent/);
  assert.match(controllerSource, /cumulativeGrossTarget/);
});

