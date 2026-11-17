import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledAttendanceMinutes } from '../services/scheduledAttendance.service.js';
import { calculateAttendancePayrollRow, summarizeAttendancePayrollRows } from '../services/payrollAttendance.service.js';
import { calculateDraftPayrollMoney } from '../services/payrollCalculation.service.js';
import { snapshotPayrollAttendance } from '../services/payrollAttendanceSnapshot.service.js';
import { buildFundReleaseReceipt } from '../services/payrollReceipt.service.js';

const schedule = { scheduledTimeIn:'09:00',scheduledTimeOut:'18:00',breakStart:'12:00',breakMinutes:60,regularWorkingMinutes:600,lateAfter:'09:00' };
test('scheduled attendance uses shift less the break, including overnight shifts',()=>{
  assert.equal(scheduledAttendanceMinutes(schedule),480);
  assert.equal(scheduledAttendanceMinutes({...schedule,scheduledTimeOut:'20:00'}),600);
  assert.equal(scheduledAttendanceMinutes({...schedule,scheduledTimeIn:'22:00',scheduledTimeOut:'07:00',breakStart:'02:00'}),480);
  assert.throws(()=>scheduledAttendanceMinutes({...schedule,scheduledTimeOut:'09:00'}),/Scheduled Time/);
});
test('11 days report 88 clock hours while approved absence basis and money remain unchanged',()=>{
  const dates=Array.from({length:15},(_,i)=>`2026-11-${String(i+1).padStart(2,'0')}`);
  const late = {'2026-11-04':'09:06','2026-11-06':'09:10','2026-11-08':'09:10'};
  const rows=dates.map(date=>calculateAttendancePayrollRow({date,restDays:['tuesday','thursday'],schedule,
    attendance:{actual_time_in:late[date] || '09:00',actual_time_out:date==='2026-11-08'?'17:00':'18:00'}}));
  // Rest-day rows have no punches in the reported period.
  for (let i=0;i<dates.length;i++) if (['tuesday','thursday'].includes(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(dates[i]+'T00:00:00Z').getUTCDay()])) rows[i]=calculateAttendancePayrollRow({date:dates[i],restDays:['tuesday','thursday'],schedule,attendance:null});
  const summary=summarizeAttendancePayrollRows({rows,regularWorkingMinutes:600});
  assert.equal(summary.scheduledDays,11);
  assert.equal(summary.lateMinutes,26);
  assert.equal(summary.totalWorkedMinutes,86*60+34);
  const money=calculateDraftPayrollMoney({monthlyBasicSalary:15000,regularWorkingMinutes:600,tardinessAbsenceMinutes:summary.tardinessAbsenceMinutes,periodType:'first_half'});
  assert.equal(money.hourlyRate,86.54);
  assert.equal(money.attendanceDeduction,37.50);
  assert.equal(money.netFundRelease,7462.50);
  const old=snapshotPayrollAttendance({rows,schedule:{...schedule,attendanceWorkingMinutes:600}});
  const current=snapshotPayrollAttendance({rows,schedule:{...schedule,attendanceWorkingMinutes:scheduledAttendanceMinutes(schedule)}});
  assert.equal(old.reduce((n,r)=>n+r.scheduled_attendance_minutes,0),110*60);
  assert.equal(current.reduce((n,r)=>n+r.scheduled_attendance_minutes,0),88*60);
  assert.deepEqual(current.map(({scheduled_attendance_minutes,...r})=>r),old.map(({scheduled_attendance_minutes,...r})=>r));
});
test('an older finalized receipt retains its original 110 hours',()=>{
  const saved={attendance_breakdown:[{total_worked_minutes:5194,scheduled_attendance_minutes:6600}],compensation:{},attendance:{},earnings:{},deductions:{},employee:{},period:{},totals:{}};
  const before=JSON.stringify(saved);
  const receipt=buildFundReleaseReceipt({payroll_status:'finalized',finalized_snapshot:saved,attendance_breakdown:[{total_worked_minutes:5194,scheduled_attendance_minutes:5280}]},{today:'2026-11-17'});
  assert.equal(receipt.official,true);
  assert.equal(receipt.scheduled_attendance_minutes,6600);
  assert.equal(JSON.stringify(saved),before);
});
