import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolvePayrollPeriod, payrollPayday } from '../services/payrollPeriod.service.js';
import { getEffectiveCompensationForPeriod } from '../services/payrollCompensation.service.js';
import { validatePayrollSettingsPayload, normalizePayrollSettingsSnapshot } from '../services/payrollSettings.service.js';
import { computeNewHireWorkdayFraction } from '../services/payrollNewHireProration.service.js';
import { calculateDraftPayrollMoney } from '../services/payrollCalculation.service.js';
import { validatePayrollReleaseInput } from '../services/payrollRelease.service.js';

const root = new URL('../../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const history = ({ from = '2026-10-12', to = null } = {}) => ({ employee_employment_history_id: 1, employee_id: 1, monthly_basic_salary: 15000, rice_allowance: 500, transportation_allowance: 500, effective_from: from, effective_to: to });
const connection = (rows) => ({ query: async () => [rows] });

test('Render prestart import is supplied and exposes the actual controller API', async () => {
  const source = read('SERVER/SYSTEM/services/payrollReadiness.service.js');
  assert.match(source, /export const assessPayrollReadiness/);
  const readiness = await import('../services/payrollReadiness.service.js');
  assert.equal(typeof readiness.assessPayrollReadiness, 'function');
});

test('standard paydays are 22nd in same month and 7th in following month across leap days/year boundary', () => {
  assert.equal(payrollPayday({ month: '2026-10', periodType: 'first_half' }), '2026-10-22');
  assert.equal(payrollPayday({ month: '2026-10', periodType: 'second_half' }), '2026-11-07');
  assert.equal(payrollPayday({ month: '2026-12', periodType: 'second_half' }), '2027-01-07');
  assert.equal(resolvePayrollPeriod({ month: '2028-02', periodType: 'second_half' }).periodEnd, '2028-02-29');
  assert.equal(payrollPayday({ month: '2028-02', periodType: 'second_half' }), '2028-03-07');
  assert.equal(payrollPayday({ month: '2028-02', periodType: 'first_half', firstHalfDay: 23 }), '2028-02-23');
  assert.throws(() => payrollPayday({ month: '2028-02', periodType: 'first_half', firstHalfDay: 7 }), /first-half payday/);
});

test('settings default to 7/22 and enabled first-period proration, reject unsupported configuration', () => {
  const settings = normalizePayrollSettingsSnapshot({});
  assert.equal(settings.first_half_payday, 22);
  assert.equal(settings.second_half_payday, 7);
  assert.equal(settings.new_hire_proration_rule, 'scheduled_workdays');
  assert.equal(validatePayrollSettingsPayload({ new_hire_proration_rule: 'scheduled_workdays' }).new_hire_proration_rule, 'scheduled_workdays');
  assert.throws(() => validatePayrollSettingsPayload({ first_half_payday: 7 }), /First-Half Payday/);
  assert.throws(() => validatePayrollSettingsPayload({ second_half_payday: 31 }), /Second-Half Payday/);
  assert.throws(() => validatePayrollSettingsPayload({ new_hire_proration_rule: 'calendar_days' }), /supported new-hire/);
});

test('a first-hire record mid-period is blocked by default but allowed after explicit policy approval', async () => {
  const args = { employeeId: 1, periodStart: '2026-10-01', periodEnd: '2026-10-15', hireDate: '2026-10-12' };
  await assert.rejects(() => getEffectiveCompensationForPeriod(connection([history()]), args), { code: 'PARTIAL_PERIOD_COMPENSATION_BLOCKED' });
  const allowed = await getEffectiveCompensationForPeriod(connection([history()]), { ...args, newHireProrationRule: 'scheduled_workdays' });
  assert.equal(allowed.payroll_new_hire_start, '2026-10-12');
  await assert.rejects(() => getEffectiveCompensationForPeriod(connection([history({ from: '2026-10-09' })]), { ...args, newHireProrationRule: 'scheduled_workdays' }), { code: 'PARTIAL_PERIOD_COMPENSATION_BLOCKED' });
  await assert.rejects(() => getEffectiveCompensationForPeriod(connection([history({ from: '2026-10-01' }),history()]), { ...args, newHireProrationRule: 'scheduled_workdays' }), { code: 'MID_PERIOD_COMPENSATION_CHANGE_BLOCKED' });
});

test('new-hire scheduled workday fraction uses hire-date rest schedule for entire half-month and excludes prehire work', () => {
  const d = computeNewHireWorkdayFraction({ periodStart: '2026-10-01', periodEnd: '2026-10-15', hireDate: '2026-10-12', restDays: ['tuesday','wednesday','thursday'] });
  assert.equal(d.allDays, 8);
  assert.equal(d.eligibleDays, 1);
  assert.equal(d.fraction, 1/8);
  assert.throws(() => computeNewHireWorkdayFraction({ periodStart: '2026-10-01', periodEnd: '2026-10-15', hireDate: '2026-10-12', restDays: [] }), /Rest Days/);
  const pay = calculateDraftPayrollMoney({ monthlyBasicSalary: 15000, regularWorkingMinutes: 600, tardinessAbsenceMinutes: 0, periodType: 'first_half', riceAllowance: 500, transportationAllowance: 500, prorationFraction: d.fraction });
  assert.equal(pay.halfMonthBasic, 937.50);
  assert.equal(pay.netFundRelease, 937.50);
  assert.equal(pay.hourlyRate, 86.54);
});

test('source enforces prehire Attendance exclusion, future-hire block, and release safety', () => {
  const service = read('SERVER/SYSTEM/services/employeePayroll.service.js');
  assert.match(service, /dateFrom: partialStart \|\| normalizedPeriod.periodStart/);
  assert.match(service, /NEW_HIRE_PRORATION_NOT_APPROVED/);
  assert.match(service, /NEW_HIRE_COMPENSATION_DATE_MISMATCH/);
  assert.match(service, /FUTURE_EMPLOYEE_START/);
  const migration = read('SERVER/SYSTEM/migrations/20261012_payroll_schedule_and_new_hire_policy.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS scheduled_release_date/);
  assert.doesNotMatch(migration, /DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i);
  const payroll = { employee_payroll_id: 5, payroll_status: 'finalized', finalized_snapshot: { net_fund_release: 100 }, period_end: '2026-10-15' };
  assert.throws(() => validatePayrollReleaseInput({ payroll, releasedByUserId: 1, releaseDate: '2026-10-12' }), /before the payroll period ends/);
  assert.throws(() => validatePayrollReleaseInput({ payroll, releasedByUserId: 1, releaseDate: '2099-12-01' }), /cannot be in the future/);
});



