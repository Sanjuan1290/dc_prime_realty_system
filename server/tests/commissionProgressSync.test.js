import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateCommissionPaymentProgress } from '../utils/commissionProgress.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const verified = (amount, type, date = '2026-08-18') => ({
  lot_project_payment_amount: amount,
  lot_project_payment_type: type,
  lot_project_payment_status: 'Verified',
  lot_project_payment_date: date,
});

test('commission progress recognizes earned DP discount without double-counting reservation credit', () => {
  const result = calculateCommissionPaymentProgress({
    terms: {
      tcp: 825000,
      downpaymentDiscountTotal: 22500,
      // 150,000 DP target - 22,500 discount - 50,000 reservation credit.
      downpaymentTotal: 77500,
    },
    payments: [
      verified(77500, 'downpayment'),
      verified(725000, 'monthly'),
    ],
  });

  assert.equal(result.verifiedCash, 802500);
  assert.equal(result.downpaymentPaid, 77500);
  assert.equal(result.earnedDpDiscount, 22500);
  assert.equal(result.settledValue, 825000);
  assert.equal(result.paymentPercent, 100);
  assert.equal(result.remainingBalance, 0);
});

test('commission progress earns DP discount proportionally and historical cutoffs ignore later payments', () => {
  const terms = {
    tcp: 500000,
    downpaymentDiscountTotal: 20000,
    downpaymentTotal: 80000,
  };
  const payments = [
    verified(40000, 'downpayment', '2024-03-01'),
    verified(100000, 'monthly', '2024-03-15'),
    verified(100000, 'monthly', '2024-04-15'),
  ];

  const historical = calculateCommissionPaymentProgress({ terms, payments, cutoffDate: '2024-03-22' });
  assert.equal(historical.earnedDpDiscount, 10000);
  assert.equal(historical.verifiedCash, 140000);
  assert.equal(historical.settledValue, 150000);
  assert.equal(historical.paymentPercent, 30);

  const current = calculateCommissionPaymentProgress({ terms, payments });
  assert.equal(current.verifiedCash, 240000);
  assert.equal(current.paymentPercent, 50);
});

test('fully-paid shortcut remains consistent with the commission screen while cash inconsistencies stay separately auditable', () => {
  const result = calculateCommissionPaymentProgress({
    terms: { tcp: 500000, downpaymentDiscountTotal: 0, downpaymentTotal: 0 },
    payments: [verified(450000, 'monthly')],
    forceFullyPaid: true,
  });

  assert.equal(result.paymentPercent, 100);
  assert.equal(result.settledValue, 500000);
  assert.equal(result.remainingBalance, 0);
});

test('payment and contract mutations synchronize commission progress before completing their transaction path', () => {
  const payments = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
  const service = read('server/services/commissionProgress.service.js');

  assert.match(payments, /commissionProgress\.service\.js/);
  assert.ok((payments.match(/syncCommissionProgressForListing\(connection, listing\)/g) || []).length >= 5);
  assert.match(service, /SET payment_percent = \?/);
  assert.match(service, /WHEN \? >= release_trigger_percent THEN 'Eligible'/);
  assert.match(service, /release_stage = 'Retention'/);
  assert.match(service, /getExistingSoaScheduleRows/);
  assert.match(service, /calculateCommissionPaymentProgress/);
});
