// Real APIs, synthetic fixtures, and a guarded disposable MySQL database only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
Object.assign(process.env,{NODE_ENV:'test',HR_DB_HOST:'127.0.0.1',HR_DB_PORT:'13307',HR_DB_USER:'qa_hr',HR_DB_PASSWORD:'qa-isolated-only-password',HR_DB_NAME:'dc_prime_hr_db',HR_DB_TLS:'false'});
const require=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url)),mysql=require('mysql2/promise');
const db=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_hr',password:'qa-isolated-only-password',database:'dc_prime_hr_db',dateStrings:true});
// Root is used only for temporary failure-injection triggers on this verified QA server.
const fixtureRoot=mysql.createPool({host:'127.0.0.1',port:13307,user:'root',password:'',database:'dc_prime_hr_db'});
const base='http://127.0.0.1:4179',date='2026-11-22',prefix='BulkQA'+Date.now();
const employees=[],payrolls=[];let cookie,viewer,originalSettings,originalOt;
async function api(path,body,{method=body?'POST':'GET',session=cookie}={}){
  const response=await fetch(base+'/hr-api/api/v1'+path,{method,headers:{origin:base,...(session?{cookie:session}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const ok=(result,status=200)=>{assert.equal(result.status,status,JSON.stringify(result.data));return result.data.data};
const body=(extra={})=>({attendance_date:date,attendance_ids:employees.slice(0,3).map(e=>e.attendance_id),actual_time_out:'19:00',reason:'Authorized overtime - synthetic bulk verification',...extra});
const preview=async payload=>ok(await api('/attendance/bulk-time-out/preview',payload));
const save=(payload,review)=>api('/attendance/bulk-time-out',{...payload,review_token:review.review_token});
async function snapshot(){
  const ids=employees.slice(0,5).map(e=>e.id),marks=ids.map(()=>'?').join(',');
  const [attendance]=await db.query(`SELECT * FROM employee_attendance_records WHERE employee_id IN (${marks}) ORDER BY employee_attendance_id`,ids);
  const [history]=await db.query(`SELECT c.* FROM employee_attendance_corrections c INNER JOIN employee_attendance_records a ON a.employee_attendance_id=c.employee_attendance_id WHERE a.employee_id IN (${marks}) ORDER BY c.employee_attendance_correction_id`,ids);
  const [payroll]=await db.query(`SELECT * FROM employee_payrolls WHERE employee_id IN (${marks}) ORDER BY employee_payroll_id`,ids);
  const [audit]=await db.query(`SELECT * FROM hr_audit_logs WHERE (entity_type='employee_attendance' AND entity_id IN (${marks})) OR (entity_type='employee_payroll' AND entity_id IN (${marks})) ORDER BY id`,[...employees.slice(0,5).map(e=>String(e.attendance_id)),...payrolls.map(String)]);
  return {attendance,history,payroll,audit};
}
test.before(async()=>{
  const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');
  assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'),'Refusing writes outside disposable QA database');
  const [[rootServer]]=await fixtureRoot.query('SELECT @@port AS port,@@datadir AS datadir');assert.deepEqual(rootServer,server);
  const [[rates]]=await db.query('SELECT regular_ot_multiplier FROM employee_payroll_settings WHERE employee_payroll_settings_id=1');originalOt=rates.regular_ot_multiplier;
  await db.execute('UPDATE employee_payroll_settings SET regular_ot_multiplier=1.25 WHERE employee_payroll_settings_id=1');
  for(const email of ['hr@qa.invalid','hrviewer@qa.invalid']){const result=await api('/auth/login',{email,password:'Synthetic-QA-only-2026!'},{session:''});ok(result);if(email.startsWith('hrviewer'))viewer=result.cookie;else cookie=result.cookie}
  originalSettings=ok(await api('/attendance/settings'));
  ok(await api('/attendance/settings',{...originalSettings,scheduledTimeIn:'09:00',scheduledTimeOut:'18:00',automaticTimeOut:'18:00',breakStart:'12:00',breakMinutes:60,regularWorkingMinutes:480},{method:'PUT'}));
  for(let i=0;i<6;i++){
    const employee=ok(await api('/employees',{first_name:prefix,last_name:String(i+1).padStart(2,'0'),department:'Administration',position:'QA Clerk',employment_type:'regular',employee_status:'active',hire_date:'2026-11-01',monthly_basic_salary:15000,rest_days:['monday']}),201);
    const id=employee.employee_id;
    if(i<5){
      const attendance=ok(await api('/attendance/manual',{employee_id:id,attendance_date:date,actual_time_in:'09:00:00',actual_time_out:'18:00:00',reason:'Synthetic automatic timeout fixture'}),201);
      await db.execute("UPDATE employee_attendance_records SET source='device',time_in_source='barcode',time_out_source='automatic' WHERE employee_attendance_id=?",[attendance.id]);
      const draft=ok(await api('/employee-payroll/drafts/generate',{month:'2026-11',period_type:'second_half',employee_id:id}),201);
      payrolls.push(draft.generated[0].employee_payroll_id);
      employees.push({id,attendance_id:attendance.id,name:prefix+' '+String(i+1).padStart(2,'0')});
    }else{
      const [insert]=await db.execute('INSERT INTO employee_attendance_records (employee_id,attendance_date) VALUES (?,?)',[id,date]);
      employees.push({id,attendance_id:insert.insertId,name:prefix+' 06'});
    }
  }
  for(const [index,status] of [[1,'finalized'],[2,'released'],[4,'corrected']])await db.execute('UPDATE employee_payrolls SET payroll_status=? WHERE employee_payroll_id=?',[status,payrolls[index]]);
});
test.after(async()=>{
  if(originalSettings)ok(await api('/attendance/settings',originalSettings,{method:'PUT'}));
  if(originalOt!==undefined)await db.execute('UPDATE employee_payroll_settings SET regular_ot_multiplier=? WHERE employee_payroll_settings_id=1',[originalOt]);
  writeFileSync('QA_REPORTS/.runtime/bulk-time-out-fixtures.json',JSON.stringify({prefix,date,employees,payrolls}));
  await Promise.all([db.end(),fixtureRoot.end()]);
  const {db:serviceDb}=await import('../../SERVER/HR/db/connect.js');await serviceDb.end();
});

test('bulk adjustment requires the existing manage permission and authentication',async()=>{
  for(const path of ['/attendance/bulk-time-out/preview','/attendance/bulk-time-out']){
    ok(await api(path,body(),{session:''}),401);ok(await api(path,body(),{session:viewer}),403);
  }
});
test('invalid selection/date/reason/clock and changes to Time In are rejected without writes',async()=>{
  const before=await snapshot();
  for(const extra of [{reason:''},{attendance_date:'2026-02-30'},{attendance_date:'2026-11-21'},{attendance_ids:[]},{attendance_ids:[employees[0].attendance_id,employees[0].attendance_id]},{attendance_ids:[employees[0].attendance_id,99999999]},{attendance_ids:[employees[5].attendance_id]},{actual_time_out:'08:00'},{actual_time_out:'25:00'},{actual_time_in:'08:00'}]){
    const result=await api('/attendance/bulk-time-out/preview',body(extra));assert.ok([400,409].includes(result.status),JSON.stringify(result));
  }
  ok(await api('/attendance/bulk-time-out',body()),409);
  assert.deepEqual(await snapshot(),before);
});
test('preview reports 1h extra/OT per selected employee, eligible drafts and frozen payroll; it writes nothing',async()=>{
  const before=await snapshot(),review=await preview(body());
  assert.equal(review.changed_count,3);assert.equal(review.draft_payroll_count,1);assert.equal(review.protected_payroll_count,2);assert.equal(review.automatic_time_out,'18:00:00');
  for(const employee of review.employees){assert.equal(employee.time_in,'09:00:00');assert.equal(employee.before.overtimeSeconds,0);assert.equal(employee.after.overtimeSeconds,3600);assert.equal(employee.additional_work_seconds,3600);assert.equal(employee.after.totalWorkedSeconds,9*3600)}
  assert.deepEqual(await snapshot(),before);
});
test('editing the request or tampering with the review proof requires a fresh preview',async()=>{
  const before=await snapshot(),payload=body(),review=await preview(payload);
  ok(await save({...payload,reason:'Edited after preview'},review),409);
  ok(await save(payload,{review_token:review.review_token+'x'}),409);
  assert.deepEqual(await snapshot(),before);
});
test('changed attendance and finalized-after-preview payroll produce stale conflicts without applying corrections',async()=>{
  const payload=body(),review=await preview(payload);
  await db.execute('UPDATE employee_attendance_records SET notes=? WHERE employee_attendance_id=?',['Concurrent synthetic edit',employees[0].attendance_id]);
  const before=await snapshot();ok(await save(payload,review),409);assert.deepEqual(await snapshot(),before);
  const next=await preview(payload);await db.execute("UPDATE employee_payrolls SET payroll_status='finalized' WHERE employee_payroll_id=?",[payrolls[0]]);
  const frozen=await snapshot();ok(await save(payload,next),409);assert.deepEqual(await snapshot(),frozen);
  await db.execute("UPDATE employee_payrolls SET payroll_status='draft' WHERE employee_payroll_id=?",[payrolls[0]]);
});
test('failure on the last individual history insert rolls back all attendance and audit writes',async()=>{
  const payload=body(),review=await preview(payload),before=await snapshot();
  await fixtureRoot.query(`CREATE TRIGGER qa_bulk_history_failure BEFORE INSERT ON employee_attendance_corrections FOR EACH ROW BEGIN IF NEW.employee_attendance_id=${employees[2].attendance_id} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic bulk history failure'; END IF; END`);
  try{const result=await save(payload,review);assert.equal(result.status,500,JSON.stringify(result));assert.deepEqual(await snapshot(),before)}finally{await fixtureRoot.query('DROP TRIGGER qa_bulk_history_failure')}
});
test('failure in the final employee audit also rolls back individual history and all corrections',async()=>{
  const payload=body(),review=await preview(payload),before=await snapshot();
  await fixtureRoot.query(`CREATE TRIGGER qa_bulk_audit_failure BEFORE INSERT ON hr_audit_logs FOR EACH ROW BEGIN IF NEW.entity_type='employee_attendance' AND NEW.entity_id='${employees[2].attendance_id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic bulk audit failure'; END IF; END`);
  try{assert.equal((await save(payload,review)).status,500);assert.deepEqual(await snapshot(),before)}finally{await fixtureRoot.query('DROP TRIGGER qa_bulk_audit_failure')}
});
test('failure during draft payroll recalculation rolls back attendance, histories, audits and payroll',async()=>{
  const payload=body(),review=await preview(payload),before=await snapshot();
  await fixtureRoot.query(`CREATE TRIGGER qa_bulk_payroll_failure BEFORE UPDATE ON employee_payrolls FOR EACH ROW BEGIN IF NEW.employee_payroll_id=${payrolls[0]} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic bulk payroll failure'; END IF; END`);
  try{const result=await save(payload,review);assert.equal(result.status,500,JSON.stringify(result));assert.deepEqual(await snapshot(),before)}finally{await fixtureRoot.query('DROP TRIGGER qa_bulk_payroll_failure')}
});
test('failure writing the payroll audit rolls back a completed draft recalculation and all attendance corrections',async()=>{
  const payload=body(),review=await preview(payload),before=await snapshot();
  await fixtureRoot.query(`CREATE TRIGGER qa_bulk_payroll_audit_failure BEFORE INSERT ON hr_audit_logs FOR EACH ROW BEGIN IF NEW.entity_type='employee_payroll' AND NEW.entity_id='${payrolls[0]}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic bulk payroll audit failure'; END IF; END`);
  try{assert.equal((await save(payload,review)).status,500);assert.deepEqual(await snapshot(),before)}finally{await fixtureRoot.query('DROP TRIGGER qa_bulk_payroll_audit_failure')}
});
test('concurrent confirmation saves once, preserves Time In, recalculates only selected drafts and records each administrator correction',async()=>{
  const payload=body(),review=await preview(payload),before=await snapshot();
  const results=await Promise.all([save(payload,review),save(payload,review)]);
  assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results));assert.ok(results.some(r=>[400,409].includes(r.status)),JSON.stringify(results));
  const result=results.find(r=>r.status===200).data.data;assert.equal(result.recalculated_drafts,1);
  const after=await snapshot();
  for(let i=0;i<3;i++){
    const row=after.attendance.find(row=>row.employee_id===employees[i].id);assert.equal(row.actual_time_in,'09:00:00');assert.equal(row.time_in_source,'barcode');assert.equal(row.actual_time_out,'19:00:00');assert.equal(row.time_out_source,'admin');assert.equal(row.overtime_seconds,3600);assert.equal(row.regular_work_seconds,28800);
    const history=after.history.filter(row=>row.employee_attendance_id===employees[i].attendance_id&&row.reason===payload.reason);assert.equal(history.length,1);assert.equal(history[0].changed_by_user_id,1);assert.equal(history[0].previous_time_in,history[0].new_time_in);
    const audits=after.audit.filter(row=>row.entity_type==='employee_attendance'&&row.entity_id===String(employees[i].attendance_id)&&JSON.parse(typeof row.details_json==='string'?row.details_json:JSON.stringify(row.details_json)).metadata?.bulkOperationId===result.operation_id);assert.equal(audits.length,1);assert.equal(audits[0].hr_user_id,1);
  }
  const selectedDraft=after.payroll.find(row=>row.employee_payroll_id===payrolls[0]);assert.equal(Number(selectedDraft.overtime_minutes),60);assert.ok(Number(selectedDraft.overtime_pay)>0);
  for(let i=1;i<5;i++)assert.deepEqual(after.payroll.find(row=>row.employee_payroll_id===payrolls[i]),before.payroll.find(row=>row.employee_payroll_id===payrolls[i]));
  for(let i=3;i<5;i++)assert.deepEqual(after.attendance.find(row=>row.employee_id===employees[i].id),before.attendance.find(row=>row.employee_id===employees[i].id));
});
test('a selected corrected payroll remains frozen and unchanged records receive no duplicate history',async()=>{
  const before=await snapshot(),payload=body({attendance_ids:[employees[0].attendance_id,employees[4].attendance_id]});
  const review=await preview(payload);assert.equal(review.changed_count,1);assert.equal(review.unchanged_count,1);assert.equal(review.protected_payroll_count,1);
  ok(await save(payload,review));const after=await snapshot();
  assert.deepEqual(after.payroll,before.payroll);assert.equal(after.history.length,before.history.length+1);
  assert.deepEqual(after.attendance.find(row=>row.employee_id===employees[0].id),before.attendance.find(row=>row.employee_id===employees[0].id));
});
test('the existing single-record correction still preserves individual correction history',async()=>{
  ok(await api(`/attendance/${employees[3].attendance_id}/correction`,{actual_time_in:'09:00:00',actual_time_out:'18:30:00',reason:'Synthetic single correction regression'},{method:'PUT'}));
  const history=ok(await api(`/attendance/${employees[3].attendance_id}/corrections`)).filter(row=>row.reason==='Synthetic single correction regression');assert.equal(history.length,1);assert.equal(history[0].previous_time_out,'18:00:00');assert.equal(history[0].new_time_out,'18:30:00');
});
test('automatic timeout still closes open records at 18:00 and does not overwrite corrected records',async()=>{
  const id=employees[5].id;
  await db.execute("UPDATE employee_attendance_records SET actual_time_in='09:00:00',actual_time_out=NULL WHERE employee_id=? AND attendance_date=?",[id,date]);
  const {applyAutomaticAttendanceTimeouts}=await import('../../SERVER/HR/jobs/attendanceAutoTimeout.job.js');
  const before=await snapshot();await applyAutomaticAttendanceTimeouts({now:new Date('2026-11-22T10:00:01Z')});
  assert.deepEqual(await snapshot(),before);
  const [[row]]=await db.execute('SELECT actual_time_out,time_out_source FROM employee_attendance_records WHERE employee_id=? AND attendance_date=?',[id,date]);assert.deepEqual(row,{actual_time_out:'18:00:00',time_out_source:'automatic'});
  // Restore an incomplete fixture for the disabled-checkbox browser check.
  await db.execute('UPDATE employee_attendance_records SET actual_time_in=NULL,actual_time_out=NULL WHERE employee_id=? AND attendance_date=?',[id,date]);
  assert.equal(ok(await api('/attendance/settings')).automaticTimeOut,'18:00:00');
});
