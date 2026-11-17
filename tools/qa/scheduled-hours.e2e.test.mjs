import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url)),mysql=require('mysql2/promise');
const base='http://127.0.0.1:4179',run=Date.now();let cookie,original,employeeId,payrollId;
async function api(path,body,method=body?'POST':'GET') {
  const r=await fetch(base+'/hr-api/api/v1'+path,{method,headers:{origin:base,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const ok=(r,status=200)=>assert.equal(r.status,status,JSON.stringify(r.data));
test.after(async()=>{if(original)ok(await api('/attendance/settings',original,'PUT'))});
test('real settings and November attendance generate an 88-hour draft with unchanged approved-basis money',async()=>{
  const auth=await api('/auth/login',{email:'hr@qa.invalid',password:'Synthetic-QA-only-2026!'});ok(auth);cookie=auth.cookie;
  const settings=await api('/attendance/settings');ok(settings);original=settings.data.data;
  ok(await api('/attendance/settings',{...original,scheduledTimeIn:'09:00',scheduledTimeOut:'18:00',automaticTimeOut:'18:00',breakStart:'12:00',breakMinutes:60,regularWorkingMinutes:600},'PUT'));
  const employee=await api('/employees',{first_name:'Synthetic Robert',last_name:`ShiftHours${run}`,department:'Administration',position:'QA Clerk',employment_type:'regular',employee_status:'active',hire_date:'2026-11-01',monthly_basic_salary:15000,rice_allowance:500,transportation_allowance:500,rest_days:['tuesday','thursday']});ok(employee,201);employeeId=employee.data.data.employee_id;
  for(const [day,timeIn,timeOut] of [[1,'09:00','18:00'],[2,'09:00','18:00'],[4,'09:06','18:00'],[6,'09:10','18:00'],[7,'09:00','18:00'],[8,'09:10','17:00'],[9,'09:00','18:00'],[11,'09:00','18:00'],[13,'09:00','18:00'],[14,'09:00','18:00'],[15,'09:00','18:00']]) {
    ok(await api('/attendance/manual',{employee_id:employeeId,attendance_date:'2026-11-'+String(day).padStart(2,'0'),actual_time_in:timeIn+':00',actual_time_out:timeOut+':00',reason:'Synthetic November shift calculation check'}),201);
  }
  const generated=await api('/employee-payroll/drafts/generate',{month:'2026-11',period_type:'first_half',employee_id:employeeId});ok(generated,201);payrollId=generated.data.data.generated[0].employee_payroll_id;
  const receipt=await api(`/employee-payroll/drafts/${payrollId}/receipt`);ok(receipt);const value=receipt.data.data;
  assert.equal(value.scheduled_attendance_minutes,5280);assert.equal(value.actual_worked_minutes,5194);
  assert.equal(value.hourly_rate,86.54);assert.equal(value.total_deduction,37.50);assert.equal(value.total,7462.50);
  assert.equal(value.approved_regular_workday_minutes,600);assert.equal(value.calculated_shift_hours,true);
  writeFileSync('QA_REPORTS/evidence/scheduled-hours-period.json',JSON.stringify({synthetic:true,period:'2026-11-01 through 2026-11-15',employeeId,payrollId,receipt:value},null,2));
});
test('an existing unfinalized 110-hour draft must be recalculated before it can become an official receipt',async()=>{
  const db=await mysql.createConnection({host:'127.0.0.1',port:13307,user:'qa_hr',password:'qa-isolated-only-password',database:'dc_prime_hr_db'});
  try {
    const [[server]]=await db.query('SELECT @@port port');assert.equal(server.port,13307);
    const [[saved]]=await db.execute('SELECT attendance_breakdown_json FROM employee_payrolls WHERE employee_payroll_id=? AND payroll_status=\'draft\'',[payrollId]);
    const rows=typeof saved.attendance_breakdown_json==='string'?JSON.parse(saved.attendance_breakdown_json):saved.attendance_breakdown_json;
    for(const row of rows) row.scheduled_attendance_minutes=row.scheduled_day?600:0;
    await db.execute("UPDATE employee_payrolls SET attendance_breakdown_json=?,calculation_version='employee-salary-260days-compressed-shift-v3' WHERE employee_payroll_id=? AND payroll_status='draft'",[JSON.stringify(rows),payrollId]);
  } finally {await db.end()}
  const review=await api(`/employee-payroll/drafts/${payrollId}/final-review`);ok(review);assert.equal(review.data.data.can_finalize,false);assert.equal(review.data.data.scheduled_hours_changed_since_draft,true);
  ok(await api(`/employee-payroll/drafts/${payrollId}/finalize`,{attendance_review_confirmed:true}),409);
  ok(await api(`/employee-payroll/drafts/${payrollId}/recalculate`,{}));
  const recalculated=await api(`/employee-payroll/drafts/${payrollId}/final-review`);ok(recalculated);assert.equal(recalculated.data.data.can_finalize,true);assert.equal(recalculated.data.data.current_scheduled_attendance_minutes,5280);
});
test('finalization freezes clock hours and money even after the schedule and approved workday change',async()=>{
  ok(await api(`/employee-payroll/drafts/${payrollId}/finalize`,{attendance_review_confirmed:true}));
  const before=await api(`/employee-payroll/history/payrolls/${payrollId}/receipt`);ok(before);
  ok(await api('/attendance/settings',{...original,scheduledTimeOut:'20:00',automaticTimeOut:'20:00',regularWorkingMinutes:480},'PUT'));
  const after=await api(`/employee-payroll/history/payrolls/${payrollId}/receipt`);ok(after);assert.deepEqual(after.data.data,before.data.data);
});
