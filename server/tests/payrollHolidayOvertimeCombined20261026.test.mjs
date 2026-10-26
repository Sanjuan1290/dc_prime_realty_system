import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findUnsupportedHolidayOvertime, holidayOvertimeWarning } from '../services/payrollHolidayOvertimeGuard.service.js';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const holiday = (date, kind, minutes) => ({date, [kind]:minutes});
test('holiday overtime guard permits up to 8 paid hours for normal and special holiday',()=>{
  assert.deepEqual(findUnsupportedHolidayOvertime([
    holiday('2026-10-15','regular_holiday_minutes',480),
    holiday('2026-10-16','special_holiday_minutes',470),
    {date:'2026-10-17',day_type:'regular',overtime_minutes:120},
  ]),[]);
  assert.equal(holidayOvertimeWarning([]),null);
});
test('flag hours beyond 8h on both holiday types without affecting ordinary overtime',()=>{
  assert.deepEqual(findUnsupportedHolidayOvertime([
    holiday('2026-10-15','regular_holiday_minutes',600),
    holiday('2026-10-16','special_holiday_minutes',525),
  ]),[
    {date:'2026-10-15',holiday_type:'Regular holiday',extra_minutes:120},
    {date:'2026-10-16',holiday_type:'Special holiday',extra_minutes:45},
  ]);
});
test('supports live Attendance row shape and safe non-array inputs',()=>{
  assert.equal(findUnsupportedHolidayOvertime([{date:'2026-10-15',regularHolidaySeconds:33000}])[0].extra_minutes,70);
  assert.deepEqual(findUnsupportedHolidayOvertime(null),[]);
});
test('draft warning and server-side finalization share the guard',()=>{
  const draft=read('server/services/employeePayroll.service.js');
  const final=read('server/services/payrollFinalization.service.js');
  assert.match(draft,/holidayOvertimeWarning\(findUnsupportedHolidayOvertime\(attendanceRows\)\)/);
  assert.match(final,/holidayOvertimeDays\.length === 0/);
  assert.match(final,/PAYROLL_HOLIDAY_OVERTIME_REVIEW_REQUIRED/);
  assert.match(read('server/services/payrollReadiness.service.js'),/holidayOvertimeWarning\(findUnsupportedHolidayOvertime/);
});
test('Salary Detail hides unsupported settings while preserving four displayed rates',()=>{
  const detail=read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx');
  const review=read('client/src/components/System/employeeSalaryComponents/FinalizePayrollModal.jsx');
  const settings=read('client/src/components/System/employeeSalaryComponents/PayrollSettingsModal.jsx');
  for(const label of ['Regular Overtime','Rest Day Overtime','Holiday Pay Rate','Night Shift Extra Pay']) assert.match(detail,new RegExp(label));
  assert.doesNotMatch(detail,/label="Overtime on Regular Holidays"|label="Overtime on Special Holidays"/);
  assert.doesNotMatch(review,/label="Regular Holiday OT Multiplier"|label="Special Holiday OT Multiplier"/);
  assert.match(settings,/role="switch"/);
});
