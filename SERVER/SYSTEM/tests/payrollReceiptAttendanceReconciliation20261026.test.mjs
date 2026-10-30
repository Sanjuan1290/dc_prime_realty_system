import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFundReleaseReceipt } from '../services/payrollReceipt.service.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const dates = ['02','03','04','05','09','10','11','12'];
const worked = [600,600,600,600,590,590,580,0];
const breakdown = dates.map((day,i)=>({
  date:`2026-10-${day}`,scheduled_day:true,
  total_worked_minutes:worked[i],scheduled_attendance_minutes:600,
  regular_attended_minutes:i===7?0:480,
  unclassified_extra_minutes:i===7?0:worked[i]-480,
}));
const draft = {employee_payroll_id:1,payroll_status:'draft',employee_name_snapshot:'TEST EMPLOYEE',
  half_month_basic:7500,expected_regular_minutes:3840,regular_attended_minutes:3360,
  tardiness_absence_minutes:520,attendance_deduction:750.01,net_fund_release:6749.99,
  attendance_breakdown:breakdown};

test('receipt separates actual 10h attendance from 8h payroll basis (October 1-15)',()=>{
  const r=buildFundReleaseReceipt(draft,{today:'2026-10-26'});
  assert.equal(r.scheduled_attendance_minutes,4800); // 8 x 10h = 80h
  assert.equal(r.actual_worked_minutes,4160); // 69h20
  assert.equal(r.total_regular_hours,64); // 8 x 8h
  assert.equal(r.total_regular_hours_attended,56); // 7 x 8h
  assert.equal(r.unclassified_extra_minutes,800); // 13h20, review; not automatic OT
  assert.equal(r.tardiness_absence_minutes,520);
  assert.equal(r.total,6749.99);
});

test('legacy receipt without saved shift evidence does not invent extra hours',()=>{
  const r=buildFundReleaseReceipt({...draft,attendance_breakdown:[]});
  assert.equal(r.actual_worked_minutes,null);
  assert.equal(r.scheduled_attendance_minutes,null);
  assert.equal(r.unclassified_extra_minutes,null);
});

test('released receipt reads only frozen snapshot, never a changed draft breakdown',()=>{
  const finalized_snapshot={
    period:{start:'2026-10-01',end:'2026-10-15'},employee:{name:'TEST EMPLOYEE'},
    attendance:{expected_regular_minutes:3840,regular_attended_minutes:3360},
    attendance_breakdown:breakdown,net_fund_release:6749.99,
  };
  const r=buildFundReleaseReceipt({...draft,payroll_status:'released',finalized_snapshot,
    attendance_breakdown:[{total_worked_minutes:999999,scheduled_attendance_minutes:999999}]});
  assert.equal(r.actual_worked_minutes,4160);
  assert.equal(r.official,true);
});

test('draft and finalized source persist original actual minutes and shift hours',()=>{
  const payroll=src('SERVER/SYSTEM/services/employeePayroll.service.js');
  const final=src('SERVER/SYSTEM/services/payrollFinalization.service.js');
  const attendance=src('SERVER/SYSTEM/services/payrollAttendance.service.js');
  const client=src('CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/FundReleaseReceipt.jsx');
  assert.match(attendance,/attendanceWorkingMinutes: runtime\.regularWorkingMinutes/);
  assert.match(payroll,/total_worked_minutes: Math\.round/);
  assert.match(payroll,/scheduled_attendance_minutes: row\.scheduledDay/);
  assert.match(final,/total_worked_minutes: n\(row\.total_worked_minutes\)/);
  assert.match(final,/scheduled_attendance_minutes: n\(row\.scheduled_attendance_minutes\)/);
  assert.match(client,/Scheduled Attendance Hours/);
  assert.match(client,/Actual Hours Worked/);
  assert.match(client,/Total Regular Hours Attended \(credited/);
  assert.match(client,/not automatically added as overtime/);
});

