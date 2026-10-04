import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePayrollPeriod } from '../services/payrollPeriod.service.js';
import {
  calculateDraftPayrollMoney,
  calculatePayrollRates,
  calculateAttendanceDeduction,
  resolvePayrollAllowances,
} from '../services/payrollCalculation.service.js';
import {
  calculateAttendancePayrollRow,
  summarizeAttendancePayrollRows,
} from '../services/payrollAttendance.service.js';
import { getEffectiveCompensationForPeriod } from '../services/payrollCompensation.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const schedule = {
  scheduledTimeIn: '09:00:00',
  scheduledTimeOut: '20:00:00',
  breakStart: '12:00:00',
  breakMinutes: 60,
  regularWorkingMinutes: 600,
  lateAfter: '09:00:00',
};

test('payroll period resolver uses 1-15 and 16-last calendar day including leap years', () => {
  assert.deepEqual(resolvePayrollPeriod({ month: '2026-09', periodType: 'first_half' }), {
    month: '2026-09', periodType: 'first_half', periodStart: '2026-09-01', periodEnd: '2026-09-15',
    periodLabel: 'September 1, 2026 - September 15, 2026',
  });
  assert.equal(resolvePayrollPeriod({ month: '2026-02', periodType: 'second_half' }).periodEnd, '2026-02-28');
  assert.equal(resolvePayrollPeriod({ month: '2028-02', periodType: 'second_half' }).periodEnd, '2028-02-29');
  assert.equal(resolvePayrollPeriod({ month: '2026-10', periodType: 'second_half' }).periodEnd, '2026-10-31');
});

test('primary receipt benchmark reproduces 49.32 hourly, 1,031.61 deduction and 6,468.39 net', () => {
  const rates = calculatePayrollRates({ monthlyBasicSalary: 15000, regularWorkingMinutes: 600 });
  assert.equal(rates.halfMonthBasic, 7500);
  assert.equal(rates.hourlyRate, 49.32);
  assert.equal(calculateAttendanceDeduction({ tardinessAbsenceMinutes: 1255, hourlyRate: rates.hourlyRate }), 1031.61);

  const draft = calculateDraftPayrollMoney({
    monthlyBasicSalary: 15000,
    regularWorkingMinutes: 600,
    tardinessAbsenceMinutes: 1255,
    periodType: 'first_half',
    riceAllowance: 500,
    transportationAllowance: 500,
  });
  assert.equal(draft.attendanceDeduction, 1031.61);
  assert.equal(draft.riceAllowance, 0);
  assert.equal(draft.transportationAllowance, 0);
  assert.equal(draft.netFundRelease, 6468.39);
});

test('rice and transportation allowances follow the approved first-half and second-half rule', () => {
  assert.deepEqual(resolvePayrollAllowances({
    periodType: 'first_half', riceAllowance: 500, transportationAllowance: 500,
  }), { riceAllowance: 0, transportationAllowance: 0, attendanceBonus: 0 });
  assert.deepEqual(resolvePayrollAllowances({
    periodType: 'second_half', riceAllowance: 500, transportationAllowance: 700,
  }), { riceAllowance: 500, transportationAllowance: 700, attendanceBonus: 0 });
});

