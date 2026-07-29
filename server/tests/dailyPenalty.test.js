import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScheduleDailyPenalty } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

const profile = {
  soa_penalty_calculation_method: 'daily',
  soa_penalty_rate_percent: 0.1,
  soa_penalty_grace_days: 1,
};

const schedule = {
  lot_project_payment_schedule_id: 1,
  due_date: '2026-07-01',
  description: '1st Monthly Payment',
  due_amount: 10000,
  penalty_amount: 0,
  amount_paid: 0,
  schedule_status: 'Unpaid',
};

test('daily penalty starts after the grace period and includes the statement date', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    asOfDate: '2026-07-05',
  });

  assert.equal(result.penaltyStartDate, '2026-07-03');
  assert.equal(result.calculatedPenaltyAmount, 30);
  assert.equal(result.penaltyAmount, 30);
});

test('zero grace period starts penalty on the day after the due date', () => {
  const resultOnDueDate = calculateScheduleDailyPenalty({
    row: { ...schedule, due_date: '2026-07-13' },
    clientProfile: { ...profile, soa_penalty_grace_days: 0 },
    asOfDate: '2026-07-13',
  });

  const resultNextDay = calculateScheduleDailyPenalty({
    row: { ...schedule, due_date: '2026-07-13' },
    clientProfile: { ...profile, soa_penalty_grace_days: 0 },
    asOfDate: '2026-07-14',
  });

  assert.equal(resultOnDueDate.penaltyStartDate, '2026-07-14');
  assert.equal(resultOnDueDate.calculatedPenaltyAmount, 0);
  assert.equal(resultNextDay.penaltyStartDate, '2026-07-14');
  assert.equal(resultNextDay.calculatedPenaltyAmount, 10);
});

test('partial payment keeps the payment-day penalty before reducing the base', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    allocations: [
      {
        lot_project_payment_id: 1,
        payment_date: '2026-07-04',
        applied_amount: 4000,
      },
    ],
    asOfDate: '2026-07-05',
  });

  assert.equal(result.calculatedPenaltyAmount, 26.02);
  assert.equal(result.paidPenaltyAmount, 20);
  assert.equal(result.unpaidBaseAmount, 6020);
  assert.equal(result.outstandingPenaltyAmount, 6.02);
});

test('paid penalty remains in the accumulated total after full payment', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    allocations: [
      {
        lot_project_payment_id: 30,
        payment_date: '2026-07-03',
        applied_amount: 10010,
      },
    ],
    asOfDate: '2026-07-03',
  });

  assert.equal(result.calculatedPenaltyAmount, 10);
  assert.equal(result.penaltyAmount, 10);
  assert.equal(result.paidPenaltyAmount, 10);
  assert.equal(result.outstandingPenaltyAmount, 0);
  assert.equal(result.unpaidBaseAmount, 0);
});

test('active extension temporarily suppresses penalty', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 5,
        relief_type: 'penalty_free_extension',
        promised_payment_date: '2026-07-05',
        status: 'active',
        reason: 'Client promised payment.',
        created_at: '2026-07-02 09:00:00',
      },
    ],
    asOfDate: '2026-07-04',
  });

  assert.equal(result.penaltyAmount, 0);
  assert.equal(result.activeExtension.status, 'active');
});

test('broken extension restores the penalty from the original start date', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 5,
        relief_type: 'penalty_free_extension',
        promised_payment_date: '2026-07-05',
        status: 'active',
        reason: 'Client promised payment.',
        created_at: '2026-07-02 09:00:00',
      },
    ],
    asOfDate: '2026-07-06',
  });

  assert.equal(result.activeExtension.status, 'broken');
  assert.equal(result.calculatedPenaltyAmount, 40);
});

