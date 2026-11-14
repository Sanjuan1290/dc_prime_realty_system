// Real API checks using only the verified disposable database from setup-local-db.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url));
const mysql=require('mysql2/promise');
const pool=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_hr',password:'qa-isolated-only-password',database:'dc_prime_hr_db',dateStrings:true});
const base='http://127.0.0.1:4179/hr-api/api/v1';
let cookie='',viewer='',employeeId,barcode,attendanceId,kiosk='';
async function request(path,{method='GET',body,session=cookie}={}){
  const response=await fetch(base+path,{method,headers:{origin:'http://127.0.0.1:4179',...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
}
const ok=(result,status=200)=>assert.equal(result.status,status,JSON.stringify(result.data));
const manual=(date,extra={})=>({employee_id:employeeId,attendance_date:date,actual_time_in:'09:00:00',actual_time_out:'20:00:00',reason:'QA attendance verification',...extra});
test.before(async()=>{
  const [[server]]=await pool.query('SELECT @@port AS port,@@datadir AS datadir');
  const expected=resolve(fileURLToPath(new URL('../../',import.meta.url)),'QA_REPORTS/.runtime/mysql').replaceAll('\\','/').toLowerCase();
  assert.equal(server.port,13307);assert.equal(server.datadir.replaceAll('\\','/').replace(/\/$/,'').toLowerCase(),expected,'Refusing writes outside the disposable QA database');
  for(const email of ['hr@qa.invalid','hrviewer@qa.invalid']){
    const result=await request('/auth/login',{method:'POST',body:{email,password:'Synthetic-QA-only-2026!'},session:''});ok(result);
    if(email.startsWith('hrviewer'))viewer=result.cookie.split(';')[0];else cookie=result.cookie.split(';')[0];
  }
  const result=await request('/employees',{method:'POST',body:{first_name:'Attendance',last_name:'Synthetic QA',department:'Administration',position:'Test Clerk',hire_date:'2026-10-01',monthly_basic_salary:15000,rest_days:['sunday']}});ok(result,201);
  employeeId=result.data.data?.employee_id||result.data.employee_id;
  const [[employee]]=await pool.execute('SELECT barcode_code FROM employees WHERE employee_id=?',[employeeId]);barcode=employee.barcode_code;assert.match(barcode,/^\d{10}$/);
});
test.after(async()=>{await pool.end()});

test('ATTENDANCE: viewer cannot write attendance, settings or company events',async()=>{
  for(const [path,method] of [['/attendance/manual','POST'],['/attendance/scan','POST'],['/attendance/settings','PUT'],['/attendance/events','POST']])ok(await request(path,{method,body:{},session:viewer}),403);
});
test('ATTENDANCE: missing reason, missing time in, invalid time and shifts over 16 hours are rejected',async()=>{
  for(const extra of [{reason:''},{actual_time_in:''},{actual_time_in:'25:00:00'},{actual_time_out:'08:00:00'}])ok(await request('/attendance/manual',{method:'POST',body:manual('2026-10-20',extra)}),400);
});
test('ATTENDANCE: impossible calendar dates return a validation error',async()=>{
  ok(await request('/attendance/manual',{method:'POST',body:manual('2026-02-30')}),400);
});
test('ATTENDANCE: malformed time out cannot be silently discarded',async()=>{
  ok(await request('/attendance/manual',{method:'POST',body:manual('2026-10-23',{actual_time_out:'25:00:00'})}),400);
  const [[row]]=await pool.execute('SELECT COUNT(*) AS n FROM employee_attendance_records WHERE employee_id=? AND attendance_date=?',[employeeId,'2026-10-23']);assert.equal(row.n,0);
});
test('ATTENDANCE: manual entry persists, appears in date/search filters, and duplicate is rejected',async()=>{
  const result=await request('/attendance/manual',{method:'POST',body:manual('2026-10-20')});ok(result,201);attendanceId=result.data.data.id;
  const records=await request('/attendance?dateFrom=2026-10-20&dateTo=2026-10-20&search=Attendance');ok(records);assert.ok(records.data.data.some(row=>row.employee_attendance_id===attendanceId&&row.actual_time_in==='09:00:00'&&row.actual_time_out==='20:00:00'));
  ok(await request('/attendance/manual',{method:'POST',body:manual('2026-10-20')}),409);
});
test('ATTENDANCE: valid overnight shift keeps original attendance date',async()=>{
  ok(await request('/attendance/manual',{method:'POST',body:manual('2026-10-21',{actual_time_in:'22:00:00',actual_time_out:'06:00:00'})}),201);
  const [[row]]=await pool.execute('SELECT attendance_date,actual_time_in,actual_time_out FROM employee_attendance_records WHERE employee_id=? AND attendance_date=?',[employeeId,'2026-10-21']);assert.deepEqual(row,{attendance_date:'2026-10-21',actual_time_in:'22:00:00',actual_time_out:'06:00:00'});
});
test('ATTENDANCE: correction stores before/after values, reason and actor',async()=>{
  ok(await request(`/attendance/${attendanceId}/correction`,{method:'PUT',body:{actual_time_in:'09:15:00',actual_time_out:'19:00:00',reason:'QA correction audit'}}));
  const result=await request(`/attendance/${attendanceId}/corrections`);ok(result);
  assert.ok(result.data.data.some(row=>row.previous_time_in==='09:00:00'&&row.new_time_in==='09:15:00'&&row.previous_time_out==='20:00:00'&&row.new_time_out==='19:00:00'&&row.reason==='QA correction audit'&&row.changed_by_user_id===1));
});
test('ATTENDANCE: malformed correction cannot clear valid recorded times',async()=>{
  for(const times of [{actual_time_in:'25:00:00',actual_time_out:'26:00:00'},{actual_time_in:'09:15:00',actual_time_out:'25:00:00'},{actual_time_in:'09:15:00garbage',actual_time_out:'19:00:00'}])ok(await request(`/attendance/${attendanceId}/correction`,{method:'PUT',body:{...times,reason:'QA invalid correction'}}),400);
  const [[row]]=await pool.execute('SELECT actual_time_in,actual_time_out FROM employee_attendance_records WHERE employee_attendance_id=?',[attendanceId]);assert.equal(row.actual_time_in,'09:15:00');assert.equal(row.actual_time_out,'19:00:00');
});
test('ATTENDANCE: concurrent manual submissions create one record',async()=>{
  const results=await Promise.all(Array.from({length:4},()=>request('/attendance/manual',{method:'POST',body:manual('2026-10-22')})));
  assert.equal(results.filter(r=>r.status===201).length,1,JSON.stringify(results));assert.equal(results.filter(r=>r.status===409).length,3,JSON.stringify(results));
});
test('ATTENDANCE: calendar, holiday classification and Excel export use saved attendance',async()=>{
  ok(await request('/attendance/day/2026-10-20',{method:'PUT',body:{day_type:'regular_holiday',notes:'QA holiday'}}));
  ok(await request('/attendance/calendar?month=2026-10'));
  const result=await request('/attendance/export-data?dateFrom=2026-10-01&dateTo=2026-10-31');ok(result);
  assert.equal(result.data.data.dates.length,31);assert.ok(result.data.data.attendance.some(row=>Number(row.employee_id)===employeeId&&row.attendance_date==='2026-10-21'));
  assert.ok(result.data.data.daySettings.some(row=>row.attendance_date==='2026-10-20'&&row.day_type==='regular_holiday'));
});
test('ATTENDANCE: reversed and oversized Excel ranges are rejected',async()=>{
  for(const range of ['dateFrom=2026-10-02&dateTo=2026-10-01','dateFrom=2026-10-01&dateTo=2026-11-02'])ok(await request('/attendance/export-data?'+range),400);
});
test('ATTENDANCE: invalid settings cannot change the current schedule',async()=>{
  const before=await request('/attendance/settings');ok(before);
  ok(await request('/attendance/settings',{method:'PUT',body:{scheduledTimeIn:'20:00:00',scheduledTimeOut:'09:00:00'}}),400);
  const after=await request('/attendance/settings');ok(after);assert.deepEqual(after.data,before.data);
});
test('ATTENDANCE: kiosk rejects unauthenticated scans and incorrect PIN, then unlocks with a scoped cookie',async()=>{
  ok(await request('/attendance-kiosk/scan',{method:'POST',body:{barcode_code:barcode,action:'time_in'},session:''}),401);
  ok(await request('/attendance-kiosk/unlock',{method:'POST',body:{pin:'000000'},session:''}),401);
  const result=await request('/attendance-kiosk/unlock',{method:'POST',body:{pin:'724381'},session:''});ok(result);assert.match(result.cookie,/HttpOnly/i);assert.match(result.cookie,/Path=\/hr-api\/api\/v1\/attendance-kiosk/);kiosk=result.cookie.split(';')[0];
  const session=await request('/attendance-kiosk/session',{session:kiosk});ok(session);assert.equal(session.data.unlocked,true);
});
test('ATTENDANCE: kiosk requires time in, validates barcodes and handles concurrent time in once',async()=>{
  const scan=body=>request('/attendance-kiosk/scan',{method:'POST',body,session:kiosk});
  ok(await scan({barcode_code:barcode,action:'time_out'}),409);ok(await scan({barcode_code:'invalid',action:'time_in'}),400);
  const results=await Promise.all(Array.from({length:4},()=>scan({barcode_code:barcode,action:'time_in'})));
  assert.equal(results.filter(r=>r.status===201).length,1,JSON.stringify(results));assert.equal(results.filter(r=>r.status===409).length,3,JSON.stringify(results));
  const response=results.find(r=>r.status===201);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());assert.equal(response.data.data.date,parts);
});
test('ATTENDANCE: kiosk time out persists once, duplicate is rejected, and lock clears the cookie',async()=>{
  const scan=()=>request('/attendance-kiosk/scan',{method:'POST',body:{barcode_code:barcode,action:'time_out'},session:kiosk});
  ok(await scan());ok(await scan(),409);
  const result=await request('/attendance-kiosk/lock',{method:'POST',body:{},session:kiosk});ok(result);assert.match(result.cookie,/Expires=|Max-Age=0/i);
});