test('attendance payroll summary mirrors current attendance semantics for absence, regular work, rest day and holiday', () => {
  const regular = calculateAttendancePayrollRow({
    date: '2026-09-01', attendance: { actual_time_in: '09:00:00', actual_time_out: '20:00:00' },
    restDays: [], daySetting: { day_type: 'regular' }, schedule,
  });
  const absent = calculateAttendancePayrollRow({
    date: '2026-09-02', attendance: null, restDays: [], daySetting: { day_type: 'regular' }, schedule,
  });
  const restWork = calculateAttendancePayrollRow({
    date: '2026-09-06', attendance: { actual_time_in: '09:00:00', actual_time_out: '20:00:00' },
    restDays: ['sunday'], daySetting: { day_type: 'regular' }, schedule,
  });
  const holidayWork = calculateAttendancePayrollRow({
    date: '2026-09-07', attendance: { actual_time_in: '09:00:00', actual_time_out: '20:00:00' },
    restDays: [], daySetting: { day_type: 'regular_holiday' }, schedule,
  });
  const summary = summarizeAttendancePayrollRows({ rows: [regular, absent, restWork, holidayWork], regularWorkingMinutes: 600 });

  assert.equal(regular.regularAttendedSeconds, 600 * 60);
  assert.equal(absent.absence, true);
  assert.equal(restWork.restDayOvertimeSeconds, 600 * 60);
  assert.equal(holidayWork.regularHolidaySeconds, 600 * 60);
  assert.equal(summary.expectedRegularMinutes, 1200);
  assert.equal(summary.regularAttendedMinutes, 600);
  assert.equal(summary.absenceMinutes, 600);
  assert.equal(summary.tardinessAbsenceMinutes, 600);
  assert.equal(summary.restDayOvertimeMinutes, 600);
  assert.equal(summary.regularHolidayMinutes, 600);
});

test('mid-period compensation changes are detected instead of inventing an unapproved proration formula', async () => {
  const connection = {
    async query() {
      return [[
        {
          employee_employment_history_id: 1, employee_id: 7, change_type: 'hired', position: 'Junior', department: 'IT', employment_type: 'probationary',
          monthly_basic_salary: '15000.00', rice_allowance: '500.00', transportation_allowance: '500.00', attendance_bonus: '0.00',
          effective_from: '2026-09-01', effective_to: '2026-09-07',
        },
        {
          employee_employment_history_id: 2, employee_id: 7, change_type: 'promotion', position: 'Developer', department: 'IT', employment_type: 'regular',
          monthly_basic_salary: '20000.00', rice_allowance: '700.00', transportation_allowance: '700.00', attendance_bonus: '0.00',
          effective_from: '2026-09-08', effective_to: null,
        },
      ]];
    },
  };
  await assert.rejects(
    getEffectiveCompensationForPeriod(connection, { employeeId: 7, periodStart: '2026-09-01', periodEnd: '2026-09-15' }),
    (error) => error.code === 'MID_PERIOD_COMPENSATION_CHANGE_BLOCKED'
  );
});

test('Batch 2 adds protected payroll API, historical compensation snapshots and draft-only recalculation', () => {
  const router = read('server/routers/System/employeePayroll.routers.js');
  const server = read('server/server.js');
  const payroll = read('server/services/employeePayroll.service.js');
  const migration = read('server/migrations/20260928_employee_salary_batch2_payroll_engine.sql');
  const permissions = read('server/config/permissions.js');

  assert.match(server, /\/api\/v1\/employee-payroll/);
  assert.match(router, /EMPLOYEE_SALARY_VIEW/);
  assert.match(router, /PAYROLL_GENERATE/);
  assert.match(router, /PAYROLL_RECALCULATE_DRAFT/);
  assert.match(payroll, /EMPLOYEE_PAYROLL_NOT_DRAFT/);
  assert.match(payroll, /employment_history_id/);
  assert.match(payroll, /attendance_breakdown_json/);
  assert.match(migration, /net_fund_release/);
  assert.match(permissions, /employee_salary\.view/);
  assert.match(permissions, /employee_salary\.generate/);
  assert.match(permissions, /employee_salary\.recalculate_draft/);
});

test('Batch 2 records premium hours without hard-coding money multipliers; later approved Payroll Settings remain optional', () => {
  const calculator = read('server/services/payrollCalculation.service.js');
  assert.match(calculator, /regularOtMultiplier === null \? 0/);
  assert.match(calculator, /restDayOtMultiplier === null \? 0/);
  assert.match(calculator, /regularHolidayMultiplier === null \? 0/);
  assert.match(calculator, /specialHolidayMultiplier === null \? 0/);
  assert.match(calculator, /nightDifferentialPercentage === null \? 0/);
  assert.doesNotMatch(calculator, /const regularOtMultiplier = 1\.25|const restDayOtMultiplier = 1\.30|const regularHolidayMultiplier = 2\.00|const nightDifferentialPercentage = 10/);
});
