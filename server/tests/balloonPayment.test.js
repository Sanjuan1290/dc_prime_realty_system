import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildBalloonAdjustedMonthlyRows,
  getRemainingUnpaidScheduleBalance,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

const monthlyRows = Array.from({ length: 12 }, (_, index) => ({
  lot_project_payment_schedule_id: index + 1,
  description: `${index + 1} Monthly Payment`,
  due_amount: index === 11 ? 56_608.37 : 56_608.33,
  monthly_amortization_amount: index === 11 ? 56_608.37 : 56_608.33,
  principal_amount: index === 11 ? 56_608.37 : 56_608.33,
  interest_amount: 0,
  amount_paid: 0,
  schedule_status: 'Unpaid',
}));

test('balloon payment reduces financed principal and removes monthly rows from the end', () => {
  const result = buildBalloonAdjustedMonthlyRows(
    monthlyRows,
    {
      financedBalance: 679_300,
      monthlyAmortization: 56_608.33,
      annualInterestRate: 0,
    },
    210_000
  );

  const activeRows = result.rows.filter((row) => !row.cancelled);
  const cancelledRows = result.rows.filter((row) => row.cancelled);

  assert.equal(result.activeTerms, 9);
  assert.equal(cancelledRows.length, 3);
  assert.equal(activeRows.at(-1).dueAmount, 16_433.36);
  assert.equal(
    Math.round(activeRows.reduce((sum, row) => sum + row.principalAmount, 0) * 100) / 100,
    469_300
  );
});

test('cancelled rows are excluded from full-payment balance', () => {
  const rows = [
    { due_amount: 100_000, amount_paid: 20_000, schedule_status: 'Partial' },
    { due_amount: 56_608.33, amount_paid: 0, schedule_status: 'Cancelled' },
  ];

  assert.equal(getRemainingUnpaidScheduleBalance(rows, {}), 80_000);
});

test('balloon payments are not allocated to monthly rows and payment search is removed', async () => {
  const [sharedSource, paymentsSource] = await Promise.all([
    readFile(new URL('../controllers/Lot_Projects/_shared/lotProject.shared.js', import.meta.url), 'utf8'),
    readFile(
      new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx', import.meta.url),
      'utf8'
    ),
  ]);

  assert.match(sharedSource, /Balloon payments are principal reductions/);
  assert.match(sharedSource, /schedule_status <> 'Cancelled'/);
  assert.doesNotMatch(paymentsSource, /Search client, unit, project, reference/);
  assert.doesNotMatch(paymentsSource, /FiSearch/);
});
