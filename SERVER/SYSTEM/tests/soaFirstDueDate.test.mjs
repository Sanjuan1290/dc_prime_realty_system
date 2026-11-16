import test from 'node:test';
import assert from 'node:assert/strict';
import {locksSoaFirstDueDate, planSoaDueDateUpdates} from '../services/soaFirstDueDate.service.js';
import {locksSoaFirstDueDate as clientLocksFirstDueDate} from '../../../CLIENT/SYSTEM/src/utils/soaFirstDueDate.js';

test('First Due Date uses actual installment payments, independently of reservation credits', () => {
  const fixtures = [
    [{type: 'Reservation', status: 'Verified', reservationFeeAppliedToDownpayment: true}, false],
    [{lot_project_payment_type: 'reservation', lot_project_payment_status: 'Verified'}, false],
    [{type: 'Downpayment', status: 'Verified'}, true],
    [{paymentTypeValue: 'downpayment', status: 'Pending'}, true],
    [{type: 'down_payment'}, true],
    [{type: 'Downpayment', status: 'Cancelled'}, false],
    [{type: 'Downpayment', status: 'Rejected'}, false],
    [{type: 'Downpayment', status: 'Voided'}, false],
    [{type: 'Monthly Amortization'}, true],
    [{paymentTypeValue: 'full_payment'}, true],
    [{type: 'Advance Payment'}, true],
    [{type: 'Legal / Misc Fee'}, false],
    [{type: 'Balloon'}, false],
  ];
  for (const [payment, expected] of fixtures) {
    assert.equal(locksSoaFirstDueDate(payment), expected, JSON.stringify(payment));
    assert.equal(clientLocksFirstDueDate(payment), expected, 'Client/server policy must agree');
  }
});

test('Changing First Due Date retains row identities and reservation allocations', () => {
  const existing = [
    {lot_project_payment_schedule_id: 1, description: 'Reservation Fee', due_date: '2026-11-16', amount_paid: 50000},
    {lot_project_payment_schedule_id: 2, description: '1st Downpayment', due_date: '2026-11-16', amount_paid: 50000, schedule_status: 'Partial'},
    {lot_project_payment_schedule_id: 3, description: '2nd Downpayment', due_date: '2026-12-16', amount_paid: 0},
    {lot_project_payment_schedule_id: 4, description: '1st Monthly Payment', due_date: '2027-01-16', amount_paid: 0},
    {lot_project_payment_schedule_id: 5, description: 'Legal / Misc Fee', due_date: null, amount_paid: 0},
    {lot_project_payment_schedule_id: 6, description: 'Balloon Payment', due_date: '2026-11-16', amount_paid: 10000},
  ];
  const snapshot = structuredClone(existing);
  const computed = [
    {description: 'Reservation Fee', dueDate: '2026-11-16'},
    {description: '1st Downpayment', dueDate: '2026-12-01'},
    {description: '2nd Downpayment', dueDate: '2027-01-01'},
    {description: '1st Monthly Payment', dueDate: '2027-02-01'},
    {description: 'Legal / Misc Fee', dueDate: null},
  ];
  assert.deepEqual(planSoaDueDateUpdates(existing, computed), [
    {id: 2, dueDate: '2026-12-01'}, {id: 3, dueDate: '2027-01-01'}, {id: 4, dueDate: '2027-02-01'},
  ]);
  assert.deepEqual(existing, snapshot);
});

test('An inconsistent existing schedule cannot silently replace paid rows', () => {
  assert.throws(() => planSoaDueDateUpdates([], [{description: '1st Downpayment', dueDate: '2026-12-01'}]), {statusCode: 409});
  assert.throws(() => planSoaDueDateUpdates(
    [{lot_project_payment_schedule_id: 2, description: '1st Downpayment'}],
    [{description: '1st Downpayment', dueDate: null}],
  ), {statusCode: 400});
});
