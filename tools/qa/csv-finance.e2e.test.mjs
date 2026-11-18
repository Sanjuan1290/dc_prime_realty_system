// Requires the guarded disposable QA DB and serve-local; no production traffic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {parseUpload} from '../../SERVER/FINANCE/src/importFile.js';
import {canonicalCsv,sha256,revision,summarize} from '../../SERVER/FINANCE/src/importContract.js';
const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url)),mysql=require('mysql2/promise');
const pool=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_finance',password:'qa-isolated-only-password',database:'dc_prime_finance_db',dateStrings:true});
const systemDb=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db',dateStrings:true});
const base='http://127.0.0.1:4179',secret='qa-csv-signing-key-only-'.repeat(3),cookies={},password='Synthetic-QA-only-2026!',run=Date.now();
const prefix={system:'/api/v1',hr:'/hr-api/api/v1',finance:'/finance-api/api/v1'};
async function request(app,path,body,session=cookies[app]){
 const response=await fetch(base+prefix[app]+path,{method:body?'POST':'GET',headers:{origin:base,'x-requested-with':'dcprime-finance',...(session?{cookie:session}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const bytes=Buffer.from(await response.arrayBuffer());let data;try{data=JSON.parse(bytes.toString())}catch{data=null}
 return {status:response.status,data,bytes,headers:response.headers};
}
const ok=(r,status=200)=>assert.equal(r.status,status,JSON.stringify(r.data));
const upload=(bytes,name='finance.csv')=>request('finance','/finance/imports/preview',{filename:name,base64:bytes.toString('base64')});
const commit=batch=>request('finance',`/finance/imports/${batch.batch_id}/commit`,{});
let companyFile,companyData,companyBatch,hrFile;
test.before(async()=>{
 for(const db of [pool,systemDb]){const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));}
 // All preceding synthetic HR releases have reached SYSTEM. Mark only this QA
 // source reconciled through today so its real transfer readiness checks apply.
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await systemDb.execute('INSERT INTO finance_hr_sync_state(id,reconciled_through_date,reconciled_at,cash_advances_to_review) VALUES(1,?,UTC_TIMESTAMP(),0) ON DUPLICATE KEY UPDATE reconciled_through_date=VALUES(reconciled_through_date),reconciled_at=UTC_TIMESTAMP(),cash_advances_to_review=0',[today]);
 for(const [app,email,path] of [['system','system@qa.invalid','/user/login'],['hr','hr@qa.invalid','/auth/login'],['finance','admin@qa.invalid','/auth/login']]){const result=await request(app,path,{email,password},'');ok(result);cookies[app]=result.headers.get('set-cookie').split(';')[0]}
});
test.after(()=>Promise.all([pool.end(),systemDb.end()]));
test('Company Finances exports a signed CSV, including all filtered records and exact cents',async()=>{
 const category=await request('system','/company-finances/categories',{kind:'income',name:'CSV QA '+run});ok(category);
 const blocked=await request('system','/company-finances/transactions',{kind:'income',amount:'100.01',transaction_date:'2026-10-25',category_id:category.data.data.id,description:'CSV QA source payment'});ok(blocked,409);assert.equal(blocked.data.code,'MANUAL_ENTRIES_MOVED');
 // A pre-existing manual entry must remain exportable after new entry moves to Finance.
 await systemDb.execute("INSERT INTO company_finance_transactions(kind,amount,transaction_date,category_id,description,created_by_user_id) VALUES('income','100.01','2026-10-25',?,'CSV QA historical payment',1)",[category.data.data.id]);
 const result=await request('system','/company-finances/transactions/export?'+new URLSearchParams({from:'2026-10-01',to:'2026-10-31',format:'csv',profile:'transfer',source:'manual',kind:'income',category:'CSV QA '+run,page:'99'}));ok(result);
 assert.match(result.headers.get('content-type'),/^text\/csv/);assert.match(result.headers.get('content-disposition'),/\.csv"$/);
 companyFile=result.bytes;companyData=await parseUpload({format:'csv',buffer:companyFile},{secret});assert.equal(companyData.rows.length,1);assert.equal(companyData.totals.money_in,'100.01');
 writeFileSync('QA_REPORTS/.runtime/company-finance-verified.csv',companyFile);
 const future=await request('system','/company-finances/transactions/export?'+new URLSearchParams({from:'2026-10-01',to:'2099-12-31',format:'csv',profile:'transfer',source:'manual',kind:'income',category:'CSV QA '+run}));ok(future);
 const bounded=await parseUpload({format:'csv',buffer:future.bytes},{secret});assert.ok(bounded.manifest.period.to<'2099-12-31');assert.equal(bounded.totals.money_in,'100.01');
});
test('HR exports only released salary cash and Finance imports the original CSV',async()=>{
 const result=await request('hr','/employee-payroll/finance-export?from=2026-10-01&to=2026-10-31&format=csv');ok(result);hrFile=result.bytes;
 assert.match(result.headers.get('content-type'),/^text\/csv/);assert.match(result.headers.get('content-disposition'),/\.csv"$/);
 const data=await parseUpload({format:'csv',buffer:hrFile},{secret});assert.ok(data.rows.length);assert.ok(data.rows.every(r=>r.source_system==='hr'&&r.source_type==='salary'&&r.transaction_type==='expense'));
 const preview=await upload(hrFile,'hr-payments.csv');ok(preview,201);assert.equal(preview.data.counts.new,data.rows.length);const imported=await commit(preview.data);ok(imported);assert.equal(imported.data.result.imported_money_out,data.totals.money_out);
 writeFileSync('QA_REPORTS/.runtime/hr-finance-verified.csv',hrFile);
});
test('The same salary exported by Company Finances is skipped after an HR import',async()=>{
 const result=await request('system','/company-finances/transactions/export?from=2026-10-01&to=2026-10-31&format=csv&profile=transfer&source=salary');ok(result);
 const preview=await upload(result.bytes,'company-salary.csv');ok(preview,201);assert.ok(preview.data.counts.duplicate>=1);ok(await commit(preview.data));
});
test('Edited amounts, forged checksums and changed metadata are rejected before any preview is saved',async()=>{
 const [[before]]=await pool.query('SELECT COUNT(*) AS n FROM finance_import_batches');
 const row={...companyData.rows[0],amount:'900.01'};row.source_revision_sha256=revision(row);
 const manifest={...companyData.manifest,snapshot:summarize([row]),transactions_sha256:sha256(canonicalCsv([row]))};
 const packed=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const tampered=companyFile.toString().replace('"100.01"','"900.01"').replace(companyData.rows[0].source_revision_sha256,row.source_revision_sha256).replaceAll(packed(companyData.manifest),packed(manifest));
 for(const bytes of [Buffer.from(companyFile.toString().replace('"100.01"','"200.01"')),Buffer.from(tampered)]){const rejected=await upload(bytes);ok(rejected,422);assert.equal(rejected.data.error.code,'TRANSFER_SIGNATURE_INVALID')}
 const [[after]]=await pool.query('SELECT COUNT(*) AS n FROM finance_import_batches');assert.equal(after.n,before.n);
});
test('ZIP, Excel, unsigned CSV and renamed archives are refused by export and import endpoints',async()=>{
 for(const format of ['zip','xlsx']){
  ok(await request('system',`/company-finances/transactions/export?from=2026-10-01&to=2026-10-31&format=${format}`),400);
  ok(await request('hr',`/employee-payroll/finance-export?from=2026-10-01&to=2026-10-31&format=${format}`),400);
  ok(await upload(companyFile,'renamed.'+format),422);
 }
 ok(await request('system','/company-finances/transactions/export?from=2026-10-01&to=2026-10-31&format=csv&profile=report'),400);
 for(const bytes of [Buffer.from(canonicalCsv(companyData.rows)),Buffer.from('PK-not-a-csv')])ok(await upload(bytes),422);
});
test('A verified CSV imports once; old preview formats must be replaced while old history can still be undone',async()=>{
 let result=await upload(companyFile,'company-cash.csv');ok(result,201);companyBatch=result.data;ok(await commit(companyBatch));
 result=await upload(companyFile,'company-cash.csv');ok(result,201);assert.equal(result.data.counts.duplicate,1);
 await pool.execute("UPDATE finance_import_batches SET file_format='zip' WHERE id=?",[result.data.batch_id]);const blocked=await commit(result.data);ok(blocked,409);assert.equal(blocked.data.error.code,'CSV_REQUIRED');
 await pool.execute("UPDATE finance_import_batches SET file_format='zip' WHERE id=?",[companyBatch.batch_id]);
 const proof=await request('finance',`/finance/imports/${companyBatch.batch_id}/undo-preview`);ok(proof);
 ok(await request('finance',`/finance/imports/${companyBatch.batch_id}/undo`,{review_token:proof.data.review_token,reason:'Synthetic CSV compatibility check'}));
 const restore=await upload(companyFile);ok(restore,201);assert.equal(restore.data.counts.restore,1);ok(await commit(restore.data));
});
