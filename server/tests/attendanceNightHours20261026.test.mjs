import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getNightShiftSeconds, getAttendanceShift, isValidOvernightAttendance } from '../services/nightShiftTime.service.js';
import { calculateAttendancePayrollRow, summarizeAttendancePayrollRows } from '../services/payrollAttendance.service.js';
import { calculateConfiguredPayrollEarnings } from '../services/payrollCalculation.service.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const schedule = {
  scheduledTimeIn: '09:00:00', scheduledTimeOut: '20:00:00',
  lateAfter: '09:00:00', breakStart: '12:00:00', breakMinutes: 60,
  regularWorkingMinutes: 480,
};
const row = (timeIn, timeOut, more = {}) => calculateAttendancePayrollRow({
  date: '2026-10-26', restDays: [], schedule, daySetting: { day_type: 'regular' },
  attendance: { actual_time_in: timeIn, actual_time_out: timeOut, ...more },
});

test('night window: 10 PM to 6 AM counted as eight night hours', () => {
  assert.equal(getNightShiftSeconds({ timeIn: '22:00', timeOut: '06:00' }), 28800);
  const result = row('22:00', '06:00');
  assert.equal(result.nightDifferentialSeconds, 28800);
  assert.equal(result.totalWorkedSeconds, 28800);
  assert.equal(result.lateSeconds, 0, 'overnight shift must not be late against daytime clock');
  assert.equal(result.overtimeSeconds, 0, 'daytime scheduled out cannot assign overnight overtime');
  assert.equal(result.regularAttendedSeconds, 28800);
});

test('night window partial overlap, post-midnight, and normal daytime', () => {
  const cases = [
    ['20:00', '23:00', 3600],
    ['23:00', '07:00', 7 * 3600],
    ['00:00', '06:00', 6 * 3600],
    ['21:00', '05:30', 7.5 * 3600],
    ['09:00', '20:00', 0],
    ['21:30', '22:30', 1800],
  ];
  for (const [timeIn, timeOut, expected] of cases) {
    assert.equal(getNightShiftSeconds({ timeIn, timeOut }), expected, `${timeIn} to ${timeOut}`);
  }
});

test('unpaid night break is excluded once, including after midnight', () => {
  assert.equal(getNightShiftSeconds({ timeIn: '22:00', timeOut: '06:00', breakStart: '01:00', breakMinutes: 60 }), 7 * 3600);
  assert.equal(row('09:00', '20:00').totalWorkedSeconds, 10 * 3600);
  assert.equal(getNightShiftSeconds({ timeIn: '22:00', timeOut: '06:00', breakStart: '12:00', breakMinutes: 60 }), 8 * 3600);
});

test('missing or invalid clock times never create night pay', () => {
  assert.equal(getAttendanceShift('22:00', null), null);
  assert.equal(getAttendanceShift('09:00', '08:00'), null, '23-hour pseudo overnight is invalid');
  assert.equal(getAttendanceShift('12:00', '12:00'), null);
  assert.equal(getNightShiftSeconds({ timeIn: '22:00', timeOut: '09:00:70' }), 0);
  assert.equal(row('22:00', null).nightDifferentialSeconds, 0);
  assert.equal(row('09:00', '08:00').reviewIssue, 'incomplete');
});

test('16-hour boundary accepted; longer pseudo overnight rejected', () => {
  assert.equal(isValidOvernightAttendance('20:00', '12:00'), true);
  assert.equal(isValidOvernightAttendance('20:00', '12:01'), false);
});

test('manual corrections recalculate night premium from amended punches', () => {
  const before = row('22:00', null);
  const after = row('22:00', '06:00');
  assert.equal(before.nightDifferentialSeconds, 0);
  assert.equal(before.reviewIssue, 'incomplete');
  const payroll = summarizeAttendancePayrollRows({ rows: [after], regularWorkingMinutes: 480 });
  assert.equal(payroll.nightDifferentialMinutes, 480);
  const pay = calculateConfiguredPayrollEarnings({ hourlyRate: 86.54, nightDifferentialMinutes: payroll.nightDifferentialMinutes, payrollSettings: { night_differential_percentage: 1 } });
  assert.equal(pay.nightDifferentialPay, 6.92, 'save the current 1% placeholder, do not rewrite as 10%');
});

test('night work can be on a rest day and preserves start-date attribution', () => {
  const result = calculateAttendancePayrollRow({
    date: '2026-10-26', restDays: ['monday'], schedule,
    daySetting: { day_type: 'regular' },
    attendance: { actual_time_in: '22:00', actual_time_out: '06:00' },
  });
  assert.equal(result.state, 'rest_day_work');
  assert.equal(result.nightDifferentialSeconds, 28800);
  assert.equal(result.restDayOvertimeSeconds, 28800);
});


test('older finalized payroll versions can compare legacy saved night seconds', () => {
  const unchangedOld = calculateAttendancePayrollRow({
    date: '2026-10-26', restDays: [], schedule, daySetting: { day_type: 'regular' },
    attendance: { actual_time_in: '22:00', actual_time_out: '06:00', night_differential_seconds: 0 },
    nightDifferentialMode: 'legacy',
  });
  assert.equal(unchangedOld.nightDifferentialSeconds, 0);
  assert.equal(row('22:00', '06:00').nightDifferentialSeconds, 28800);
  const finalization = read('server/services/payrollFinalization.service.js');
  const payrollService = read('server/services/employeePayroll.service.js');
  assert.match(finalization, /nightDifferentialMode: \/\^\(employee-salary-260days-8hours-night-/);
  assert.match(payrollService, /employee-salary-260days-compressed-shift-v3/);
});

test('UI shows Timed In and next-day Time Out, preserves status filter wire code', () => {
  const page = read('client/src/pages/System/Attendance.jsx');
  assert.match(page, />Timed In<\/option>/);
  assert.match(page, /'Timed In'\}\<\/span>/);
  assert.match(page, /Next day/);
  assert.match(page, /value="in_office"/);
  assert.doesNotMatch(page, />Currently In<\/option>|: 'In Office'<\/span>/);
});

test('manual and barcode routes retain authorization and audit, handle next-day Time Out', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js');
  const manual = read('client/src/components/System/employeeComponents/AttendanceCorrectionModal.jsx');
  assert.match(controller, /isValidOvernightAttendance\(prior\.actual_time_in, now\.time\)/);
  assert.match(controller, /isEventTimeOutBeforeTimeIn/);
  assert.match(controller, /invalidAttendanceClockRange/);
  assert.match(controller, /employee_attendance_corrections/);
  assert.match(manual, /duration > 0 && duration <= 16 \* 60/);
  assert.match(manual, /Night shift: choose the Time In date above/);
});

test('drafts persist night minutes per date while finalization fingerprints retain legacy field shapes', () => {
  const service = read('server/services/employeePayroll.service.js');
  const finalization = read('server/services/payrollFinalization.service.js');
  const salaryView = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx');
  assert.match(service, /night_differential_minutes: Math\.round\(Number\(row\.nightDifferentialSeconds/);
  assert.match(finalization, /row\.night_differential_minutes !== undefined/);
  assert.match(salaryView, /Night Hrs/);
  assert.match(salaryView, /formatPayrollDuration\(row\.night_differential_minutes\)/);
});

