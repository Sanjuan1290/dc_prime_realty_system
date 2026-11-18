// Signed exports, actual import/report APIs, guarded disposable Finance DB only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {buildSalaryFinanceSnapshot} from '../../SERVER/HR/services/salaryFinanceExport.service.js';
import {buildFinanceExportSnapshot} from '../../SERVER/SYSTEM/services/companyFinanceExport.service.js';
import {buildSignedFinanceCsv} from '../../SERVER/HR/services/financeTransferCsv.js';
Object.assign(process.env,{NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'13307',TIDB_USERNAME:'qa_finance',TIDB_PASSWORD:'qa-isolated-only-password',TIDB_DATABASE:'dc_prime_finance_db',TIDB_SSL:'false'});
const {getPool}=await import('../../SERVER/FINANCE/src/db.js');
const db=getPool(),base='http://127.0.0.1:4179',prefix='/finance-api/api/v1',secret='qa-csv-signing-key-only-'.repeat(3),key=String(Date.now());
let cookie,propertyFile,reversalBatch,latestBatch;
async function api(path,body){
 const response=await fetch(base+prefix+path,{method:body?'POST':'GET',headers:{origin:base,'x-requested-with':'dcprime-finance',...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;
}
const report=(from='2026-08-01',to='2026-08-31')=>api(`/finance/reports?from=${from}&to=${to}`);
function signed(snapshot){return {filename:'qa-actual-'+randomUUID()+'.csv',base64:buildSignedFinanceCsv(snapshot,{secret}).toString('base64')}}
async function imported(file){const preview=await api('/finance/imports/preview',file);return {preview,...await api('/finance/imports/'+preview.batch_id+'/commit',{})}}
function salarySnapshot(versions,{payroll=key,amounts={},cashDates={}}={}){
 const dates={1:'2026-08-10',2:'2026-08-11',3:'2026-08-11',4:'2026-08-15',5:'2026-08-16',...cashDates};
 return buildSalaryFinanceSnapshot({from:'2026-08-01',to:'2026-08-31',events:versions.map(version=>({payload_json:{
  schema_version:'1.0',source_system:'hr',source_payroll_id:payroll,source_event_version:version,
  event_type:version%2?'salary.cash_released.v1':'salary.cash_reversed.v1',direction:version%2?'out':'in',currency:'PHP',
  cash_date:dates[version],recorded_at:dates[version]+'T01:00:00Z',amount:amounts[version]??(version===5?'8000.01':'7462.50'),
 }}))});
}
async function undo(batch){const review=await api('/finance/imports/'+batch.batch_id+'/undo-preview');return api('/finance/imports/'+batch.batch_id+'/undo',{review_token:review.review_token,reason:'Synthetic actual-totals import undo'})}
test.before(async()=>{
 const [[state]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(state.port,13307);
 assert.equal(state.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
 const login=await fetch(base+prefix+'/auth/login',{method:'POST',headers:{origin:base,'x-requested-with':'dcprime-finance','content-type':'application/json'},body:JSON.stringify({email:'admin@qa.invalid',password:'Synthetic-QA-only-2026!'})});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 propertyFile=signed(buildFinanceExportSnapshot({from:'2026-08-01',to:'2026-08-31',overview:{balance_verified:true,hr_salary_sync:true,warnings:[]},transactions:[{reference:'property:'+key,txn_date:'2026-08-01',kind:'income',amount:'403866.66',title:'QA property collection for actual totals',category:'Property Collections',source:'property',recorded_at:'2026-08-01 09:00:00'}]}));
 await imported(propertyFile);
 writeFileSync('QA_REPORTS/.runtime/actual-totals-fixture.json',JSON.stringify({payrollKey:key},null,2));
});
test.after(()=>db.end());

test('An unreversed salary is counted once in gross and actual expenses',async()=>{
 await imported(signed(salarySnapshot([1])));
 const data=await report();assert.equal(data.money_in,'403866.66');assert.equal(data.money_out,'7462.50');
 assert.equal(data.actual_money_in,'403866.66');assert.equal(data.actual_money_out,'7462.50');assert.equal(data.payroll_correction_count,0);
});
test('An undo without a new release removes the original expense from actual totals',async()=>{
 await imported(signed(salarySnapshot([2])));
 const data=await report();assert.equal(data.money_in,'411329.16');assert.equal(data.money_out,'7462.50');
 assert.equal(data.actual_money_in,'403866.66');assert.equal(data.actual_money_out,'0.00');assert.equal(data.net_change,'403866.66');assert.equal(data.payroll_correction_count,2);
});
test('Releasing again reproduces the screenshot while keeping actual income and expenses correct',async()=>{
 await imported(signed(salarySnapshot([3])));
 const data=await report();assert.equal(data.money_in,'411329.16');assert.equal(data.money_out,'14925.00');
 assert.equal(data.actual_money_in,'403866.66');assert.equal(data.actual_money_out,'7462.50');assert.equal(data.net_change,'396404.16');assert.equal(data.closing_balance,'396404.16');
 assert.equal(data.period_count,4);assert.equal(data.categories.find(row=>row.kind==='expense').amount,'14925.00');
 assert.deepEqual(await api('/finance/dashboard?from=2026-08-01&to=2026-08-31'),data);
});
test('Repeated files and the same HR salary exported from the main system never add payments again',async()=>{
 const before=await report(),snapshot=salarySnapshot([1,2,3]);
 for(const file of [signed(snapshot),signed(snapshot),signed(buildFinanceExportSnapshot({from:'2026-08-01',to:'2026-08-31',overview:{balance_verified:true,hr_salary_sync:true,warnings:[]},transactions:snapshot.rows.map(row=>({reference:row.source_transaction_id,txn_date:row.transaction_date,kind:row.transaction_type,amount:row.amount,title:row.description,category:row.category,source:'salary',recorded_at:row.recorded_at}))}))]){
  const result=await imported(file);assert.equal(result.preview.counts.duplicate,3);assert.equal(result.result.imported,0);assert.equal(result.result.duplicate,3);
  assert.deepEqual(await report(),before);
 }
 const propertyRepeat=await imported(propertyFile);assert.equal(propertyRepeat.result.duplicate,1);assert.deepEqual(await report(),before);
});
test('As-of dates do not exclude a salary because of a later reversal; crossing dates preserve ledger timing',async()=>{
 const beforeUndo=await report('2026-08-01','2026-08-10');assert.equal(beforeUndo.actual_money_out,'7462.50');assert.equal(beforeUndo.payroll_correction_count,0);
 const crossing=await report('2026-08-11','2026-08-11');assert.equal(crossing.opening_balance,'396404.16');assert.equal(crossing.net_change,'0.00');
 assert.equal(crossing.actual_money_in,'0.00');assert.equal(crossing.actual_money_out,'7462.50');assert.equal(crossing.payroll_correction_money_out,'0.00');
});
test('Multiple undo cycles remove every canceled pair and keep the latest corrected salary amount',async()=>{
 reversalBatch=await imported(signed(salarySnapshot([4])));latestBatch=await imported(signed(salarySnapshot([5])));
 const data=await report();assert.equal(data.actual_money_in,'403866.66');assert.equal(data.actual_money_out,'8000.01');assert.equal(data.payroll_correction_count,4);
 assert.equal(data.money_in,'418791.66');assert.equal(data.money_out,'22925.01');assert.equal(data.net_change,'395866.65');
});
test('Undoing imports and restoring the same source events recalculate actual totals without changing identities',async()=>{
 await undo(latestBatch);assert.equal((await report()).actual_money_out,'0.00');
 await undo(reversalBatch);assert.equal((await report()).actual_money_out,'7462.50');
 const restored=await imported(signed(salarySnapshot([4,5])));assert.equal(restored.result.restored,2);
 assert.equal((await report()).actual_money_out,'8000.01');
});
test('Equal amounts from other employees and independent legacy payroll remain real expenses',async()=>{
 await imported(signed(salarySnapshot([1],{payroll:String(Number(key)+1),cashDates:{1:'2026-08-16'}})));
 const [[category]]=await db.query("SELECT id FROM finance_categories WHERE kind='expense' AND name='Salary' LIMIT 1");
 await db.query(`INSERT INTO finance_transactions(transaction_date,kind,amount,category_id,description,status,source_system,source_transaction_id,source_revision_sha256,created_by)
  VALUES('2026-08-16','expense','7462.50',?,'QA independent legacy salary','posted','realty',?,?,1)`,[category.id,'salary:'+key,'a'.repeat(64)]);
 const data=await report();assert.equal(data.actual_money_out,'22925.01');assert.equal(data.payroll_correction_count,4);
});
test('An external HR salary with an older Realty identity is canceled only when its receipt proves the HR origin',async()=>{
 const payroll=String(Number(key)+2),cashDates={1:'2026-08-12',2:'2026-08-13',3:'2026-08-13'},first=await imported(signed(salarySnapshot([1],{payroll,amounts:{1:'500.05'},cashDates})));
 const [[transaction]]=await db.query("SELECT id FROM finance_transactions WHERE source_system='hr' AND source_transaction_id=?",['salary:'+payroll]);
 // Simulate the older importer namespace; retain the authentic external-HR receipt.
 await db.query("UPDATE finance_transactions SET source_system='realty' WHERE id=?",[transaction.id]);
 await imported(signed(salarySnapshot([2,3],{payroll,amounts:{2:'500.05',3:'500.06'},cashDates})));
 const data=await report();assert.equal(data.actual_money_out,'23425.07');assert.equal(data.payroll_correction_count,6);
 assert.equal(first.result.imported,1);
});
test('A genuine income entry with the same Salary category and amount is not a payroll reversal',async()=>{
 const [[category]]=await db.query("SELECT id FROM finance_categories WHERE kind='income' AND name='Salary' LIMIT 1");
 await api('/finance/transactions',{kind:'income',amount:'7462.50',transaction_date:'2026-08-16',category_id:String(category.id),description:'QA genuine refund separate from payroll correction'});
 const data=await report();assert.equal(data.actual_money_in,'411329.16');assert.equal(data.payroll_correction_count,6);
 const empty=await report('2026-07-01','2026-07-31');assert.equal(empty.actual_money_in,'0.00');assert.equal(empty.actual_money_out,'0.00');
});
