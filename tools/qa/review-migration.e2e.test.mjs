// Execute the shipping SQL against fresh, partial and completed scratch schemas.
// This tests MySQL execution and data preservation; no live TiDB is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const mysql=createRequire(new URL('../../SERVER/SYSTEM/package.json',import.meta.url))('mysql2/promise');
const sql=readFileSync(new URL('../../SERVER/SYSTEM/migrations/20261122_review_center_batches.sql',import.meta.url),'utf8');
const statements=sql.replace(/^\s*--.*$/gm,'').split(';').map(value=>value.trim()).filter(Boolean);
const changes=[...sql.replace(/^\s*--.*$/gm,'').matchAll(/'((?:''|[^'])*)'/g)].map(match=>match[1].replaceAll("''","'")).filter(value=>/^ALTER TABLE /i.test(value));
let connection,sequence=0;const schemas=new Set(),results=[];
const guard=async()=>{const [[server]]=await connection.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'))};
test.before(async()=>{connection=await mysql.createConnection({host:'127.0.0.1',port:13307,user:'root',dateStrings:true});await guard()});
test.after(async()=>{if(connection){await guard();for(const schema of schemas){assert.match(schema,/^qa_review_migration_[a-z0-9_]+$/);await connection.query('DROP DATABASE `'+schema+'`')}await connection.end()}mkdirSync('QA_REPORTS/evidence',{recursive:true});writeFileSync('QA_REPORTS/evidence/review-migration-results.json',JSON.stringify({engine:'Isolated MySQL 8; TiDB statement ordering checked separately',results},null,2))});
async function fixture(){
 await guard();const schema='qa_review_migration_'+Date.now().toString(36)+'_'+(++sequence);assert.match(schema,/^qa_review_migration_[a-z0-9_]+$/);await connection.query('CREATE DATABASE `'+schema+'`');schemas.add(schema);await connection.query('USE `'+schema+'`');
 for(const ddl of [
  'CREATE TABLE operational_reviews(operational_review_id BIGINT UNSIGNED PRIMARY KEY,before_snapshot_json JSON,after_snapshot_json JSON,status VARCHAR(40))',
  'CREATE TABLE audit_cases(audit_case_id BIGINT UNSIGNED PRIMARY KEY,operational_review_id BIGINT UNSIGNED,status VARCHAR(40),finding TEXT)',
  'CREATE TABLE lot_project_listing_bulk_batches(batch_id BIGINT UNSIGNED PRIMARY KEY,lot_project_id INT UNSIGNED NOT NULL,changed_by_user_id INT UNSIGNED,adjustment_reason VARCHAR(1000),changed_count INT UNSIGNED NOT NULL DEFAULT 0)',
  'CREATE TABLE lot_project_listing_bulk_rows(row_id BIGINT UNSIGNED PRIMARY KEY,batch_id BIGINT UNSIGNED NOT NULL,lot_project_listing_id INT UNSIGNED NOT NULL,before_snapshot_json JSON NOT NULL,after_snapshot_json JSON NOT NULL,changed_fields_json JSON NOT NULL)',
  "CREATE TABLE protected_change_requests(protected_change_request_id BIGINT UNSIGNED PRIMARY KEY,status ENUM('pending','approved','rejected','used','expired','cancelled') NOT NULL DEFAULT 'pending',request_payload_json JSON)",
 ])await connection.query(ddl);
 await connection.query("INSERT INTO operational_reviews VALUES(1,?,?,'pending_auditor_review'),(2,?,?,'correction_required')",['{"value":"Original"}','{"value":"Saved"}','{"value":"Before correction"}','{"value":"After correction"}']);
 await connection.query("INSERT INTO audit_cases VALUES(5,2,'pending_system_admin_correction','Existing finding must survive')");
 await connection.query("INSERT INTO lot_project_listing_bulk_batches VALUES(10,1,7,'Existing batch reason',1)");
 await connection.query('INSERT INTO lot_project_listing_bulk_rows VALUES(101,10,55,?,?,?)',['{"cadastralLots":["LEGACY-A"]}','{"cadastralLots":["LEGACY-B"]}','{"cadastralLots":{"before":"LEGACY-A","after":"LEGACY-B"}}']);
 await connection.query("INSERT INTO protected_change_requests VALUES(71,'approved',?)",['{"rows":[{"listingId":55}]}']);return schema;
}
async function businessHistory(){const data={};for(const [table,fields] of [
 ['operational_reviews','*'],['audit_cases','*'],['lot_project_listing_bulk_batches','batch_id,lot_project_id,changed_by_user_id,adjustment_reason,changed_count'],
 ['lot_project_listing_bulk_rows','row_id,batch_id,lot_project_listing_id,before_snapshot_json,after_snapshot_json,changed_fields_json'],['protected_change_requests','*'],
 ])data[table]=(await connection.query(`SELECT ${fields} FROM ${table} ORDER BY 1`))[0];return data}
async function apply(){const checks=[];for(const statement of statements){const [rows]=await connection.query(statement);if(/^SELECT 'review_batch_/.test(statement)){assert.equal(rows[0].installed,rows[0].expected);checks.push(rows[0])}}assert.equal(checks.length,4);return checks}
for(const [name,prefix] of [['fresh schema',0],['interrupted after the first column',1],['interrupted after all columns',9],['interrupted after indexes and one foreign key',15],['completed migration',18]])test(name+' resumes and reruns without changing historical records',async()=>{
 const schema=await fixture();for(const ddl of changes.slice(0,prefix))await connection.query(ddl);
 if(prefix>=9){await connection.query("UPDATE lot_project_listing_bulk_batches SET operational_review_id=1,changed_field_count=1,submission_key='existing-submission' WHERE batch_id=10");await connection.query("UPDATE lot_project_listing_bulk_rows SET operational_review_id=2,audit_case_id=5,review_status='no_issue',reviewed_by_user_id=7,reviewed_at='2026-11-22 10:00:00',review_note='Existing decision must survive' WHERE row_id=101")}
 const before=await businessHistory(),checks=await apply();assert.deepEqual(await businessHistory(),before);
 const [saved]=await connection.query('SELECT * FROM lot_project_listing_bulk_rows WHERE row_id=101');if(prefix>=9){assert.equal(saved[0].review_status,'no_issue');assert.equal(saved[0].review_note,'Existing decision must survive');assert.equal(Number(saved[0].audit_case_id),5)}else assert.equal(saved[0].review_status,'pending');
 await apply();assert.deepEqual(await businessHistory(),before);assert.deepEqual((await connection.query('SELECT * FROM lot_project_listing_bulk_rows WHERE row_id=101'))[0],saved);
 await assert.rejects(connection.query('UPDATE lot_project_listing_bulk_rows SET operational_review_id=99999 WHERE row_id=101'),error=>error.errno===1452);
 await connection.query("INSERT INTO protected_change_requests VALUES(72,'returned','{}')");assert.equal((await connection.query('SELECT status FROM protected_change_requests WHERE protected_change_request_id=72'))[0][0].status,'returned');
 results.push({name,status:'PASS',completionChecks:checks});await guard();assert.ok(schemas.has(schema));await connection.query('DROP DATABASE `'+schema+'`');schemas.delete(schema);
});
