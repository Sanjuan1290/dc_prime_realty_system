// Real APIs and independent disposable databases. Email is captured in memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
Object.assign(process.env,{NODE_ENV:'test',HR_DB_HOST:'127.0.0.1',HR_DB_PORT:'13307',HR_DB_USER:'qa_hr',HR_DB_PASSWORD:'qa-isolated-only-password',HR_DB_NAME:'dc_prime_hr_db',HR_DB_TLS:'false',HR_JWT_SECRET:'qa-hr-only-secret-'.repeat(4)});
const require=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url)),mysql=require('mysql2/promise');
const {requestPayrollUndo}=await import('../../SERVER/HR/services/payrollUndo.service.js');
const {sendPayrollUndoEmail}=await import('../../SERVER/HR/services/payrollUndoEmail.js');
const {db:hrDb}=await import('../../SERVER/HR/db/connect.js');
const systemDb=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db',dateStrings:true});
const financeDb=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_finance',password:'qa-isolated-only-password',database:'dc_prime_finance_db',dateStrings:true});
const {parseUpload}=await import('../../SERVER/FINANCE/src/importFile.js');
const base='http://127.0.0.1:4179',password='Synthetic-QA-only-2026!',secret='qa-csv-signing-key-only-'.repeat(3),cookies={};
const prefixes={hr:'/hr-api/api/v1',finance:'/finance-api/api/v1',system:'/api/v1'};
let payrollId,employeeId,originalSettings,firstReceipt,originalFile,releaseBatch,reversalBatch,thirdBatch,captured;
const fixture={};
async function api(app,path,body,{method=body?'POST':'GET',cookie=cookies[app]}={}){
  const response=await fetch(base+prefixes[app]+path,{method,headers:{origin:base,'x-requested-with':'dcprime-finance',...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const bytes=Buffer.from(await response.arrayBuffer());let data;try{data=JSON.parse(bytes.toString())}catch{data=null}
  return {status:response.status,data,bytes,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data};
const details=async()=>ok(await api('hr',`/employee-payroll/drafts/${payrollId}`)).data;
async function resetThrottle(){await hrDb.query('UPDATE hr_payroll_undo_challenges SET requested_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 20 MINUTE) WHERE user_id=1')}
async function codeFor(extra={}){
  captured=null;
  const result=await requestPayrollUndo(payrollId,1,{password,reason:'Synthetic authorized payroll correction',cash_date:'2026-11-17',...extra},{settings:{key:'not-used',from:'qa@invalid'},mailer:async data=>{captured=data}});
  assert.ok(captured?.code);return {challenge_id:result.challenge_id,password,code:captured.code};
}
const confirm=body=>api('hr',`/employee-payroll/payrolls/${payrollId}/undo/confirm`,body);
const release=date=>api('hr',`/employee-payroll/payrolls/${payrollId}/release`,{release_date:date,release_witness_name:'Synthetic witness'});
async function finalize(){ok(await api('hr',`/employee-payroll/drafts/${payrollId}/recalculate`,{}));ok(await api('hr',`/employee-payroll/drafts/${payrollId}/finalize`,{attendance_review_confirmed:true}))}
async function exported(from,to=from,app='hr'){
  const path=app==='hr'?`/employee-payroll/finance-export?from=${from}&to=${to}&format=csv`:`/company-finances/transactions/export?from=${from}&to=${to}&format=csv&source=salary`;
  const result=await api(app,path);ok(result);return {bytes:result.bytes,...await parseUpload({format:'csv',buffer:result.bytes},{secret})};
}
const preview=file=>api('finance','/finance/imports/preview',{filename:'synthetic-salary.csv',base64:file.bytes.toString('base64')});
async function commit(file){const p=ok(await preview(file),201);return {id:p.batch_id,data:ok(await api('finance',`/finance/imports/${p.batch_id}/commit`,{}))}}
async function undoBatch(id){const p=ok(await api('finance',`/finance/imports/${id}/undo-preview`));return api('finance',`/finance/imports/${id}/undo`,{review_token:p.review_token,reason:'Synthetic sequence undo verification'})}
async function ledgerSalary(){const [rows]=await financeDb.execute("SELECT source_transaction_id,status,kind,amount FROM finance_transactions WHERE source_system='hr' AND (source_transaction_id=? OR source_transaction_id LIKE ?) ORDER BY id",['salary:'+payrollId,'salary:'+payrollId+':%']);return rows}

test.before(async()=>{
  for(const db of [hrDb,systemDb,financeDb]){const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'))}
  for(const [app,email,path,key] of [['hr','hr@qa.invalid','/auth/login','hr'],['hr','hrviewer@qa.invalid','/auth/login','hrviewer'],['finance','admin@qa.invalid','/auth/login','finance'],['system','system@qa.invalid','/user/login','system']]){const r=await api(app,path,{email,password},{cookie:''});ok(r);cookies[key]=r.cookie}
  originalSettings=ok(await api('hr','/attendance/settings')).data;
  ok(await api('hr','/attendance/settings',{...originalSettings,scheduledTimeIn:'09:00',scheduledTimeOut:'18:00',automaticTimeOut:'18:00',breakStart:'12:00',breakMinutes:60,regularWorkingMinutes:480},{method:'PUT'}));
  const employee=ok(await api('hr','/employees',{first_name:'Synthetic',last_name:'Undo'+Date.now(),department:'Administration',position:'QA Clerk',employment_type:'regular',employee_status:'active',hire_date:'2026-11-01',monthly_basic_salary:15000,rice_allowance:0,transportation_allowance:0,rest_days:['saturday','sunday']}),201);employeeId=employee.data.employee_id;
  for(let day=1;day<=15;day++){if([0,6].includes(new Date(Date.UTC(2026,10,day)).getUTCDay()))continue;ok(await api('hr','/attendance/manual',{employee_id:employeeId,attendance_date:'2026-11-'+String(day).padStart(2,'0'),actual_time_in:'09:00:00',actual_time_out:'18:00:00',reason:'Synthetic complete attendance for undo tests'}),201)}
  const draft=ok(await api('hr','/employee-payroll/drafts/generate',{month:'2026-11',period_type:'first_half',employee_id:employeeId}),201);payrollId=draft.data.generated[0].employee_payroll_id;
  ok(await api('hr',`/employee-payroll/drafts/${payrollId}/finalize`,{attendance_review_confirmed:true}));firstReceipt=ok(await api('hr',`/employee-payroll/drafts/${payrollId}/receipt`)).data;
  Object.assign(fixture,{payrollId,employeeId});
});
test.after(async()=>{
  if(originalSettings)ok(await api('hr','/attendance/settings',originalSettings,{method:'PUT'}));
  writeFileSync('QA_REPORTS/.runtime/pdf4-fixtures.json',JSON.stringify(fixture,null,2));
  await Promise.all([hrDb.end(),systemDb.end(),financeDb.end()]);
});
test.beforeEach(resetThrottle);

test('undo requires the administrator role, permission and the current password',async()=>{
  ok(await api('hr',`/employee-payroll/payrolls/${payrollId}/undo/request`,{password,reason:'Not authorized'},{cookie:''}),401);
  ok(await api('hr',`/employee-payroll/payrolls/${payrollId}/undo/request`,{password,reason:'Not authorized'},{cookie:cookies.hrviewer}),403);
  await assert.rejects(requestPayrollUndo(payrollId,2,{password,reason:'Not an admin'}),{code:'PAYROLL_UNDO_FORBIDDEN'});
  await assert.rejects(codeFor({password:'Incorrect-password'}),{code:'PAYROLL_UNDO_PASSWORD_INVALID'});
  assert.equal((await details()).payroll_status,'finalized');
});
test('a missing email configuration fails without modifying payroll or creating an active code',async()=>{
  const result=await api('hr',`/employee-payroll/payrolls/${payrollId}/undo/request`,{password,reason:'Synthetic email configuration test'});ok(result,503);assert.equal(result.data.code,'PAYROLL_UNDO_EMAIL_NOT_CONFIGURED');assert.doesNotMatch(result.data.message,/Password reset/);
  const [[active]]=await hrDb.query('SELECT COUNT(*) AS n FROM hr_payroll_undo_challenges WHERE payroll_id=? AND used_at IS NULL',[payrollId]);assert.equal(active.n,0);assert.equal((await details()).payroll_status,'finalized');
});
test('undo sends to a changed login email without needing a password-reset URL',async()=>{
  const [[identity]]=await hrDb.query('SELECT login_email FROM hr_login_identities WHERE hr_user_id=1');
  const [[user]]=await hrDb.query('SELECT email_snapshot FROM hr_users WHERE id=1');
  const names=['RESEND_API_KEY','EMAIL_FROM','HR_PUBLIC_URL'],saved=names.map(name=>process.env[name]);
  let sent;
  try {
    await hrDb.query('UPDATE hr_login_identities SET login_email=? WHERE hr_user_id=1',['changed-login@qa.invalid']);
    await hrDb.query('UPDATE hr_users SET email_snapshot=? WHERE id=1',['changed-login@qa.invalid']);
    process.env.RESEND_API_KEY='synthetic-only';process.env.EMAIL_FROM='HR <onboarding@resend.dev>';delete process.env.HR_PUBLIC_URL;
    const requested=await requestPayrollUndo(payrollId,1,{password,reason:'Verify changed login email'},{mailer:(data,options)=>sendPayrollUndoEmail(data,{...options,send:async(url,request)=>{sent=JSON.parse(request.body);return {ok:true}}})});
    assert.deepEqual(sent.to,['changed-login@qa.invalid']);assert.match(sent.text,/\d{6}/);assert.ok(requested.challenge_id);
    assert.equal((await details()).payroll_status,'finalized');
  } finally {
    await hrDb.query('UPDATE hr_login_identities SET login_email=? WHERE hr_user_id=1',[identity.login_email]);
    await hrDb.query('UPDATE hr_users SET email_snapshot=? WHERE id=1',[user.email_snapshot]);
    names.forEach((name,index)=>{if(saved[index]===undefined)delete process.env[name];else process.env[name]=saved[index]});
  }
});
test('provider restrictions reach the caller safely and invalidate the undelivered code',async()=>{
  const before=await details();
  await assert.rejects(requestPayrollUndo(payrollId,1,{password,reason:'Synthetic restricted sender'},{settings:{key:'synthetic-only',from:'onboarding@resend.dev'},mailer:(data,options)=>sendPayrollUndoEmail(data,{...options,send:async()=>({ok:false,status:403,json:async()=>({message:'You can only send testing emails to your own email address. PRIVATE_DETAIL'})})})}),error=>error.code==='PAYROLL_UNDO_TEST_SENDER_RESTRICTED'&&!/PRIVATE_DETAIL/.test(error.message));
  const [[active]]=await hrDb.query('SELECT COUNT(*) AS n FROM hr_payroll_undo_challenges WHERE payroll_id=? AND used_at IS NULL',[payrollId]);
  assert.equal(active.n,0);assert.equal((await details()).payroll_status,before.payroll_status);
});
test('one email code permits exactly one concurrent undo and preserves the original receipt',async()=>{
  const body=await codeFor();const [[stored]]=await hrDb.query('SELECT code_hash FROM hr_payroll_undo_challenges WHERE id=?',[body.challenge_id]);assert.equal(stored.code_hash.length,64);assert.notEqual(stored.code_hash,body.code);
  const responses=await Promise.all([confirm(body),confirm(body),confirm(body)]);assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===409).length,2);
  const payroll=await details();assert.equal(payroll.payroll_status,'draft');assert.equal(payroll.undo_history.length,1);assert.equal(payroll.undo_history[0].reversal_event_id,null);
  const receipt=ok(await api('hr',`/employee-payroll/payrolls/${payrollId}/undo-history/${payroll.undo_history[0].id}/receipt`)).data;assert.equal(receipt.total,firstReceipt.total);assert.equal(receipt.official,false);assert.ok(receipt.undo_reason);
  ok(await confirm(body),409);ok(await api('hr',`/employee-payroll/payrolls/${payrollId+999}/undo-history/${payroll.undo_history[0].id}/receipt`),404);
});
test('an undone salary requires recalculation before re-finalization',async()=>{
  const result=await api('hr',`/employee-payroll/drafts/${payrollId}/finalize`,{attendance_review_confirmed:true});ok(result,409);assert.equal(result.data.code,'PAYROLL_UNDO_RECALCULATION_REQUIRED');
  await finalize();assert.equal((await details()).payroll_status,'finalized');assert.equal(ok(await api('hr',`/employee-payroll/drafts/${payrollId}/receipt`)).data.total,firstReceipt.total);
});
test('a verified undo can recalculate its employee inside a closed period without reopening the period',async()=>{
  const body=await codeFor();ok(await confirm(body));
  const payroll=await details(),periodId=payroll.employee_payroll_period_id;
  const [[period]]=await hrDb.query('SELECT payroll_status FROM employee_payroll_periods WHERE employee_payroll_period_id=?',[periodId]);
  try{
    await hrDb.query("UPDATE employee_payroll_periods SET payroll_status='finalized' WHERE employee_payroll_period_id=?",[periodId]);
    await finalize();
    const [[still]]=await hrDb.query('SELECT payroll_status FROM employee_payroll_periods WHERE employee_payroll_period_id=?',[periodId]);assert.equal(still.payroll_status,'finalized');
  }finally{await hrDb.query('UPDATE employee_payroll_periods SET payroll_status=? WHERE employee_payroll_period_id=?',[period.payroll_status,periodId])}
});
test('expired, replaced and five-times-guessed codes cannot change payroll',async()=>{
  const expired=await codeFor();await hrDb.query('UPDATE hr_payroll_undo_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[expired.challenge_id]);ok(await confirm(expired),409);
  const replaced=await codeFor(),active=await codeFor();ok(await confirm(replaced),409);
  const wrong=active.code==='000000'?'000001':'000000';for(let i=0;i<5;i++)ok(await confirm({...active,code:wrong}),403);ok(await confirm(active),409);assert.equal((await details()).payroll_status,'finalized');
});
test('a code becomes stale when payroll is released; release retries create one event',async()=>{
  const stale=await codeFor();ok(await release('2099-01-01'),409);ok(await release('2026-11-16'));ok(await release('2026-11-16'),409);
  const r=await confirm(stale);ok(r,409);assert.equal(r.data.code,'PAYROLL_UNDO_STALE');
  const [[count]]=await hrDb.query("SELECT COUNT(*) AS n FROM hr_outbox_events WHERE aggregate_id=? AND event_type='salary.cash_released.v1'",[String(payrollId)]);assert.equal(count.n,1);
  originalFile=await exported('2026-11-16');assert.equal(originalFile.rows.length,1);assert.equal(originalFile.rows[0].source_transaction_id,'salary:'+payrollId);
});
test('released payroll undo accepts a request without a checkbox and still validates the undo date',async()=>{
  assert.ok((await codeFor()).challenge_id);
  await assert.rejects(codeFor({cash_date:'2026-11-15'}),{code:'PAYROLL_UNDO_DATE_INVALID'});
  await assert.rejects(codeFor({cash_date:'2026-02-30'}),{code:'PAYROLL_UNDO_DATE_INVALID'});
  await assert.rejects(codeFor({cash_date:'2099-01-01'}),{code:'PAYROLL_UNDO_DATE_INVALID'});
});
test('undo released payroll creates one offset event, retains all evidence and binds the approved reason',async()=>{
  const body=await codeFor();const result=ok(await confirm({...body,reason:'An unauthorized replacement reason',cash_date:'2099-01-01'}));assert.ok(result.data.reversal_event_id);
  const payroll=await details();assert.equal(payroll.payroll_status,'draft');assert.equal(payroll.undo_history.length,3);assert.equal(payroll.undo_history[0].reason,'Synthetic authorized payroll correction');assert.equal(payroll.undo_history[0].cash_date,'2026-11-17');
  const [events]=await hrDb.query('SELECT event_revision,event_type,payload_json FROM hr_outbox_events WHERE aggregate_id=? ORDER BY event_revision',[String(payrollId)]);assert.equal(events.length,2);assert.equal(events[1].event_type,'salary.cash_reversed.v1');
  const original=typeof events[0].payload_json==='string'?JSON.parse(events[0].payload_json):events[0].payload_json,reversal=typeof events[1].payload_json==='string'?JSON.parse(events[1].payload_json):events[1].payload_json;assert.equal(original.amount,reversal.amount);assert.equal(reversal.direction,'in');
  assert.deepEqual((await exported('2026-11-16')).rows,originalFile.rows);
});
test('Finance refuses an orphan reversal and a valid preview never changes balances',async()=>{
  const reversal=await exported('2026-11-17');assert.equal(reversal.rows.length,1);assert.equal(reversal.rows[0].transaction_type,'income');
  const before=ok(await api('finance','/finance/dashboard?from=2026-11-01&to=2026-11-18'));
  const blocked=await preview(reversal);ok(blocked,409);assert.equal(blocked.data.error.code,'SALARY_PREDECESSOR_REQUIRED');
  ok(await preview(originalFile),201);assert.deepEqual(ok(await api('finance','/finance/dashboard?from=2026-11-01&to=2026-11-18')),before);
});
test('Finance imports the original and reversal once, with exact cents and no double balance impact',async()=>{
  const before=ok(await api('finance','/finance/dashboard?from=2026-11-01&to=2026-11-18')),balance=before.closing_balance;
  releaseBatch=await commit(originalFile);reversalBatch=await commit(await exported('2026-11-17'));
  const rows=await ledgerSalary();assert.equal(rows.length,2);assert.equal(rows[0].amount,rows[1].amount);assert.equal(rows[0].kind,'expense');assert.equal(rows[1].kind,'income');
  const duplicate=ok(await preview(await exported('2026-11-16','2026-11-17')),201);assert.equal(duplicate.counts.duplicate,2);assert.equal(duplicate.counts.new,0);
  assert.equal(ok(await api('finance','/finance/dashboard?from=2026-11-01&to=2026-11-18')).closing_balance,balance);
  const after=ok(await api('finance','/finance/reports?from=2026-11-01&to=2026-11-18'));
  assert.equal(after.actual_money_in,before.actual_money_in);assert.equal(after.actual_money_out,before.actual_money_out);
  assert.equal(after.payroll_correction_count,2);
  // Leave this preview uncommitted so the following undo proves dependency protection.
});
test('Finance cannot remove an original payment while its reversal remains active',async()=>{
  const blocked=await api('finance',`/finance/imports/${releaseBatch.id}/undo-preview`);ok(blocked,409);assert.equal(blocked.data.error.code,'SALARY_DEPENDENT_IMPORT');
  assert.ok((await ledgerSalary()).every(row=>row.status==='posted'));
});
test('re-release uses a new immutable identity and cannot be backdated before the reversal',async()=>{
  await finalize();const backdated=await release('2026-11-16');ok(backdated,409);assert.equal(backdated.data.code,'PAYROLL_RELEASE_BEFORE_REVERSAL');assert.equal((await details()).payroll_status,'finalized');
  ok(await release('2026-11-18'));const third=await exported('2026-11-18');assert.equal(third.rows[0].source_transaction_id,'salary:'+payrollId+':3');thirdBatch=await commit(third);
  assert.equal((await ledgerSalary()).filter(row=>row.status==='posted').length,3);
  const report=ok(await api('finance','/finance/reports?from=2026-11-01&to=2026-11-18'));
  assert.equal(report.actual_money_out,third.rows[0].amount);assert.equal(report.actual_money_in,'0.00');
});
test('ordered Realty delivery acknowledges retries and its export matches HR fingerprints',async()=>{
  const [events]=await hrDb.query('SELECT payload_json FROM hr_outbox_events WHERE aggregate_id=? ORDER BY event_revision',[String(payrollId)]);
  for(const row of events){const event=typeof row.payload_json==='string'?JSON.parse(row.payload_json):row.payload_json;
    for(let attempt=0;attempt<2;attempt++){const r=await fetch('http://127.0.0.1:5201/api/v1/internal/finance/salary-events',{method:'POST',headers:{authorization:'Bearer '+'qa-local-integration-token-'.repeat(3),'content-type':'application/json'},body:JSON.stringify(event)});assert.equal(r.status,200,await r.text())}}
  await systemDb.query("UPDATE finance_hr_sync_state SET reconciled_through_date='2026-11-18',reconciled_at=UTC_TIMESTAMP(),cash_advances_to_review=0 WHERE id=1");
  const hr=await exported('2026-11-16','2026-11-18'),system=await exported('2026-11-16','2026-11-18','system');
  const ordered=rows=>rows.slice().sort((a,b)=>a.source_transaction_id.localeCompare(b.source_transaction_id));assert.deepEqual(ordered(system.rows),ordered(hr.rows));assert.equal(hr.rows.length,3);
  const p=ok(await preview(system),201);assert.equal(p.counts.duplicate,3);assert.equal(p.counts.new,0);
  fixture.salaryAmount=hr.rows[0].amount;
  const report=ok(await api('system','/company-finances/overview?from=2026-11-16&to=2026-11-18')).data;
  assert.equal(report.sources.salary_paid,Number(fixture.salaryAmount));assert.equal(report.sources.salary_reversals,Number(fixture.salaryAmount));
});
test('a released payroll missing its current event blocks export instead of silently disappearing',async()=>{
  const [[event]]=await hrDb.query("SELECT event_id FROM hr_outbox_events WHERE aggregate_id=? AND event_revision=3 AND event_type='salary.cash_released.v1'",[String(payrollId)]);
  try{
    await hrDb.query("UPDATE hr_outbox_events SET event_type='qa.hidden' WHERE event_id=?",[event.event_id]);
    const response=await api('hr','/employee-payroll/finance-export?from=2026-11-18&to=2026-11-18&format=csv');ok(response,409);assert.equal(response.data.code,'SALARY_EVENT_REQUIRED');
  }finally{await hrDb.query("UPDATE hr_outbox_events SET event_type='salary.cash_released.v1' WHERE event_id=?",[event.event_id])}
});
test('Finance undo/restoration respects salary event order and stale previews roll back',async()=>{
  const stale=ok(await preview(await exported('2026-11-18')),201);
  ok(await undoBatch(thirdBatch.id));
  const failed=await api('finance',`/finance/imports/${stale.batch_id}/commit`,{});ok(failed,409);assert.equal(failed.data.error.code,'PREVIEW_STALE');
  ok(await undoBatch(reversalBatch.id));ok(await undoBatch(releaseBatch.id));assert.ok((await ledgerSalary()).every(row=>row.status==='void'));
  const restored=await commit(await exported('2026-11-16','2026-11-18'));assert.equal(restored.data.result.restored,3);assert.ok((await ledgerSalary()).every(row=>row.status==='posted'));
});
test('email delivery failure invalidates its challenge and preserves the released salary',async()=>{
  await assert.rejects(requestPayrollUndo(payrollId,1,{password,reason:'Synthetic failed mail',cash_date:'2026-11-18'},{settings:{key:'not-used',from:'qa@invalid'},mailer:async()=>{throw new Error('Synthetic mail failure')}}),{code:'PAYROLL_UNDO_EMAIL_FAILED'});
  assert.equal((await details()).payroll_status,'released');const [[row]]=await hrDb.query('SELECT used_at FROM hr_payroll_undo_challenges WHERE payroll_id=? ORDER BY requested_at DESC,id DESC LIMIT 1',[payrollId]);assert.ok(row.used_at);
});
test('database-backed verification throttling includes failed administrator passwords',async()=>{
  for(let i=0;i<5;i++)await assert.rejects(codeFor({password:'Incorrect-password'}),{code:'PAYROLL_UNDO_PASSWORD_INVALID'});
  await assert.rejects(codeFor(),{code:'PAYROLL_UNDO_RATE_LIMITED'});assert.equal((await details()).payroll_status,'released');
});
test('HR and Finance audit responses show the actor and redact secrets',async()=>{
  const hr=ok(await api('hr','/audit-logs?module=Payroll'));assert.ok(hr.items.some(row=>row.action==='payroll.undone'));assert.ok(hr.items.every(row=>row.actor_name_snapshot));
  const finance=ok(await api('finance','/finance/audit'));assert.ok(finance.items.length);assert.ok(finance.items.some(row=>row.actor_name));assert.doesNotMatch(JSON.stringify(hr),new RegExp(password));
  for(const stamp of [hr.items[0].recorded_at,finance.items[0].created_at,(await details()).undo_history[0].recorded_at])assert.ok(Math.abs(Date.now()-Date.parse(stamp.replace(' ','T')+'+08:00'))<120000,'Audit timestamps must match Asia/Manila without a second timezone shift');
});
