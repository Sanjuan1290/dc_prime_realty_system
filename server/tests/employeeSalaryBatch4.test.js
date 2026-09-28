import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFinalizedPayrollSnapshot,
  buildPayrollAttendanceFingerprintPayload,
  compareAttendanceFingerprints,
  hashPayrollAttendanceFingerprint,
} from '../services/payrollFinalization.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const basePayroll = {
  employee_payroll_id: 12,
  employee_id: 7,
  employment_history_id: 3,
  period_label: 'September 1, 2026 - September 15, 2026',
  period_start: '2026-09-01',
  period_end: '2026-09-15',
  period_type: 'first_half',
  employee_name_snapshot: 'ROBERT RENBY C. SAN JUAN',
  position_snapshot: 'Junior IT & Systems Developer',
  department_snapshot: 'IT',
  employment_status_snapshot: 'probationary',
  monthly_salary_snapshot: 15000,
  half_month_basic: 7500,
  daily_rate: 493.150684,
  hourly_rate_snapshot: 49.32,
  minute_rate: 0.822,
  regular_working_minutes_snapshot: 600,
  attendance_calculated_through: '2026-09-15',
  expected_regular_minutes: 4620,
  regular_attended_minutes: 3543,
  pto_minutes: 0,
  regular_holiday_minutes: 0,
  special_holiday_minutes: 0,
  late_minutes: 655,
  absence_minutes: 600,
  tardiness_absence_minutes: 1255,
  overtime_minutes: 0,
  rest_day_overtime_minutes: 0,
  night_differential_minutes: 0,
  attendance_deduction: 1031.61,
  overtime_pay: 0,
  rest_day_overtime_pay: 0,
  regular_holiday_pay: 0,
  special_holiday_pay: 0,
  night_differential_pay: 0,
  rice_allowance: 0,
  transportation_allowance: 0,
  attendance_bonus: 0,
  manual_additions_total: 0,
  manual_deductions_total: 0,
  net_fund_release: 6468.39,
  calculation_version: 'employee-salary-batch2-v1',
  calculation_warnings: [],
  attendance_breakdown: [{
    date: '2026-09-01', state: 'regular_work', day_type: 'regular', time_in: '09:00:00', time_out: '20:00:00',
    scheduled_day: true, absence: false, regular_attended_minutes: 600, late_minutes: 0, overtime_minutes: 0,
    rest_day_overtime_minutes: 0, regular_holiday_minutes: 0, special_holiday_minutes: 0,
  }],
};

test('Batch 4 finalized snapshot freezes the payroll values used by the future receipt', () => {
  const snapshot = buildFinalizedPayrollSnapshot(basePayroll);
  assert.equal(snapshot.employee.name, 'ROBERT RENBY C. SAN JUAN');
  assert.equal(snapshot.employee.position, 'Junior IT & Systems Developer');
  assert.equal(snapshot.compensation.monthly_basic, 15000);
  assert.equal(snapshot.compensation.half_month_basic, 7500);
  assert.equal(snapshot.deductions.attendance_deduction, 1031.61);
  assert.equal(snapshot.net_fund_release, 6468.39);
  assert.equal(snapshot.attendance.tardiness_absence_minutes, 1255);
});

test('Batch 4 attendance fingerprint changes when current Attendance changes', () => {
  const original = buildPayrollAttendanceFingerprintPayload({
    attendanceCalculatedThrough: '2026-09-15', regularWorkingMinutes: 600,
    summary: basePayroll, rows: basePayroll.attendance_breakdown,
  });
  const changed = structuredClone(original);
  changed.summary.tardiness_absence_minutes = 1200;
  changed.rows[0].time_in = '08:55:00';
  assert.notEqual(hashPayrollAttendanceFingerprint(original), hashPayrollAttendanceFingerprint(changed));
  const differences = compareAttendanceFingerprints({ finalizedPayload: original, currentPayload: changed });
  assert.ok(differences.some((item) => item.field === 'tardiness_absence_minutes'));
});

test('Batch 4 adds dedicated finalization endpoints and permission', () => {
  const router = read('server/routers/System/employeePayroll.routers.js');
  const permissions = read('server/config/permissions.js');
  const controller = read('server/controllers/System/Employees/EmployeePayroll.controller.js');
  const migration = read('server/migrations/20260928_employee_salary_batch4_finalization.sql');

  assert.match(router, /final-review'.*PAYROLL_FINALIZE/);
  assert.match(router, /finalize'.*PAYROLL_FINALIZE/);
  assert.match(permissions, /PAYROLL_FINALIZE: 'employee_salary\.finalize'/);
  assert.match(controller, /title: 'Payroll Finalized'/);
  assert.match(migration, /finalized_snapshot_json JSON/);
  assert.match(migration, /finalized_attendance_fingerprint CHAR\(64\)/);
});

test('Batch 4 finalization is stale-safe and never recalculates a finalized row', () => {
  const finalization = read('server/services/payrollFinalization.service.js');
  const payroll = read('server/services/employeePayroll.service.js');

  assert.match(finalization, /PAYROLL_FINAL_REVIEW_STALE/);
  assert.match(finalization, /payroll_status = 'finalized'/);
  assert.match(finalization, /finalized_snapshot_json/);
  assert.match(payroll, /existing\.payroll_status !== 'draft'/);
  assert.match(payroll, /Only Draft payroll can be recalculated/);
});

test('Batch 4 UI shows Final Review and flags Attendance changes without enabling corrections early', () => {
  const page = read('client/src/pages/System/EmployeeSalary.jsx');
  const detail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx');
  const review = read('client/src/components/System/employeeSalaryComponents/FinalizePayrollModal.jsx');

  assert.match(page, /PAYROLL_FINALIZE/);
  assert.match(page, /Final Review/);
  assert.match(detail, /Proceed to Final Review/);
  assert.match(detail, /Attendance changed after this payroll was finalized/);
  assert.match(detail, /Create Salary Correction/);
  assert.match(review, /Payroll Final Double-Check/);
  assert.match(review, /Finalize Salary/);
  assert.match(review, /Future promotions, Attendance Settings changes, salary changes, or Attendance corrections will not automatically rewrite this payroll/);
});
