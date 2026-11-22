import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {db,hrDb,guard,api,ok,base,requireSystem} from './pdf10-common.mjs';
import {normalizedListing} from '../../SERVER/SYSTEM/controllers/Lot_Projects/Listings/listingBulkFields.js';
const fixture=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf10/fixtures.json','utf8')),jwt=requireSystem('jsonwebtoken');
await guard(db);
const cookie=role=>'token='+jwt.sign({id:fixture.users[role].id,authVersion:0},'qa-system-only-secret-'.repeat(3),{expiresIn:3600});
const call=(role,path,body)=>api(path,body,{cookie:cookie(role)}),projectRoot='/projects/lot-projects/'+fixture.slug;
async function createReview(type,entityId,action='listing.edit',snapshots={}){
 const [result]=await db.query(`INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,entity_label,initiated_by_user_id,initiated_by_role,before_snapshot_json,after_snapshot_json,status,approval_type)
  VALUES(?,'operations',?,?,?,'Synthetic compact review',1,'super_admin',?,?,'pending_auditor_review','emergency_super_admin')`,[action,fixture.projectId,type,String(entityId),JSON.stringify(snapshots.before||{value:'Before'}),JSON.stringify(snapshots.after||{value:'After'})]);
 const id=Number(result.insertId);await db.query('UPDATE operational_reviews SET review_number=? WHERE operational_review_id=?',['REV-'+String(id).padStart(8,'0'),id]);
 await db.query("INSERT INTO operational_review_events(operational_review_id,event_type,actor_user_id,actor_role,message) VALUES(?,'created',1,'super_admin','Original synthetic operation saved.')",[id]);return id;
}
const [[cadastral]]=await db.query('SELECT * FROM operational_reviews WHERE operational_review_id=?',[fixture.cadastralReviewId]);
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const reviewId=await createReview('lot_project_listing',cadastral.entity_id,'listing.edit',{before:parse(cadastral.before_snapshot_json),after:parse(cadastral.after_snapshot_json)});
const [[account]]=await db.query('SELECT * FROM lot_project_accounts WHERE lot_project_account_id=(SELECT current_account_id FROM lot_project_listings WHERE lot_project_listing_id=?)',[fixture.ids[213]]);
const reservationId=await createReview('lot_project_account',account.lot_project_account_id,'reservation.create');
const [[payment]]=await db.query('SELECT * FROM lot_project_payments WHERE lot_project_account_id=? ORDER BY lot_project_payment_id DESC LIMIT 1',[account.lot_project_account_id]);
const paymentReviewId=await createReview('lot_project_payment',payment.lot_project_payment_id,'payment.create');
const batchRows=[];for(const id of fixture.ids.slice(0,2)){const [[saved]]=await db.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=?',[id]);const original=normalizedListing(saved);batchRows.push({listingId:id,expectedStatus:'Available',original,values:{...original,lotAreaSqm:original.lotAreaSqm+1}})}
const batch=ok(await call('super_admin',projectRoot+'/listing-bulk/apply',{rows:batchRows,reason:'Synthetic confirmation behavior test.',submissionKey:randomUUID()}));
const out=resolve('QA_REPORTS/evidence/review-details');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
await context.addCookies([{name:'token',value:cookie('auditor').slice(6),url:base}]);const page=await context.newPage(),checks=[],errors=[],writes=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST'&&/\/workflow\/reviews\/\d+\/auditor-verify/.test(request.url()))writes.push(request.url())});
const reviewPath=id=>base+'/portal/auditor/review-center/reviews/'+id;
const screenshot=name=>page.screenshot({path:resolve(out,name+'.png'),fullPage:true,animations:'disabled'});
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await screenshot('failure-'+checks.length).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
try{
 await check('review opens with comparison and actions; overview, completed-change banner and history are hidden',async()=>{
  await page.goto(reviewPath(reviewId));await page.getByRole('button',{name:'No Issue',exact:true}).waitFor();
  assert.equal(await page.locator('#review-overview').count(),0);assert.equal(await page.getByText('Change already saved',{exact:true}).count(),0);assert.equal(await page.getByText('Review History',{exact:true}).count(),0);
  assert.equal(await page.getByRole('dialog').count(),0);await screenshot('compact-desktop');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width===390)await screenshot('compact-mobile')}
 });
 await check('info icon and history button open accessible dialogs and restore focus after Escape',async()=>{
  const info=page.getByRole('button',{name:'Review information',exact:true});await info.click();const details=page.getByRole('dialog',{name:'Review Information'});await details.waitFor();await details.getByText('Submitted By',{exact:true}).waitFor();await details.getByText('Submitted At',{exact:true}).waitFor();await page.keyboard.press('Escape');await details.waitFor({state:'hidden'});assert.equal(await info.evaluate(element=>element===document.activeElement),true);
  await page.getByRole('button',{name:'View Review History',exact:true}).click();const history=page.getByRole('dialog',{name:'Review History'});await history.getByText('Original synthetic operation saved.',{exact:true}).waitFor();await screenshot('history-dialog');await history.getByRole('button',{name:'Close review history'}).click();await history.waitFor({state:'hidden'});
 });
 await check('No Issue requires confirmation; cancelling sends no request and confirming records one decision',async()=>{
  await page.getByRole('button',{name:'No Issue',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Mark No Issue?'});await dialog.waitFor();assert.equal(writes.length,0);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(writes.length,0);assert.equal(ok(await call('auditor','/workflow/reviews/'+reviewId)).data.status,'pending_auditor_review');
  await page.getByRole('button',{name:'No Issue',exact:true}).click();dialog=page.getByRole('dialog',{name:'Mark No Issue?'});await dialog.getByRole('button',{name:'No Issue',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Audit Complete',{exact:true}).first().waitFor();assert.equal(writes.length,1);assert.equal(ok(await call('auditor','/workflow/reviews/'+reviewId)).data.status,'closed');
 });
 await check('View Record opens the complete listing page without a second summary modal',async()=>{
  const profile=ok(await call('auditor',projectRoot+'/listings/'+cadastral.entity_id)).data;
  assert.equal(profile.account,null);assert.equal(Number(profile.listing.id),Number(cadastral.entity_id));assert.equal(Number(profile.listing.lot_project_id),fixture.projectId);
  await page.getByRole('button',{name:'View Record',exact:true}).click();await page.waitForURL('**/portal/lot-projects/**/listings/**');await page.getByRole('button',{name:'Unit & Status',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);await page.getByText('Cadastral Lot No.',{exact:true}).waitFor();await page.getByRole('link',{name:'Back to Review',exact:true}).waitFor();await screenshot('native-listing');
 });
 await check('reservation review opens the exact buyer account with the full native tabs and no reservation-summary overlay',async()=>{
  await page.goto(reviewPath(reservationId));await page.getByRole('button',{name:'View Record',exact:true}).click();await page.waitForURL('**/accounts/'+account.lot_project_account_id+'?**');assert.equal(await page.getByRole('dialog').count(),0);await page.getByRole('button',{name:'Client Profile',exact:true}).click();await page.getByText(account.buyer_name_snapshot,{exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:/Edit Profile|Save Changes/}).count(),0);await screenshot('native-reservation-account');
 });
 await check('document and payment reviews go to their source tabs and keep the exact reviewed payment visible',async()=>{
  await page.goto(reviewPath(fixture.documentReviewId));await page.getByRole('button',{name:'View Record',exact:true}).click();await page.waitForURL('**tab=documents**');assert.equal(await page.getByRole('dialog').count(),0);await page.getByRole('button',{name:'Documents',exact:true}).waitFor();
  await page.goto(reviewPath(paymentReviewId));await page.getByRole('button',{name:'View Record',exact:true}).click();await page.waitForURL('**tab=payments**');const target=page.locator('#payment-record-'+payment.lot_project_payment_id);await target.waitFor();await target.getByText(payment.lot_project_payment_reference_id,{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('button',{name:'Add Payment',exact:true}).count(),0);await screenshot('native-payment');
 });
 await check('batch No Issue actions confirm the selected rows and keep history hidden until requested',async()=>{
  await page.goto(reviewPath(batch.reviewId));await page.getByRole('button',{name:'No Issue',exact:true}).first().waitFor();assert.equal(await page.getByText('Review History',{exact:true}).count(),0);
  await page.getByRole('checkbox',{name:'Select pending units on this page'}).check();await page.getByRole('button',{name:'No Issue — Selected',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Mark No Issue?'});await dialog.getByText(/2 selected listings/).waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(ok(await call('auditor','/workflow/reviews/'+batch.reviewId+'/bulk-rows')).summary.pendingRecords,2);
  await page.getByRole('button',{name:'No Issue',exact:true}).first().click();dialog=page.getByRole('dialog',{name:'Mark No Issue?'});await dialog.getByRole('button',{name:'No Issue',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(ok(await call('auditor','/workflow/reviews/'+batch.reviewId+'/bulk-rows')).summary.pendingRecords,1);await page.getByRole('button',{name:'View Review History',exact:true}).click();await page.getByRole('dialog',{name:'Review History'}).waitFor();
 });
 await check('an incorrect review target shows an unavailable notice instead of another record',async()=>{
  await page.goto(reviewPath(reservationId));await page.getByRole('button',{name:'View Record',exact:true}).click();await page.waitForURL('**/accounts/'+account.lot_project_account_id+'?**');
  const url=new URL(page.url());url.searchParams.set('reviewTargetId',String(Number(account.lot_project_account_id)+100000));await page.goto(url.toString());
  await page.getByRole('alert').getByText('The exact review record is unavailable or outside your access.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Client Profile',exact:true}).count(),0);await page.getByRole('button',{name:'Back to Review',exact:true}).click();await page.waitForURL('**/review-center/reviews/'+reservationId);
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await db.end();await hrDb.end()}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
