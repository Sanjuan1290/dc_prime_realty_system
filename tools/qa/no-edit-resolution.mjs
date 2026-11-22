// Loopback-only synthetic QA. Never use a live ledger or production credentials.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {db,hrDb,guard,api,ok,base,requireSystem} from './pdf10-common.mjs';
const f=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf10/fixtures.json','utf8'));
await guard(db);
const cookie=role=>'token='+requireSystem('jsonwebtoken').sign({id:f.users[role].id,authVersion:0},'qa-system-only-secret-'.repeat(3),{expiresIn:3600});
const call=(role,path,body)=>api(path,body,{cookie:cookie(role)});
const [[payment]]=await db.query('SELECT * FROM lot_project_payments WHERE lot_project_account_id=(SELECT current_account_id FROM lot_project_listings WHERE lot_project_listing_id=?) ORDER BY lot_project_payment_id DESC LIMIT 1',[f.ids[213]]);
assert.ok(payment);
const notes='Verified the bank receipt and the original payment. No changes to the saved record are required.';
const checks=[],errors=[],out=resolve('QA_REPORTS/evidence/no-edit-resolution');mkdirSync(out,{recursive:true});
const parse=value=>typeof value==='string'?JSON.parse(value):value;
async function createCase(assignee='super_admin'){
 const snap=JSON.stringify({paymentId:payment.lot_project_payment_id,amount:Number(payment.lot_project_payment_amount),paymentDate:payment.lot_project_payment_date});
 const [created]=await db.query("INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,entity_label,initiated_by_user_id,initiated_by_role,before_snapshot_json,after_snapshot_json,status,approval_type) VALUES('payment.create','accounting',?,'lot_project_payment',?,'Synthetic resolution payment',?,'accounting_staff',?,?,'pending_auditor_review','staff_entry')",[f.projectId,String(payment.lot_project_payment_id),f.users.accounting_staff.id,snap,snap]);
 const reviewId=Number(created.insertId);await db.query('UPDATE operational_reviews SET review_number=? WHERE operational_review_id=?',['REV-'+String(reviewId).padStart(8,'0'),reviewId]);
 const opened=ok(await call('auditor','/workflow/reviews/'+reviewId+'/audit-case',{finding:'Synthetic receipt verification requires an administrator response.',assigneeId:f.users[assignee].id}),201);
 return {reviewId,caseId:opened.data.auditCaseId,path:'/workflow/audit-cases/'+opened.data.auditCaseId+'/resolve-with-notes'};
}
const review=async item=>ok(await call('super_admin','/workflow/reviews/'+item.reviewId)).data;
async function ledger(){const result={};for(const [name,column,id] of [['lot_project_payments','lot_project_payment_id',payment.lot_project_payment_id],['lot_project_payment_allocations','lot_project_payment_id',payment.lot_project_payment_id],['lot_project_payment_schedules','lot_project_account_id',payment.lot_project_account_id],['lot_project_commissions','lot_project_account_id',payment.lot_project_account_id]]){const [rows]=await db.query('SELECT * FROM '+name+' WHERE '+column+'=?',[id]);result[name]=rows}return result}
const baseline=await ledger();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
await context.addCookies([{name:'token',value:cookie('super_admin').slice(6),url:base}]);
const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
const url=item=>base+'/portal/super_admin/review-center/reviews/'+item.reviewId;
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
try{
 const item=await createCase(),body={notes,resolutionMode:'without_edit'},original=await review(item);
 await check('assignee, role, explanation and explicit resolution method are enforced',async()=>{
  for(const role of ['system_admin','accounting_staff','accounting_head','auditor'])ok(await call(role,item.path,body),403);
  for(const invalid of [{...body,notes:''},{...body,notes:'test'},{...body,notes:'x'.repeat(5001)},{...body,resolutionMode:'close'}])ok(await call('super_admin',item.path,invalid),400);
  ok(await call('super_admin',item.path,{notes}),409);
  assert.equal((await review(item)).status,'correction_required');
 });
 await check('failure while saving the review evidence rolls back case, review, notifications and history',async()=>{
  const root=await requireSystem('mysql2/promise').createConnection({host:'127.0.0.1',port:13307,user:'root',password:'',database:'dc_prime_realty_system_db'});await guard(root);
  const trigger='qa_resolution_atomic_'+item.reviewId;
  try{
   await root.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON operational_review_events FOR EACH ROW BEGIN IF NEW.operational_review_id=${item.reviewId} AND NEW.event_type='resolution_submitted_without_edit' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic resolution atomicity failure'; END IF; END`);
   ok(await call('super_admin',item.path,body),500);
  }finally{await root.query('DROP TRIGGER IF EXISTS '+trigger);await root.end()}
  const saved=await review(item);assert.equal(saved.status,'correction_required');assert.equal(saved.auditCase.status,'pending_system_admin_correction');assert.equal(saved.auditCase.system_admin_user_id,null);assert.equal(saved.events.filter(event=>event.event_type==='resolution_submitted_without_edit').length,0);
 });
 await check('concurrent submissions record one response without editing the ledger, snapshots or revision',async()=>{
  const responses=await Promise.all([call('super_admin',item.path,body),call('super_admin',item.path,body)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const saved=await review(item);assert.equal(saved.status,'pending_auditor_recheck');assert.equal(saved.auditCase.resolutionMode,'without_edit');assert.equal(saved.auditCase.correction_applied_at,null);assert.equal(Number(saved.auditCase.system_admin_user_id),f.users.super_admin.id);assert.equal(saved.events.filter(event=>event.event_type==='resolution_submitted_without_edit').length,1);assert.equal(saved.revision,original.revision);assert.deepEqual(parse(saved.before_snapshot_json),parse(original.before_snapshot_json));assert.deepEqual(parse(saved.after_snapshot_json),parse(original.after_snapshot_json));assert.deepEqual(await ledger(),baseline);
  const [[logs]]=await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='audit_case' AND entity_id=? AND title='Submitted resolution without editing'",[String(item.caseId)]);assert.equal(Number(logs.n),1);
  const [[notification]]=await db.query("SELECT COUNT(*) n FROM internal_notifications WHERE audit_case_id=? AND notification_type='audit_correction_recheck'",[item.caseId]);assert.ok(Number(notification.n)>0);
 });
 await check('payment correction explains that the submitted case is awaiting independent verification',async()=>{
  const response=await call('super_admin','/projects/lot-projects/'+f.slug+'/listings/'+payment.lot_project_listing_id+'/payments/'+payment.lot_project_payment_id+'/correction-code',{action:'edit',reason:'Verify the saved receipt against the original record.',proposed:{amount:Number(payment.lot_project_payment_amount)},reviewId:item.reviewId,auditCaseId:item.caseId});
  ok(response,409);assert.match(response.data.message,/already awaiting Auditor verification/);
 });
 await check('only the Auditor can close or return a no-edit resolution; resubmission uses the same case',async()=>{
  ok(await call('super_admin','/workflow/reviews/'+item.reviewId+'/auditor-verify',{note:notes}),403);
  ok(await call('auditor','/workflow/reviews/'+item.reviewId+'/correction-return',{comments:'Please include the original bank verification reference.'}));
  assert.equal((await review(item)).status,'correction_required');
  ok(await call('super_admin',item.path,{...body,notes:notes+' Bank reference QA-ONLY-01.'}));
  ok(await call('auditor','/workflow/reviews/'+item.reviewId+'/auditor-verify',{note:'Verified the explanation against the original bank reference.'}));
  const saved=await review(item);assert.equal(saved.status,'closed');assert.equal(Number(saved.auditCase.audit_case_id),item.caseId);assert.ok(saved.auditCase.final_verified_at);assert.equal(saved.auditCase.correction_applied_at,null);assert.equal(saved.events.filter(event=>event.event_type==='resolution_submitted_without_edit').length,2);assert.equal(saved.events.filter(event=>event.event_type==='controlled_correction_applied').length,0);assert.deepEqual(await ledger(),baseline);
 });
 await check('the UI offers Resolve Without Editing, requires explanation, supports cancellation and displays the pending response',async()=>{
  const visible=await createCase();let writes=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(visible.path))writes++});
  await page.goto(url(visible));await page.getByRole('button',{name:'Resolve Without Editing',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Resolve Without Editing',exact:true});await dialog.waitFor();assert.equal(await dialog.getByRole('button',{name:'Submit for Auditor Verification'}).isDisabled(),true);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(writes,0);assert.equal((await review(visible)).status,'correction_required');
  await page.getByRole('button',{name:'Resolve Without Editing',exact:true}).click();dialog=page.getByRole('dialog',{name:'Resolve Without Editing',exact:true});await dialog.getByRole('textbox').fill(notes);await dialog.getByRole('button',{name:'Submit for Auditor Verification'}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Awaiting Verification',{exact:true}).first().waitFor();await page.getByText('Resolution Without Editing',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Resolve Without Editing',exact:true}).count(),0);assert.equal(writes,1);await page.screenshot({path:resolve(out,'resolution-pending.png'),fullPage:true});assert.deepEqual(await ledger(),baseline);
 });
 await check('an assigned System Admin can submit the same no-edit workflow',async()=>{
  const assigned=await createCase('system_admin');ok(await call('super_admin',assigned.path,body),403);ok(await call('system_admin',assigned.path,body));assert.equal((await review(assigned)).status,'pending_auditor_recheck');assert.deepEqual(await ledger(),baseline);
 });
 await check('listing price cards keep full labels and amounts inside the modal on desktop and mobile',async()=>{
  await page.goto(base+'/portal/lot-projects/'+f.slug+'/listings/'+f.ids[0]);await page.getByRole('button',{name:'Edit',exact:true}).first().click();await page.getByText('Live Price Breakdown',{exact:true}).waitFor();
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1100});const section=page.getByRole('region',{name:'Installment pricing'});await section.scrollIntoViewIfNeeded();await section.getByText('Total Contract Price (TCP)',{exact:true}).waitFor();const bounds=await section.evaluate(element=>{const card=element.getBoundingClientRect();return [...element.querySelectorAll('dt,dd')].every(node=>{const box=node.getBoundingClientRect();return box.left>=card.left&&box.right<=card.right&&node.scrollWidth<=node.clientWidth+1})});assert.ok(bounds,'Price labels/amounts must stay inside the card at width '+width);await page.screenshot({path:resolve(out,'pricing-'+width+'.png'),fullPage:true})}
  await page.getByRole('button',{name:'Cancel',exact:true}).last().click();
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await db.end();await hrDb.end()}
if(checks.some(item=>item.status!=='PASS'))process.exitCode=1;
