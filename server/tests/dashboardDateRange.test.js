import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDashboardDateRange } from '../controllers/Lot_Projects/Dashboard/Dashboard.controller.js';

test('Admin may load a one-month custom dashboard range', () => {
  const range = resolveDashboardDateRange({ range: 'custom', from: '2026-07-17', to: '2026-07-17' }, 'admin');
  assert.equal(range.from, '2026-07-17');
  assert.equal(range.to, '2026-07-17');
  assert.equal(range.spanMonths, 1);
});


test('custom dashboard ranges preserve exact inclusive start and end dates', () => {
  const range = resolveDashboardDateRange({ range: 'custom', from: '2026-06-01', to: '2026-07-15' }, 'admin');
  assert.equal(range.from, '2026-06-01');
  assert.equal(range.to, '2026-07-15');
});

test('Admin dashboard custom ranges are blocked above 12 calendar months', () => {
  assert.throws(
    () => resolveDashboardDateRange({ range: 'custom', from: '2025-07-01', to: '2026-07-31' }, 'admin'),
    /limited to 12 calendar months/i
  );
});

test('Super Admin may load more than 12 months and receives a warning flag', () => {
  const range = resolveDashboardDateRange({ range: 'custom', from: '2025-01-18', to: '2026-07-03' }, 'super_admin');
  assert.equal(range.from, '2025-01-18');
  assert.equal(range.to, '2026-07-03');
  assert.equal(range.spanMonths, 19);
  assert.equal(range.longRangeWarning, true);
});

test('preset ranges resolve to complete calendar months', () => {
  const range = resolveDashboardDateRange({ range: 'last_month' }, 'admin');
  assert.match(range.from, /^\d{4}-\d{2}-01$/);
  const end = new Date(`${range.to}T00:00:00`);
  const nextDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  assert.equal(nextDay.getDate(), 1);
});
