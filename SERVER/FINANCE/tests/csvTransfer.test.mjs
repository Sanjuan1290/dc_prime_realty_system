import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalCsv,sha256,revision,summarize} from '../src/importContract.js';
import {buildSignedFinanceCsv,readSignedFinanceCsv} from '../src/financeTransferCsv.js';
import {buildSignedFinanceCsv as realtyCsv} from '../../SYSTEM/services/financeTransferCsv.js';
import {buildSignedFinanceCsv as hrCsv} from '../../HR/services/financeTransferCsv.js';
import {parseUpload,decodeUpload} from '../src/importFile.js';
const secret='synthetic-csv-unit-signing-key-2026!';
function snapshot(count=2){
 const rows=Array.from({length:count},(_,i)=>{const row={schema_version:'1.0',source_system:'realty',source_transaction_id:'manual:'+(i+1),source_version:'1',transaction_date:'2026-10-20',recorded_at:'2026-10-20 10:00:00',transaction_type:'expense',category:'Office',description:i?'Another payment':'Comma, quote " and\r\nnext line',amount:'50.25',currency:'PHP',status:'posted',reference_id:'',source_type:'manual'};return {...row,source_revision_sha256:revision(row)}});
 const csv=canonicalCsv(rows),manifest={schema_version:'1.0',source_system:'realty',export_id:'csv-unit',generated_at:'2026-10-20T02:00:00.000Z',currency:'PHP',period:{from:'2026-10-01',to:'2026-10-20'},filters:{kind:'all',source:'all',category:'all'},status_scope:'posted_only',salary_source:'legacy',warnings:[],reconciled:true,snapshot:summarize(rows),context:{},transactions_sha256:sha256(csv),checksum_algorithm:'sha256',data_file:'transactions.csv'};
 return {rows,csv,manifest};
}
test('All independently deployed services use the same signed CSV protocol',()=>{
 const source=readFileSync(new URL('../src/financeTransferCsv.js',import.meta.url),'utf8');
 for(const path of ['../../HR/services/financeTransferCsv.js','../../SYSTEM/services/financeTransferCsv.js'])assert.equal(readFileSync(new URL(path,import.meta.url),'utf8'),source);
 const fixture=snapshot();assert.deepEqual(realtyCsv(fixture,{secret}),buildSignedFinanceCsv(fixture,{secret}));assert.deepEqual(hrCsv(fixture,{secret}),realtyCsv(fixture,{secret}));
});
test('Signed CSV is one UTF-8 file with exact cents, multiline text and embedded metadata',async()=>{
 const fixture=snapshot(),bytes=buildSignedFinanceCsv(fixture,{secret});assert.ok(bytes.toString().startsWith('\uFEFF"schema_version"'));assert.ok(bytes.toString().includes('"transfer_signature"'));
 const parsed=await parseUpload(decodeUpload({filename:'finance.CSV',base64:bytes.toString('base64')}),{secret});assert.deepEqual(parsed.rows,fixture.rows);assert.equal(parsed.totals.money_out,'100.50');assert.deepEqual(parsed.manifest,fixture.manifest);
});
test('Editing amounts or descriptions fails even if row hashes and manifest totals are recalculated',()=>{
 const fixture=snapshot(),bytes=buildSignedFinanceCsv(fixture,{secret}),old=readSignedFinanceCsv(bytes,{secret});
 for(const change of [text=>text.replace('"50.25"','"90.25"'),text=>text.replace('Another payment','Altered payment')])assert.throws(()=>readSignedFinanceCsv(Buffer.from(change(bytes.toString())),{secret}),{code:'TRANSFER_SIGNATURE_INVALID'});
 const changed=structuredClone(old.manifest);changed.snapshot.money_out='180.50';const packed=Buffer.from(JSON.stringify(changed)).toString('base64url');const original=Buffer.from(JSON.stringify(old.manifest)).toString('base64url');
 assert.throws(()=>readSignedFinanceCsv(Buffer.from(bytes.toString().replaceAll(original,packed)),{secret}),{code:'TRANSFER_SIGNATURE_INVALID'});
});
test('Truncating rows, duplicating rows and changing only one metadata copy cannot pass verification',()=>{
 const fixture=snapshot();fixture.rows.forEach(row=>row.description='Plain payment');fixture.csv=canonicalCsv(fixture.rows);fixture.manifest.transactions_sha256=sha256(fixture.csv);
 const bytes=buildSignedFinanceCsv(fixture,{secret}),lines=bytes.toString().split('\r\n');
 for(const text of [[...lines.slice(0,2),''].join('\r\n'),[...lines.slice(0,-1),lines[1],''].join('\r\n'),bytes.toString().replace('"50.25"','"50.26"')])assert.throws(()=>readSignedFinanceCsv(Buffer.from(text),{secret}),{code:'TRANSFER_SIGNATURE_INVALID'});
});
test('Missing or wrong signing secrets never fall back to unsigned checksums',()=>{
 const fixture=snapshot(),bytes=buildSignedFinanceCsv(fixture,{secret});
 assert.throws(()=>buildSignedFinanceCsv(fixture,{secret:''}),{code:'TRANSFER_KEY_REQUIRED',status:503});
 assert.throws(()=>readSignedFinanceCsv(bytes,{secret:''}),{code:'TRANSFER_KEY_REQUIRED',status:503});
 assert.throws(()=>readSignedFinanceCsv(bytes,{secret:'different-server-secret-at-least-32'}),{code:'TRANSFER_SIGNATURE_INVALID'});
});
test('Empty and over-limit exports, unsigned CSV and resaved files are rejected',()=>{
 assert.throws(()=>buildSignedFinanceCsv(snapshot(0),{secret}),{code:'EMPTY_EXPORT'});assert.throws(()=>buildSignedFinanceCsv(snapshot(501),{secret}),{code:'EXPORT_TOO_LARGE'});
 assert.throws(()=>readSignedFinanceCsv(Buffer.from(snapshot().csv),{secret}),{code:'INVALID_IMPORT_FILE'});
 const bytes=buildSignedFinanceCsv(snapshot(),{secret});assert.throws(()=>readSignedFinanceCsv(Buffer.from(bytes.toString().replaceAll('\r\n','\n')),{secret}));
});
