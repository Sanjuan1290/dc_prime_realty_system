import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { requiresDistinctReview } from '../services/reviewActionPolicy.js';
import { sellerAuditRows } from '../../client/src/utils/sellerAuditHistory.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=name=>readFileSync(path.join(root,name),'utf8');

test('financial and replacement actions use distinct Reviews while routine edits may merge',()=>{
 for(const action of ['seller.manager_replace','commission.assigned_seller_change','commission.adjust_unit']) assert.equal(requiresDistinctReview(action),true);
 for(const action of ['seller.update','listing.update','reservation.update']) assert.equal(requiresDistinctReview(action),false);
 const src=read('server/services/operationalReview.service.js');
 assert.match(src,/isDepartmentHead && !requiresDistinctReview\(actionKey\)/);
 assert.match(src,/requiresDistinctReview\(actionKey\) \? null : await refreshOwnRoutineReview/);
 assert.match(src,/requiresDistinctReview\(actionKey\)/);
});
test('manager and seller changes attach exact Review ID in the same transaction',()=>{
 const manager=read('server/controllers/System/sellerManagerReplacement.controller.js');
 const seller=read('server/controllers/Lot_Projects/ListingProfile/AssignedSellerChange.controller.js');
 for(const [source,reference] of [[manager,'review'],[seller,'workflow']]) {
  assert.ok(source.indexOf(`const ${reference}=await createOperationalReview`)<source.lastIndexOf('await writeAuditLog'));
  assert.ok(source.includes(`reviewId:${reference}.reviewId`));
  assert.ok(source.includes(`reviewNumber:${reference}.reviewNumber`));
 }
 assert.match(manager,/await connection.commit\(\)/);
 assert.match(seller,/await connection.commit\(\)/);
});
test('rate-only commission adjustments also link the exact review or audit correction',()=>{
 const source=read('server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
 const action=source.indexOf("title: 'Adjusted unit commission rates'");
 const review=source.indexOf("actionKey: 'commission.adjust_unit'",source.indexOf('const rateByCommission'));
 assert.ok(action>review,'the Audit Log must follow Review creation');
 assert.match(source,/reviewId: workflow\?\.reviewId \|\| null/);
 assert.match(source,/reviewNumber: workflow\?\.reviewNumber \|\| null/);
});
test('Audit Logs filter linked reviews by exact stored ID, not a substring',()=>{
 const controller=read('server/controllers/System/auditLogs.controller.js');
 assert.match(controller,/JSON_UNQUOTE\(JSON_EXTRACT\(al.metadata_json, '\$\.reviewId'\)\) = \?/);
 assert.match(controller,/if \(!Number.isSafeInteger\(id\) \|\| id < 1\)/);
 assert.match(controller,/await requireAdmin\(req\)/);
});
test('audit exports carry saved manager moves without live lookups',()=>{
 const rows=sellerAuditRows([{id:8,createdAt:'2026-10-18',title:'Replaced Manager',entityLabel:'Unit Manager',metadata:{replacementId:12,reviewId:13,fromManagerName:'Manager A',toManagerName:'Manager B',affected:[{sellerId:44,name:'Agent 1'},{sellerId:45,name:'Agent 2'}],reason:'Left network'}}]);
 assert.equal(rows.length,2);assert.equal(rows[0][1],13);assert.equal(rows[0][7],'Manager A');assert.equal(rows[1][8],'Manager B');
 assert.equal(rows[1][6],'Agent 2');
});
test('audit exports preserve original and new seller allocations',()=>{
 const rows=sellerAuditRows([{id:9,metadata:{changeId:7,reviewId:8,reason:'Wrong seller',before:[{role:'sales_agent',sellerName:'Old',rate:1,grossCommission:100}],after:[{role:'sales_agent',sellerName:'New',rate:2,grossCommission:200}]}}]);
 assert.equal(rows.length,1);assert.equal(rows[0][7],'Old');assert.equal(rows[0][8],'New');assert.equal(rows[0][9],'1');assert.equal(rows[0][10],'2');assert.equal(rows[0][11],'100');assert.equal(rows[0][12],'200');
 assert.deepEqual(sellerAuditRows([{id:10,metadata:{}}]),[]);
});
test('review comparison is snapshot-only and Audit UI has cross links with permissions',()=>{
 const component=read('client/src/components/Shared/ReviewSensitiveActionSummary.jsx');
 const review=read('client/src/pages/System/ReviewCenter.jsx');
 const auditPage=read('client/src/pages/System/AuditLogs.jsx');
 const auditModal=read('client/src/components/System/auditLogsComponents/AuditLogDetailsModal.jsx');
 assert.match(component,/Historical|historical|saved historical/);
 assert.doesNotMatch(component,/useQuery|fetch\(|useFetch\(/);
 assert.match(review,/hasPermission\(actor, PERMISSIONS.AUDIT_LOGS_VIEW\)/);
 assert.match(auditPage,/reviewId.*linkedReviewId/);
 assert.match(auditModal,/getAuditReferences\(log.metadata\)/);
 assert.match(read('client/src/utils/auditReportExcel.js'),/Seller & Manager Changes/);
});
test('Phase 9 QA plan uses only read-only SQL and no unsupported triggers',()=>{
 const sql=read('server/scripts/phase89_readonly_tidb_checks.sql');
 assert.doesNotMatch(sql,/^\s*(?:UPDATE|DELETE|INSERT|DROP|CREATE|ALTER|TRUNCATE|DELIMITER)\b/im);
 assert.doesNotMatch(sql,/\bTRIGGER\b/i);
 assert.match(sql,/seller_manager_replacements/);
 assert.match(sql,/lot_project_assigned_seller_changes/);
});
