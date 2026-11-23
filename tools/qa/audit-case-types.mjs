// All writes are synthetic and confined to the guarded disposable loopback database.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {REVIEW_ACTIONS} from '../../SERVER/SYSTEM/config/reviewActions.js';
import {db,hrDb,guard,api,ok,base,requireSystem} from './pdf10-common.mjs';
import {normalizedListing} from '../../SERVER/SYSTEM/controllers/Lot_Projects/Listings/listingBulkFields.js';
await guard(db);
const f=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf10/fixtures.json','utf8')),nonce=randomUUID().slice(0,8);
const cookie=role=>'token='+requireSystem('jsonwebtoken').sign({id:f.users[role].id,authVersion:0},'qa-system-only-secret-'.repeat(3),{expiresIn:3600});
const call=(role,path,body,method)=>api(path,body,{cookie:cookie(role),...(method?{method}:{})});
const notes='Checked the original evidence and confirmed that no record change is necessary.';
const checks=[],errors=[],out=resolve('QA_REPORTS/evidence/audit-case-types');mkdirSync(out,{recursive:true});
const parse=value=>typeof value==='string'?JSON.parse(value):value;
async function createCase(actionKey,entityId,snapshot={value:'Original saved data'}){
 const definition=REVIEW_ACTIONS[actionKey],json=JSON.stringify(snapshot);
 const [result]=await db.query("INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,entity_label,initiated_by_user_id,initiated_by_role,before_snapshot_json,after_snapshot_json,status,approval_type) VALUES(?,?,?,?,?,'Synthetic case coverage',1,'super_admin',?,?,'pending_auditor_review','emergency_super_admin')",[actionKey,definition.department,f.projectId,definition.entityType,String(entityId),json,json]);
 const reviewId=Number(result.insertId);await db.query('UPDATE operational_reviews SET review_number=? WHERE operational_review_id=?',['REV-'+String(reviewId).padStart(8,'0'),reviewId]);
 const opened=ok(await call('auditor','/workflow/reviews/'+reviewId+'/audit-case',{finding:'Check the original saved evidence before resolving this synthetic case.',assigneeId:1}),201);
 return {reviewId,caseId:opened.data.auditCaseId};
}
const review=async item=>ok(await call('super_admin','/workflow/reviews/'+item.reviewId)).data;
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
async function check(name,action){if(only&&!name.includes(only))return;try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png'),fullPage:false}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
const [[payment]]=await db.query('SELECT * FROM lot_project_payments WHERE lot_project_account_id=(SELECT current_account_id FROM lot_project_listings WHERE lot_project_listing_id=?) ORDER BY lot_project_payment_id DESC LIMIT 1',[f.ids[213]]);
const [[account]]=await db.query('SELECT * FROM lot_project_accounts WHERE lot_project_account_id=?',[payment.lot_project_account_id]);
const projects=ok(await call('super_admin','/projects/lot-projects/options')).data.slice(0,2);assert.equal(projects.length,2);
const [project1,project2]=projects.map(project=>Number(project.lot_project_id||project.id));
const groupBody={seller_group_type:'external',seller_group_name:'QA Case Scope '+nonce,seller_group_description:'Synthetic case coverage',seller_group_status:'active',broker_name:'QA Case Broker '+nonce,broker_license_number:'QA-LIC-'+nonce,realty_name:'QA Case Realty '+nonce,broker_prc_number:'QA-PRC-'+nonce,project_rates:[project1,project2].map(lot_project_id=>({lot_project_id,seller_group_pool_rate:8})),external_account:{first_name:'Synthetic',last_name:'Representative',email:'case-'+nonce+'@qa.invalid'}};
const group=ok(await call('super_admin','/seller-groups/create',groupBody),201),groupId=Number(group.seller_group_id);
const [[seller]]=await db.query('SELECT * FROM accredited_sellers WHERE seller_group_id=? LIMIT 1',[groupId]);
const ids={lot_project_listing:f.ids[0],lot_project_payment:payment.lot_project_payment_id,lot_project_payment_proof:payment.lot_project_payment_id,lot_project_signed_receipt:payment.lot_project_payment_id,lot_project_account:account.lot_project_account_id,lot_project_reservation:account.lot_project_account_id,lot_project_cancellation:account.lot_project_account_id,lot_project_client_profile:account.lot_project_client_profile_id,lot_project_commission_account:account.lot_project_account_id,lot_project_settings:f.projectId,lot_project_lmf_schedule:payment.lot_project_payment_schedule_id||1,lot_project_penalty_schedule:payment.lot_project_payment_schedule_id||1,seller_group:groupId,seller_group_project_rates:groupId+':'+project1,accredited_seller:seller.accredited_seller_id};
async function businessFingerprint(){
 const hash=createHash('sha256');
 for(const [table,key] of [['lot_project_listings','lot_project_listing_id'],['lot_project_accounts','lot_project_account_id'],['lot_project_payments','lot_project_payment_id'],['lot_project_payment_allocations','lot_project_payment_allocation_id'],['lot_project_payment_schedules','lot_project_payment_schedule_id'],['lot_project_commissions','lot_project_commission_id'],['seller_groups','seller_group_id'],['seller_group_lot_project_rates','seller_group_id'],['accredited_sellers','accredited_seller_id']]){
  const [rows]=await db.query('SELECT * FROM '+table+' ORDER BY '+key);hash.update(JSON.stringify(rows));
 }return hash.digest('hex');
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());await context.addCookies([{name:'token',value:cookie('super_admin').slice(6),url:base}]);
const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
const reviewUrl=item=>base+'/portal/super_admin/review-center/reviews/'+item.reviewId;
const examples=new Map();
try{
 const baseline=await businessFingerprint();
 for(const [actionKey,definition] of Object.entries(REVIEW_ACTIONS)){
  if(definition.entityType==='lot_project_listing_bulk_batch')continue; // Cases belong to each affected listing, not the batch parent.
  await check('no-edit resolution and independent closure: '+actionKey,async()=>{
   const item=await createCase(actionKey,ids[definition.entityType]||1),original=await review(item);
   if(!examples.has(definition.entityType)){
    await page.goto(reviewUrl(item));await page.getByRole('button',{name:'Resolve Without Editing',exact:true}).waitFor();examples.set(definition.entityType,item);
   }
   ok(await call('super_admin','/workflow/audit-cases/'+item.caseId+'/resolve-with-notes',{notes,resolutionMode:'without_edit'}));
   let saved=await review(item);assert.equal(saved.status,'pending_auditor_recheck');assert.equal(saved.auditCase.correction_applied_at,null);assert.equal(saved.revision,original.revision);assert.deepEqual(parse(saved.before_snapshot_json),parse(original.before_snapshot_json));assert.deepEqual(parse(saved.after_snapshot_json),parse(original.after_snapshot_json));
   ok(await call('super_admin','/workflow/reviews/'+item.reviewId+'/auditor-verify',{note:notes}),403);
   ok(await call('auditor','/workflow/reviews/'+item.reviewId+'/auditor-verify',{note:'Independently checked the explanation against the original evidence.'}));
   saved=await review(item);assert.equal(saved.auditCase.status,'closed');assert.ok(saved.auditCase.final_verified_at);assert.equal(saved.events.filter(event=>event.event_type==='resolution_submitted_without_edit').length,1);
  });
 }
 await check('all no-edit case types leave the original business records unchanged',async()=>assert.equal(await businessFingerprint(),baseline));
 const scoped=await createCase('network.rates.update',groupId+':'+project1,{groupId,projectId:project1,poolRate:8});
 const changed={...groupBody,project_rates:groupBody.project_rates.map(rate=>({...rate,seller_group_pool_rate:rate.lot_project_id===project1?9:8})),auditCaseId:scoped.caseId,reviewId:scoped.reviewId,reason:notes};
 const state=async()=>{
  const [[network]]=await db.query('SELECT * FROM seller_groups WHERE seller_group_id=?',[groupId]);
  const [rates]=await db.query('SELECT * FROM seller_group_lot_project_rates WHERE seller_group_id=? ORDER BY lot_project_id',[groupId]);
  const [[representative]]=await db.query('SELECT * FROM users WHERE id=?',[network.seller_group_external_account_user_id]);
  return {network,rates,representative};
 };
 const before=await state();
 await check('a project-rate case cannot change another project, Network identity or representative',async()=>{
  for(const body of [{...changed,seller_group_name:'Not authorized by this rate case'},{...changed,external_account:{...groupBody.external_account,first_name:'Not permitted'}},{...changed,project_rates:changed.project_rates.map(rate=>({...rate,seller_group_pool_rate:9}))}]){const denied=await call('super_admin','/seller-groups/edit/'+groupId,body,'PUT');ok(denied,409);assert.equal(denied.data.code,'AUDIT_CORRECTION_SCOPE_MISMATCH');assert.deepEqual(await state(),before)}
 });
 await check('the full Network editor corrects the exact group/project case and creates no duplicate review',async()=>{
  const [[countBefore]]=await db.query('SELECT COUNT(*) n FROM operational_reviews');
  const saved=ok(await call('super_admin','/seller-groups/edit/'+groupId,changed,'PUT'));assert.equal(Number(saved.rate_review.auditCaseId),scoped.caseId);assert.equal(saved.review,null);
  const after=await state();assert.deepEqual(after.network,before.network);assert.deepEqual(after.representative,before.representative);assert.deepEqual(after.rates.find(rate=>Number(rate.lot_project_id)===project2),before.rates.find(rate=>Number(rate.lot_project_id)===project2));assert.equal(Number(after.rates.find(rate=>Number(rate.lot_project_id)===project1).seller_group_pool_rate),9);
  const [[countAfter]]=await db.query('SELECT COUNT(*) n FROM operational_reviews');assert.equal(countAfter.n,countBefore.n);const detail=await review(scoped);assert.equal(detail.status,'pending_auditor_recheck');assert.equal(parse(detail.after_snapshot_json).projectId,project1);
  const stale=await call('super_admin','/seller-groups/edit/'+groupId,changed,'PUT');ok(stale,409);assert.match(stale.data.message,/already awaiting Auditor verification/);
 });
 await check('listing correction collects its missing reason, cancellation writes nothing, and the existing Final Review still runs',async()=>{
  const item=await createCase('listing.edit',f.ids[0]);await page.goto(reviewUrl(item));await page.getByRole('button',{name:'Open Unit',exact:true}).click();await page.getByRole('button',{name:'Save Changes',exact:true}).waitFor();
  const requests=[];page.on('request',request=>{if(request.method()==='PUT'&&request.url().includes('/listings/'+f.ids[0]))requests.push(request)});
  await page.getByRole('button',{name:'Save Changes',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Correction Reason',exact:true});await dialog.waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(requests.length,0);
  await page.getByRole('button',{name:'Save Changes',exact:true}).click();dialog=page.getByRole('dialog',{name:'Correction Reason',exact:true});await dialog.getByRole('textbox',{name:'Correction Reason',exact:true}).fill(notes);await dialog.getByRole('button',{name:'Continue to Review',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Final Double-Check',{exact:false}).first().waitFor();assert.equal(requests.length,0);await page.screenshot({path:resolve(out,'reason-before-final-review.png'),fullPage:false});
 });
 await check('Network corrections collect a reason before the existing Final Review',async()=>{
  await page.reload(); // Discard the prior cancelled draft without saving it.
  const item=await createCase('network.rates.update',groupId+':'+project1,{groupId,projectId:project1,poolRate:9});await page.goto(reviewUrl(item));await page.getByRole('button',{name:'Open Network Rates',exact:true}).click();await page.getByRole('button',{name:'Proceed to Final Review',exact:true}).waitFor();
  await page.getByRole('spinbutton').first().fill('10');await page.getByRole('button',{name:'Proceed to Final Review',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Correction Reason',exact:true});await dialog.waitFor();await dialog.getByRole('textbox',{name:'Correction Reason',exact:true}).fill(notes);await dialog.getByRole('button',{name:'Continue to Review',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Final Double-Check',{exact:false}).first().waitFor();assert.equal((await review(item)).status,'correction_required');
 });
 await check('legacy case references authorize the same Network, status and listing corrections',async()=>{
  const identity=await createCase('network.edit',groupId),current=await state();
  const payload={...groupBody,seller_group_description:'Synthetic correction using the legacy case reference.',project_rates:current.rates.map(rate=>({...rate})),audit_case_id:identity.caseId,reviewId:identity.reviewId,reason:notes};
  ok(await call('super_admin','/seller-groups/edit/'+groupId,payload,'PUT'));assert.equal((await review(identity)).status,'pending_auditor_recheck');
  const projectCase=await createCase('network.rates.update',groupId+':'+project1);ok(await call('super_admin','/seller-groups/'+groupId+'/projects/'+project1+'/pool',{poolRate:9,status:'active',audit_case_id:projectCase.caseId,reason:notes},'PATCH'));assert.equal((await review(projectCase)).status,'pending_auditor_recheck');
  const status=await createCase('network.status',groupId);ok(await call('super_admin','/seller-groups/toggle-status/'+groupId,{status:'inactive',audit_case_id:status.caseId,reason:notes},'PATCH'));assert.equal((await review(status)).status,'pending_auditor_recheck');
  const listingCase=await createCase('listing.edit',f.ids[0]),[[listing]]=await db.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=?',[f.ids[0]]);
  ok(await call('super_admin','/projects/lot-projects/'+f.slug+'/listings/'+f.ids[0],{...normalizedListing(listing),lotAreaSqm:Number(listing.lot_project_listing_area_sqm)+1,status:listing.lot_project_listing_status,audit_case_id:listingCase.caseId,reviewId:listingCase.reviewId,reason:notes},'PUT'));assert.equal((await review(listingCase)).status,'pending_auditor_recheck');
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,only?'results-filtered.json':'results.json'),JSON.stringify({checks,errors,entityTypes:[...examples.keys()]},null,2));await browser.close();await db.end();await hrDb.end()}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
