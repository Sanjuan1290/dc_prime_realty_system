// Synthetic listing fixtures and real Excel parsing, restricted to disposable QA MySQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../../CLIENT/SYSTEM/package.json',import.meta.url)),XLSX=require('xlsx-js-style');
const mysql=createRequire(new URL('../../SERVER/SYSTEM/package.json',import.meta.url))('mysql2/promise');
const db=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db',dateStrings:true});
const source=readFileSync('CLIENT/SYSTEM/src/utils/listingBulkExcel.js','utf8').replace("import * as XLSX from 'xlsx-js-style'",`import XLSX from '${pathToFileURL(require.resolve('xlsx-js-style')).href}'`);
const {createListingWorkbook,parseBulkWorkbook}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const base='http://127.0.0.1:4179',slug='qa-pdf8-'+Date.now(),root='/projects/lot-projects/'+slug;
const locationCode='Q8'+Date.now().toString(36).slice(-6).toUpperCase(),unit=suffix=>locationCode+'-'+suffix;
let cookie,projectId,profileId,accountId;const ids=[];
async function api(path,body,{method=body?'POST':'GET',session=cookie}={}){
 const response=await fetch(base+'/api/v1'+path,{method,headers:{origin:base,...(session?{cookie:session}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const ok=(result,status=200)=>{assert.equal(result.status,status,JSON.stringify(result.data));return result.data};
const exportRows=async()=>ok(await api(root+'/listing-bulk/export?status=all'));
const book=async()=>{const exported=await exportRows();return createListingWorkbook({listings:exported.data,project:exported.project,editable:true})};
const set=(book,id,header,value)=>{
 const rows=XLSX.utils.sheet_to_json(book.Sheets.Listings,{header:1}),r=rows.findIndex(row=>row[0]===id),c=rows[0].indexOf(header);assert.ok(r>0&&c>=0);
 book.Sheets.Listings[XLSX.utils.encode_cell({r,c})]={v:value,t:typeof value==='number'?'n':'s'};
};
const parse=book=>{const bytes=XLSX.write(book,{type:'array',bookType:'xlsx'});return parseBulkWorkbook({name:'QA-edits.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes},projectId)};
const validate=rows=>api(root+'/listing-bulk/validate',{rows});
const apply=rows=>api(root+'/listing-bulk/apply',{rows,reason:'Synthetic PDF 8 correction verification',filename:'QA-paired-columns.xlsx'});
async function snapshot(){
 const [listings]=await db.execute('SELECT * FROM lot_project_listings WHERE lot_project_id=? ORDER BY lot_project_listing_id',[projectId]);
 const [profiles]=await db.execute('SELECT * FROM lot_project_client_profiles WHERE lot_project_id=? ORDER BY lot_project_client_profile_id',[projectId]);
 const [batches]=await db.execute('SELECT * FROM lot_project_listing_bulk_batches WHERE lot_project_id=? ORDER BY batch_id',[projectId]);
 return {listings,profiles,batches};
}
test.before(async()=>{
 const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
 const login=await api('/user/login',{email:'system@qa.invalid',password:'Synthetic-QA-only-2026!'},{session:''});ok(login);cookie=login.cookie;
 const [project]=await db.execute("INSERT INTO lot_projects(lot_project_name,lot_project_slug,lot_project_location,lot_project_location_code) VALUES(?,?,'Synthetic QA location',?)",['PDF 8 Synthetic Project '+slug,slug,locationCode]);projectId=project.insertId;
 for(let i=0;i<3;i++){
  const [result]=await db.execute(`INSERT INTO lot_project_listings(lot_project_id,lot_project_listing_unit_type,lot_project_listing_unit_id,lot_project_listing_old_unit_ids,lot_project_listing_area_sqm,lot_project_listing_price_per_sqm,lot_project_listing_installment_price_per_sqm,lot_project_listing_cash_price_per_sqm,lot_project_listing_lmf_rate,lot_project_listing_reservation_fee,annual_interest_rate,lot_project_listing_status,lot_project_listing_net_selling_price,lot_project_listing_lmf_amount,lot_project_listing_tcp)
   VALUES(?,'Inner',?,?,300,2200,2200,1900,10,50000,?,?,660000,66000,726000)`,[projectId,unit('040'+(i+3)),i===0?unit('0100'):null,i===0?0:4,i===0?'sold':'available']);ids.push(result.insertId);
 }
 const [profile]=await db.execute(`INSERT INTO lot_project_client_profiles(lot_project_id,lot_project_listing_id,buyer_full_name,buyer_email,soa_annual_interest_rate,soa_interest_rate_overridden,soa_mode_of_payment,soa_selected_price_per_sqm,soa_selected_base_selling_price,soa_selected_net_selling_price,soa_selected_lmf_amount,soa_selected_tcp,soa_monthly_terms,soa_downpayment_percentage,soa_downpayment_terms,soa_reservation_fee,soa_first_due_date,soa_starting_date)
  VALUES(?,?,'Synthetic PDF8 Buyer','synthetic-buyer@qa.invalid',11.5,1,'installment',2200,660000,660000,66000,726000,24,30,3,50000,'2026-12-22','2026-11-22')`,[projectId,ids[0]]);profileId=profile.insertId;
 const [account]=await db.execute("INSERT INTO lot_project_accounts(account_reference,lot_project_id,lot_project_listing_id,lot_project_client_profile_id,buyer_name_snapshot,unit_id_snapshot) VALUES(?,?,?,?,'Synthetic PDF8 Buyer',?)",['QA-PDF8-'+Date.now(),projectId,ids[0],profileId,unit('0403')]);accountId=account.insertId;
 await db.execute('UPDATE lot_project_listings SET current_account_id=? WHERE lot_project_listing_id=?',[accountId,ids[0]]);
 // A stray newer profile must not replace the buyer attached to current_account_id.
 await db.execute("INSERT INTO lot_project_client_profiles(lot_project_id,lot_project_listing_id,buyer_full_name,soa_annual_interest_rate,soa_interest_rate_overridden) VALUES(?,?,'Synthetic unrelated former buyer',88,1)",[projectId,ids[0]]);
});
test.after(async()=>{
 if(ids.length===3){mkdirSync('QA_REPORTS/.runtime/pdf8',{recursive:true});writeFileSync('QA_REPORTS/.runtime/pdf8/fixtures.json',JSON.stringify({slug,projectId,ids,profileId,accountId,locationCode},null,2))}await db.end();
});

test('export selects the current account SOA rate of 11.5%, preserves the 0% default and excludes buyer personal data',async()=>{
 const before=await snapshot(),result=await exportRows(),sold=result.data.find(row=>row.id===ids[0]),available=result.data.find(row=>row.id===ids[1]);
 assert.equal(sold.annualInterestRate,0);assert.equal(sold.soaAnnualInterestRate,11.5);assert.equal(sold.soaInterestRateSource,'custom');assert.equal(available.soaAnnualInterestRate,4);assert.equal(available.soaInterestRateSource,'listing');
 assert.equal(Object.hasOwn(sold,'buyer_email'),false);assert.equal(Object.hasOwn(sold,'buyer_full_name'),false);assert.deepEqual(await snapshot(),before);
});
test('explicit 0% buyer overrides and inherited listing rates are distinguished correctly',async()=>{
 try{
  await db.execute('UPDATE lot_project_client_profiles SET soa_annual_interest_rate=0 WHERE lot_project_client_profile_id=?',[profileId]);let row=(await exportRows()).data.find(row=>row.id===ids[0]);assert.equal(row.soaAnnualInterestRate,0);assert.equal(row.soaInterestRateSource,'custom');
  await db.execute('UPDATE lot_project_client_profiles SET soa_interest_rate_overridden=0,soa_annual_interest_rate=11.5 WHERE lot_project_client_profile_id=?',[profileId]);row=(await exportRows()).data.find(row=>row.id===ids[0]);assert.equal(row.soaAnnualInterestRate,0);assert.equal(row.soaInterestRateSource,'listing');
 }finally{await db.execute('UPDATE lot_project_client_profiles SET soa_interest_rate_overridden=1,soa_annual_interest_rate=11.5 WHERE lot_project_client_profile_id=?',[profileId])}
});
test('editable workbook shows one effective rate while its hidden baseline retains the listing default',async()=>{
 const workbook=await book(),headers=XLSX.utils.sheet_to_json(workbook.Sheets.Listings,{header:1})[0],sold=XLSX.utils.sheet_to_json(workbook.Sheets.Listings,{defval:null})[0],baseline=XLSX.utils.sheet_to_json(workbook.Sheets['Original Values'],{defval:null})[0];
 assert.ok(headers.includes('Annual Interest Rate (%)'));assert.ok(headers.includes('New Annual Interest Rate (%)'));
 assert.ok(!headers.includes('Listing Default Annual Interest Rate (%)'));assert.ok(!headers.includes('New Listing Default Annual Interest Rate (%)'));assert.ok(!headers.includes('Interest Rate Source'));
 assert.equal(sold['Annual Interest Rate (%)'],11.5);assert.equal(sold['New Annual Interest Rate (%)'],'');assert.equal(baseline['Inventory Annual Interest Rate Baseline (%)'],0);
});
test('untouched paired templates validate with zero changes and do not turn the visible buyer interest into a listing edit',async()=>{
 const before=await snapshot(),rows=await parse(await book()),result=ok(await validate(rows));assert.equal(result.valid,true,JSON.stringify(result));assert.equal(result.changedCount,0);assert.equal(result.unchangedCount,3);assert.deepEqual(await snapshot(),before);
});
test('protected financial changes reject the entire mixed batch without updating an eligible inventory row',async()=>{
 const workbook=await book();set(workbook,ids[0],'New Annual Interest Rate (%)',11.5);set(workbook,ids[1],'New Lot Area SQM',325);
 const rows=await parse(workbook),before=await snapshot(),result=ok(await validate(rows));assert.equal(result.valid,false);assert.match(JSON.stringify(result.errors),/Annual Interest Rate cannot be changed/);ok(await apply(rows),409);assert.deepEqual(await snapshot(),before);
});
test('stale rows with proposed changes are rejected without overwriting a concurrent edit',async()=>{
 const workbook=await book();set(workbook,ids[1],'New Lot Area SQM',325);
 await db.execute('UPDATE lot_project_listings SET lot_project_listing_area_sqm=301 WHERE lot_project_listing_id=?',[ids[1]]);
 try{const before=await snapshot(),rows=await parse(workbook),result=ok(await validate(rows));assert.equal(result.valid,false);assert.match(JSON.stringify(result.errors),/changed since the Excel file/);ok(await apply(rows),409);assert.deepEqual(await snapshot(),before)}finally{await db.execute('UPDATE lot_project_listings SET lot_project_listing_area_sqm=300 WHERE lot_project_listing_id=?',[ids[1]])}
});
test('paired edits use the existing approval/save/audit path, append the previous Unit ID and preserve buyer financial terms',async()=>{
 const workbook=await book();set(workbook,ids[0],'New Unit ID',unit('0403A'));set(workbook,ids[1],'New Lot Area SQM',325);set(workbook,ids[1],'New Reservation Fee',0);
 const before=await snapshot(),rows=await parse(workbook),review=ok(await validate(rows));assert.equal(review.valid,true,JSON.stringify(review));assert.equal(review.changedCount,2);assert.equal(review.protectedCount,1);assert.equal(review.preview.find(row=>row.listingId===ids[0]).after.oldUnitIds,unit('0100')+', '+unit('0403'));
 const saved=ok(await apply(rows));assert.equal(saved.changedCount,2);const after=await snapshot();
 const sold=after.listings.find(row=>row.lot_project_listing_id===ids[0]),prior=before.listings.find(row=>row.lot_project_listing_id===ids[0]);assert.equal(sold.lot_project_listing_unit_id,unit('0403A'));assert.equal(sold.lot_project_listing_old_unit_ids,unit('0100')+', '+unit('0403'));
 for(const field of ['annual_interest_rate','lot_project_listing_area_sqm','lot_project_listing_price_per_sqm','lot_project_listing_lmf_rate','lot_project_listing_reservation_fee','lot_project_listing_tcp','current_account_id'])assert.equal(sold[field],prior[field]);
 assert.deepEqual(after.profiles,before.profiles);assert.deepEqual(after.listings.find(row=>row.lot_project_listing_id===ids[2]),before.listings.find(row=>row.lot_project_listing_id===ids[2]));
 const available=after.listings.find(row=>row.lot_project_listing_id===ids[1]);assert.equal(Number(available.lot_project_listing_area_sqm),325);assert.equal(Number(available.lot_project_listing_reservation_fee),0);
 const [[history]]=await db.execute('SELECT COUNT(*) AS n FROM lot_project_listing_bulk_rows WHERE batch_id=?',[saved.batchId]);assert.equal(history.n,2);
 const [[account]]=await db.execute('SELECT unit_id_snapshot FROM lot_project_accounts WHERE lot_project_account_id=?',[accountId]);assert.equal(account.unit_id_snapshot,unit('0403A'));
 const final=(await exportRows()).data.find(row=>row.id===ids[0]);assert.equal(final.soaAnnualInterestRate,11.5);assert.equal(final.annualInterestRate,0);
});
test('anonymous users cannot export or apply a listing workbook',async()=>{
 ok(await api(root+'/listing-bulk/export?status=all',undefined,{session:''}),401);ok(await api(root+'/listing-bulk/apply',{rows:[]},{session:''}),401);
});
