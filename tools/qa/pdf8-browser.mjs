// Production bundles, real APIs and a real downloaded XLSX. Run pdf8-listings.e2e.test.mjs first.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const fixture=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf8/fixtures.json','utf8'));
const require=createRequire(new URL('../../CLIENT/SYSTEM/package.json',import.meta.url)),XLSX=require('xlsx-js-style');
const mysql=createRequire(new URL('../../SERVER/SYSTEM/package.json',import.meta.url))('mysql2/promise');
const db=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db',dateStrings:true});
const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
const base='http://127.0.0.1:4179',out=resolve('QA_REPORTS/evidence/pdf8');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const response=await context.request.post(base+'/api/v1/user/login',{headers:{origin:base},data:{email:'system@qa.invalid',password:'Synthetic-QA-only-2026!'}});assert.equal(response.status(),200,await response.text());
const page=await context.newPage(),checks=[],errors=[],failures=[];page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=500)failures.push({path:new URL(r.url()).pathname,status:r.status()})});
const project='/system/lot-projects/'+fixture.slug;
const unit=suffix=>fixture.locationCode+'-'+suffix;
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function download(format){
 await page.goto(base+project+'/listings');await page.getByRole('button',{name:'Export Listings',exact:true}).click();
 if(format==='inventory')await page.getByRole('radio',{name:/Complete Listings/}).check();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel',exact:true}).click();const file=await pending,path=resolve(out,format+'.xlsx');await file.saveAs(path);return path;
}
const set=(book,id,header,value)=>{const rows=XLSX.utils.sheet_to_json(book.Sheets.Listings,{header:1});const r=rows.findIndex(row=>row[0]===id),c=rows[0].indexOf(header);assert.ok(r>0&&c>=0);book.Sheets.Listings[XLSX.utils.encode_cell({r,c})]={v:value,t:typeof value==='number'?'n':'s'}};
let editable;
try{
 await check('Downloaded editable workbook pairs current/new columns and shows the buyer 11.5% separately from the 0% default',async()=>{
  editable=await download('editable');const book=XLSX.readFile(editable,{cellStyles:true}),rows=XLSX.utils.sheet_to_json(book.Sheets.Listings,{defval:null}),headers=XLSX.utils.sheet_to_json(book.Sheets.Listings,{header:1})[0];
  for(const field of ['Unit ID','Old Unit IDs','Cadastral Lots','Lot Type','Lot Area SQM','Installment Price / SQM','Cash Price / SQM','Reservation Fee','Legal / Misc Rate (%)','Listing Default Annual Interest Rate (%)'])assert.equal(headers.indexOf('New '+field),headers.indexOf(field)+1);
  assert.ok(!headers.includes('Cadastral Lots (comma-separated)'));const sold=rows.find(row=>row['Listing ID']===fixture.ids[0]);assert.equal(sold['Annual Interest Rate (%)'],11.5);assert.equal(sold['Listing Default Annual Interest Rate (%)'],0);assert.equal(sold['Interest Rate Source'],'Buyer SOA');assert.equal(sold['New Unit ID'],'');
  assert.equal(book.Workbook.Sheets[1].Hidden,1);assert.equal(book.Sheets.Listings['!protect'],undefined);
 });
 await check('Complete reference Excel also contains the effective 11.5% rate and no New columns',async()=>{
  const book=XLSX.readFile(await download('inventory')),row=XLSX.utils.sheet_to_json(book.Sheets.Listings).find(row=>row['Listing ID']===fixture.ids[0]);assert.equal(row['Annual Interest Rate (%)'],11.5);assert.equal(row['Listing Default Annual Interest Rate (%)'],0);assert.equal(Object.keys(row).some(key=>key.startsWith('New ')),false);
 });
 await check('Editing a current column gives a clear upload error before validation or save',async()=>{
  const book=XLSX.readFile(editable);set(book,fixture.ids[1],'Unit ID','LA-MISTAKE');const path=resolve(out,'reference-mistake.xlsx');XLSX.writeFile(book,path);
  await page.goto(base+project+'/listings/bulk-edit');await page.locator('input[type="file"]').setInputFiles(path);await page.getByText(/A current\/reference value was changed/).waitFor();assert.ok(await page.getByRole('button',{name:/^Confirm \d+ Listing Changes$/}).isDisabled());
 });
 await check('New columns preview and save through the existing bulk workflow, retaining the previous Unit ID automatically',async()=>{
  const book=XLSX.readFile(editable);set(book,fixture.ids[1],'New Unit ID',unit('0404A'));set(book,fixture.ids[1],'New Lot Area SQM',350);const path=resolve(out,'proposed-edits.xlsx');XLSX.writeFile(book,path);
  await page.locator('input[type="file"]').setInputFiles(path);await page.getByRole('button',{name:'Validate & Preview',exact:true}).click();await page.getByLabel('Reason for changes *',{exact:true}).waitFor();await page.getByText(unit('0404A'),{exact:true}).first().waitFor();
  const [[before]]=await db.execute('SELECT lot_project_listing_unit_id,lot_project_listing_area_sqm FROM lot_project_listings WHERE lot_project_listing_id=?',[fixture.ids[1]]);assert.equal(before.lot_project_listing_unit_id,unit('0404'));assert.equal(Number(before.lot_project_listing_area_sqm),325);
  await page.getByLabel('Reason for changes *',{exact:true}).fill('Synthetic PDF8 browser survey and identity adjustment');await page.screenshot({path:resolve(out,'preview.png'),fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'Confirm 1 Listing Changes',exact:true}).click();await page.getByText('Updated 1 listings.',{exact:true}).waitFor();
  const [[after]]=await db.execute('SELECT lot_project_listing_unit_id,lot_project_listing_old_unit_ids,lot_project_listing_area_sqm FROM lot_project_listings WHERE lot_project_listing_id=?',[fixture.ids[1]]);assert.equal(after.lot_project_listing_unit_id,unit('0404A'));assert.equal(after.lot_project_listing_old_unit_ids,unit('0404'));assert.equal(Number(after.lot_project_listing_area_sqm),350);
 });
 await check('Edit Listing prominently shows the protected buyer SOA rate and default separately at desktop and mobile widths',async()=>{
  await page.goto(base+project+'/listings/'+fixture.ids[0]);await page.getByRole('button',{name:'Edit',exact:true}).click();
  const buyer=page.getByLabel(/^Buyer SOA Annual Interest Rate/),inventory=page.getByLabel(/^Listing Default Annual Interest Rate/);await buyer.waitFor();assert.equal(await buyer.inputValue(),'11.5');assert.equal(await buyer.isDisabled(),true);assert.equal(await inventory.inputValue(),'0');assert.equal(await inventory.isDisabled(),true);
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});await buyer.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,`edit-listing-${width}.png`),animations:'disabled'})}
  await page.getByRole('button',{name:'Close modal',exact:true}).click();const [[row]]=await db.execute('SELECT soa_annual_interest_rate,soa_interest_rate_overridden FROM lot_project_client_profiles WHERE lot_project_client_profile_id=?',[fixture.profileId]);assert.equal(Number(row.soa_annual_interest_rate),11.5);assert.equal(row.soa_interest_rate_overridden,1);
 });
 assert.deepEqual(errors,[],'Uncaught browser errors');assert.deepEqual(failures,[],'Server errors');
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors,failures},null,2));await browser.close();await db.end()}
if(checks.some(check=>check.status==='FAIL'))process.exitCode=1;
