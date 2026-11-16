// Tests mutate only the guarded disposable QA database at loopback:13307.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {canonicalCsv,revision,sha256,summarize} from '../../SERVER/FINANCE/src/importContract.js';
import {buildFinanceTransferZip} from '../../SERVER/HR/services/salaryFinanceExport.service.js';
const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url)),mysql=require('mysql2/promise');
const pool=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_finance',password:'qa-isolated-only-password',database:'dc_prime_finance_db',dateStrings:true});
const [[server]]=await pool.execute('SELECT @@port AS port,@@datadir AS datadir');
const expected=resolve(fileURLToPath(new URL('../../',import.meta.url)),'QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/');
assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),expected);
test.after(()=>pool.end());
const base='http://127.0.0.1:4179',prefix='/finance-api/api/v1',password='Synthetic-QA-only-2026!',run=Date.now();let cookie;
async function request(path,{body,session=cookie}={}){
  const res=await fetch(base+prefix+path,{method:body?'POST':'GET',headers:{origin:base,'x-requested-with':'dcprime-finance',...(body?{'content-type':'application/json'}:{}),...(session?{cookie:session}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
const ok=(result,status=200)=>assert.equal(result.status,status,JSON.stringify(result.data));
const finance=(path,options)=>request('/finance'+path,options);
async function fixture(suffix,{category=`Automatic import ${run}`,kind='expense',amount='123.45',id=`manual:${run+suffix}`}={}){
  const row={schema_version:'1.0',source_system:'realty',source_transaction_id:id,source_version:'1',transaction_date:'2026-10-21',recorded_at:'2026-10-21 09:00:00',transaction_type:kind,category,description:'QA import undo '+suffix,amount,currency:'PHP',status:'posted',reference_id:'',source_type:'manual'};row.source_revision_sha256=revision(row);
  const csv=canonicalCsv([row]),manifest={schema_version:'1.0',source_system:'realty',export_id:randomUUID(),generated_at:'2026-10-31T00:00:00Z',currency:'PHP',period:{from:'2026-10-01',to:'2026-10-31'},filters:{kind:'all',source:'all',category:'all'},status_scope:'posted_only',salary_source:'legacy',warnings:[],reconciled:true,snapshot:summarize([row]),context:{},transactions_sha256:sha256(csv),checksum_algorithm:'sha256',data_file:'transactions.csv'};
  const buffer=await buildFinanceTransferZip({rows:[row],csv,manifest});return {body:{filename:`qa-undo-${run}-${suffix}.zip`,base64:buffer.toString('base64')},row,manifest};
}
const preview=async file=>{const result=await finance('/imports/preview',{body:file.body});ok(result,201);return result.data};
const commit=async batch=>{const result=await finance(`/imports/${batch.batch_id}/commit`,{body:{}});ok(result);return result.data};
const review=async id=>{const result=await finance(`/imports/${id}/undo-preview`);ok(result);return result.data};
const undo=async(id,proof)=>finance(`/imports/${id}/undo`,{body:{review_token:proof.review_token,reason:'QA confirmed undo of imported payments'}});
let firstFile,firstBatch,firstTransaction,startingBalance;
test('admin signs in; mapping routes are removed and unauthorized undo is denied',async()=>{
  const login=await request('/auth/login',{body:{email:'admin@qa.invalid',password},session:null});ok(login);cookie=login.cookie;
  ok(await finance('/imports/mappings'),404);
  ok(await finance('/imports/mappings',{body:{}}),404);
  ok(await finance('/imports/'+randomUUID()+'/undo',{body:{},session:''}),401);
  const viewer=await request('/auth/login',{body:{email:'viewer@qa.invalid',password},session:null});ok(viewer);
  ok(await finance('/imports/'+randomUUID()+'/undo-preview',{session:viewer.cookie}),403);
  ok(await finance('/imports/'+randomUUID()+'/undo',{body:{},session:viewer.cookie}),403);
});
test('preview proposes automatic categories without writing categories or balances',async()=>{
  firstFile=await fixture(1);const [[before]]=await pool.execute('SELECT COUNT(*) AS n FROM finance_categories');
  const dashboard=await finance('/dashboard?from=2026-10-01&to=2026-10-31');ok(dashboard);startingBalance=dashboard.data.closing_balance;
  firstBatch=await preview(firstFile);assert.equal(firstBatch.ready,true);assert.equal(firstBatch.counts.new,1);assert.equal(firstBatch.items[0].category_action,'create');
  const [[after]]=await pool.execute('SELECT COUNT(*) AS n FROM finance_categories');assert.equal(after.n,before.n);
  assert.equal((await finance('/dashboard?from=2026-10-01&to=2026-10-31')).data.closing_balance,startingBalance);
  const result=await commit(firstBatch);assert.equal(result.result.imported,1);
  const [[stored]]=await pool.execute('SELECT t.id,t.amount,t.status,c.name FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id WHERE source_system=? AND source_transaction_id=?',[firstFile.row.source_system,firstFile.row.source_transaction_id]);
  firstTransaction=stored.id;assert.equal(stored.name,firstFile.row.category);assert.equal(stored.amount,'123.45');
});
test('undo removes the payment from balances, keeps the record/audit and is idempotent concurrently',async()=>{
  const proof=await review(firstBatch.batch_id);assert.equal(proof.impact.removed,1);assert.equal(proof.impact.balance_change,'123.45');
  ok(await finance(`/imports/${firstBatch.batch_id}/undo`,{body:{reason:'Valid QA reason'}}),409);
  const results=await Promise.all([undo(firstBatch.batch_id,proof),undo(firstBatch.batch_id,proof),undo(firstBatch.batch_id,proof)]);results.forEach(result=>ok(result));assert.equal(results.filter(result=>!result.data.already_undone).length,1);
  const [[payment]]=await pool.execute('SELECT status,void_reason FROM finance_transactions WHERE id=?',[firstTransaction]);assert.equal(payment.status,'void');assert.match(payment.void_reason,/^Import undone:/);
  assert.equal((await finance('/dashboard?from=2026-10-01&to=2026-10-31')).data.closing_balance,startingBalance);
  const [[audit]]=await pool.execute("SELECT COUNT(*) AS n FROM finance_audit_logs WHERE action='finance.import.undone' AND entity_id=?",[firstBatch.batch_id]);assert.equal(audit.n,1);
  const history=await finance('/imports');ok(history);assert.equal(history.data.items.find(item=>item.id===firstBatch.batch_id).status,'undone');
});
test('re-import restores the original payment without creating another source identity',async()=>{
  const batch=await preview(firstFile);assert.equal(batch.counts.restore,1);assert.equal(batch.ready,true);
  const result=await commit(batch);assert.equal(result.result.restored,1);assert.equal(result.result.created,0);
  const [[payment]]=await pool.execute('SELECT COUNT(*) AS n,MIN(id) AS id FROM finance_transactions WHERE source_system=? AND source_transaction_id=?',[firstFile.row.source_system,firstFile.row.source_transaction_id]);assert.equal(payment.n,1);assert.equal(payment.id,firstTransaction);
});
test('overlapping imports retain shared cash until the last active import is undone',async()=>{
  const file=await fixture(2,{amount:'0.17'}),a=await preview(file);await commit(a);const b=await preview(file);assert.equal(b.counts.duplicate,1);await commit(b);
  const stale=await review(a.batch_id);
  // Change the other active receipt after the first balance-impact review.
  const proofB=await review(b.batch_id);const undoB=await undo(b.batch_id,proofB);ok(undoB);assert.equal(undoB.data.result.kept,1);
  ok(await undo(a.batch_id,stale),409);
  const proofA=await review(a.batch_id);assert.equal(proofA.impact.removed,1);ok(await undo(a.batch_id,proofA));
  const [[payment]]=await pool.execute('SELECT status FROM finance_transactions WHERE source_transaction_id=?',[file.row.source_transaction_id]);assert.equal(payment.status,'void');
});
test('concurrent commits from two previews add the same payment only once',async()=>{
  const file=await fixture(3,{kind:'income',amount:'10.01'}),a=await preview(file),b=await preview(file);
  const results=await Promise.all([commit(a),commit(b)]);assert.equal(results.reduce((sum,r)=>sum+r.result.imported,0),1);assert.equal(results.reduce((sum,r)=>sum+r.result.duplicate,0),1);
  const reviews=await Promise.all([review(a.batch_id),review(b.batch_id)]);
  const resultsUndo=await Promise.all([undo(a.batch_id,reviews[0]),undo(b.batch_id,reviews[1])]);assert.equal(resultsUndo.filter(r=>r.status===200).length,1);assert.equal(resultsUndo.filter(r=>r.status===409).length,1);
  const remaining=resultsUndo[0].status===409?a:b;ok(await undo(remaining.batch_id,await review(remaining.batch_id)));
  const [[payment]]=await pool.execute('SELECT COUNT(*) AS n,SUM(status=\'posted\') AS posted FROM finance_transactions WHERE source_transaction_id=?',[file.row.source_transaction_id]);assert.equal(payment.n,1);assert.equal(Number(payment.posted),0);
});
test('long and inactive source categories import automatically; changed source values still conflict',async()=>{
  const file=await fixture(4,{category:'QA auto '+run+' '+'Long source category '.repeat(6)}),batch=await preview(file);await commit(batch);
  const [[category]]=await pool.execute('SELECT id FROM finance_categories WHERE name=?',[file.row.category]);await pool.execute('UPDATE finance_categories SET is_active=0 WHERE id=?',[category.id]);
  const next=await fixture(5,{category:file.row.category}),ready=await preview(next);assert.equal(ready.items[0].category_action,'reactivate');await commit(ready);
  const [[active]]=await pool.execute('SELECT is_active FROM finance_categories WHERE id=?',[category.id]);assert.equal(active.is_active,1);
  const changed=await fixture(4,{id:file.row.source_transaction_id,category:file.row.category,amount:'999.99'}),blocked=await preview(changed);assert.equal(blocked.counts.conflict,1);assert.equal(blocked.ready,false);
  ok(await finance(`/imports/${blocked.batch_id}/commit`,{body:{}}),409);
  // Expire this intentional conflict so normal reconciliation can be checked.
  await pool.execute('UPDATE finance_import_batches SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 61 MINUTE) WHERE id=?',[blocked.batch_id]);
  const report=await finance('/reconciliation?from=2026-10-01&to=2026-10-31');ok(report);assert.equal(report.data.reconciliation_passed,true,JSON.stringify(report.data.issues));
});
test('partially overlapping files undo only payments no longer included by another active import',async()=>{
  const before=(await finance('/dashboard?from=2026-10-01&to=2026-10-31')).data.closing_balance;
  const parts=await Promise.all([fixture(10,{amount:'1.11'}),fixture(11,{amount:'2.22'}),fixture(12,{amount:'3.33'})]);
  const bundle=async(indexes,name)=>{const rows=indexes.map(index=>parts[index].row),csv=canonicalCsv(rows),manifest={...parts[0].manifest,export_id:randomUUID(),snapshot:summarize(rows),transactions_sha256:sha256(csv)};return {body:{filename:name+'.zip',base64:(await buildFinanceTransferZip({rows,csv,manifest})).toString('base64')}}};
  const a=await preview(await bundle([0,1],'overlap-a-'+run)),bFile=await bundle([1,2],'overlap-b-'+run);await commit(a);const b=await preview(bFile);assert.equal(b.counts.new,1);assert.equal(b.counts.duplicate,1);await commit(b);
  const proofA=await review(a.batch_id);assert.equal(proofA.impact.removed,1);assert.equal(proofA.impact.kept,1);assert.equal(proofA.impact.money_out_removed,'1.11');ok(await undo(a.batch_id,proofA));
  const proofB=await review(b.batch_id);assert.equal(proofB.impact.removed,2);assert.equal(proofB.impact.money_out_removed,'5.55');ok(await undo(b.batch_id,proofB));
  assert.equal((await finance('/dashboard?from=2026-10-01&to=2026-10-31')).data.closing_balance,before);
});
