// Real API tests. Every database mutation is restricted to the disposable QA server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {db,hrDb,guard,api,ok,password,requireSystem} from './pdf10-common.mjs';
import {normalizedListing} from '../../SERVER/SYSTEM/controllers/Lot_Projects/Listings/listingBulkFields.js';
import {savedSnapshotChangeSummary} from '../../CLIENT/SYSTEM/src/utils/reviewSnapshotFormat.js';
import {getStaticRolePolicy} from '../../SERVER/SYSTEM/config/rolePolicies.js';
const tag=Date.now().toString(36),slug='qa-pdf10-'+tag,code='Q10'+tag.slice(-5).toUpperCase(),root='/projects/lot-projects/'+slug;
const users={},sessions={},ids=[],batches=[],fixtures={slug,code,users,ids,batches};let projectId,docs;
// Only the isolated server knows this test signing key. Repeated workflow runs
// use synthetic sessions rather than consume the production login throttle.
const sessionFor=id=>'token='+requireSystem('jsonwebtoken').sign({id,authVersion:0},'qa-system-only-secret-'.repeat(3),{expiresIn:3600});
const call=(role,path,body,method)=>api(path,body,{cookie:sessions[role],method});
const parse=value=>typeof value==='string'?JSON.parse(value):value;
async function listing(id){return (await db.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=?',[id]))[0][0]}
async function rowsFor(listingIds,changes){const result=[];for(const id of listingIds){const row=await listing(id),original=normalizedListing(row);result.push({listingId:id,expectedStatus:row.lot_project_listing_status==='sold'?'Sold / Active':'Available',original,values:{...original,...changes}})}return result}
async function review(id){return ok(await call('auditor','/workflow/reviews/'+id)).data}
async function apply(rows,{role='super_admin',key=randomUUID(),reason='Synthetic authorized cadastral bulk correction'}={}){return call(role,root+'/listing-bulk/apply',{rows,submissionKey:key,reason,filename:'Synthetic-QA.xlsx'})}
const listingBody=(row,extra={})=>({...normalizedListing(row),status:row.lot_project_listing_status,cadastralLots:[],...extra});
test.before(async()=>{
 await guard(db);await guard(hrDb);
 const bcrypt=requireSystem('bcrypt'),hash=await bcrypt.hash(password,10);
 users.super_admin={id:1,email:'system@qa.invalid'};sessions.super_admin=sessionFor(1);
 for(const role of ['system_admin','operations_head','operations_staff','accounting_head','accounting_staff','auditor','sales_head']){
  const email=`${role}-${tag}@qa.invalid`;
  const [result]=await db.execute("INSERT INTO users(first_name,last_name,email,password_hash,role,account_category,is_system_account,admin_all_projects,all_projects_access,must_change_password) VALUES(?,'Synthetic QA',?,?,?,'system',0,1,1,0)",[role,email,hash,role]);
  users[role]={id:result.insertId,email};
  for(const permission of getStaticRolePolicy(role).recommended)await db.execute('INSERT INTO user_permissions(user_id,permission_key,allowed,granted_by_user_id) VALUES(?,?,1,1)',[result.insertId,permission]);
  sessions[role]=sessionFor(result.insertId);
 }
 const [p]=await db.execute("INSERT INTO lot_projects(lot_project_name,lot_project_slug,lot_project_location,lot_project_location_code) VALUES(?,?,'Synthetic isolated QA',?)",['PDF10 '+tag,slug,code]);projectId=p.insertId;fixtures.projectId=projectId;
 for(const lot of ['Q10-CAD-A','Q10-CAD-B','Q10-INDIVIDUAL'])await db.execute('INSERT INTO lot_project_cadastral_lot_numbers(lot_project_id,lot_project_cadastral_lot_number) VALUES(?,?)',[projectId,lot]);
 for(let i=0;i<215;i++){
  const [result]=await db.execute(`INSERT INTO lot_project_listings(lot_project_id,lot_project_listing_unit_type,lot_project_listing_unit_id,lot_project_listing_area_sqm,lot_project_listing_price_per_sqm,lot_project_listing_installment_price_per_sqm,lot_project_listing_cash_price_per_sqm,lot_project_listing_lmf_rate,lot_project_listing_reservation_fee,annual_interest_rate,lot_project_listing_status,lot_project_listing_net_selling_price,lot_project_listing_lmf_amount,lot_project_listing_tcp)
   VALUES(?,'Inner',?,300,2200,2200,1900,10,50000,0,'available',660000,66000,726000)`,[projectId,code+'-'+String(i+1).padStart(4,'0')]);ids.push(result.insertId);
 }
 const created=[];for(let i=1;i<=2;i++){const [r]=await db.execute("INSERT INTO documents(document_name,document_code) VALUES(?,?)",['Synthetic PDF10 '+i+' '+tag,'Q10-'+tag+'-'+i]);created.push(r.insertId)}docs=created;
});
test.after(async()=>{if(ids.length===215&&batches.length===2){mkdirSync('QA_REPORTS/.runtime/pdf10',{recursive:true});writeFileSync('QA_REPORTS/.runtime/pdf10/fixtures.json',JSON.stringify(fixtures,null,2))}await db.end();await hrDb.end()});

for(const [index,count] of [60,150].entries())test(`one ${count}-listing operation creates one parent, exact row snapshots and one notification per recipient`,async()=>{
 const selected=index===0?ids.slice(0,60):ids.slice(60,210),rows=await rowsFor(selected,{lotType:'Corner'});
 const before=ok(await call('auditor','/workflow/summary')).data;
 const result=ok(await apply(rows));assert.equal(result.changedCount,count);assert.ok(result.reviewId);
 const [[n]]=await db.query('SELECT COUNT(*) AS n FROM operational_reviews WHERE lot_project_id=?',[projectId]);assert.equal(n.n,index+1,'no per-listing review flood');
 const [[batch]]=await db.query('SELECT * FROM lot_project_listing_bulk_batches WHERE batch_id=?',[result.batchId]);assert.equal(Number(batch.operational_review_id),result.reviewId);assert.equal(batch.changed_count,count);assert.equal(batch.changed_field_count,count);
 const [items]=await db.query('SELECT * FROM lot_project_listing_bulk_rows WHERE batch_id=? ORDER BY row_id',[result.batchId]);assert.equal(items.length,count);
 for(const item of items){assert.equal(parse(item.before_snapshot_json).lotType,'Inner');assert.equal(parse(item.after_snapshot_json).lotType,'Corner');assert.equal((await listing(item.lot_project_listing_id)).lot_project_listing_unit_type,'Corner')}
 const after=ok(await call('auditor','/workflow/summary')).data;assert.equal(after.pendingReviewTasks-before.pendingReviewTasks,1);assert.equal(after.affectedRecords-before.affectedRecords,count);
 const [notices]=await db.query('SELECT user_id,COUNT(*) AS n FROM internal_notifications WHERE operational_review_id=? GROUP BY user_id',[result.reviewId]);assert.ok(notices.length>=2);assert.ok(notices.every(row=>row.n===1));
 const [[audit]]=await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type='lot_project_listing' AND JSON_EXTRACT(metadata_json,'$.batchId')=?",[result.batchId]);assert.equal(audit.n,count);
 batches.push({...result,selected,rows,items});
});

test('bulk pages, unit search, changed-field filters, sorting and main queue keep affected records separate',async()=>{
 const batch=batches[1];assert.ok(batch);const url='/workflow/reviews/'+batch.reviewId+'/bulk-rows';
 const first=ok(await call('auditor',url+'?page=1&limit=20&sort=unit&direction=desc'));assert.equal(first.data.length,20);assert.equal(first.pagination.total,150);assert.equal(first.pagination.totalPages,8);assert.ok(!Object.hasOwn(first.data[0],'before_snapshot_json'));
 const last=ok(await call('auditor',url+'?page=8&limit=20'));assert.equal(last.data.length,10);assert.ok(!first.data.every(row=>last.data.some(other=>other.row_id===row.row_id)));
 const found=ok(await call('auditor',url+'?search='+encodeURIComponent(code+'-0061')));assert.equal(found.data.length,1);assert.equal(found.data[0].lot_project_listing_id,ids[60]);
 assert.equal(ok(await call('auditor',url+'?field=lotType')).pagination.total,150);assert.equal(ok(await call('auditor',url+'?field=reservationFee')).pagination.total,0);ok(await call('auditor',url+'?field=unauthorized'),400);
 const queue=ok(await call('auditor','/workflow/reviews?category=bulk&search='+encodeURIComponent('Batch '+batch.batchId)));assert.equal(queue.data.length,1);assert.equal(queue.data[0].affected_records,150);
 const detail=ok(await call('auditor',url+'/'+batch.items[0].row_id)).data;assert.deepEqual(parse(detail.before_snapshot_json),parse(batch.items[0].before_snapshot_json));
 ok(await call('operations_staff',url+'/decision',{rowIds:[batch.items[0].row_id],decision:'no_issue'}),403);
});

test('58 clean and 2 issue results create exactly two linked cases; incomplete batches cannot close',async()=>{
 const batch=batches[0],url='/workflow/reviews/'+batch.reviewId;ok(await call('auditor',url+'/auditor-verify',{}),409);
 const clean=batch.items.slice(0,58).map(row=>Number(row.row_id));ok(await call('auditor',url+'/bulk-rows/decision',{rowIds:clean,decision:'no_issue'}));
 ok(await call('auditor',url+'/auditor-verify',{}),409);
 for(const row of batch.items.slice(58))ok(await call('auditor',url+'/bulk-rows/decision',{rowIds:[row.row_id],decision:'report_issue',note:'Synthetic cadastral issue requires controlled correction.',assigneeId:users.system_admin.id}));
 const [[state]]=await db.query("SELECT SUM(review_status='no_issue') AS clean,SUM(audit_case_id IS NOT NULL) AS issues FROM lot_project_listing_bulk_rows WHERE batch_id=?",[batch.batchId]);assert.equal(Number(state.clean),58);assert.equal(Number(state.issues),2);
 const [children]=await db.query('SELECT * FROM lot_project_listing_bulk_rows WHERE batch_id=? AND audit_case_id IS NOT NULL ORDER BY row_id',[batch.batchId]);batch.issues=children;assert.equal(children.length,2);
 for(const row of children){const child=await review(row.operational_review_id);assert.deepEqual(parse(child.before_snapshot_json),parse(row.before_snapshot_json));assert.equal(Number(child.auditCase.assigned_responder_user_id),users.system_admin.id)}
 const duplicate=await Promise.all([call('auditor',url+'/bulk-rows/decision',{rowIds:[clean[0]],decision:'report_issue',note:'Cannot duplicate an existing result.'}),call('auditor',url+'/bulk-rows/decision',{rowIds:[clean[0]],decision:'report_issue',note:'Concurrent duplicate result.'})]);assert.ok(duplicate.every(response=>response.status===409));
 ok(await call('auditor',url+'/auditor-verify',{}));assert.equal((await review(batch.reviewId)).status,'closed');
 assert.equal((await review(children[0].operational_review_id)).status,'correction_required','open child cases remain independent');
});

test('150 clean listings can be completed in pages without individual review tasks',async()=>{
 const batch=batches[1],url='/workflow/reviews/'+batch.reviewId;for(const start of [0,100])ok(await call('auditor',url+'/bulk-rows/decision',{rowIds:batch.items.slice(start,start+100).map(row=>Number(row.row_id)),decision:'no_issue'}));
 ok(await call('auditor',url+'/auditor-verify',{}));assert.equal((await review(batch.reviewId)).status,'closed');
});

test('an assigned administrator corrects a child, failed verification returns the same case, and independent Auditor closes it',async()=>{
 const item=batches[0].issues[0],reviewId=Number(item.operational_review_id),auditCaseId=Number(item.audit_case_id),id=item.lot_project_listing_id,url='/workflow/reviews/'+reviewId;
 const original=parse((await review(reviewId)).before_snapshot_json),row=await listing(id),path=root+'/listings/'+id;
 const body=listingBody(row,{lotType:'End',auditCaseId,reviewId,reason:'Corrected lot type following verified survey evidence.'});
 ok(await call('super_admin',path,body,'PUT'),403);ok(await call('system_admin',path,{...body,reason:''},'PUT'),400);
 ok(await call('system_admin',path,body,'PUT'));let saved=await review(reviewId);assert.equal(saved.status,'pending_auditor_recheck');assert.deepEqual(parse(saved.before_snapshot_json),original);
 ok(await call('system_admin',url+'/auditor-verify',{note:'Self verification must be rejected.'}),403);
 ok(await call('system_admin','/workflow/audit-cases/'+auditCaseId+'/resolve-with-notes',{notes:'Submitted from an older client; this must never close the case.'}));assert.equal((await review(reviewId)).auditCase.status,'pending_auditor_recheck');
 ok(await call('auditor',url+'/correction-return',{comments:'Survey evidence needs another correction to the lot type.'}));saved=await review(reviewId);assert.equal(saved.status,'correction_required');assert.equal(Number(saved.auditCase.audit_case_id),auditCaseId);
 ok(await call('system_admin',path,listingBody(await listing(id),{lotType:'Inner',auditCaseId,reviewId,reason:'Second correction supported by the final survey record.'}),'PUT'));
 ok(await call('auditor',url+'/auditor-verify',{note:'Verified saved lot type against the final survey evidence.'}));saved=await review(reviewId);assert.equal(saved.auditCase.status,'closed');assert.ok(saved.auditCase.final_verified_at);assert.deepEqual(parse(saved.before_snapshot_json),original);
 assert.equal(saved.events.filter(event=>event.event_type==='controlled_correction_applied').length,2);assert.equal(saved.events.filter(event=>event.event_type==='auditor_correction_returned').length,1);
 const [[linked]]=await db.query('SELECT * FROM lot_project_listing_bulk_rows WHERE row_id=?',[item.row_id]);assert.equal(linked.review_status,'verified_closed');assert.deepEqual(parse(linked.after_snapshot_json),parse(item.after_snapshot_json));
 fixtures.correctionReviewId=reviewId;
});

test('saved cadastral, document and multiple-field comparisons work for normal and protected edits',async()=>{
 const id=ids[210],path=root+'/listings/'+id;
 let response=ok(await call('super_admin',path,listingBody(await listing(id),{lotType:'End',cadastralLots:['Q10-CAD-A'],documentRequirements:[{documentId:docs[0],isRequired:1,responsibleParty:'client',status:'active'}]}),'PUT'));
 let saved=await review(response.review.reviewId);assert.deepEqual(parse(saved.before_snapshot_json).cadastralLots,[]);assert.deepEqual(parse(saved.after_snapshot_json).cadastralLots,['Q10-CAD-A']);assert.ok(savedSnapshotChangeSummary(parse(saved.before_snapshot_json),parse(saved.after_snapshot_json)).changedFields>=3);
 const beforeDoc=parse(saved.after_snapshot_json).documentRequirements;assert.equal(beforeDoc[0].documentId,docs[0]);
 response=ok(await call('super_admin',path+'/document-requirements',{documents:[{documentId:docs[1],isRequired:0,responsibleParty:'internal',status:'active'}]},'PUT'));
 saved=await review(response.review.reviewId);const after=parse(saved.after_snapshot_json);assert.equal(after.documentRequirements.find(row=>row.documentId===docs[0]).status,'inactive');assert.equal(after.documentRequirements.find(row=>row.documentId===docs[1]).isRequired,0);
 const [persisted]=await db.query('SELECT document_id AS documentId,lot_project_listing_document_is_required AS isRequired,lot_project_listing_document_responsible_party AS responsibleParty,lot_project_listing_document_status AS status FROM lot_project_listing_documents WHERE lot_project_listing_id=? ORDER BY document_id',[id]);assert.deepEqual(after.documentRequirements,persisted);fixtures.documentReviewId=response.review.reviewId;
 await db.query("UPDATE lot_project_listings SET lot_project_listing_status='sold' WHERE lot_project_listing_id=?",[id]);
 response=ok(await call('super_admin',path,listingBody(await listing(id),{cadastralLots:['Q10-CAD-B'],reason:'Synthetic protected cadastral survey correction.'}),'PUT'));
 saved=await review(response.review.reviewId);assert.deepEqual(parse(saved.before_snapshot_json).cadastralLots,['Q10-CAD-A']);assert.deepEqual(parse(saved.after_snapshot_json).cadastralLots,['Q10-CAD-B']);assert.deepEqual(parse(saved.before_snapshot_json).documentRequirements,parse(saved.after_snapshot_json).documentRequirements);fixtures.cadastralReviewId=response.review.reviewId;
});

test('Head batch approval returns and reuses one request; unauthorized roles cannot approve or change protected finances',async()=>{
 const target=[ids[211],ids[212]],key=randomUUID();for(const id of target)await db.query("UPDATE lot_project_listings SET lot_project_listing_status='sold' WHERE lot_project_listing_id=?",[id]);
 const rows=await rowsFor(target,{lotType:'Corner'}),request=ok(await apply(rows,{role:'operations_staff',key}),202),requestId=request.approvalRequestId,path='/workflow/protected-changes/'+requestId;
 for(const repeated of await Promise.all([apply(rows,{role:'operations_staff',key}),apply(rows,{role:'operations_staff',key})]))assert.equal(ok(repeated,202).approvalRequestId,requestId,'concurrent identical submissions reuse the same approval');
 assert.equal((await listing(target[0])).lot_project_listing_unit_type,'Inner');
 const headList=ok(await call('operations_head','/workflow/protected-changes?status=pending&search='+encodeURIComponent('bulk listing edit'))).data;assert.ok(headList.some(row=>Number(row.protected_change_request_id)===requestId));assert.ok(!Object.hasOwn(headList.find(row=>Number(row.protected_change_request_id)===requestId),'request_payload_json'));
 const page=ok(await call('operations_head',path+'/bulk-rows?limit=1&page=2'));assert.equal(page.data.length,1);assert.equal(page.pagination.total,2);
 ok(await call('sales_head',path+'/bulk-rows'),403);ok(await call('operations_staff',path+'/review',{decision:'approve'}),403);
 ok(await call('operations_head',path+'/review',{decision:'return',note:'Clarify the survey report before applying this change.'}));
 const revised=rows.map(row=>({...row,values:{...row.values,lotType:'End'}})),same=ok(await apply(revised,{role:'operations_staff',key}),202);assert.equal(same.approvalRequestId,requestId);
 ok(await call('operations_head',path+'/review',{decision:'approve',note:'Survey clarification checked.'}));
 const saved=ok(await apply(revised,{role:'operations_staff',key}));assert.equal(saved.changedCount,2);assert.equal((await review(saved.reviewId)).status,'pending_auditor_review');
 const [[requests]]=await db.query('SELECT COUNT(*) AS n FROM protected_change_requests WHERE entity_id=? AND requested_by_user_id=?',[key,users.operations_staff.id]);assert.equal(requests.n,1);
 const invalid=await rowsFor(target,{reservationFee:0});ok(await apply(invalid,{role:'operations_staff'}),409);
 fixtures.headBatchReviewId=saved.reviewId;fixtures.headApprovalId=requestId;
});

test('individual Head requests can return, approve exact payloads, and retain their audit decisions',async()=>{
 const id=ids[211],path=root+'/listings/'+id,body=listingBody(await listing(id),{lotType:'Corner',cadastralLots:['Q10-INDIVIDUAL'],reason:'Synthetic individual protected survey correction.'});
 const pending=ok(await call('operations_staff',path,body,'PUT'),409);const requestId=Number(pending.data.requestId),requestPath='/workflow/protected-changes/'+requestId+'/review';
 ok(await call('operations_head',requestPath,{decision:'return',note:'Add the final survey confirmation.'}));
 const again=ok(await call('operations_staff',path,body,'PUT'),409);ok(await call('operations_head','/workflow/protected-changes/'+again.data.requestId+'/review',{decision:'approve',note:'Survey confirmation received.'}));
 const saved=ok(await call('operations_staff',path,body,'PUT'));assert.equal((await review(saved.review.reviewId)).status,'pending_auditor_review');
 const [[audit]]=await db.query("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type='protected_change_request' AND entity_id IN (?,?)",[String(requestId),String(again.data.requestId)]);assert.ok(audit.n>=2);
});

test('main Notifications remain available and role-specific summaries never leak another department',async()=>{
 const summary=ok(await call('sales_head','/workflow/summary')).data;assert.equal(summary.pendingReviewTasks,0);assert.equal(summary.openAuditCases,0);assert.equal(summary.returnedRequests,0);
 const main=await call('super_admin','/notifications/payment-dues?page=1&limit=10');assert.equal(main.status,200,JSON.stringify(main.data));
 const admin=ok(await call('system_admin','/workflow/summary')).data;assert.ok(admin.completedCorrections>=1);assert.ok(admin.assignedCorrections>=1);
});

test('concurrent confirmation of one bulk operation saves exactly one parent and one batch',async()=>{
 const rows=await rowsFor([ids[214]],{lotType:'End'}),key=randomUUID();
 const responses=await Promise.all([apply(rows,{key}),apply(rows,{key})]);assert.deepEqual(responses.map(row=>row.status).sort(),[200,409]);
 const [[count]]=await db.query('SELECT COUNT(*) AS n,COUNT(operational_review_id) AS reviews FROM lot_project_listing_bulk_batches WHERE lot_project_id=? AND changed_by_user_id=1 AND submission_key=?',[projectId,key]);assert.equal(count.n,1);assert.equal(count.reviews,1);
});
