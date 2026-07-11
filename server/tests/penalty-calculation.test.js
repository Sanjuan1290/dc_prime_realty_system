import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSchedulePenalty } from '../utils/penalty.js';

test('does not charge before or during the grace period', () => {
  const input = { dueDate: '2026-01-10', dueAmount: 10000, ratePercent: 3, graceDays: 5 };
  assert.equal(calculateSchedulePenalty({ ...input, asOfDate: '2026-01-15' }), 0);
});

test('charges one flat period on the first day after grace', () => {
  assert.equal(calculateSchedulePenalty({
    dueDate: '2026-01-10',
    dueAmount: 10000,
    ratePercent: 3,
    graceDays: 5,
    asOfDate: '2026-01-16',
  }), 300);
});

test('charges another flat period when the next calendar month starts', () => {
  assert.equal(calculateSchedulePenalty({
    dueDate: '2026-01-10',
    dueAmount: 10000,
    ratePercent: 3,
    graceDays: 5,
    asOfDate: '2026-02-16',
  }), 600);
});

test('does not compound prior penalties', () => {
  assert.equal(calculateSchedulePenalty({
    dueDate: '2026-01-01',
    dueAmount: 12345.67,
    ratePercent: 2.5,
    graceDays: 0,
    asOfDate: '2026-03-02',
  }), 925.93);
});
