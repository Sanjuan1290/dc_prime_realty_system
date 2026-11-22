import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {db,hrDb,guard,api,ok,requireSystem} from './pdf10-common.mjs';
import {normalizedListing} from '../../SERVER/SYSTEM/controllers/Lot_Projects/Listings/listingBulkFields.js';
const f=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf10/fixtures.json','utf8')),mysql=requireSystem('mysql2/promise'),jwt=requireSystem('jsonwebtoken');
const cookie=role=>'token='+jwt.sign({id:f.users[role].id,authVersion:0},'qa-system-only-secret-'.repeat(3),{expiresIn:3600});
let admin;const trigger='qa_pdf10_atomic_failure';
test.before(async()=>{await guard(db);admin=await mysql.createConnection({host:'127.0.0.1',port:13307,user:'root',database:'dc_prime_realty_system_db'});await guard(admin)});
test.after(async()=>{if(admin){await admin.query('DROP TRIGGER IF EXISTS '+trigger);await admin.end()}await db.end();await hrDb.end()});
const state=async()=>{const [rows]=await db.query('SELECT * FROM lot_project_listings WHERE lot_project_id=? ORDER BY lot_project_listing_id',[f.projectId]);const [[counts]]=await db.query('SELECT (SELECT COUNT(*) FROM lot_project_listing_bulk_batches) AS batches,(SELECT COUNT(*) FROM lot_project_listing_bulk_rows) AS items,(SELECT COUNT(*) FROM audit_cases) AS cases,(SELECT COUNT(*) FROM operational_reviews) AS reviews,(SELECT COUNT(*) FROM operational_review_events) AS events,(SELECT COUNT(*) FROM audit_logs) AS audits,(SELECT COUNT(*) FROM internal_notifications) AS notifications');return {rows,counts}};
test('failure after two listing writes rolls back all listing values, batch history, reviews, notifications and audit logs',async()=>{
 const ids=f.ids.slice(1,4),rows=[];for(const id of ids){const [[saved]]=await db.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=?',[id]);const original=normalizedListing(saved);rows.push({listingId:id,expectedStatus:'Available',original,values:{...original,lotAreaSqm:333}})}
 const before=await state();
 await admin.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON lot_project_listing_bulk_rows FOR EACH ROW BEGIN IF NEW.lot_project_listing_id=${Number(ids[2])} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic atomic failure'; END IF; END`);
 try{const response=await api('/projects/lot-projects/'+f.slug+'/listing-bulk/apply',{rows,submissionKey:randomUUID(),reason:'Synthetic atomic rollback verification.'},{cookie:cookie('super_admin')});assert.equal(response.status,500);assert.deepEqual(await state(),before)}finally{await admin.query('DROP TRIGGER '+trigger)}
});
test('failure recording a second batch decision rolls back the first decision and all its audit evidence',async()=>{
 const [rows]=await db.query('SELECT br.* FROM lot_project_listing_bulk_rows br INNER JOIN lot_project_listing_bulk_batches b ON b.batch_id=br.batch_id WHERE b.operational_review_id=? ORDER BY br.row_id',[f.headBatchReviewId]);assert.equal(rows.length,2);assert.ok(rows.every(row=>row.review_status==='pending'));
 const before=await state();await admin.query(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON lot_project_listing_bulk_rows FOR EACH ROW BEGIN IF NEW.row_id=${Number(rows[1].row_id)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic decision failure'; END IF; END`);
 try{const response=await api('/workflow/reviews/'+f.headBatchReviewId+'/bulk-rows/decision',{rowIds:rows.map(row=>row.row_id),decision:'no_issue'},{cookie:cookie('auditor')});assert.equal(response.status,500);assert.deepEqual(await state(),before);const [after]=await db.query('SELECT * FROM lot_project_listing_bulk_rows WHERE batch_id=? ORDER BY row_id',[rows[0].batch_id]);assert.deepEqual(after,rows)}finally{await admin.query('DROP TRIGGER '+trigger)}
});
test('a failed issue-row update rolls back its child review, case, notification and events',async()=>{
 const [[row]]=await db.query('SELECT br.* FROM lot_project_listing_bulk_rows br INNER JOIN lot_project_listing_bulk_batches b ON b.batch_id=br.batch_id WHERE b.operational_review_id=? ORDER BY br.row_id LIMIT 1',[f.headBatchReviewId]);const before=await state();
 await admin.query(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON lot_project_listing_bulk_rows FOR EACH ROW BEGIN IF NEW.row_id=${Number(row.row_id)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic issue failure'; END IF; END`);
 try{const response=await api('/workflow/reviews/'+f.headBatchReviewId+'/bulk-rows/decision',{rowIds:[row.row_id],decision:'report_issue',note:'Synthetic issue creation rollback.',assigneeId:1},{cookie:cookie('auditor')});assert.equal(response.status,500);assert.deepEqual(await state(),before)}finally{await admin.query('DROP TRIGGER '+trigger)}
});
