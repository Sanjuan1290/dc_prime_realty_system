import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import {
  parseFinanceExportFilters,selectFinanceExportRows,asFinanceTransferRows,makeFinanceTransferCsv,
  summarizeExportRows,buildFinanceExportSnapshot,buildFinanceTransferZip,buildFinanceExcel,
  FINANCE_TRANSFER_COLUMNS,FINANCE_TRANSFER_VERSION,
} from '../services/companyFinanceExport.service.js';
import { buildFinanceCsv } from '../services/companyFinances.service.js';

const tx=[
  {reference:'property:2',kind:'income',amount:'50000.00',title:'Collection, Pantihan',category:'Property Collections',source:'property',txn_date:'2026-10-25',recorded_at:'2026-10-26 10:00:00'},
  {reference:'salary:3',kind:'expense',amount:'6957.48',title:'Salary person',category:'Salary',source:'salary',txn_date:'2026-10-26',recorded_at:'2026-10-26 12:30:00'},
  {reference:'manual:19',kind:'expense',amount:'120.22',title:'=WEBSERVICE("x")',category:'Office',source:'manual',txn_date:'2026-10-27',recorded_at:''},
  {reference:'network:23',kind:'expense',amount:'2000',title:'Broker payout',category:'Commissions',source:'network_payout',txn_date:'2026-10-26',recorded_at:''},
];
const overview={balance_verified:true,warnings:[],money_in:50000,money_out:9077.70,available_balance:40922.3};
const make = (entries=tx,extra={})=>buildFinanceExportSnapshot({transactions:entries,from:'2026-10-01',to:'2026-10-31',overview,...extra,generatedAt:'2026-10-27T12:00:00.000Z',exportId:'00112233-4455-6677-8899-aabbccddeeff'});

