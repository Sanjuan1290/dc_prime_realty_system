import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {db,hrDb,guard,api,ok,login,requireSystem} from './pdf10-common.mjs';
import {PERMISSIONS} from '../../SERVER/SYSTEM/config/permissions.js';
const fixture=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf10/fixtures.json','utf8')),cookies={};
const jwt=requireSystem('jsonwebtoken');
const originalRef='SYNTHETIC-ORIGINAL-'+Date.now(),correctedRef='SYNTHETIC-CORRECTED-'+Date.now();
for(const [role,user] of Object.entries(fixture.users))cookies[role]='token='+jwt.sign({id:user.id,authVersion:0},'qa-system-only-secret-'.repeat(3),{expiresIn:3600});
const call=(role,path,body,method)=>api(path,body,{cookie:cookies[role],method}),root='/projects/lot-projects/'+fixture.slug;
let accountId,profileId,paymentId,scheduleId,reviewId,auditCaseId,hrCookie,originalKiosk,originalExpiry;const id=fixture.ids[213];
test.before(async()=>{
 await guard(db);await guard(hrDb);hrCookie=await login('hr@qa.invalid','hr');
 const [profile]=await db.execute(`INSERT INTO lot_project_client_profiles(lot_project_id,lot_project_listing_id,buyer_full_name,soa_annual_interest_rate,soa_mode_of_payment,soa_selected_price_per_sqm,soa_selected_base_selling_price,soa_selected_net_selling_price,soa_selected_lmf_amount,soa_selected_tcp,soa_monthly_terms,soa_downpayment_percentage,soa_downpayment_terms,soa_reservation_fee,soa_first_due_date,soa_starting_date)
 VALUES(?,?,'Synthetic PDF10 Buyer',0,'installment',2200,660000,660000,66000,726000,24,30,3,50000,'2026-12-22','2026-11-22')`,[fixture.projectId,id]);profileId=profile.insertId;
 const [account]=await db.execute("INSERT INTO lot_project_accounts(account_reference,lot_project_id,lot_project_listing_id,lot_project_client_profile_id,buyer_name_snapshot,unit_id_snapshot) VALUES(?,?,?,?,'Synthetic PDF10 Buyer',?)",['QA-PDF10-'+Date.now(),fixture.projectId,id,profileId,fixture.code+'-0214']);accountId=account.insertId;
 await db.execute("UPDATE lot_project_listings SET current_account_id=?,lot_project_listing_status='sold' WHERE lot_project_listing_id=?",[accountId,id]);
 const [schedule]=await db.execute(`INSERT INTO lot_project_payment_schedules(lot_project_id,lot_project_listing_id,lot_project_client_profile_id,lot_project_account_id,due_date,description,due_amount,principal_amount,monthly_amortization_amount,amount_paid,schedule_status) VALUES(?,?,?,?,'2026-12-22','Downpayment 1',108819.42,108819.42,108819.42,41180.58,'Partial')`,[fixture.projectId,id,profileId,accountId]);scheduleId=schedule.insertId;
 const [payment]=await db.execute(`INSERT INTO lot_project_payments(lot_project_id,lot_project_listing_id,lot_project_client_profile_id,lot_project_account_id,lot_project_payment_schedule_id,lot_project_payment_type,lot_project_payment_amount,lot_project_payment_date,lot_project_payment_reference_id) VALUES(?,?,?,?,?,'downpayment',41180.58,'2026-11-22',?)`,[fixture.projectId,id,profileId,accountId,scheduleId,originalRef]);paymentId=payment.insertId;
 await db.execute('INSERT INTO lot_project_payment_allocations(lot_project_payment_id,lot_project_payment_schedule_id,applied_amount) VALUES(?,?,41180.58)',[paymentId,scheduleId]);
 const [review]=await db.execute(`INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,entity_label,initiated_by_user_id,initiated_by_role,before_snapshot_json,after_snapshot_json,status,approval_type) VALUES('payment.create','accounting',?,'lot_project_payment',?,'Synthetic payment',?,'accounting_staff',NULL,?,'pending_auditor_review','head_preapproved')`,[fixture.projectId,String(paymentId),fixture.users.accounting_staff.id,JSON.stringify({amount:41180.58,paymentDate:'2026-11-22',paymentType:'downpayment',paymentMethod:'Cash',referenceId:'SYNTHETIC-ORIGINAL',scheduleId})]);reviewId=review.insertId;
 await db.execute('UPDATE operational_reviews SET review_number=? WHERE operational_review_id=?',['REV-'+String(reviewId).padStart(8,'0'),reviewId]);
 const opened=ok(await call('auditor','/workflow/reviews/'+reviewId+'/audit-case',{finding:'Synthetic payment reference needs correction against the deposit record.',assigneeId:1}),201);auditCaseId=opened.auditCaseId||opened.data?.auditCaseId;
 const [[audit]]=await db.query('SELECT audit_case_id FROM audit_cases WHERE operational_review_id=?',[reviewId]);auditCaseId=Number(audit.audit_case_id);
 const [[settings]]=await hrDb.query('SELECT attendance_kiosk_password_hash AS hash,attendance_kiosk_generation AS generation,attendance_kiosk_password_expires_at_ms AS expiry,attendance_kiosk_rotated_at AS rotated FROM hr_settings WHERE id=1');originalKiosk=settings;
});
test.after(async()=>{
 if(originalKiosk)await hrDb.query('UPDATE hr_settings SET attendance_kiosk_password_hash=?,attendance_kiosk_generation=?,attendance_kiosk_password_expires_at_ms=?,attendance_kiosk_rotated_at=? WHERE id=1',[originalKiosk.hash,originalKiosk.generation,originalKiosk.expiry,originalKiosk.rotated]);
 await db.end();await hrDb.end();
});
const paymentBody=(extra={})=>({amount:41180.58,paymentDate:'2026-11-22',paymentType:'downpayment',paymentMethod:'Cash',referenceId:correctedRef,scheduleId,reason:'Corrected reference using the authorized deposit evidence.',reviewId,auditCaseId,...extra});
test('SOA exposes the exact per-installment partial Remaining Due of 67,638.84',async()=>{
 const detail=ok(await call('super_admin',root+'/listings/'+id));
 const find=value=>{if(Array.isArray(value)){for(const row of value){if(Number(row.remainingDue)===67638.84)return row;const found=find(row);if(found)return found}}else if(value&&typeof value==='object'){for(const item of Object.values(value)){const found=find(item);if(found)return found}}};
 const row=find(detail);assert.ok(row,JSON.stringify(Object.keys(detail)));assert.equal(Number(row.amountPaid),41180.58);
});
test('both payment review and case references authorize only the assigned owner and exact payment',async()=>{
 const path=root+'/listings/'+id+'/payments/'+paymentId;
 ok(await call('system_admin',path,paymentBody(),'PUT'),403);
 ok(await call('super_admin',path,paymentBody({reviewId:reviewId+99999}),'PUT'),409);
 ok(await call('auditor',path,paymentBody(),'PUT'),403);
 ok(await call('super_admin',path,paymentBody({reason:''}),'PUT'),400);
 ok(await call('system_admin',path+'/correction-code',{action:'edit',reason:paymentBody().reason,proposed:paymentBody(),reviewId,auditCaseId}),403);
 const preflight=ok(await call('super_admin',path+'/correction-code',{action:'edit',reason:paymentBody().reason,proposed:paymentBody(),reviewId,auditCaseId}));assert.equal(preflight.data.authorizationType,'audit_case');
 ok(await call('super_admin',path,paymentBody(),'PUT'));
 const saved=ok(await call('auditor','/workflow/reviews/'+reviewId)).data;assert.equal(saved.status,'pending_auditor_recheck');assert.equal(saved.before_snapshot_json,null,'missing original baseline stays unavailable');
 const event=saved.events.find(event=>event.event_type==='controlled_correction_applied');assert.ok(event);const evidence=typeof event.metadata_json==='string'?JSON.parse(event.metadata_json):event.metadata_json;assert.equal(evidence.nextBeforeSnapshot.referenceId,originalRef);assert.equal(Number(evidence.nextBeforeSnapshot.allocations[0].applied_amount),41180.58);
 const permission=PERMISSIONS.WORKFLOW_AUDIT_CORRECTION_VERIFY,auditorId=fixture.users.auditor.id;
 const [savedPermission]=await db.query('SELECT * FROM user_permissions WHERE user_id=? AND permission_key=?',[auditorId,permission]);assert.equal(savedPermission.length,1);
 await db.query('DELETE FROM user_permissions WHERE user_id=? AND permission_key=?',[auditorId,permission]);
 try{ok(await call('auditor','/workflow/reviews/'+reviewId+'/auditor-verify',{note:'An account without correction-verification permission must be denied.'}),403)}finally{await db.query('INSERT INTO user_permissions(user_id,permission_key,allowed,granted_by_user_id) VALUES(?,?,?,?)',[auditorId,permission,savedPermission[0].allowed,savedPermission[0].granted_by_user_id])}
 ok(await call('auditor','/workflow/reviews/'+reviewId+'/auditor-verify',{note:'Verified the corrected payment reference and allocation.'}));
});
let password,firstSessions;
test('kiosk regeneration stores a hash, expires in 14 days and revokes all previous device sessions',async()=>{
 const hr=(path,body,options={})=>api(path,body,{app:'hr',cookie:hrCookie,...options});
 ok(await hr('/attendance/kiosk-password',{confirmed:false}),400);ok(await api('/attendance/kiosk-password',{confirmed:true},{app:'hr'}),401);
 const viewer=await login('hrviewer@qa.invalid','hr');ok(await hr('/attendance/kiosk-password',{confirmed:true},{cookie:viewer}),403);
 const rotate=async()=>ok(await hr('/attendance/kiosk-password',{confirmed:true})).data;
 const first=await rotate();assert.equal(first.password.length,24);assert.equal(first.visibleForSeconds,15);assert.ok(Math.abs(first.expiresAt-Date.now()-14*86400000)<2000);
 firstSessions=[];for(let i=0;i<3;i++){const session=await hr('/attendance-kiosk/unlock',{password:first.password},{cookie:''});ok(session);firstSessions.push(session.cookie)}
 const second=await rotate();password=second.password;originalExpiry=second.expiresAt;
 for(const cookie of firstSessions){assert.equal(ok(await hr('/attendance-kiosk/session',undefined,{cookie})).unlocked,false);ok(await hr('/attendance-kiosk/scan',{barcode:'0000000000'},{cookie}),401)}
 ok(await hr('/attendance-kiosk/unlock',{password:first.password},{cookie:''}),401);ok(await hr('/attendance-kiosk/unlock',{pin:'724381'},{cookie:''}),401);ok(await hr('/attendance-kiosk/unlock',{password},{cookie:''}));
 const status=ok(await hr('/attendance/kiosk-password'));assert.ok(!JSON.stringify(status).includes(password));assert.ok(!JSON.stringify(status).includes('passwordHash'));
 const [[stored]]=await hrDb.query('SELECT attendance_kiosk_password_hash AS hash FROM hr_settings WHERE id=1');assert.notEqual(stored.hash,password);assert.ok(await requireSystem('bcrypt').compare(password,stored.hash));
 const [audit]=await hrDb.query("SELECT details_json FROM hr_audit_logs WHERE entity_type='attendance_kiosk' ORDER BY id DESC LIMIT 2");assert.ok(!JSON.stringify(audit).includes(password));assert.ok(!JSON.stringify(audit).includes(stored.hash));
});
test('server-side credential expiry locks active sessions and rejects unlocks while preserving the 6 PM setting',async()=>{
 const hr=(path,body,options={})=>api(path,body,{app:'hr',cookie:hrCookie,...options});
 const unlocked=await hr('/attendance-kiosk/unlock',{password},{cookie:''});ok(unlocked);
 const [[before]]=await hrDb.query('SELECT * FROM hr_settings WHERE id=1');
 await hrDb.query('UPDATE hr_settings SET attendance_kiosk_password_expires_at_ms=? WHERE id=1',[Date.now()-1]);
 assert.equal(ok(await hr('/attendance-kiosk/session',undefined,{cookie:unlocked.cookie})).unlocked,false);const denied=await hr('/attendance-kiosk/unlock',{password},{cookie:''});ok(denied,401);assert.equal(denied.data.code,'KIOSK_PASSWORD_EXPIRED');
 const [[after]]=await hrDb.query('SELECT * FROM hr_settings WHERE id=1');for(const key of Object.keys(before).filter(key=>/auto.*time|timeout|time_out/i.test(key)))assert.equal(after[key],before[key]);
 await hrDb.query('UPDATE hr_settings SET attendance_kiosk_password_expires_at_ms=? WHERE id=1',[originalExpiry]);
});
