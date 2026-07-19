import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  getFullPaymentAmount,
  getRowUnpaidAmount,
} from '../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/paymentAmountUtils.js';
import {
  getRemainingUnpaidScheduleBalance,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

test('full payment amount adds every unpaid SOA row', () => {
  const rows = [
    { totalDue: 50_000, amountPaid: 50_000 },
    { totalDue: 150_000, amountPaid: 25_000 },
    { dueAmount: 80_000, discountAmount: 5_000, interest: 2_000, penalty: 1_000, amountPaid: 8_000 },
  ];

  assert.equal(getRowUnpaidAmount(rows[1]), 125_000);
  assert.equal(getFullPaymentAmount(rows), 195_000);
});

test('editing a payment restores its current amount before calculating full payment', () => {
  const rows = [
    { totalDue: 100_000, amountPaid: 60_000 },
    { totalDue: 50_000, amountPaid: 0 },
  ];

  assert.equal(getFullPaymentAmount(rows, 20_000), 110_000);
});

test('backend full payment balance matches stored SOA values', () => {
  const storedRows = [
    { due_amount: 100_000, interest_amount: 0, penalty_amount: 0, amount_paid: 30_000 },
    { due_amount: 60_000, interest_amount: 5_000, penalty_amount: 2_000, amount_paid: 7_000 },
  ];

  assert.equal(getRemainingUnpaidScheduleBalance(storedRows, {}), 125_000);
});

test('full payment UI locks amount and submits without a preferred row', async () => {
  const source = await readFile(
    new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /disabled=\{isFullPayment\}/);
  assert.match(source, /soaRowId: isBalloonPayment \|\| isFullPayment \? null/);
  assert.match(source, /Full Payment covers every unpaid SOA row/);
});

