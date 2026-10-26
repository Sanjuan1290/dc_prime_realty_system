import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateAttendancePayrollRow, summarizeAttendancePayrollRows } from '../services/payrollAttendance.service.js';
import { calculateDraftPayrollMoney, calculatePayrollRates } from '../services/payrollCalculation.service.js';
import { buildFundReleaseReceipt } from '../services/payrollReceipt.service.js';
import { explainPayrollRates } from '../../client/src/components/System/employeeSalaryComponents/payrollRateExplanation.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const schedule = {
  scheduledTimeIn: '09:00:00', scheduledTimeOut: '20:00:00',
  breakStart: '12:00:00', breakMinutes: 60,
  regularWorkingMinutes: 600, lateAfter: '09:00:00',
};
const punches = {
  '2026-10-02': ['09:00:00', '20:00:00'], '2026-10-03': ['09:00:00', '20:00:00'],
  '2026-10-04': ['09:00:00', '20:00:00'], '2026-10-05': ['09:00:00', '20:00:00'],
  '2026-10-09': ['09:10:00', '20:00:00'], '2026-10-10': ['09:10:00', '20:00:00'],
  '2026-10-11': ['09:20:00', '20:00:00'],
};
const days = Array.from({ length: 15 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
const rows = days.map((date) => calculateAttendancePayrollRow({
  date,
  attendance: punches[date] ? { actual_time_in: punches[date][0], actual_time_out: punches[date][1] } : null,
  restDays: ['tuesday', 'wednesday', 'thursday'],
  daySetting: { day_type: 'regular' }, schedule,
}));
const summary = summarizeAttendancePayrollRows({ rows, regularWorkingMinutes: schedule.regularWorkingMinutes });

test('four 10-hour workdays are 40 regular hours per week, not automatically overtime', () => {
  assert.equal(rows.filter(row => row.scheduledDay).length, 8);
  assert.equal(rows.filter(row => row.state === 'regular_work').length, 7);
  assert.equal(rows.filter(row => row.absence).length, 1);
  assert.equal(summary.expectedRegularMinutes, 4800); // 80h
  assert.equal(summary.regularAttendedMinutes, 4160); // 69h20m
  assert.equal(summary.totalWorkedMinutes, 4160);
  assert.equal(summary.overtimeMinutes, 0);
  assert.equal(summary.restDayOvertimeMinutes, 0);
  assert.equal(summary.lateMinutes, 40);
  assert.equal(summary.absenceMinutes, 600);
  assert.equal(summary.tardinessAbsenceMinutes, 640);
  assert.equal(rows.find(row => row.date === '2026-10-02').regularAttendedSeconds, 36000);
});

test('10-hour absence is deducted at the unchanged 8-hour divisor rate', () => {
  const rate = calculatePayrollRates({ monthlyBasicSalary: 15000, regularWorkingMinutes: 600 });
  assert.equal(rate.hourlyRate, 86.54);
  assert.equal(rate.regularHoursPerDay, 8);
  const result = calculateDraftPayrollMoney({ monthlyBasicSalary: 15000,
    regularWorkingMinutes: 600, tardinessAbsenceMinutes: summary.tardinessAbsenceMinutes,
    periodType: 'first_half' });
  assert.equal(result.halfMonthBasic, 7500);
  assert.equal(result.attendanceDeduction, 923.09);
  assert.equal(result.netFundRelease, 6576.91);
});

test('new draft and readiness use 10-hour schedule but preserve 8-hour pay divisor', () => {
  const draft = read('server/services/employeePayroll.service.js');
  const ready = read('server/services/payrollReadiness.service.js');
  const correction = read('server/services/payrollCorrection.service.js');
  const final = read('server/services/payrollFinalization.service.js');
  assert.match(draft, /employee-salary-260days-compressed-shift-v3/);
  assert.doesNotMatch(draft, /paidWorkMinutesOverride: PAYROLL_PAID_WORK_MINUTES/);
  assert.doesNotMatch(ready, /paidWorkMinutesOverride: PAYROLL_PAID_WORK_MINUTES/);
  assert.match(correction, /regularWorkingMinutes: attendance.schedule.regularWorkingMinutes/);
  assert.match(final, /paidWorkMinutesOverride: \/\^employee-salary-260days-8hours-/);
  assert.match(final, /employee-salary-260days-compressed-shift-/);
});

test('receipt and salary explanation accurately show the 10-hour shift and 8-hour rate divisor', () => {
  const receipt = buildFundReleaseReceipt({
    payroll_status: 'draft', calculation_version: 'employee-salary-260days-compressed-shift-v3',
    regular_working_minutes_snapshot: 600, monthly_salary_snapshot: 15000,
    daily_rate: 692.307692, hourly_rate_snapshot: 86.54,
    half_month_basic: 7500, attendance_deduction: 923.09, net_fund_release: 6576.91,
    expected_regular_minutes: 4800, regular_attended_minutes: 4160,
    tardiness_absence_minutes: 640,
    attendance_breakdown: rows.map(row => ({
      date: row.date, total_worked_minutes: Math.round(row.totalWorkedSeconds / 60),
      scheduled_attendance_minutes: row.scheduledDay ? 600 : 0,
      unclassified_extra_minutes: 0,
    })),
  });
  assert.equal(receipt.compressed_shift, true);
  assert.equal(receipt.total_regular_hours, 80);
  assert.equal(receipt.total_regular_hours_attended, 69.33);
  assert.equal(receipt.actual_worked_minutes, 4160);
  assert.equal(receipt.unclassified_extra_minutes, 0);
  assert.equal(receipt.total, 6576.91);
  const explanation = explainPayrollRates({
    monthly_salary_snapshot: 15000, daily_rate: 692.307692,
    hourly_rate_snapshot: 86.54, regular_working_minutes_snapshot: 600,
    tardiness_absence_minutes: 640, attendance_deduction: 923.09,
  });
  assert.equal(explanation.workHours, 10);
  assert.equal(explanation.hourlyBasisHours, 8);
  assert.equal(explanation.hourlyMatchesDaily, true);
});

test('correction UI is a single form but history and stale-snapshot protection remain', () => {
  const ui = read('client/src/components/System/employeeSalaryComponents/CorrectPayrollModal.jsx');
  const service = read('server/services/payrollCorrection.service.js');
  assert.match(ui, /Update Finalized Salary/);
  assert.match(ui, /reason: reason.trim\(\)/);
  assert.match(ui, /review_hash: review.review_hash/);
  assert.doesNotMatch(ui, /Final Double-Check|Before vs After|confirmed &&/);
  assert.match(service, /PAYROLL_CORRECTION_REVIEW_STALE/);
  assert.match(service, /INSERT INTO employee_payroll_corrections/);
  assert.match(service, /before_snapshot_json, after_snapshot_json/);
});
