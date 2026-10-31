// Requires setup-local-db.mjs and serve-local.mjs. Synthetic records only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {revision,summarize,canonicalCsv,sha256} from '../../SERVER/FINANCE/src/importContract.js';
const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url));
const mysql=require('mysql2/promise'), JSZip=require('jszip');
const base='http://127.0.0.1:4179', password='Synthetic-QA-only-2026!';
const pools=new Map();
const db=(app)=>{if(!pools.has(app))pools.set(app,mysql.createPool({host:'127.0.0.1',port:13307,user:`qa_${app}`,password:'qa-isolated-only-password',database:`dc_prime_${app==='system'?'realty_system':app}_db`,dateStrings:true}));return pools.get(app)};
test.after(async()=>{for(const pool of pools.values())await pool.end()});
const cookies={};
async function request(path,{method='GET',body,cookie='',headers={}}={}){
  const r=await fetch(base+path,{method,headers:{origin:base,'x-requested-with':'dcprime-finance',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  let data;const text=await r.text();try{data=JSON.parse(text)}catch{data=text}
  return {status:r.status,data,cookie:r.headers.get('set-cookie'),headers:r.headers};
}
const ok=(r,status=200)=>assert.equal(r.status,status,JSON.stringify(r.data));
const finance=(path,opts={})=>request('/finance-api/api/v1'+path,{cookie:cookies.admin,...opts});
const hr=(path,opts={})=>request('/hr-api/api/v1'+path,{cookie:cookies.hr,...opts});
const system=(path,opts={})=>request('/api/v1'+path,{cookie:cookies.system,...opts});

test('ALL: real backend entrypoints, DB health and optional WEBSITE host',async()=>{
  for(const p of ['/api/v1/health','/hr-api/api/v1/health','/finance-api/api/v1/health'])ok(await request(p));
  assert.equal((await fetch('http://127.0.0.1:5204/health')).status,200);
});
test('ALL: unauthenticated mutations and reads cannot access application records',async()=>{
  for(const [p,method] of [['/finance-api/api/v1/finance/transactions','GET'],['/finance-api/api/v1/finance/transactions','POST'],['/hr-api/api/v1/employees','GET'],['/hr-api/api/v1/employees','POST'],['/api/v1/user/getUsers','GET'],['/api/v1/user/createUser','POST']]){
    const r=await request(p,{method,body:method==='POST'?{}:undefined});ok(r,401);
  }
});
test('FINANCE: CSRF header and unapproved origins are rejected',async()=>{
  ok(await request('/finance-api/api/v1/auth/login',{method:'POST',body:{email:'admin@qa.invalid',password},headers:{'x-requested-with':''}}),403);
  ok(await request('/finance-api/api/v1/auth/login',{method:'POST',body:{email:'admin@qa.invalid',password},headers:{origin:'https://attacker.invalid'}}),403);
});
test('ALL: synthetic login, cookie attributes and protected current-user endpoint',async()=>{
  for(const [key,path,email] of [['admin','/finance-api/api/v1/auth','admin@qa.invalid'],['viewer','/finance-api/api/v1/auth','viewer@qa.invalid'],['accountant','/finance-api/api/v1/auth','accountant@qa.invalid'],['hr','/hr-api/api/v1/auth','hr@qa.invalid'],['hrviewer','/hr-api/api/v1/auth','hrviewer@qa.invalid'],['system','/api/v1/user','system@qa.invalid']]){
    const r=await request(path+'/login',{method:'POST',body:{email,password}});ok(r);assert.match(r.cookie,/HttpOnly/i);assert.match(r.cookie,/SameSite=/i);
    if(key==='hr')assert.match(r.cookie,/Path=\/hr-api\/api\/v1/);
    cookies[key]=r.cookie.split(';')[0];ok(await request(path+'/me',{cookie:cookies[key]}));
  }
});
test('ALL: cookies from other systems never authorize requests',async()=>{
  ok(await finance('/auth/me',{cookie:cookies.system+'; '+cookies.hr}),401);
  ok(await hr('/auth/me',{cookie:cookies.admin+'; '+cookies.system}),401);
  ok(await system('/user/me',{cookie:cookies.admin+'; '+cookies.hr}),401);
});
test('ALL: independent database grants deny cross-schema reads',async()=>{
  for(const [app,foreign] of [['system','dc_prime_hr_db.hr_users'],['hr','dc_prime_finance_db.finance_users'],['finance','dc_prime_realty_system_db.users']]) await assert.rejects(db(app).query(`SELECT * FROM ${foreign} LIMIT 1`),e=>['ER_TABLEACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR'].includes(e.code));
});
let incomeId,expenseId,transactionId;
test('FINANCE: admin category setup and viewer/accountant permissions',async()=>{
  let r=await finance('/finance/categories',{method:'POST',body:{kind:'income',name:'QA collections '+randomUUID()}});ok(r,201);incomeId=r.data.id;
  r=await finance('/finance/categories',{method:'POST',body:{kind:'expense',name:'QA expenses '+randomUUID()}});ok(r,201);expenseId=r.data.id;
  ok(await finance('/finance/categories',{method:'POST',cookie:cookies.accountant,body:{kind:'income',name:'Forbidden'}}),403);
  ok(await finance('/finance/transactions',{method:'POST',cookie:cookies.viewer,body:{}}),403);
  ok(await finance('/finance/users',{cookie:cookies.accountant}),403);
  ok(await finance('/finance/audit',{cookie:cookies.viewer}),403);
});
test('FINANCE: exact-cent income/expense, negative opening balance and reload persistence',async()=>{
  ok(await finance('/finance/transactions',{method:'POST',body:{kind:'expense',amount:'50.25',transaction_date:'2026-09-30',category_id:expenseId,description:'QA opening'}}),201);
  let r=await finance('/finance/transactions',{method:'POST',cookie:cookies.accountant,body:{kind:'income',amount:'100.01',transaction_date:'2026-10-20',category_id:incomeId,description:'QA cents'}});ok(r,201);transactionId=r.data.id;
  r=await finance('/finance/dashboard?from=2026-10-01&to=2026-10-30');ok(r);assert.equal(r.data.opening_balance,'-50.25');assert.equal(r.data.closing_balance,'49.76');
  const again=await finance('/finance/dashboard?from=2026-10-01&to=2026-10-30');assert.deepEqual(again.data,r.data);
});
test('FINANCE: invalid amount/category/date and SQL injection cannot mutate ledger',async()=>{
  const body={kind:'income',amount:'1.00',transaction_date:'2026-10-20',category_id:incomeId,description:'QA invalid'};
  const [[before]]=await db('finance').query('SELECT COUNT(*) AS n FROM finance_transactions');
  for(const change of [{amount:'1.999'},{amount:'-1'},{transaction_date:'2026-02-30'},{transaction_date:'2099-01-01'},{category_id:expenseId},{category_id:'1 OR 1=1'}])ok(await finance('/finance/transactions',{method:'POST',body:{...body,...change}}),400);
  ok(await finance('/finance/transactions?page=1%3BSELECT%201'),400);
  const [[after]]=await db('finance').query('SELECT COUNT(*) AS n FROM finance_transactions');assert.equal(after.n,before.n);
});
test('FINANCE: failed correction rolls back the original void and audit write',async()=>{
  const [[before]]=await db('finance').query('SELECT COUNT(*) AS n FROM finance_audit_logs');
  ok(await finance(`/finance/transactions/${transactionId}/correct`,{method:'POST',body:{kind:'income',amount:'10.00',transaction_date:'2026-10-20',category_id:expenseId,description:'QA rollback',reason:'Wrong category test'}}),400);
  const [[row]]=await db('finance').execute('SELECT status FROM finance_transactions WHERE id=?',[transactionId]);assert.equal(row.status,'posted');
  const [[after]]=await db('finance').query('SELECT COUNT(*) AS n FROM finance_audit_logs');assert.equal(after.n,before.n);
});
test('FINANCE: four concurrent void requests commit once and keep one audit record',async()=>{
  const results=await Promise.all(Array.from({length:4},()=>finance(`/finance/transactions/${transactionId}/void`,{method:'POST',body:{reason:'QA bounded concurrency'}})));
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,3);
  const [[row]]=await db('finance').execute("SELECT COUNT(*) AS n FROM finance_audit_logs WHERE entity_id=? AND action='transaction.voided'",[transactionId]);assert.equal(row.n,1);
});
test('FINANCE: corrected transactions preserve lineage and immutable history',async()=>{
  let r=await finance('/finance/transactions',{method:'POST',body:{kind:'income',amount:'7.77',transaction_date:'2026-10-20',category_id:incomeId,description:'QA correct source'}});ok(r,201);
  const original=r.data.id;r=await finance(`/finance/transactions/${original}/correct`,{method:'POST',body:{kind:'income',amount:'8.88',transaction_date:'2026-10-20',category_id:incomeId,description:'QA replacement',reason:'QA corrected amount'}});ok(r,201);
  const [rows]=await db('finance').execute('SELECT status,corrected_from_transaction_id FROM finance_transactions WHERE id IN (?,?) ORDER BY id',[original,r.data.id]);assert.equal(rows[0].status,'void');assert.equal(String(rows[1].corrected_from_transaction_id),String(original));
});
test('FINANCE: audit/import-history/reconciliation execute real SQL',async()=>{
  for(const p of ['/finance/audit?page=2','/finance/imports?page=2','/finance/reconciliation?from=2026-10-01&to=2026-10-30'])ok(await finance(p));
  for(const p of ['/finance/audit?page=1.5','/finance/imports?page=NaN'])ok(await finance(p),400);
});
test('FINANCE: real ZIP preview, category mapping, commit, concurrent retry and duplicate detection',async()=>{
  ok(await finance('/finance/imports/mappings',{method:'POST',body:{kind:'income',source_category:'QA Property Collections',category_id:incomeId}}),201);
  const row={schema_version:'1.0',source_system:'realty',source_transaction_id:'property:qa-105',source_version:'1',transaction_date:'2026-10-20',recorded_at:'2026-10-20 09:35:12',transaction_type:'income',category:'QA Property Collections',description:'QA source transfer',amount:'50000.00',currency:'PHP',status:'posted',reference_id:'',source_type:'property'};
  row.source_revision_sha256=revision(row);const rows=[row],csv=Buffer.from(canonicalCsv(rows));
  const manifest={schema_version:'1.0',source_system:'realty',export_id:randomUUID(),generated_at:'2026-10-27T10:00:00.000Z',currency:'PHP',period:{from:'2026-10-01',to:'2026-10-27'},filters:{kind:'all',source:'all',category:'all'},status_scope:'posted_only',salary_source:'legacy',warnings:[],reconciled:true,snapshot:summarize(rows),context:{},transactions_sha256:sha256(csv),checksum_algorithm:'sha256',data_file:'transactions.csv'};
  const zip=new JSZip();zip.file('manifest.json',JSON.stringify(manifest));zip.file('transactions.csv',csv);const body={filename:'qa-transfer.zip',base64:(await zip.generateAsync({type:'nodebuffer'})).toString('base64')};
  let r=await finance('/finance/imports/preview',{method:'POST',body});ok(r,201);assert.equal(r.data.ready,true);assert.equal(r.data.counts.new,1);
  const path=`/finance/imports/${r.data.batch_id}/commit`;const rs=await Promise.all(Array.from({length:3},()=>finance(path,{method:'POST',body:{}})));for(const result of rs)ok(result);
  assert.equal(rs.filter(v=>!v.data.already_committed).length,1);
  r=await finance('/finance/imports/preview',{method:'POST',body});ok(r,201);assert.equal(r.data.counts.duplicate,1);
  r=await finance('/finance/reconciliation?from=2026-10-01&to=2026-10-30');ok(r);
  const [[count]]=await db('finance').query("SELECT COUNT(*) AS n FROM finance_transactions WHERE source_system='realty' AND source_transaction_id='property:qa-105'");assert.equal(count.n,1);
});
let employeeId,payrollId;
test('HR: viewer cannot create employees or generate payroll',async()=>{
  ok(await hr('/employees',{method:'POST',cookie:cookies.hrviewer,body:{}}),403);
  ok(await hr('/employee-payroll/drafts/generate',{method:'POST',cookie:cookies.hrviewer,body:{month:'2026-10',period_type:'first_half'}}),403);
});
test('HR: employee creation, compensation/rest days/history and reload',async()=>{
  const r=await hr('/employees',{method:'POST',body:{first_name:'Synthetic',last_name:'Employee',department:'Administration',position:'QA Clerk',hire_date:'2026-10-01',monthly_basic_salary:15000,rice_allowance:500,transportation_allowance:500,rest_days:['sunday']}});ok(r,201);
  employeeId=r.data.data?.employee_id||r.data.employee_id;assert.ok(employeeId,JSON.stringify(r.data));
  const row=await hr('/employees/'+employeeId);ok(row);ok(await hr(`/employees/${employeeId}/employment-history`));
});
test('HR: manual attendance for a complete payroll period persists and duplicate entries conflict',async()=>{
  for(let day=1;day<=15;day++){
    const date='2026-10-'+String(day).padStart(2,'0');if(new Date(date+'T00:00:00Z').getUTCDay()===0)continue;
    ok(await hr('/attendance/manual',{method:'POST',body:{employee_id:employeeId,attendance_date:date,actual_time_in:'09:00:00',actual_time_out:'20:00:00',reason:'QA synthetic full shift'}}),201);
  }
  const r=await hr('/attendance/manual',{method:'POST',body:{employee_id:employeeId,attendance_date:'2026-10-01',actual_time_in:'09:00:00',actual_time_out:'20:00:00',reason:'QA duplicate'}});ok(r,409);
  ok(await hr('/attendance?month=2026-10'));
});
test('HR: payroll period, settings, draft generation and repeat request safety',async()=>{
  ok(await hr('/employee-payroll/period-preview?month=2026-10&period_type=first_half'));
  const r=await hr('/employee-payroll/drafts/generate',{method:'POST',body:{month:'2026-10',period_type:'first_half',employee_id:employeeId}});ok(r,201);
  payrollId=r.data.data.generated[0].employee_payroll_id;assert.ok(payrollId);
  ok(await hr('/employee-payroll/drafts/'+payrollId));
  const again=await hr('/employee-payroll/drafts/generate',{method:'POST',body:{month:'2026-10',period_type:'first_half',employee_id:employeeId}});assert.ok([201,409].includes(again.status),JSON.stringify(again.data));
  const [[count]]=await db('hr').execute('SELECT COUNT(*) AS n FROM employee_payrolls WHERE employee_id=?',[employeeId]);assert.equal(count.n,1);
});
test('HR: draft release and signed receipt access fail closed',async()=>{
  ok(await hr(`/employee-payroll/payrolls/${payrollId}/release`,{method:'POST',body:{release_date:'2026-10-30'}}),409);
  ok(await hr(`/employee-payroll/payrolls/${payrollId}/signed-receipts`),503);
});
test('HR: finalization freezes snapshot, concurrent release commits once and history/receipt persists',async()=>{
  const review=await hr(`/employee-payroll/drafts/${payrollId}/final-review`);ok(review);assert.equal(review.data.data.can_finalize,true,JSON.stringify(review.data));
  ok(await hr(`/employee-payroll/drafts/${payrollId}/finalize`,{method:'POST',body:{attendance_review_confirmed:true}}));
  const [[before]]=await db('hr').execute('SELECT finalized_snapshot_json,net_fund_release FROM employee_payrolls WHERE employee_payroll_id=?',[payrollId]);assert.ok(before.finalized_snapshot_json);assert.ok(Number(before.net_fund_release)>0);
  const results=await Promise.all(Array.from({length:4},()=>hr(`/employee-payroll/payrolls/${payrollId}/release`,{method:'POST',body:{release_date:'2026-10-30',release_reference:'QA synthetic release'}})));
  assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results));assert.equal(results.filter(r=>r.status===409).length,3);
  const [[after]]=await db('hr').execute('SELECT finalized_snapshot_json,payroll_status FROM employee_payrolls WHERE employee_payroll_id=?',[payrollId]);assert.equal(after.payroll_status,'released');assert.deepEqual(after.finalized_snapshot_json,before.finalized_snapshot_json);
  ok(await hr(`/employee-payroll/history/${employeeId}`));ok(await hr(`/employee-payroll/history/payrolls/${payrollId}/receipt`));
});
test('HR/SYSTEM: scheduled outbox delivery reconciles exact cash amount',async()=>{
  let row;
  for(let i=0;i<25;i++){const [rows]=await db('hr').execute('SELECT delivery_state,payload_json FROM hr_outbox_events WHERE aggregate_id=?',[String(payrollId)]);row=rows[0];if(row?.delivery_state==='delivered')break;await new Promise(r=>setTimeout(r,800))}
  assert.equal(row?.delivery_state,'delivered');const payload=typeof row.payload_json==='string'?JSON.parse(row.payload_json):row.payload_json;
  const [[entry]]=await db('system').execute('SELECT amount FROM finance_external_salary_entries WHERE event_id=?',[payload.event_id]);assert.equal(entry.amount,payload.amount);
});
test('SYSTEM: project and inventory creation persist with computed pricing and audit',async()=>{
  const name='QA Isolated Project';let r=await system('/projects/lot-projects',{method:'POST',body:{name,location:'Synthetic Cavite',locationCode:'QAZ',cadastralLots:['QA-100']}});ok(r,201);
  const [[project]]=await db('system').execute('SELECT lot_project_id,lot_project_slug FROM lot_projects WHERE lot_project_name=?',[name]);assert.ok(project);
  r=await system(`/projects/lot-projects/${project.lot_project_slug}/listings`,{method:'POST',body:{unitNumber:'1',unitCode:'QAZ-1',installmentPricePerSqm:10000,cashPricePerSqm:9500,lotAreaSqm:100,legalMiscRate:5,reservationFee:50000,status:'available'}});ok(r,201);
  ok(await system(`/projects/lot-projects/${project.lot_project_slug}/listings`));
  const [[listing]]=await db('system').execute('SELECT lot_project_listing_tcp FROM lot_project_listings WHERE lot_project_id=?',[project.lot_project_id]);assert.equal(Number(listing.lot_project_listing_tcp),1050000);
  const [[count]]=await db('system').query("SELECT COUNT(*) AS n FROM audit_logs WHERE action='create' AND module='Projects'");assert.ok(count.n>=1);
});
test('SYSTEM: authenticated projects/users/notifications/audit read real empty schema',async()=>{
  for(const p of ['/user/getUsers','/projects/lot-projects','/notifications/documents','/audit-logs']){const r=await system(p);ok(r);}
});
test('SYSTEM/HR: immutable salary receiver is idempotent under four bounded retries',async()=>{
  const event={schema_version:'1.0',event_id:randomUUID(),event_type:'salary.cash_released.v1',source_system:'hr',source_payroll_id:'99991',source_event_version:1,cash_date:'2026-10-20',recorded_at:'2026-10-20T08:00:00.000Z',currency:'PHP',amount:'6749.99',direction:'out',reference:'HR-PAYROLL-99991-RELEASE-1',display_label:'Salary payment #99991'};
  const opts={method:'POST',body:event,headers:{authorization:'Bearer '+'qa-local-integration-token-'.repeat(3)}};
  ok(await system('/internal/finance/salary-events',{method:'POST',body:event}),401);
  const rs=await Promise.all(Array.from({length:4},()=>system('/internal/finance/salary-events',opts)));for(const r of rs)ok(r);
  assert.equal(rs.filter(r=>r.data.status==='recorded').length,1);
  ok(await system('/internal/finance/salary-events',{...opts,body:{...event,amount:'7000.00'}}),409);
  const [[count]]=await db('system').query("SELECT COUNT(*) AS n,SUM(amount) AS total FROM finance_external_salary_entries WHERE source_payroll_id='99991'");assert.equal(count.n,1);assert.equal(count.total,'6749.99');
});
test('ALL: logout removes browser sessions; expired Finance session is denied',async()=>{
  const session=await finance('/auth/login',{method:'POST',body:{email:'viewer@qa.invalid',password}});ok(session);
  const expired=session.cookie.split(';')[0];await db('finance').query('UPDATE finance_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE user_id=3');
  ok(await finance('/auth/me',{cookie:expired}),401);
  for(const [fn,path] of [[finance,'/auth/logout'],[hr,'/auth/logout'],[system,'/user/logout']]){const r=await fn(path,{method:'POST'});ok(r);assert.match(r.cookie,/Max-Age=0|Expires=/i);}
});
