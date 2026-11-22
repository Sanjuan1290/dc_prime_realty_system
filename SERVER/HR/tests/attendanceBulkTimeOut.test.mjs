import test from 'node:test';
import assert from 'node:assert/strict';
import {readBulkTimeOutInput,signBulkTimeOutReview,verifyBulkTimeOutReview} from '../services/attendanceBulkTimeOut.service.js';
import {prepareAttendanceCorrection} from '../services/attendanceCorrection.service.js';
import {calculateAttendancePayrollRow} from '../services/payrollAttendance.service.js';

const body={attendance_date:'2026-11-22',attendance_ids:[3,1,2],actual_time_out:'19:00',reason:' Authorized overtime '};
const attendance={actual_time_in:'09:00:00',actual_time_out:'18:00:00'};
test('bulk input requires one real date, distinct selected IDs, one valid timeout and a reason',()=>{
  assert.deepEqual(readBulkTimeOutInput(body),{date:'2026-11-22',attendanceIds:[1,2,3],timeOut:'19:00:00',reason:'Authorized overtime'});
  for(const extra of [{attendance_date:'2026-02-30'},{attendance_date:['2026-11-22']},{attendance_ids:[]},{attendance_ids:[1,1]},{attendance_ids:[-1]},{attendance_ids:[1.5]},{attendance_ids:[Number.MAX_SAFE_INTEGER+1]},{attendance_ids:Array.from({length:101},(_,i)=>i+1)},{actual_time_out:'25:00'},{actual_time_out:''},{reason:' '},{reason:'x'.repeat(1001)},{actual_time_in:'08:00'}])assert.throws(()=>readBulkTimeOutInput({...body,...extra}),{statusCode:400});
});
test('review proof is tied to the administrator, exact adjustment, expiry and signature',()=>{
  const prior=process.env.HR_JWT_SECRET;process.env.HR_JWT_SECRET='unit-bulk-review-only-secret-'.repeat(3);
  try{
    const input=readBulkTimeOutInput(body),claim={actorId:12,input,fingerprint:'snapshot',now:1000};
    const token=signBulkTimeOutReview(claim);
    assert.equal(verifyBulkTimeOutReview(token,{actorId:12,input,now:2000}).fingerprint,'snapshot');
    for(const [proof,options] of [[undefined,{actorId:12,input,now:2000}],[token,{actorId:13,input,now:2000}],[token,{actorId:12,input:{...input,timeOut:'20:00:00'},now:2000}],[token,{actorId:12,input,now:601000}],[token+'x',{actorId:12,input,now:2000}],[token+'.extra',{actorId:12,input,now:2000}]])assert.throws(()=>verifyBulkTimeOutReview(proof,options),{statusCode:409});
  }finally{if(prior===undefined)delete process.env.HR_JWT_SECRET;else process.env.HR_JWT_SECRET=prior}
});
test('shared correction preserves Time In, validates reasons and supports valid overnight shifts',()=>{
  const correction=prepareAttendanceCorrection(attendance,{...attendance,actual_time_out:'19:00',reason:'Authorized overtime'});
  assert.equal(correction.timeInChanged,false);assert.equal(correction.timeOutChanged,true);
  assert.equal(correction.actualTimeIn,'09:00:00');
  for(const extra of [{reason:''},{actual_time_in:null},{actual_time_out:'08:00'},{actual_time_out:'25:00'}])assert.throws(()=>prepareAttendanceCorrection(attendance,{...attendance,reason:'Correction',...extra}),{statusCode:400});
  assert.equal(prepareAttendanceCorrection({actual_time_in:'22:00',actual_time_out:'05:00'},{actual_time_in:'22:00',actual_time_out:'06:00',reason:'Overnight correction'}).actualTimeOut,'06:00:00');
  assert.equal(prepareAttendanceCorrection(attendance,{...attendance,reason:'Already matches'},{allowUnchanged:true}).changed,false);
});
test('existing calculator adds one hour overtime for 18:00 to 19:00 and respects rest days and holidays',()=>{
  const input={date:'2026-11-22',restDays:['monday'],schedule:{scheduledTimeIn:'09:00:00',scheduledTimeOut:'18:00:00',breakStart:'12:00:00',breakMinutes:60,regularWorkingMinutes:480}};
  const before=calculateAttendancePayrollRow({...input,attendance});
  const after=calculateAttendancePayrollRow({...input,attendance:{...attendance,actual_time_out:'19:00:00'}});
  assert.equal(before.overtimeSeconds,0);assert.equal(after.overtimeSeconds,3600);assert.equal(after.totalWorkedSeconds-before.totalWorkedSeconds,3600);assert.equal(after.regularAttendedSeconds,8*3600);
  const rest=calculateAttendancePayrollRow({...input,restDays:['sunday'],attendance:{...attendance,actual_time_out:'19:00:00'}});
  assert.equal(rest.overtimeSeconds,0);assert.equal(rest.restDayOvertimeSeconds,9*3600);
  const holiday=calculateAttendancePayrollRow({...input,attendance:{...attendance,actual_time_out:'19:00:00',day_type:'regular_holiday'}});
  assert.equal(holiday.regularHolidaySeconds,9*3600);assert.equal(holiday.overtimeSeconds,0);
});
