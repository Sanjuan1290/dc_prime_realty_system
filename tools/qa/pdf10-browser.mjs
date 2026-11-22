import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {db,hrDb,guard,api,ok,base,password,requireSystem} from './pdf10-common.mjs';
import {normalizedListing} from '../../SERVER/SYSTEM/controllers/Lot_Projects/Listings/listingBulkFields.js';
const f=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf10/fixtures.json','utf8')),jwt=requireSystem('jsonwebtoken'),out=resolve('QA_REPORTS/evidence/pdf10');mkdirSync(out,{recursive:true});
await guard(db);await guard(hrDb);
const cookies=Object.fromEntries(Object.entries(f.users).map(([role,user])=>[role,'token='+jwt.sign({id:user.id,authVersion:0},'qa-system-only-secret-'.repeat(3),{expiresIn:3600})]));
const call=(role,path,body,method)=>api(path,body,{cookie:cookies[role],method});
async function bulkRows(ids,changes){const rows=[];for(const id of ids){const [[row]]=await db.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=?',[id]);const original=normalizedListing(row);rows.push({listingId:id,expectedStatus:row.lot_project_listing_status==='sold'?'Sold / Active':'Available',original,values:{...original,...changes,lotType:original.lotType===changes.lotType?'Corner':changes.lotType}})}return rows}
const root='/projects/lot-projects/'+f.slug;
const batch=ok(await call('super_admin',root+'/listing-bulk/apply',{rows:await bulkRows(f.ids.slice(0,150),{lotType:'End'}),submissionKey:randomUUID(),reason:'Synthetic browser review of a 150-listing operation.'}));
for(const id of f.ids.slice(150,210))await db.query("UPDATE lot_project_listings SET lot_project_listing_status='sold' WHERE lot_project_listing_id=?",[id]);
const headRows=await bulkRows(f.ids.slice(150,210),{lotType:'Inner'}),headKey=randomUUID(),headPending=ok(await call('operations_staff',root+'/listing-bulk/apply',{rows:headRows,submissionKey:headKey,reason:'Synthetic browser survey approval for 60 units.'}),202);
const [[originalKiosk]]=await hrDb.query('SELECT attendance_kiosk_password_hash AS hash,attendance_kiosk_generation AS generation,attendance_kiosk_password_expires_at_ms AS expiry,attendance_kiosk_rotated_at AS rotated FROM hr_settings WHERE id=1');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[],contexts=[];let page;
async function contextFor(role){const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());if(role)await context.addCookies([{name:'token',value:cookies[role].slice(6),url:base}]);const next=await context.newPage();next.setDefaultTimeout(12000);next.on('pageerror',error=>errors.push(error.message));return {context,page:next}}
async function fits(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflows horizontally')}
async function screenshot(name){await page.screenshot({path:resolve(out,name+'.png'),fullPage:true,animations:'disabled',mask:[page.locator('input[aria-label="New kiosk password"]')]})}
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await screenshot('failure-'+checks.length).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
try{
 for(const role of ['operations_head','auditor','system_admin','super_admin']){
  const current=await contextFor(role);page=current.page;
  await check(role+' has separate role tabs and no internal notification controls on desktop and mobile',async()=>{
   await page.goto(base+'/portal/'+role+'/review-center');const nav=page.getByRole('navigation',{name:'Review workspace'});await nav.waitFor();
   const expected=role==='operations_head'?['Approval Queue','Returned Requests','Approval History']:role==='auditor'?['Review Queue','Audit Cases','Review History']:['Correction Queue','Awaiting Verification','Correction History'];for(const label of expected)await nav.getByRole('button',{name:label,exact:true}).waitFor();
   assert.equal(await page.getByText('Internal Notifications',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Mark All as Read',exact:true}).count(),0);assert.equal(await page.getByText('Unread Notifications',{exact:true}).count(),0);
   for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});await fits();await screenshot(role+'-'+width)}
   if(role==='super_admin'){await page.goto(base+'/portal/super_admin/notifications');await page.getByRole('navigation',{name:'Module breadcrumb'}).getByText('Notifications',{exact:true}).waitFor();await screenshot('main-notifications')}
  });
 }
 const auditor=await contextFor('auditor');page=auditor.page;
 await check('Auditor batch details render only one page, support search/filter/pagination and compact comparison',async()=>{
  await page.goto(base+'/portal/auditor/review-center/reviews/'+batch.reviewId);await page.getByRole('heading',{name:'Bulk Listing Edit',exact:true}).waitFor();await page.getByRole('navigation',{name:'Affected listings pagination'}).getByText('Showing 1–20 of 150',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Inspect',exact:true}).count(),20);const complete=page.getByRole('button',{name:'Complete Batch',exact:true});assert.equal(await complete.isDisabled(),true);
  const search=page.getByRole('textbox',{name:'Search affected units'});await search.fill(f.code+'-0001');await page.getByRole('navigation',{name:'Affected listings pagination'}).getByText('Showing 1–1 of 1',{exact:true}).waitFor();await page.getByRole('button',{name:'Inspect',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Listing comparison'});await dialog.getByText('Changed Fields Only',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Full Form Comparison',exact:true}).count(),1);await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await search.fill('');await page.getByRole('navigation',{name:'Affected listings pagination'}).getByText('Showing 1–20 of 150',{exact:true}).waitFor();await page.getByRole('navigation',{name:'Affected listings pagination'}).getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('navigation',{name:'Affected listings pagination'}).getByText('Page 2 of 8',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Changed field'}).selectOption('reservationFee');await page.getByText('No affected listings match.',{exact:true}).waitFor();await page.getByRole('combobox',{name:'Changed field'}).selectOption('lotType');await page.getByRole('button',{name:'Inspect',exact:true}).first().waitFor();
  await page.setViewportSize({width:390,height:1000});await fits();await screenshot('batch-mobile');await page.setViewportSize({width:1440,height:1000});await screenshot('batch-desktop');
 });
 await check('saved protected cadastral change is highlighted by default and offers full-form comparison',async()=>{
  await page.goto(base+'/portal/auditor/review-center/reviews/'+f.cadastralReviewId);await page.getByRole('button',{name:'Changed Fields Only',exact:true}).waitFor();await page.getByText('Q10-CAD-A',{exact:true}).first().waitFor();await page.getByText('Q10-CAD-B',{exact:true}).first().waitFor();await screenshot('cadastral-changed-fields');
  await page.getByRole('button',{name:'Full Form Comparison',exact:true}).click();await page.getByRole('checkbox',{name:'Highlight Changes',exact:true}).waitFor();await screenshot('cadastral-full-form');
 });
 const head=await contextFor('operations_head');page=head.page;
 await check('Head inspects a 60-listing approval by pages, returns it, then approves the revised same request',async()=>{
  await page.goto(base+'/portal/operations_head/review-center');await page.getByRole('textbox',{name:'Search reviews'}).fill('APR-'+String(headPending.approvalRequestId).padStart(8,'0'));await page.getByRole('button',{name:'Inspect',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Approval Details'});await dialog.getByRole('navigation',{name:'Bulk approval pagination'}).getByText('Showing 1–20 of 60',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Inspect',exact:true}).count(),20);
  await dialog.getByRole('navigation',{name:'Bulk approval pagination'}).getByRole('button',{name:'Next',exact:true}).click();await dialog.getByRole('navigation',{name:'Bulk approval pagination'}).getByText('Page 2 of 3',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Inspect',exact:true}).first().click();await dialog.getByRole('button',{name:'Changed Fields Only',exact:true}).waitFor();
  await dialog.getByRole('textbox',{name:'Decision Notes'}).fill('Survey evidence requires clarification before approval.');await dialog.getByRole('button',{name:'Return for Correction',exact:true}).click();await dialog.waitFor({state:'hidden'});
  const again=ok(await call('operations_staff',root+'/listing-bulk/apply',{rows:headRows,submissionKey:headKey,reason:'Synthetic browser survey approval for 60 units.'}),202);assert.equal(again.approvalRequestId,headPending.approvalRequestId);
  await page.reload();await page.getByRole('textbox',{name:'Search reviews'}).fill('APR-'+String(headPending.approvalRequestId).padStart(8,'0'));await page.getByRole('button',{name:'Inspect',exact:true}).click();dialog=page.getByRole('dialog',{name:'Approval Details'});await dialog.getByRole('textbox',{name:'Decision Notes'}).fill('Clarification checked against the final survey.');page.once('dialog',dialog=>dialog.accept());await dialog.getByRole('button',{name:'Approve',exact:true}).click();await dialog.waitFor({state:'hidden'});
 });
 const staff=await contextFor('operations_staff');page=staff.page;
 await check('returned Staff bulk reviews submit follow-up correction details on the same parent and preserve saved decimal values',async()=>{
  const id=f.ids[214],[[original]]=await db.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=?',[id]),values=normalizedListing(original),rows=[{listingId:id,expectedStatus:'Available',original:values,values:{...values,lotAreaSqm:333.333}}];
  const created=ok(await call('operations_staff',root+'/listing-bulk/apply',{rows,submissionKey:randomUUID(),reason:'Synthetic decimal persistence and returned batch verification.'}));
  const [[saved]]=await db.query('SELECT * FROM lot_project_listing_bulk_rows WHERE batch_id=?',[created.batchId]);assert.equal(Number((typeof saved.after_snapshot_json==='string'?JSON.parse(saved.after_snapshot_json):saved.after_snapshot_json).lotAreaSqm),333.33);
  ok(await call('operations_head','/workflow/reviews/'+created.reviewId+'/return',{reason:'Confirm the final approved survey area before forwarding.'}));
  const [[current]]=await db.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=?',[id]),next=normalizedListing(current);ok(await call('operations_staff',root+'/listing-bulk/apply',{rows:[{listingId:id,expectedStatus:'Available',original:next,values:{...next,lotAreaSqm:335}}],submissionKey:randomUUID(),reason:'Authorized follow-up area correction following survey clarification.'}));
  await page.goto(base+'/portal/operations_staff/review-center/reviews/'+created.reviewId);await page.getByRole('button',{name:'Submit Correction',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Submit Correction'});await dialog.getByRole('textbox',{name:'Correction Details'}).fill('Corrected the saved unit area to 335 SQM using the authorized follow-up bulk edit; see its listing audit history.');await dialog.getByRole('button',{name:'Submit Correction',exact:true}).click();await dialog.waitFor({state:'hidden'});
  const state=ok(await call('operations_head','/workflow/reviews/'+created.reviewId)).data;assert.equal(state.status,'pending_head_review');assert.equal(state.events.filter(event=>event.event_type==='staff_correction_submitted').length,1);
  const [[again]]=await db.query('SELECT after_snapshot_json FROM lot_project_listing_bulk_rows WHERE row_id=?',[saved.row_id]);assert.deepEqual(again.after_snapshot_json,saved.after_snapshot_json);await screenshot('staff-resubmitted-bulk');
 });
 const hr=await contextFor();page=hr.page;const response=await hr.context.request.post(base+'/hr-api/api/v1/auth/login',{headers:{origin:base},data:{email:'hr@qa.invalid',password}});assert.equal(response.status(),200);
 await page.goto(base+'/hr/attendance-records');await page.getByRole('button',{name:'Attendance Settings',exact:true}).click();await page.getByRole('region',{name:'Kiosk password management'}).waitFor();
 const device=await contextFor();const seed=await hr.context.request.post(base+'/hr-api/api/v1/attendance/kiosk-password',{headers:{origin:base},data:{confirmed:true}});assert.equal(seed.status(),200);const initial=(await seed.json()).data.password;
 await device.page.goto(base+'/hr/kiosk');await device.page.getByLabel('Kiosk Password',{exact:true}).fill(initial);await device.page.getByRole('button',{name:'Continue to Attendance',exact:true}).click();await device.page.getByRole('button',{name:'Lock Station',exact:true}).waitFor();
 await check('kiosk warning cancellation leaves the credential unchanged; confirmed rotation locks another device and hides the password after 15 seconds',async()=>{
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Regenerate Kiosk Password',exact:true}).click();assert.equal(await page.getByLabel('New kiosk password',{exact:true}).count(),0);
  const [[before]]=await hrDb.query('SELECT attendance_kiosk_generation AS generation FROM hr_settings WHERE id=1');let warning='';page.once('dialog',dialog=>{warning=dialog.message();return dialog.accept()});await page.getByRole('button',{name:'Regenerate Kiosk Password',exact:true}).click();
  const input=page.getByLabel('New kiosk password',{exact:true});await input.waitFor();const started=Date.now();assert.ok((await input.inputValue()).length===24);assert.match(warning,/ALL devices/);assert.match(warning,/15 seconds/);assert.match(warning,/14 days/);
  await device.page.getByLabel('Kiosk Password',{exact:true}).waitFor({timeout:5000});await page.waitForTimeout(13500);assert.equal(await input.count(),1);await input.waitFor({state:'detached',timeout:3000});assert.ok(Date.now()-started<17000);
  assert.equal(await page.getByRole('button',{name:/Reveal|Show password/}).count(),0);await screenshot('kiosk-after-one-time-display');
  const [[after]]=await hrDb.query('SELECT attendance_kiosk_generation AS generation FROM hr_settings WHERE id=1');assert.equal(Number(after.generation),Number(before.generation)+1);
 });
 assert.deepEqual(errors,[],'browser runtime errors');
}finally{
 await hrDb.query('UPDATE hr_settings SET attendance_kiosk_password_hash=?,attendance_kiosk_generation=?,attendance_kiosk_password_expires_at_ms=?,attendance_kiosk_rotated_at=? WHERE id=1',[originalKiosk.hash,originalKiosk.generation,originalKiosk.expiry,originalKiosk.rotated]);
 writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await db.end();await hrDb.end();
}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
