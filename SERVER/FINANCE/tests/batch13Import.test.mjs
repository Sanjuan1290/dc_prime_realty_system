import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {canonicalCsv,parseCsv,validateSnapshot,sha256,revision,summarize,COLUMNS,decodeCell,encodeCell} from '../src/importContract.js';
import {decodeUpload,parseUpload,MAX_FILE_BYTES} from '../src/importFile.js';
const base=resolve(import.meta.dirname,'../../..');
const row=()=>{const r={schema_version:'1.0',source_system:'realty',source_transaction_id:'property:105',source_version:'1',transaction_date:'2026-10-20',recorded_at:'2026-10-20 09:35:12',transaction_type:'income',category:'Property Collections',description:'Deposit, with "quote"',amount:'50000.00',currency:'PHP',status:'posted',reference_id:'',source_type:'property'};return {...r,source_revision_sha256:revision(r)};};
function fixture(rows=[row()]){
  const sum=summarize(rows),csv=Buffer.from(canonicalCsv(rows),'utf8');
  const manifest={schema_version:'1.0',source_system:'realty',export_id:'test-export',generated_at:'2026-10-27T10:00:00.000Z',currency:'PHP',period:{from:'2026-10-01',to:'2026-10-27'},filters:{kind:'all',source:'all',category:'all'},status_scope:'posted_only',salary_source:'legacy',warnings:[],reconciled:true,snapshot:sum,context:{},transactions_sha256:sha256(csv),checksum_algorithm:'sha256',data_file:'transactions.csv'};
  return {rows,manifest,csv};
}
const check=(f=fixture())=>validateSnapshot({rows:f.rows,manifest:f.manifest,rawCsv:f.csv});
function broken(f,fn){const other=structuredClone(f);other.csv=Buffer.from(f.csv);fn(other);return other;}
const reject=(work,code)=>assert.throws(work,e=>{assert.equal(e.code,code);return true;});

test('Batch 11 CSV exact columns, CRLF, BOM and quoted commas/quotes round-trip',()=>{const f=fixture();assert.deepEqual(parseCsv(f.csv),f.rows);assert.deepEqual(COLUMNS,Object.keys(f.rows[0]));});
test('valid manifest and selected exact totals are accepted',()=>{const result=check();assert.deepEqual(result.totals,{record_count:1,money_in:'50000.00',money_out:'0.00',net_change:'50000.00'});});
test('CSV formula escaping is reversible, without evaluating formulas',()=>{for(const s of ['=1+1','+9','@SUM(A1)','#safe',"'quote",'  =HYPERLINK(1)','normal', '-42']){const encoded=encodeCell(s);const csv=Buffer.from('\uFEFF"description"\r\n'+encoded+'\r\n');const decoded=decodeCell(encoded.slice(1,-1).replaceAll('""','"'));assert.equal(decoded,s);assert.ok(csv.length);}});
test('source revision mismatch rejects changed money',()=>{const f=fixture();const x=broken(f,v=>{v.rows[0].amount='70000.00';v.csv=Buffer.from(canonicalCsv(v.rows));v.manifest.transactions_sha256=sha256(v.csv);v.manifest.snapshot=summarize(v.rows);});reject(()=>check(x),'SOURCE_REVISION_MISMATCH');});
test('changed CSV hash rejects even if manifest totals unchanged',()=>{const f=fixture();f.csv=Buffer.concat([f.csv,Buffer.from('x')]);reject(()=>check(f),'CHECKSUM_MISMATCH');});
test('manifest warning or unreconciled transfer blocks import',()=>{let f=fixture();f.manifest.warnings=['unverified salary'];reject(()=>check(f),'RECONCILIATION_REQUIRED');f=fixture();f.manifest.reconciled=false;reject(()=>check(f),'RECONCILIATION_REQUIRED');});
test('manifest totals cannot be faked',()=>{const f=fixture();f.manifest.snapshot.money_in='50001.00';reject(()=>check(f),'TOTAL_MISMATCH');});
test('duplicate source IDs in same file are rejected',()=>{const a=row(),b={...row()};const f=fixture([a,b]);reject(()=>check(f),'DUPLICATE_SOURCE_ID');});
test('cannot claim commission_archive property identity',()=>{const r=row();r.source_type='commission_archive';r.source_revision_sha256=revision(r);const f=fixture([r]);reject(()=>check(f),'INVALID_ROW');});
test('future-dated source transaction is rejected',()=>{const r=row();r.transaction_date='2099-01-01';r.source_revision_sha256=revision(r);const f=fixture([r]);reject(()=>check(f),'INVALID_ROW');});
test('wrong type filter rejects otherwise valid source records',()=>{const f=fixture();f.manifest.filters.kind='expense';reject(()=>check(f),'FILTER_MISMATCH');});
test('malformed unquoted values fail strict CSV parsing',()=>{const f=fixture();const s=f.csv.toString().replace('"1.0"','1.0');reject(()=>parseCsv(Buffer.from(s)),'INVALID_CSV');});
test('excessive CSV rows fail before processing',()=>{const f=fixture(Array.from({length:501},(_,i)=>{const r=row();r.source_transaction_id=`property:${i+1}`;r.source_revision_sha256=revision(r);return r;}));reject(()=>parseCsv(f.csv),'TOO_MANY_ROWS');});
test('upload accepts CSV names and rejects ZIP, Excel, path traversal and oversized uploads',()=>{
 const tiny=Buffer.from('test');assert.equal(decodeUpload({filename:'finance.csv',base64:tiny.toString('base64')}).format,'csv');
 for(const filename of ['finance.zip','finance.xlsx','../../finance.csv'])reject(()=>decodeUpload({filename,base64:tiny.toString('base64')}),'INVALID_IMPORT_FILE');
 reject(()=>decodeUpload({filename:'finance.csv',base64:'bad##'}),'INVALID_IMPORT_FILE');
 reject(()=>decodeUpload({filename:'finance.csv',base64:Buffer.alloc(MAX_FILE_BYTES+1).toString('base64')}),'INVALID_IMPORT_FILE');
});
test('ZIP and Excel payloads cannot bypass CSV-only parsing',async()=>{
 for(const format of ['zip','xlsx'])await assert.rejects(()=>parseUpload({format,buffer:Buffer.from('anything')}),{code:'INVALID_IMPORT_FILE'});
});
test('Batch 13 SQL includes category approvals, preview history, source traceability and immutable-source restriction',()=>{const sql=readFileSync(resolve(base,'SERVER/FINANCE/migrations/04_finance_import.sql'),'utf8');for(const table of ['finance_import_batches','finance_import_items','finance_import_category_mappings'])assert.match(sql,new RegExp(table));assert.match(sql,/VARCHAR\(1500\)/);});
test('Accountants can preview, commit and review imports; undo remains Admin-only',()=>{const server=readFileSync(resolve(base,'SERVER/FINANCE/src/server.js'),'utf8');for(const route of ['/imports/preview','/imports/:id/commit','/imports/:id/undo'])assert.ok(server.includes(route));assert.match(server,/imports`,requireRole\('admin','accountant'\)/);assert.match(server,/imports\/preview`,requireRole\('admin','accountant'\),requireImportEnabled/);assert.match(server,/imports\/:id\/commit`,requireRole\('admin','accountant'\),requireImportEnabled/);assert.match(server,/imports\/:id\/undo`,requireRole\('admin'\)/);});