test('waiver reduces the penalty without changing the calculated amount', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 7,
        relief_type: 'partial_waiver',
        relief_amount: 10,
        status: 'active',
        reason: 'Approved partial waiver.',
        created_at: '2026-07-05 08:00:00',
      },
    ],
    asOfDate: '2026-07-05',
  });

  assert.equal(result.calculatedPenaltyAmount, 30);
  assert.equal(result.waivedPenaltyAmount, 10);
  assert.equal(result.penaltyAmount, 20);
});

test('future SOA rows cannot receive a penalty-free extension yet', () => {
  const result = calculateScheduleDailyPenalty({
    row: { ...schedule, due_date: '2026-07-10' },
    clientProfile: profile,
    asOfDate: '2026-07-01',
  });

  assert.equal(result.canGrantExtension, false);
});

test('full payment by the promised date honors the extension and keeps penalty at zero', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    allocations: [
      {
        lot_project_payment_id: 2,
        payment_date: '2026-07-05',
        applied_amount: 10000,
      },
    ],
    reliefs: [
      {
        penalty_relief_id: 8,
        relief_type: 'penalty_free_extension',
        promised_payment_date: '2026-07-05',
        status: 'active',
        reason: 'Client promised payment.',
        created_at: '2026-07-02 09:00:00',
      },
    ],
    asOfDate: '2026-07-06',
  });

  assert.equal(result.activeExtension.status, 'honored');
  assert.equal(result.penaltyAmount, 0);
  assert.equal(result.unpaidBaseAmount, 0);
});

test('extension preserves penalty accrued before the grant date', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 20,
        relief_type: 'penalty_free_extension',
        promised_payment_date: '2026-07-06',
        status: 'active',
        reason: 'Extension granted after penalty started.',
        created_at: '2026-07-04 09:00:00',
      },
    ],
    asOfDate: '2026-07-05',
  });

  assert.equal(result.activeExtension.status, 'active');
  assert.equal(result.calculatedPenaltyAmount, 10);
  assert.equal(result.penaltyAmount, 10);
});

test('broken extension can be granted again while the installment remains unpaid', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 21,
        relief_type: 'penalty_free_extension',
        promised_payment_date: '2026-07-04',
        status: 'active',
        reason: 'First promise.',
        created_at: '2026-07-02 09:00:00',
      },
    ],
    asOfDate: '2026-07-06',
  });

  assert.equal(result.activeExtension.status, 'broken');
  assert.equal(result.canGrantExtension, true);
});

test('penalty correction resets the current amount and allows later accrual', () => {
  const onCorrectionDate = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 30,
        relief_type: 'penalty_correction',
        relief_amount: 30,
        status: 'active',
        reason: 'Payment was entered late.',
        created_at: '2026-07-05 09:00:00',
      },
    ],
    asOfDate: '2026-07-05',
  });

  const afterCorrection = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 30,
        relief_type: 'penalty_correction',
        relief_amount: 30,
        status: 'active',
        reason: 'Payment was entered late.',
        created_at: '2026-07-05 09:00:00',
      },
    ],
    asOfDate: '2026-07-07',
  });

  assert.equal(onCorrectionDate.calculatedPenaltyAmount, 0);
  assert.equal(afterCorrection.calculatedPenaltyAmount, 20);
});

test('restoring a penalty correction recalculates the full late period', () => {
  const result = calculateScheduleDailyPenalty({
    row: schedule,
    clientProfile: profile,
    reliefs: [
      {
        penalty_relief_id: 30,
        relief_type: 'penalty_correction',
        relief_amount: 30,
        status: 'restored',
        reason: 'Payment was entered late.',
        created_at: '2026-07-05 09:00:00',
      },
      {
        penalty_relief_id: 31,
        relief_type: 'restoration',
        relief_amount: 30,
        restores_penalty_relief_id: 30,
        status: 'active',
        reason: 'Correction was applied by mistake.',
        created_at: '2026-07-06 09:00:00',
      },
    ],
    asOfDate: '2026-07-07',
  });

  assert.equal(result.calculatedPenaltyAmount, 50);
});
