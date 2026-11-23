import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_ACTIONS} from '../config/reviewActions.js';
import {getPendingAuditCorrectionCase} from '../services/auditCaseAuthorization.service.js';

const types=[...new Set(Object.values(REVIEW_ACTIONS).map(action=>action.entityType))].filter(type=>type!=='lot_project_listing_bulk_batch');
for(const entityType of types)test(`all case types explain stale stages and retain exact identity/assignee: ${entityType}`,async()=>{
 const entityId=entityType==='seller_group_project_rates'?'12:34':'12';
 const row={audit_case_id:3,status:'pending_system_admin_correction',review_status:'correction_required',entity_type:entityType,entity_id:entityId,assigned_responder_user_id:7};
 const connection={query:async()=>[[row]]},args={auditCaseId:3,entityType,entityId,actor:{id:7,role:'super_admin'},correctionReason:'Corrected against the original saved evidence.'};
 assert.ok(await getPendingAuditCorrectionCase(connection,args));
 assert.equal(await getPendingAuditCorrectionCase(connection,{...args,entityId:entityId+'9'}),null);
 await assert.rejects(getPendingAuditCorrectionCase(connection,{...args,actor:{id:8,role:'super_admin'}}),{statusCode:403});
 row.status='pending_auditor_recheck';row.review_status='pending_auditor_recheck';
 await assert.rejects(getPendingAuditCorrectionCase(connection,args),{statusCode:409,code:'AUDIT_CASE_AWAITING_VERIFICATION'});
 row.status='closed';row.review_status='closed';
 await assert.rejects(getPendingAuditCorrectionCase(connection,args),{statusCode:409,code:'AUDIT_CASE_NOT_AWAITING_CORRECTION'});
});
