import {createRequire} from 'node:module';
// Only the verified disposable loopback database; email is captured in memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {canonicalCsv,revision,sha256,summarize} from '../../SERVER/FINANCE/src/importContract.js';
import {buildSignedFinanceCsv} from '../../SERVER/HR/services/financeTransferCsv.js';
process.env.FINANCE_TRANSFER_SIGNING_SECRET='qa-csv-signing-key-only-'.repeat(3);
Object.assign(process.env,{NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'13307',TIDB_USERNAME:'qa_finance',TIDB_PASSWORD:'qa-isolated-only-password',TIDB_DATABASE:'dc_prime_finance_db',TIDB_SSL:'false',FINANCE_STAGING_ENABLED:'true'});
const {getPool}=await import('../../SERVER/FINANCE/src/db.js');
const {createUser,resendInvitation}=await import('../../SERVER/FINANCE/src/users.js');
const {verifyPassword}=await import('../../SERVER/FINANCE/src/passwords.js');
const {parseUpload}=await import('../../SERVER/FINANCE/src/importFile.js');
const pool=getPool(),actor={id:1},base='http://127.0.0.1:4179';
const [[server]]=await pool.execute('SELECT @@port AS port,@@datadir AS datadir');
const expected=resolve(fileURLToPath(new URL('../../',import.meta.url)),'QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/');
assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),expected);
test.after(()=>pool.end());
const options={checkSettings:()=>{},mailer:async data=>{captured=data}},password='My-own-private-Password-2026!';
let captured,user,cookie;
async function request(path,{body,session=cookie}={}){
  const res=await fetch(base+'/finance-api/api/v1'+path,{method:body?'POST':'GET',headers:{origin:base,'x-requested-with':'dcprime-finance',...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
test('Invitation generates and emails a private temporary password; DB stores only its hash',async()=>{
  user=await createUser({email:`invited-${Date.now()}@qa.invalid`,display_name:'QA Invited User',role:'viewer'},actor,options);
  assert.equal(user.invitation_status,'sent');assert.ok(captured.password.length>=24);
  assert.ok(!JSON.stringify(user).includes(captured.password));
  const [[stored]]=await pool.execute('SELECT password_hash,must_change_password FROM finance_users WHERE id=?',[user.id]);
  assert.ok(verifyPassword(captured.password,stored.password_hash));assert.equal(stored.must_change_password,1);
});
test('Temporary password session cannot read or write Finance until password is changed',async()=>{
  const login=await request('/auth/login',{body:{email:user.email,password:captured.password},session:null});assert.equal(login.status,200);assert.equal(login.data.user.must_change_password,true);cookie=login.cookie;
  const blocked=await request('/finance/dashboard');assert.equal(blocked.status,403);assert.equal(blocked.data.error.code,'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await request('/auth/change-password',{body:{current_password:captured.password,new_password:password,confirm_password:'different'}})).status,400);
  assert.equal((await request('/auth/change-password',{body:{current_password:captured.password,new_password:password,confirm_password:password}})).status,200);
  assert.equal((await request('/finance/dashboard')).status,200);
  assert.equal((await request('/finance/users')).status,403);
  assert.equal((await request('/auth/login',{body:{email:user.email,password:captured.password},session:null})).status,401);
});
test('Admins cannot assign passwords; failed email can be resent without exposing credentials',async()=>{
  await assert.rejects(createUser({email:'no@qa.invalid',display_name:'No',role:'viewer',password:'Do-not-accept-this!'},actor,options),e=>e.code==='ADMIN_PASSWORD_FORBIDDEN');
  const failed=await createUser({email:`failed-${Date.now()}@qa.invalid`,display_name:'QA Mail Retry',role:'viewer'},actor,{...options,mailer:async()=>{throw new Error('fake delivery failure')}});
  assert.equal(failed.invitation_status,'failed');
  assert.equal((await resendInvitation(failed.id,actor,options)).invitation_status,'sent');
  await pool.execute('UPDATE finance_users SET temporary_password_expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[failed.id]);
  const expired=await request('/auth/login',{body:{email:failed.email,password:captured.password},session:null});assert.equal(expired.status,401);assert.equal(expired.data.error.code,'INVITATION_EXPIRED');
  const [logs]=await pool.execute("SELECT metadata_json FROM finance_audit_logs WHERE entity_type='user' AND entity_id IN (?,?)",[user.id,failed.id]);
  assert.ok(!JSON.stringify(logs).includes(captured.password));assert.ok(!JSON.stringify(logs).includes(password));
});
test('HR audit is permissioned and released salary export downloads through Pages',async()=>{
  let login=await fetch(base+'/hr-api/api/v1/auth/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:'hr@qa.invalid',password:'Synthetic-QA-only-2026!'})});assert.equal(login.status,200);const hrCookie=login.headers.get('set-cookie').split(';')[0];
  const audit=await fetch(base+'/hr-api/api/v1/audit-logs',{headers:{cookie:hrCookie}});assert.equal(audit.status,200);assert.ok((await audit.json()).total>0);
  const result=await fetch(base+'/hr-api/api/v1/employee-payroll/finance-export?from=2026-10-01&to=2026-10-31&format=csv',{headers:{cookie:hrCookie}});
  assert.equal(result.status,200,await result.clone().text());
  const buffer=Buffer.from(await result.arrayBuffer()),parsed=await parseUpload({format:'csv',buffer});assert.ok(parsed.rows.length);assert.ok(parsed.rows.every(r=>r.source_system==='hr'&&r.transaction_type==='expense'));
  const financeLogin=await request('/auth/login',{body:{email:'admin@qa.invalid',password:'Synthetic-QA-only-2026!'},session:null});cookie=financeLogin.cookie;
  const upload={filename:'hr-salaries.csv',base64:buffer.toString('base64')};
  const preview=await request('/finance/imports/preview',{body:upload});assert.equal(preview.status,201,JSON.stringify(preview.data));assert.equal(preview.data.ready,true);
  const commit=await request(`/finance/imports/${preview.data.batch_id}/commit`,{body:{}});assert.equal(commit.status,200);assert.equal(commit.data.result.imported,preview.data.counts.new);
  const duplicate=await request('/finance/imports/preview',{body:upload});assert.equal(duplicate.data.counts.duplicate,parsed.rows.length);assert.equal(duplicate.data.counts.new,0);
  login=await fetch(base+'/hr-api/api/v1/auth/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:'hrviewer@qa.invalid',password:'Synthetic-QA-only-2026!'})});
  const viewerCookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/hr-api/api/v1/audit-logs',{headers:{cookie:viewerCookie}})).status,403);
  assert.equal((await fetch(base+'/hr-api/api/v1/employee-payroll/finance-export?from=2026-01-01&to=2026-01-31',{headers:{cookie:viewerCookie}})).status,403);
});
test('Prepare a synthetic invited account for the browser password-setup flow',async()=>{
  const account=await createUser({email:`browser-invite-${Date.now()}@qa.invalid`,display_name:'QA Browser Invite',role:'viewer'},actor,options);
  writeFileSync(new URL('../../QA_REPORTS/.runtime/browser-invitation.json',import.meta.url),JSON.stringify({email:account.email,password:captured.password}));
});
test('Previously imported external HR salaries labelled Realty are recognized without changing cash',async()=>{
  const payrollId=String(Date.now()),sourceId='salary:'+payrollId,batch=randomUUID();
  const row={schema_version:'1.0',source_system:'realty',source_transaction_id:sourceId,source_version:'1',transaction_date:'2026-10-30',recorded_at:'2026-10-30 10:00:00',transaction_type:'expense',category:'Salary',description:'Salary payment #'+payrollId,amount:'12.34',currency:'PHP',status:'posted',reference_id:'',source_type:'salary'};row.source_revision_sha256=revision(row);
  const manifest={schema_version:'1.0',source_system:'realty',export_id:randomUUID(),generated_at:'2026-10-31T00:00:00Z',currency:'PHP',period:{from:'2026-10-01',to:'2026-10-31'},filters:{kind:'expense',source:'salary',category:'all'},status_scope:'posted_only',salary_source:'external',warnings:[],reconciled:true,snapshot:summarize([row]),context:{},checksum_algorithm:'sha256',data_file:'transactions.csv',transactions_sha256:sha256(canonicalCsv([row]))};
  const [[mapping]]=await pool.execute("SELECT id AS category_id FROM finance_categories WHERE kind='expense' AND name='Salary' LIMIT 1");
  // Reproduce the database state saved by the previous importer version.
  const [insert]=await pool.execute("INSERT INTO finance_transactions(transaction_date,kind,amount,category_id,description,status,source_system,source_transaction_id,source_revision_sha256,created_by) VALUES(?,'expense',?,?,?,'posted','realty',?,?,1)",[row.transaction_date,row.amount,mapping.category_id,row.description,sourceId,row.source_revision_sha256]);
  await pool.execute("INSERT INTO finance_import_batches(id,source_system,export_id,file_name,file_sha256,file_format,source_from,source_to,source_generated_at,manifest_json,total_rows,selected_money_in,selected_money_out,created_by,status,committed_by,committed_at,result_json) VALUES(?,'realty',?,'old-external.zip',?,'zip','2026-10-01','2026-10-31',?,?,1,'0.00','12.34',1,'committed',1,UTC_TIMESTAMP(),?)",[batch,manifest.export_id,'a'.repeat(64),manifest.generated_at,JSON.stringify(manifest),JSON.stringify({imported:1})]);
  await pool.execute("INSERT INTO finance_import_items(batch_id,`row_number`,source_system,source_transaction_id,source_revision_sha256,source_category,source_kind,category_id,decision,source_row_json,transaction_id) VALUES(?,2,'realty',?,?,'Salary','expense',?,'imported',?,?)",[batch,sourceId,row.source_revision_sha256,mapping.category_id,JSON.stringify(row),insert.insertId]);
  const current={...row,source_system:'hr'},csv=canonicalCsv([current]),updated={...manifest,source_system:'hr',export_id:randomUUID(),transactions_sha256:sha256(csv)};
  const data=await buildSignedFinanceCsv({rows:[current],csv,manifest:updated});
  const preview=await request('/finance/imports/preview',{body:{filename:'hr-previously-imported.csv',base64:data.toString('base64')}});assert.equal(preview.status,201,JSON.stringify(preview.data));assert.equal(preview.data.counts.duplicate,1);assert.equal(preview.data.counts.new,0);
  const committed=await request(`/finance/imports/${preview.data.batch_id}/commit`,{body:{}});assert.equal(committed.status,200);assert.equal(committed.data.result.imported,0);
  const [[count]]=await pool.execute('SELECT COUNT(*) AS n FROM finance_transactions WHERE source_transaction_id=?',[sourceId]);assert.equal(count.n,1);
});
test('Actual Company Finances CSV exports import through Finance without deployment approval flags',async()=>{
  const login=await fetch(base+'/api/v1/user/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:'system@qa.invalid',password:'Synthetic-QA-only-2026!'})});assert.equal(login.status,200);const systemCookie=login.headers.get('set-cookie').split(';')[0];
  const system=async(path,body)=>fetch(base+'/api/v1/company-finances'+path,{method:body?'POST':'GET',headers:{cookie:systemCookie,origin:base,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const categoryResponse=await system('/categories',{kind:'expense',name:'QA Company Export '+Date.now()}),category=(await categoryResponse.json()).data;assert.equal(categoryResponse.status,200);
  const entry=await system('/transactions',{kind:'expense',amount:'44.55',transaction_date:'2026-10-25',category_id:category.id,description:'Synthetic company export payment'});assert.equal(entry.status,409);
  const mysql=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url))('mysql2/promise');
  const systemDb=await mysql.createConnection({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db'});
  try {await systemDb.execute("INSERT INTO company_finance_transactions(category_id,kind,amount,transaction_date,description,created_by_user_id) VALUES(?,'expense','44.55','2026-10-25','Synthetic historical company export payment',1)",[category.id])}finally{await systemDb.end()}
  for(const [format,extension] of [['csv','csv']]){
    const response=await system('/transactions/export?'+new URLSearchParams({from:'2026-10-01',to:'2026-10-31',profile:'transfer',format,category:category.name}));assert.equal(response.status,200,await response.clone().text());
    const buffer=Buffer.from(await response.arrayBuffer()),parsed=await parseUpload({format:extension,buffer});assert.equal(parsed.totals.money_out,'44.55');
    const preview=await request('/finance/imports/preview',{body:{filename:'company-finances.'+extension,base64:buffer.toString('base64')}});assert.equal(preview.status,201,JSON.stringify(preview.data));assert.equal(preview.data.ready,true);
    const commit=await request(`/finance/imports/${preview.data.batch_id}/commit`,{body:{}});assert.equal(commit.status,200);assert.equal(commit.data.result.imported,format==='csv'?1:0);
  }
});