test('v1 transfer columns are exact and follow Batch 3 schema first',()=>{
 assert.deepEqual(FINANCE_TRANSFER_COLUMNS.slice(0,13),[
 'schema_version','source_system','source_transaction_id','source_version','transaction_date','recorded_at',
 'transaction_type','category','description','amount','currency','status','reference_id']);
 assert.equal(FINANCE_TRANSFER_VERSION,'1.0');
});
test('filter validation rejects arrays, SQL-looking and unsupported types',()=>{
 for(const bad of [{kind:'both'},{source:'hacker'},{category:''},{source:['all','salary']},{kind:'a'.repeat(40)}])assert.throws(()=>parseFinanceExportFilters(bad));
 assert.deepEqual(parseFinanceExportFilters(),{kind:'all',source:'all',category:'all'});
});
test('type source and category filters all apply, no pagination',()=>{
 assert.equal(selectFinanceExportRows(tx,{kind:'expense',source:'salary',category:'Salary'}).length,1);
 assert.equal(selectFinanceExportRows(tx,{kind:'income',source:'all',category:'all'}).length,1);
 assert.equal(selectFinanceExportRows(tx,{kind:'income',source:'salary',category:'all'}).length,0);
});
test('amounts are unsigned two-place decimal strings; IDs stable; source receipt ref deliberately absent',()=>{
 const rows=asFinanceTransferRows(tx);
 assert.equal(rows[0].source_transaction_id,'property:2');
 assert.equal(rows[0].amount,'50000.00');
 assert.equal(rows[1].amount,'6957.48');
 assert.equal(rows[2].amount,'120.22');
 assert.equal(rows[3].amount,'2000.00');
 assert.equal(rows[1].reference_id,'');
 assert.equal(rows[1].status,'posted');
 assert.equal(rows[1].currency,'PHP');
});
test('invalid or duplicate source IDs fail closed, including simultaneous archive and active IDs',()=>{
 assert.throws(()=>asFinanceTransferRows([tx[0],tx[0]]),{code:'FINANCE_EXPORT_ID_CONFLICT'});
 assert.throws(()=>asFinanceTransferRows([{...tx[0],reference:'property:none'}]),{code:'FINANCE_EXPORT_ID_CONFLICT'});
});
test('invalid, zero and negative amounts are rejected; non-positive entries are not exported',()=>{
 for(const amount of [0,'0.00','-50.00','3.567','abc',null])
  assert.throws(()=>asFinanceTransferRows([{...tx[0],amount}]),{code:'FINANCE_EXPORT_DATA_INVALID'});
});
test('source revision changes on changed amount but remains same across exports',()=>{
 const prev=asFinanceTransferRows([tx[0]])[0].source_revision_sha256;
 assert.equal(prev,asFinanceTransferRows([tx[0]])[0].source_revision_sha256);
 assert.notEqual(prev,asFinanceTransferRows([{...tx[0],amount:'55000.00'}])[0].source_revision_sha256);
});
test('CSV is UTF-8 BOM, CRLF, correctly quoted and formula-resistant',()=>{
 const csv=makeFinanceTransferCsv(asFinanceTransferRows(tx));
 assert.ok(csv.startsWith('\uFEFF"schema_version","source_system"'));
 assert.match(csv,/"'=WEBSERVICE\(""x""\)"/);
 assert.ok(csv.endsWith('\r\n'));
 assert.equal(csv.split('\r\n').length,tx.length+2);
});
test('apostrophes and fullwidth prefixes receive reversible protection',()=>{
 const malicious=asFinanceTransferRows([
 {...tx[0],reference:'manual:2',title:"'=SUM(1,2)"},
 {...tx[0],reference:'manual:3',title:'＠HYPERLINK()'},
 ]);
 const csv=makeFinanceTransferCsv(malicious);
 assert.ok(csv.includes("\"''=SUM(1,2)\""));
 assert.ok(csv.includes("\"'＠HYPERLINK()\""));
});
test('summary totals use cents, not float accumulation; selected net != historical balance',()=>{
 const s=summarizeExportRows(asFinanceTransferRows(tx));
 assert.deepEqual(s,{count:4,money_in:'50000.00',money_out:'9077.70',net_change:'40922.30'});
 const selected=make(tx,{filters:{kind:'expense',source:'all',category:'all'}});
 assert.equal(selected.manifest.snapshot.money_in,'0.00');
 assert.equal(selected.manifest.snapshot.money_out,'9077.70');
 assert.equal(selected.manifest.context.unfiltered_balance_as_of_to,'40922.30');
});
test('manifest contains version, dates, filter, totals, checksum and warnings',()=>{
 const x=make();
 assert.equal(x.manifest.schema_version,'1.0');
 assert.equal(x.manifest.period.from,'2026-10-01');
 assert.equal(x.manifest.status_scope,'posted_only');
 assert.equal(x.manifest.snapshot.record_count,4);
 assert.equal(x.manifest.transactions_sha256,createHash('sha256').update(Buffer.from(x.csv,'utf8')).digest('hex'));
});
test('empty subset writes header, zero totals and verifiable manifest',()=>{
 const x=make(tx,{filters:{kind:'income',source:'salary',category:'all'}});
 assert.equal(x.rows.length,0);
 assert.equal(x.manifest.snapshot.net_change,'0.00');
 assert.equal(x.csv.split('\r\n').length,2);
});
test('report CSV remains seven original columns with signed amounts',()=>{
 const csv=buildFinanceCsv(tx);
 assert.match(csv,/Name","Type","Category","Entry","Date & Time","Amount \(PHP\)","Reference/);
 assert.match(csv,/-6957\.48/);
});
test('mock zipped transfer includes CSV and JSON manifest',async()=>{
 class ZipFake{constructor(){this.files={};}file(name,value){this.files[name]=value;}async generateAsync(){return Buffer.from(Object.keys(this.files).sort().join(','));}}
 const result=await buildFinanceTransferZip(make(),{ZIP:ZipFake});
 assert.equal(result.toString(),'manifest.json,transactions.csv');
});
test('Excel builder writes text-only transactions, summary and metadata with guarded IDs',async()=>{
 const books=[];
 class SheetFake{
  constructor(name){this.name=name;this.rows=[];this.columns=[];this.cells=new Map();}
  getRow(n){return this.cells.get(n)||this.cells.set(n,{font:{},fill:{}}).get(n);}
  addRow(row){this.rows.push(row);return row;}
  getColumn(key){return {numFmt:'@'};}
 }
 class WorkbookFake{constructor(){books.push(this);this.worksheets=[];this.xlsx={writeBuffer:async()=>Buffer.from('mock-xlsx')};}addWorksheet(name){let s=new SheetFake(name);this.worksheets.push(s);return s;}}
 const result=await buildFinanceExcel(make(),{Excel:{Workbook:WorkbookFake}});
 assert.equal(result.toString(),'mock-xlsx');
 const [data,summary,meta]=books[0].worksheets;
 assert.deepEqual([data.name,summary.name,meta.name],['Transactions','Summary','Metadata']);
 assert.equal(data.rows[2].description,'=WEBSERVICE("x")');
 assert.equal(typeof data.rows[2].description,'string');
 assert.equal(summary.rows.length,16);
 assert.ok(meta.rows.length>8);
});
test('invalid range and out-of-period transactions are rejected',()=>{
 assert.throws(()=>make(tx,{from:'2026-11-01',to:'2026-10-01'}));
 assert.throws(()=>make([{...tx[0],txn_date:'2026-09-30'}]));
});
test('endpoint preserves legacy route and permission but adds types',()=>{
 const file=fs.readFileSync(new URL('../controllers/System/companyFinances.controller.js',import.meta.url),'utf8');
 const router=fs.readFileSync(new URL('../routers/System/companyFinances.routers.js',import.meta.url),'utf8');
 assert.match(file,/profile==='report' && format==='csv'/);
 assert.match(file,/!snapshot\.manifest\.reconciled/);
 assert.match(file,/50,000/);
 assert.match(router,/requirePermission\(PERMISSIONS.COMPANY_FINANCES_VIEW\)/);
});
test('frontend advertises CSV, XLSX, ZIP and has the three filters',()=>{
 const ui=fs.readFileSync(new URL('../../../CLIENT/SYSTEM/src/pages/System/CompanyFinances.jsx',import.meta.url),'utf8');
 for(const label of ['Export transaction type','Export source','Export category','Excel report','Finance transfer CSV ZIP','Finance transfer Excel'])assert.ok(ui.includes(label),label);
 assert.match(ui,/const exportCsv=async/);
});
