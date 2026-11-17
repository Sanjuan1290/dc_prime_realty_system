// Isolated loopback database and APIs only. Never point these fixtures at a live ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { carryForwardOpenAuditCases } from '../../SERVER/SYSTEM/services/auditCaseWorkflow.service.js';
import { advanceAuditCaseToRecheck } from '../../SERVER/SYSTEM/services/auditCaseAuthorization.service.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from '../../SERVER/SYSTEM/config/recommendedRolePermissions.js';
const require=createRequire(new URL('../../SERVER/SYSTEM/package.json',import.meta.url)),mysql=require('mysql2/promise');
const db=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db',dateStrings:true});
const base='http://127.0.0.1:4179',password='Synthetic-QA-only-2026!',run=Date.now(),cookies={},users={},fixture={};
let project,listing,accountId,paymentId,scheduleId,reviewId,caseId;
async function api(path,{role='auditor',body,method=body?'POST':'GET'}={}) {
  const res=await fetch(base+'/api/v1'+path,{method,headers:{origin:base,...(cookies[role]?{cookie:cookies[role]}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
const ok=(r,status=200)=>assert.equal(r.status,status,JSON.stringify(r.data));
test.after(async()=>{await db.end()});
test('prepare synthetic payment, users and saved review in the isolated database',async()=>{
  const [[server]]=await db.query('SELECT @@port port');assert.equal(server.port,13307);
  for(const role of ['auditor','system_admin','accounting_head','accounting_staff']) {
    const [r]=await db.execute(`INSERT INTO users(account_category,first_name,last_name,email,password_hash,role,status,must_change_password,admin_all_projects,all_projects_access)
      SELECT 'system','QA',?,?,password_hash,?,'active',0,1,1 FROM users WHERE id=1`,[role,`${role}-${run}@qa.invalid`,role]);
    users[role]=r.insertId;
    for (const key of RECOMMENDED_ROLE_PERMISSIONS[role]) await db.execute('INSERT INTO user_permissions(user_id,permission_key,allowed) VALUES(?,?,1)',[r.insertId,key]);
    const login=await api('/user/login',{role,body:{email:`${role}-${run}@qa.invalid`,password}});ok(login);cookies[role]=login.cookie;
  }
  const owner=await api('/user/login',{role:'owner',body:{email:'system@qa.invalid',password}});ok(owner);cookies.owner=owner.cookie;
  [[project]]=await db.query('SELECT lot_project_id,lot_project_slug FROM lot_projects ORDER BY lot_project_id DESC LIMIT 1');
  [[listing]]=await db.query('SELECT lot_project_listing_id,lot_project_listing_unit_id FROM lot_project_listings WHERE lot_project_id=? LIMIT 1',[project.lot_project_id]);
  const [client]=await db.execute("INSERT INTO lot_project_client_profiles(lot_project_id,lot_project_listing_id,buyer_full_name) VALUES(?,?,'Synthetic Review Buyer')",[project.lot_project_id,listing.lot_project_listing_id]);
  const [account]=await db.execute("INSERT INTO lot_project_accounts(account_reference,lot_project_id,lot_project_listing_id,unit_id_snapshot,buyer_name_snapshot) VALUES(?,?,?,?,'Synthetic Review Buyer')",[`QA-REVIEW-${run}`,project.lot_project_id,listing.lot_project_listing_id,listing.lot_project_listing_unit_id]);accountId=account.insertId;
  const [schedule]=await db.execute("INSERT INTO lot_project_payment_schedules(lot_project_id,lot_project_listing_id,lot_project_client_profile_id,lot_project_account_id,description,due_date,due_amount) VALUES(?,?,?,?, 'First Downpayment','2026-11-01',1000)",[project.lot_project_id,listing.lot_project_listing_id,client.insertId,accountId]);scheduleId=schedule.insertId;
  const [payment]=await db.execute("INSERT INTO lot_project_payments(lot_project_id,lot_project_listing_id,lot_project_client_profile_id,lot_project_account_id,lot_project_payment_schedule_id,lot_project_payment_type,lot_project_payment_date,lot_project_payment_amount,lot_project_payment_method,lot_project_payment_reference_id) VALUES(?,?,?,?,?,'downpayment','2026-11-01',1000,'Cash',?)",[project.lot_project_id,listing.lot_project_listing_id,client.insertId,accountId,scheduleId,`QA-PAY-${run}`]);paymentId=payment.insertId;
  await db.execute("INSERT INTO lot_project_payment_proofs(lot_project_id,lot_project_listing_id,lot_project_client_profile_id,lot_project_payment_id,file_name,file_mime_type,cloudinary_public_id,proof_status,malware_scan_status) VALUES(?,?,?,?,'synthetic-proof.pdf','application/pdf',?,'active','pending')",[project.lot_project_id,listing.lot_project_listing_id,client.insertId,paymentId,'qa-only-never-fetched-'+run]);
  const [review]=await db.execute("INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,entity_label,initiated_by_user_id,initiated_by_role,after_snapshot_json,status,approval_type) VALUES('payment.create','accounting',?,'lot_project_payment',?,'Synthetic payment',?,'accounting_head',?,'pending_auditor_review','head_self')",[project.lot_project_id,String(paymentId),users.accounting_head,JSON.stringify({paymentId,scheduleId,amount:1000,paymentDate:'2026-11-01'})]);reviewId=review.insertId;
  await db.execute('UPDATE operational_reviews SET review_number=? WHERE operational_review_id=?',[`REV-QA-${reviewId}`,reviewId]);
  Object.assign(fixture,{reviewId,project,listing,paymentId,accountId,scheduleId,users,run});
});
test('Staff review goes through its Department Head to Auditor completion without an audit case',async()=>{
  const [created]=await db.execute("INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,initiated_by_user_id,initiated_by_role,status,approval_type) VALUES('payment.create','accounting',?,'lot_project_payment',?,?,'accounting_staff','pending_head_review','staff_entry')",[project.lot_project_id,String(paymentId),users.accounting_staff]);
  const id=created.insertId;
  ok(await api(`/workflow/reviews/${id}/head-confirm`,{role:'accounting_staff',body:{note:'Staff cannot approve their own work'}}),403);
  ok(await api(`/workflow/reviews/${id}/auditor-verify`,{body:{note:'Audit cannot bypass the pending Head check'}}),409);
  ok(await api(`/workflow/reviews/${id}/head-confirm`,{role:'accounting_head',body:{note:'Department Head confirmed the payment'}}));
  const detail=await api(`/workflow/reviews/${id}`);ok(detail);assert.equal(detail.data.data.status,'pending_auditor_review');
  ok(await api(`/workflow/reviews/${id}/auditor-verify`,{body:{note:'Review complete; no issue found'}}));
  const [[review]]=await db.execute('SELECT status FROM operational_reviews WHERE operational_review_id=?',[id]);assert.equal(review.status,'closed');
  const [[cases]]=await db.execute('SELECT COUNT(*) n FROM audit_cases WHERE operational_review_id=?',[id]);assert.equal(cases.n,0);
});
test('Auditor finding goes directly to System Correction Queue; Head is never asked for an explanation',async()=>{
  const opened=await api(`/workflow/reviews/${reviewId}/audit-case`,{body:{finding:'Payment amount differs from the authorized receipt.'}});ok(opened,201);caseId=opened.data.data.auditCaseId;fixture.caseId=caseId;
  assert.equal(opened.data.data.status,'pending_system_admin_correction');
  const queue=await api('/workflow/reviews',{role:'system_admin'});ok(queue);assert.ok(queue.data.data.some(r=>Number(r.operational_review_id)===reviewId));
  const head=await api('/workflow/reviews',{role:'accounting_head'});ok(head);assert.equal(head.data.data.some(r=>Number(r.operational_review_id)===reviewId),false);
  const detail=await api(`/workflow/reviews/${reviewId}`);ok(detail);assert.equal(detail.data.data.status,'correction_required');assert.equal(detail.data.data.viewer.canAct,false);
  ok(await api(`/workflow/audit-cases/${caseId}/head-response`,{role:'accounting_head',body:{response:'An old client should not advance this case'}}),409);
  ok(await api(`/workflow/audit-cases/${caseId}/resolve-with-notes`,{role:'auditor',body:{notes:'Auditor cannot close the admin correction'}}),403);
  ok(await api(`/workflow/audit-cases/${caseId}/resolve-with-notes`,{role:'system_admin',body:{notes:'No correction has been applied yet'}}),409);
});
test('Current Record preview identifies the exact payment and SOA while historical snapshots remain unchanged',async()=>{
  const preview=await api(`/workflow/reviews/${reviewId}/record-preview`);ok(preview);const p=preview.data.data;
  assert.equal(p.fields.buyerName,'Synthetic Review Buyer');assert.equal(p.fields.unitCode,listing.lot_project_listing_unit_id);
  assert.equal(p.fields.accountReference,`QA-REVIEW-${run}`);assert.equal(Number(p.fields.amount),1000);assert.equal(p.fields.paymentMethod,'Cash');
  assert.match(p.fields.relatedSoaEntry[0],/First Downpayment.*2026-11-01/);assert.equal(p.proofs.length,1);assert.equal(p.proofs[0].previewAvailable,false);
  assert.doesNotMatch(JSON.stringify(p),/cloudinary_public_id|qa-only-never-fetched/);
  const blocked=await api(`/workflow/reviews/${reviewId}/proofs/${p.proofs[0].proofId}/content`);ok(blocked,423);
  ok(await api(`/workflow/reviews/${reviewId}/proofs/99999999/content`),404);
  ok(await api(`/workflow/reviews/${reviewId}/record-preview`,{role:'accounting_staff'}),403);
  const [[saved]]=await db.execute('SELECT after_snapshot_json FROM operational_reviews WHERE operational_review_id=?',[reviewId]);
  const snapshot=typeof saved.after_snapshot_json==='string'?JSON.parse(saved.after_snapshot_json):saved.after_snapshot_json;
  assert.equal(snapshot.buyerName,undefined);assert.equal(snapshot.scheduleDescription,undefined);
});
test('authorized correction preserves its evidence; Resolve with Notes closes it and notifies the Auditor once',async()=>{
  const connection=await db.getConnection();try{
    await connection.beginTransaction();
    const [[auditCase]]=await connection.execute('SELECT * FROM audit_cases WHERE audit_case_id=? FOR UPDATE',[caseId]);
    await connection.execute('UPDATE lot_project_payments SET lot_project_payment_amount=950 WHERE lot_project_payment_id=?',[paymentId]);
    const result=await advanceAuditCaseToRecheck(connection,{auditCase,actor:{id:users.system_admin,role:'system_admin'},correctionSummary:'Corrected the amount to match the receipt',afterSnapshot:{paymentId,amount:950,scheduleId}});
    assert.equal(result.status,'correction_required');await connection.commit();
  }finally{connection.release()}
  const notes='Corrected the payment from PHP 1000 to PHP 950 against the approved receipt.';
  ok(await api(`/workflow/audit-cases/${caseId}/resolve-with-notes`,{role:'system_admin',body:{notes}}));
  ok(await api(`/workflow/audit-cases/${caseId}/resolve-with-notes`,{role:'system_admin',body:{notes}}),409);
  const detail=await api(`/workflow/reviews/${reviewId}`);ok(detail);assert.equal(detail.data.data.status,'closed');
  assert.equal(detail.data.data.auditCase.resolution_notes,notes);assert.ok(detail.data.data.auditCase.resolved_at);assert.equal(detail.data.data.auditCase.resolved_by_role,'system_admin');
  const notifications=await api('/workflow/notifications');ok(notifications);assert.ok(notifications.data.data.some(n=>n.notification_type==='audit_case_resolved'&&n.title.includes('Resolved by System Admin')));
  const [[count]]=await db.execute("SELECT COUNT(*) n FROM operational_review_events WHERE operational_review_id=? AND event_type='audit_case_resolved'",[reviewId]);assert.equal(count.n,1);
  fixture.resolvedReviewId=reviewId;
});
test('legacy open cases migrate once with snapshots, explanations and events intact; owner-only scope remains',async()=>{
  const snapshots=[];
  for(const status of ['awaiting_head_response','under_auditor_review','pending_auditor_recheck','closed']) {
    const [r]=await db.execute("INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,initiated_by_user_id,initiated_by_role,after_snapshot_json,status,approval_type) VALUES('payment.edit','accounting',?,'lot_project_payment',?,1,'super_admin',?,?,'emergency_super_admin')",[project.lot_project_id,String(paymentId),JSON.stringify({amount:42,legacy:true}),status==='closed'?'closed':status==='pending_auditor_recheck'?status:'audit_case_open']);
    const [c]=await db.execute("INSERT INTO audit_cases(operational_review_id,opened_by_auditor_user_id,finding,status,head_response,correction_summary,correction_applied_at) VALUES(?,?,'Legacy synthetic finding',?,'Retain this original explanation','Retain original correction',NOW())",[r.insertId,users.auditor,status]);
    snapshots.push({review:r.insertId,id:c.insertId,status});
  }
  assert.equal(await carryForwardOpenAuditCases(db),3);assert.equal(await carryForwardOpenAuditCases(db),0);
  for(const item of snapshots){
    const [[row]]=await db.execute('SELECT c.*,r.after_snapshot_json FROM audit_cases c JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id WHERE c.audit_case_id=?',[item.id]);
    assert.equal(row.status,item.status==='closed'?'closed':'pending_system_admin_correction');assert.equal(row.head_response,'Retain this original explanation');assert.equal(row.correction_summary,'Retain original correction');assert.match(JSON.stringify(row.after_snapshot_json),/legacy/);
  }
  const ownerCase=snapshots[2];
  ok(await api(`/workflow/audit-cases/${ownerCase.id}/resolve-with-notes`,{role:'system_admin',body:{notes:'System Admin must not resolve an owner-only case'}}),403);
  ok(await api(`/workflow/audit-cases/${ownerCase.id}/resolve-with-notes`,{role:'owner',body:{notes:'Owner resolved the existing applied correction with history preserved'}}));
  fixture.openReviewId=snapshots[0].review;
  writeFileSync('QA_REPORTS/.runtime/pdf3-fixtures.json',JSON.stringify(fixture,null,2));
});
