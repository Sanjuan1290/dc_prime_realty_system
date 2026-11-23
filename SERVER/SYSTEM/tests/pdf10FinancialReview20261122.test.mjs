import test from 'node:test';
import assert from 'node:assert/strict';
import {installmentRemainingDue,commissionPaymentProgress} from '../../../CLIENT/shared/financialProgress.js';
import {reconcileCommission} from '../services/commissionReconciliation.service.js';
import {sameValue,savedSnapshotChangeSummary} from '../../../CLIENT/SYSTEM/src/utils/reviewSnapshotFormat.js';
import {moduleBreadcrumb} from '../../../CLIENT/SYSTEM/src/utils/moduleBreadcrumb.js';
import {canApplyAuditCaseCorrection,getPendingAuditCorrectionCase} from '../services/auditCaseAuthorization.service.js';
import {PERMISSIONS,canActorCreateUserRole,canActorManageUserRole} from '../config/permissions.js';

test('installment remaining due handles partial cash, exact settlement, excess allocations and cancelled schedules',()=>{
 assert.equal(installmentRemainingDue({totalDue:108819.42,amountPaid:41180.58}),67638.84);
 assert.equal(installmentRemainingDue({totalDue:108819.42,amountPaid:108819.42}),0);
 assert.equal(installmentRemainingDue({totalDue:100,amountPaid:125}),0);
 assert.equal(installmentRemainingDue({totalDue:100,amountPaid:20,status:'Cancelled'}),0);
 assert.equal(installmentRemainingDue({totalDue:100+20+5-10,amountPaid:20}),95,'the existing calculator supplies net discounts, interest and penalties');
});
test('commission progress uses actual Released cash and excludes eligible, pending and unreleased retention',()=>{
 const releases=[{status:'Released',netAmount:20000},{status:'Pending',netAmount:20000},{status:'Eligible',netAmount:30000},{status:'On Hold',stage:'Retention',netAmount:30000}];
 const reconciled=reconcileCommission({grossCommission:100000,releases});assert.equal(reconciled.released,20000);
 assert.deepEqual(commissionPaymentProgress({entitlement:reconciled.grossCommission,released:reconciled.released}),{total:100000,paid:20000,percent:20,barPercent:20});
 assert.equal(commissionPaymentProgress({entitlement:0,released:10}).percent,0);
 assert.equal(commissionPaymentProgress({entitlement:100,released:110}).barPercent,100);
 assert.equal(commissionPaymentProgress({entitlement:100,released:110}).percent,110);
});
test('saved comparison distinguishes null from unavailable values and counts nested fields and arrays',()=>{
 assert.equal(sameValue({a:null,b:[{x:1,y:2}]},{b:[{y:2,x:1}],a:null}),true);
 assert.equal(sameValue(null,undefined),false);
 const before={cadastralLots:['A'],documentRequirements:[{documentId:1,isRequired:1}],pricing:{amount:100,rate:0},value:null};
 const after={cadastralLots:['B'],documentRequirements:[{documentId:1,isRequired:0}],pricing:{amount:120,rate:1},value:'Recorded'};
 assert.deepEqual(savedSnapshotChangeSummary(before,after),{changedFields:5,unavailableFields:0,complete:true});
 assert.deepEqual(savedSnapshotChangeSummary({unitCode:'A'},{unitCode:'A',cadastralLots:['B']}),{changedFields:0,unavailableFields:1,complete:false});
 assert.equal(savedSnapshotChangeSummary(null,{value:1}).complete,false);
});
test('breadcrumbs identify role, project, listing tab and review details',()=>{
 const listing=moduleBreadcrumb('/portal/operations_head/projects/lot-projects/qa/listings/21',{role:'operations_head',projectName:'Synthetic Project',search:'?tab=payments&auditCaseId=9'});
 assert.equal(listing.title,'Payments & SOA');assert.ok(listing.crumbs.some(row=>row.label==='Synthetic Project'));assert.equal(listing.crumbs[0].to,'/portal/operations_head');
 assert.equal(moduleBreadcrumb('/portal/auditor/review-center/reviews/1',{role:'auditor'}).title,'Review Details');
});
test('both administrator roles enforce assignment and independent correction authority',()=>{
 const row={assigned_responder_user_id:7,opened_by_auditor_user_id:9};
 for(const role of ['system_admin','super_admin']){assert.equal(canApplyAuditCaseCorrection({id:7,role},row),true);assert.equal(canApplyAuditCaseCorrection({id:8,role},row),false);assert.equal(canApplyAuditCaseCorrection({id:9,role},{...row,assigned_responder_user_id:9}),false)}
 assert.equal(canApplyAuditCaseCorrection({id:7,role:'auditor',permissions:[PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY]},row),false);
 assert.equal(canActorCreateUserRole('system_admin','system_admin'),false);assert.equal(canActorCreateUserRole('super_admin','system_admin'),true);assert.equal(canActorManageUserRole('system_admin','system_admin'),false);
});
test('controlled correction requires the exact pending record and a meaningful reason',async()=>{
 const row={audit_case_id:3,status:'pending_system_admin_correction',review_status:'correction_required',entity_type:'lot_project_payment',entity_id:'12',assigned_responder_user_id:7};
 const connection={query:async()=>[[row]]},args={auditCaseId:3,entityType:'lot_project_payment',entityId:12,actor:{id:7,role:'super_admin'},correctionReason:'Verified against original deposit evidence.'};
 assert.ok(await getPendingAuditCorrectionCase(connection,args));assert.equal(await getPendingAuditCorrectionCase(connection,{...args,entityId:13}),null);
 await assert.rejects(getPendingAuditCorrectionCase(connection,{...args,actor:null}),{statusCode:403});
 await assert.rejects(getPendingAuditCorrectionCase(connection,{...args,correctionReason:'fix'}),{statusCode:400});
 row.review_status='closed';await assert.rejects(getPendingAuditCorrectionCase(connection,args),{statusCode:409,code:'AUDIT_CASE_NOT_AWAITING_CORRECTION'});
});
