import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAttendancePayrollRow,summarizeAttendancePayrollRows} from '../services/payrollAttendance.service.js';
import {buildPayrollAttendanceFingerprintPayload,hashPayrollAttendanceFingerprint} from '../services/payrollFinalization.service.js';

const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const restDays=['tuesday','wednesday','thursday'];
const schedule={regularWorkingMinutes:480,scheduledTimeIn:'09:00:00',scheduledTimeOut:'20:00:00',lateAfter:'09:15:00',breakStart:'12:00:00',breakMinutes:60};
const days=Array.from({length:15},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`);
const attendance={'2026-10-02':{actual_time_in:'09:00:00',actual_time_out:'20:00:00'},'2026-10-09':{actual_time_in:'09:10:00',actual_time_out:'20:00:00'}};
const result=days.map(date=>calculateAttendancePayrollRow({date,attendance:attendance[date]||null,restDays,daySetting:{day_type:'regular'},schedule}));

test('Tuesday-Thursday are Rest Days, but Friday October 2 and 9 are regular workdays',()=>{
 for(const date of ['2026-10-02','2026-10-09']){
  const r=result.find(x=>x.date===date);
  assert.equal(r.state,'regular_work');
  assert.equal(r.restDayOvertimeSeconds,0);
  assert.ok(r.regularAttendedSeconds>0);
 }
});
test('October 1-15 has eight scheduled workdays when Tuesday-Thursday are off',()=>{
 const s=summarizeAttendancePayrollRows({rows:result,regularWorkingMinutes:480});
 assert.equal(s.scheduledDays,8);
 assert.equal(s.restDayOvertimeMinutes,0);
 assert.equal(s.expectedRegularMinutes,3840);
 assert.equal(result.filter(r=>r.scheduledDay).length,8);
});
test('payroll fingerprints differ when a Friday was incorrectly classified as Rest Day',()=>{
 const summary=summarizeAttendancePayrollRows({rows:result,regularWorkingMinutes:480});
 const original=buildPayrollAttendanceFingerprintPayload({attendanceCalculatedThrough:'2026-10-15',regularWorkingMinutes:480,summary,rows:result});
 const wrong=result.map(r=>r.date==='2026-10-02'?{...r,state:'rest_day_work',scheduledDay:false,restDayOvertimeSeconds:r.totalWorkedSeconds,regularAttendedSeconds:0}:r);
 const incorrect=buildPayrollAttendanceFingerprintPayload({attendanceCalculatedThrough:'2026-10-15',regularWorkingMinutes:480,summary:summarizeAttendancePayrollRows({rows:wrong,regularWorkingMinutes:480}),rows:wrong});
 assert.notEqual(hashPayrollAttendanceFingerprint(original),hashPayrollAttendanceFingerprint(incorrect));
});
