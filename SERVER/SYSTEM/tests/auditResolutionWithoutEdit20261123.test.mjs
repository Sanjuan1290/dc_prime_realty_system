import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAuditCaseWithNotes,findNoEditAuditResolution} from '../services/auditCaseWorkflow.service.js';
import {getPendingAuditCorrectionCase} from '../services/auditCaseAuthorization.service.js';

const actor={id:5,role:'super_admin'};
const auditCase={audit_case_id:10,operational_review_id:20,status:'pending_system_admin_correction',review_status:'correction_required',assigned_responder_user_id:5,opened_by_auditor_user_id:7};
const notes='Verified the original receipt; no change to the saved payment is required.';
const capture=()=>{const calls=[];return {calls,async query(sql,params=[]){calls.push({sql,params});return /^\s*SELECT/.test(sql)?[[]]:[{affectedRows:1,insertId:1}]}}};

test('an explicit no-edit resolution records evidence and submits the same case without a fake correction/version',async()=>{
 const connection=capture();
 const result=await resolveAuditCaseWithNotes(connection,{auditCase,actor,notes,resolutionMode:'without_edit'});
 assert.deepEqual(result,{resolutionMode:'without_edit',recordChanged:false});
 const event=connection.calls.find(call=>call.sql.includes('INSERT INTO operational_review_events'));
 assert.equal(event.params[1],'resolution_submitted_without_edit');
 assert.equal(event.params[4],actor.id);assert.equal(event.params[6],notes);
 assert.deepEqual(JSON.parse(event.params[7]),{auditCaseId:10,resolutionMode:'without_edit',recordChanged:false});
 for(const {sql} of connection.calls){assert.doesNotMatch(sql,/revision\s*=|after_snapshot_json\s*=|before_snapshot_json\s*=|correction_applied_at\s*=/);assert.doesNotMatch(sql,/UPDATE lot_project_(payments|payment_allocations|payment_schedules|commissions)\b/)}
});

test('no-edit resolutions enforce assignee, role, explanation and workflow stage before writing',async()=>{
 const invalid=[
  {actor:{id:6,role:'super_admin'},statusCode:403},
  {actor:{id:5,role:'accounting_head'},statusCode:403},
  {actor:{id:7,role:'super_admin'},auditCase:{...auditCase,assigned_responder_user_id:7},statusCode:403},
  {notes:' ',statusCode:400},{notes:'test',statusCode:400},{notes:'x'.repeat(5001),statusCode:400},
  {resolutionMode:'close_now',statusCode:400},
  {auditCase:{...auditCase,status:'pending_auditor_recheck'},statusCode:409},
  {auditCase:{...auditCase,review_status:'closed'},statusCode:409},
 ];
 for(const {statusCode,...override} of invalid){const connection=capture();await assert.rejects(resolveAuditCaseWithNotes(connection,{auditCase,actor,notes,resolutionMode:'without_edit',...override}),{statusCode});assert.equal(connection.calls.length,0)}
});

test('legacy resolution requests still require a real controlled correction',async()=>{
 const connection=capture();await assert.rejects(resolveAuditCaseWithNotes(connection,{auditCase,actor,notes}),{statusCode:409,code:'AUDIT_CORRECTION_NOT_APPLIED'});assert.equal(connection.calls.length,0);
});

test('independent verification accepts only the latest valid, actor-bound no-edit submission for the same case',()=>{
 const saved={...auditCase,system_admin_user_id:5};
 const event={operational_review_event_id:4,event_type:'resolution_submitted_without_edit',actor_user_id:5,metadata_json:JSON.stringify({auditCaseId:10,resolutionMode:'without_edit'})};
 assert.equal(findNoEditAuditResolution(saved,[event]),event);
 assert.equal(findNoEditAuditResolution(saved,[{...event,actor_user_id:6}]),null);
 assert.equal(findNoEditAuditResolution(saved,[{...event,metadata_json:'{invalid'}]),null);
 assert.equal(findNoEditAuditResolution({...saved,audit_case_id:11},[event]),null);
 assert.equal(findNoEditAuditResolution(saved,[event,{...event,operational_review_event_id:5,event_type:'auditor_correction_returned'}]),null);
 assert.equal(findNoEditAuditResolution(saved,[event,{...event,operational_review_event_id:5,event_type:'controlled_correction_applied'}]),null);
});

test('stale payment correction requests explain pending verification while retaining exact payment binding',async()=>{
 const row={...auditCase,status:'pending_auditor_recheck',review_status:'pending_auditor_recheck',entity_type:'lot_project_payment',entity_id:'8'};
 const connection={query:async()=>[[row]]},args={auditCaseId:10,actor,entityType:'lot_project_payment',entityId:8,explainState:true};
 await assert.rejects(getPendingAuditCorrectionCase(connection,args),{statusCode:409,code:'AUDIT_CASE_AWAITING_VERIFICATION'});
 assert.equal(await getPendingAuditCorrectionCase(connection,{...args,entityId:9}),null);
 assert.equal(await getPendingAuditCorrectionCase(connection,{...args,explainState:false}),null);
});
