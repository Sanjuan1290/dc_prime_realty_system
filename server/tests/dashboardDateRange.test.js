import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDashboardDateRange } from '../controllers/Lot_Projects/Dashboard/Dashboard.controller.js';

const admin1 = { role: 'admin', admin_type: 'admin_1' };
const superAdmin = { role: 'super_admin', admin_type: null };

test('Admin 1 may load a one-month custom dashboard range', () => {
  const range = resolveDashboardDateRange({ range: 'custom', from: '2026-07-17', to: '2026-07-17' }, admin1);
  assert.equal(range.from, '2026-07-17');
  assert.equal(range.to, '2026-07-17');
  assert.equal(range.spanMonths, 1);
});

test('custom dashboard ranges preserve exact inclusive start and end dates', () => {
  const range = resolveDashboardDateRange({ range: 'custom', from: '2026-06-01', to: '2026-07-15' }, admin1);
  assert.equal(range.from, '2026-06-01');
  assert.equal(range.to, '2026-07-15');
});

test('Admin 1 may load exactly 12 months or one year', () => {
  const range = resolveDashboardDateRange({ range: 'custom', from: '2025-07-31', to: '2026-07-30' }, admin1);
  assert.equal(range.from, '2025-07-31');
  assert.equal(range.to, '2026-07-30');
});

test('Admin 1 dashboard custom ranges are blocked above 12 months or one year', () => {
  assert.throws(
    () => resolveDashboardDateRange({ range: 'custom', from: '2025-07-31', to: '2026-07-31' }, admin1),
    /Admin 1 dashboard reports are limited to 12 months \(1 year\)/i
  );
});

test('Super Admin may load more than 12 months and receives a warning flag', () => {
  const range = resolveDashboardDateRange({ range: 'custom', from: '2025-01-18', to: '2026-07-03' }, superAdmin);
  assert.equal(range.from, '2025-01-18');
  assert.equal(range.to, '2026-07-03');
  assert.equal(range.spanMonths, 19);
  assert.equal(range.longRangeWarning, true);
});

test('preset ranges resolve to complete calendar months', () => {
  const range = resolveDashboardDateRange({ range: 'last_month' }, admin1);
  assert.match(range.from, /^\d{4}-\d{2}-01$/);
  const end = new Date(`${range.to}T00:00:00`);
  const nextDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  assert.equal(nextDay.getDate(), 1);
});
