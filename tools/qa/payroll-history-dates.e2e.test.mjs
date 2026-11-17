// Only synthetic records on the guarded disposable MySQL server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const require=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url)),mysql=require('mysql2/promise');
const db=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_hr',password:'qa-isolated-only-password',database:'dc_prime_hr_db',dateStrings:true});
const base='http://127.0.0.1:4179',run=Date.now();let cookie,employeeId,code,barcode,beforeAttendance,payrollId;
async function api(path,body,method=body?'POST':'GET'){
 const res=await fetch(base+'/hr-api/api/v1'+path,{method,headers:{origin:base,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
const ok=(r,status=200)=>assert.equal(r.status,status,JSON.stringify(r.data));
const employeeBody=suffix=>({first_name:'Synthetic Robert',last_name:`PayrollDate${run}${suffix}`,department:'Administration',position:'QA Clerk',employment_type:'regular',employee_status:'active',hire_date:'2026-11-16',monthly_basic_salary:15000,rice_allowance:500,transportation_allowance:500,rest_days:['tuesday','thursday']});
async function attendance(id){
 for(const [day,timeIn,timeOut] of [[1,'09:00','18:00'],[2,'09:00','18:00'],[4,'09:06','18:00'],[6,'09:10','18:00'],[7,'09:00','18:00'],[8,'09:10','17:00'],[9,'09:00','18:00'],[11,'09:00','18:00'],[13,'09:00','18:00'],[14,'09:00','18:00'],[15,'09:00','18:00']])ok(await api('/attendance/manual',{employee_id:id,attendance_date:'2026-11-'+String(day).padStart(2,'0'),actual_time_in:timeIn+':00',actual_time_out:timeOut+':00',reason:'Synthetic historical attendance reproduction'}),201);
}
const readiness=async(id,period='first_half')=>{const result=await api('/employee-payroll/eligible-employees?month=2026-11&period_type='+period);ok(result);return result.data.data.find(e=>e.employee_id===id).payroll_readiness};
test.before(async()=>{
 const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
 const login=await api('/auth/login',{email:'hr@qa.invalid',password:'Synthetic-QA-only-2026!'});ok(login);cookie=login.cookie;
});
test.after(()=>db.end());
test('Nov 16 hire with Tuesday/Thursday rest days reports the actual date mismatch for Nov 1–15',async()=>{
 const created=await api('/employees',employeeBody('api'));ok(created,201);employeeId=created.data.data.employee_id;code=created.data.data.employee_code;barcode=created.data.data.barcode_code;
 await attendance(employeeId);[beforeAttendance]=await db.execute('SELECT employee_attendance_id,attendance_date,actual_time_in,actual_time_out FROM employee_attendance_records WHERE employee_id=? ORDER BY attendance_date',[employeeId]);
 const result=await readiness(employeeId);assert.equal(result.eligible,false);assert.equal(result.can_generate,false);assert.deepEqual(result.issues.map(i=>i.code),['EMPLOYEE_HIRED_AFTER_PERIOD']);assert.deepEqual(result.warnings,[]);assert.match(result.issues[0].message,/2026-11-16/);
 const second=await readiness(employeeId,'second_half');assert.equal(second.can_generate,true,JSON.stringify(second));assert.deepEqual(second.attendance.rest_days,['tuesday','thursday']);
});
test('A direct request cannot generate a pre-employment payroll',async()=>{
 const result=await api('/employee-payroll/drafts/generate',{month:'2026-11',period_type:'first_half',employee_id:employeeId});ok(result,409);assert.equal(result.data.code,'EMPLOYEE_HIRED_AFTER_PERIOD');
 const [[count]]=await db.execute('SELECT COUNT(*) AS n FROM employee_payrolls WHERE employee_id=?',[employeeId]);assert.equal(count.n,0);
});
test('An explicit hire-date correction updates original salary and rest-day history without changing attendance or identifiers',async()=>{
 ok(await api('/employees/'+employeeId,{...employeeBody('api'),hire_date:'2026-11-01',hire_date_change_reason:'Correcting a synthetic onboarding date'},'PUT'));
 const record=await api('/employees/'+employeeId);ok(record);assert.equal(record.data.data.employee_code,code);assert.equal(record.data.data.barcode_code,barcode);assert.equal(record.data.data.hire_date,'2026-11-01');
 const [[history]]=await db.execute('SELECT effective_from,monthly_basic_salary,correction_reason FROM employee_employment_history WHERE employee_id=?',[employeeId]);assert.equal(history.effective_from,'2026-11-01');assert.equal(Number(history.monthly_basic_salary),15000);assert.match(history.correction_reason,/onboarding date/);
 const [rest]=await db.execute('SELECT day_of_week,effective_from FROM employee_rest_day_assignments WHERE employee_id=? ORDER BY day_of_week',[employeeId]);assert.deepEqual(rest.map(row=>row.effective_from),['2026-11-01','2026-11-01']);assert.deepEqual(rest.map(row=>row.day_of_week).sort(),['thursday','tuesday']);
 const [after]=await db.execute('SELECT employee_attendance_id,attendance_date,actual_time_in,actual_time_out FROM employee_attendance_records WHERE employee_id=? ORDER BY attendance_date',[employeeId]);assert.deepEqual(after,beforeAttendance);
 const result=await readiness(employeeId);assert.equal(result.can_generate,true,JSON.stringify(result));assert.deepEqual(result.attendance.rest_days,['tuesday','thursday']);assert.equal(result.attendance.recorded_days,11);assert.equal(result.warnings.some(w=>w.startsWith('No rest-day assignment')),false);
});
test('Corrected dates allow draft generation and finalized payroll still blocks hire-date rewrites',async()=>{
 const created=await api('/employee-payroll/drafts/generate',{month:'2026-11',period_type:'first_half',employee_id:employeeId});ok(created,201);payrollId=created.data.data.generated[0].employee_payroll_id;
 ok(await api(`/employee-payroll/drafts/${payrollId}/finalize`,{attendance_review_confirmed:true}));
 const blocked=await api('/employees/'+employeeId,{...employeeBody('api'),hire_date:'2026-10-31',hire_date_change_reason:'This change must be blocked after finalization'},'PUT');ok(blocked,409);assert.match(blocked.data.message,/finalized or released payroll/);
 const [[history]]=await db.execute('SELECT effective_from FROM employee_employment_history WHERE employee_id=?',[employeeId]);assert.equal(history.effective_from,'2026-11-01');
});
test('Current rest days never silently fill a genuine historical schedule gap',async()=>{
 const created=await api('/employees',{...employeeBody('gap'),hire_date:'2026-11-01'});ok(created,201);const id=created.data.data.employee_id;
 await db.execute("UPDATE employee_rest_day_assignments SET effective_from='2026-11-16' WHERE employee_id=?",[id]);
 const current=await api('/employees/'+id);ok(current);assert.deepEqual(current.data.data.rest_days,['tuesday','thursday']);
 const result=await readiness(id);assert.equal(result.eligible,true);assert.equal(result.issues.some(issue=>issue.code==='PAYROLL_COMPENSATION_NOT_FOUND'),false);
 assert.ok(result.warnings.some(w=>w.includes('2026-11-01 to 2026-11-15')&&w.includes('current rest days may start later')));assert.deepEqual(result.attendance.rest_days,[]);
});
test('Prepare a separate synthetic employee for the real browser correction flow',async()=>{
 const body=employeeBody('browser'),created=await api('/employees',body);ok(created,201);await attendance(created.data.data.employee_id);
 writeFileSync('QA_REPORTS/.runtime/payroll-history-browser.json',JSON.stringify({id:created.data.data.employee_id,code:created.data.data.employee_code,body}));
});

