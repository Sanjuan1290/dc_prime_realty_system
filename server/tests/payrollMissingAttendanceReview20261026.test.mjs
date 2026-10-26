import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateAttendancePayrollRow } from '../services/payrollAttendance.service.js';
import { getPayrollAttendanceReviewDays, sameReviewedDates, validateAttendanceFinalReview } from '../services/payrollAttendanceReview.service.js';
import { PERMISSIONS } from '../config/permissions.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from '../config/recommendedRolePermissions.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const schedule = { regularWorkingMinutes: 480, scheduledTimeIn: '09:00:00', scheduledTimeOut: '20:00:00', lateAfter: '09:00:00', breakStart: '12:00:00', breakMinutes: 60 };
const row = (attendance = null, opts = {}) => calculateAttendancePayrollRow({ date: opts.date || '2026-10-14', attendance, restDays: opts.restDays || [], daySetting: opts.daySetting || { day_type: 'regular' }, schedule });

test('missing regular-day scan counts as absence without a second approval warning', () => {
  const r = row();
  assert.equal(r.state, 'absent');
  assert.equal(r.absence, true);
  assert.equal(r.reviewIssue, null);
});
test('explicit recorded absence does not show as forgotten scan', () => {
  const r = row({ attendance_status: 'absent' });
  assert.equal(r.absence, true);
  assert.equal(r.reviewIssue, null);
});
test('rest days and unworked holidays do not count as missing scans', () => {
  assert.equal(row(null, { restDays: ['wednesday'] }).reviewIssue, null);
  assert.equal(row(null, { daySetting: { day_type: 'special_holiday' } }).reviewIssue, null);
});
test('fully recorded fieldwork does not flag as missing attendance', () => {
  assert.equal(row({ actual_time_in: '09:00:00', actual_time_out: '20:00:00' }).reviewIssue, null);
});
test('missing either punch requires a correction', () => {
  assert.equal(row({ actual_time_in: '09:00:00' }).reviewIssue, 'incomplete');
  assert.equal(row({ actual_time_out: '20:00:00' }).reviewIssue, 'incomplete');
  assert.equal(row({ actual_time_in: '09:00:00', attendance_status: 'absent' }).reviewIssue, 'incomplete');
  assert.equal(row({ actual_time_in: '09:00:00' }, { restDays: ['wednesday'] }).reviewIssue, 'incomplete');
  assert.equal(row({ actual_time_in: '09:00:00' }, { daySetting: { day_type: 'regular_holiday' } }).reviewIssue, 'incomplete');
});
test('no-punch record without an explicit absent status still counts as an absence', () => {
  assert.equal(row({ attendance_status: 'present' }).state, 'absent');
  assert.equal(row({ attendance_status: 'present' }).reviewIssue, null);
});
test('date lists contain only real unresolved days and are stable', () => {
  const days = getPayrollAttendanceReviewDays([
    { date: '2026-10-15', reviewIssue: 'incomplete' },
    { date: '2026-10-14', reviewIssue: 'missing' },
    { date: '2026-10-13', reviewIssue: null },
  ]);
  assert.deepEqual(days, [
    { date: '2026-10-14', issue: 'missing' },
    { date: '2026-10-15', issue: 'incomplete' },
  ]);
  assert.deepEqual(getPayrollAttendanceReviewDays(undefined), []);
});
test('fully missing punches already deduct as absence without a manual confirmation step', () => {
  const review = { attendance_review_required: true, incomplete_punches_require_correction: false, attendance_review_days: [{ date: '2026-10-14', issue: 'missing' }] };
  validateAttendanceFinalReview({ review, attendanceReviewConfirmed: false, reviewedMissingDates: [] });
});
test('incomplete time punches block even when accounting checks the box', () => {
  assert.throws(() => validateAttendanceFinalReview({ review: { incomplete_punches_require_correction: true }, attendanceReviewConfirmed: true, reviewedMissingDates: [] }), { code: 'PAYROLL_ATTENDANCE_INCOMPLETE' });
});
test('a clean review needs no acknowledgment', () => {
  validateAttendanceFinalReview({ review: { attendance_review_required: false, incomplete_punches_require_correction: false }, attendanceReviewConfirmed: false });
});
test('roles keep Operations in charge of attendance and Accounting in charge of payroll', () => {
  for (const role of ['operations_staff', 'operations_head']) {
    assert.ok(RECOMMENDED_ROLE_PERMISSIONS[role].includes(PERMISSIONS.ATTENDANCE_MANAGE));
    assert.equal(RECOMMENDED_ROLE_PERMISSIONS[role].includes(PERMISSIONS.PAYROLL_RELEASE), false);
  }
  for (const role of ['accounting_staff', 'accounting_head']) {
    assert.ok(RECOMMENDED_ROLE_PERMISSIONS[role].includes(PERMISSIONS.PAYROLL_FINALIZE));
    assert.ok(RECOMMENDED_ROLE_PERMISSIONS[role].includes(PERMISSIONS.PAYROLL_RECALCULATE_DRAFT));
    assert.ok(RECOMMENDED_ROLE_PERMISSIONS[role].includes(PERMISSIONS.PAYROLL_RELEASE));
    assert.equal(RECOMMENDED_ROLE_PERMISSIONS[role].includes(PERMISSIONS.ATTENDANCE_MANAGE), false);
  }
});
test('recheck happens on the server and is permission gated', () => {
  const finalization = read('server/services/payrollFinalization.service.js');
  const controller = read('server/controllers/System/Employees/EmployeePayroll.controller.js');
  const router = read('server/routers/System/employeePayroll.routers.js');
  const ui = read('client/src/components/System/employeeSalaryComponents/FinalizePayrollModal.jsx');
  assert.match(finalization, /validateAttendanceFinalReview\(/);
  assert.match(finalization, /attendance_review_days/);
  assert.match(controller, /attendanceReviewConfirmed: req\.body\?\.attendance_review_confirmed === true/);
  assert.match(controller, /reviewedMissingDates: req\.body\?\.reviewed_missing_dates/);
  assert.match(router, /post\('\/drafts\/:employeePayrollId\/finalize', requirePermission\(PERMISSIONS\.PAYROLL_FINALIZE\)/);
  assert.doesNotMatch(ui, /attendance_review_confirmed/);
  assert.doesNotMatch(ui, /Confirm genuine absences with Operations/);
  assert.match(ui, /Incomplete attendance/);
});
test('new compressed shift uses 10-hour attendance for Final Review and preflight with 8-hour salary divisor', () => {
  const finalization = read('server/services/payrollFinalization.service.js');
  const readiness = read('server/services/payrollReadiness.service.js');
  assert.match(finalization, /paidWorkMinutesOverride: \/\^employee-salary-260days-8hours-/);
  assert.doesNotMatch(readiness, /paidWorkMinutesOverride: PAYROLL_PAID_WORK_MINUTES/);
});



