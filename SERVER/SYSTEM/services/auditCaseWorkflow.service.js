import {appendReviewEvent} from './operationalReview.service.js';
import {assertAuditCaseCorrectionActor} from './auditCaseAuthorization.service.js';
import {createInternalNotifications,notifyAuditors} from './internalNotification.service.js';

export const notifyCorrectionOwners = async (connection,review,auditCase) => {
 const [users]=await connection.query("SELECT id FROM users WHERE role IN ('system_admin','super_admin') AND status='active' AND COALESCE(can_login,1)=1");
 const assigned=Number(auditCase.assigned_responder_user_id||0);
 await createInternalNotifications(connection,{userIds:users.filter(user=>!assigned||Number(user.id)===assigned).map(user=>user.id),type:'system_correction_required',title:`Correction required · ${auditCase.case_number}`,message:auditCase.finding,reviewId:review.operational_review_id,auditCaseId:auditCase.audit_case_id});
};

// Preserve existing evidence. Legacy Head-response cases enter correction;
// corrections already applied enter independent audit, including after restart.
export const carryForwardOpenAuditCases = async pool => {
 const connection=await pool.getConnection();
 try{
  await connection.beginTransaction();
  const [cases]=await connection.query(`SELECT c.*,r.status AS review_status,r.approval_type,r.initiated_by_role FROM audit_cases c
   INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id
   WHERE r.status NOT IN ('closed','auditor_verified') AND
    (c.status IN ('awaiting_head_response','under_auditor_review') OR (c.status='pending_system_admin_correction' AND c.correction_applied_at IS NOT NULL))
   ORDER BY c.audit_case_id FOR UPDATE`);
  for(const item of cases){
   const corrected=Boolean(item.correction_applied_at),caseStatus=corrected?'pending_auditor_recheck':'pending_system_admin_correction',reviewStatus=corrected?'pending_auditor_recheck':'correction_required';
   await connection.query('UPDATE audit_cases SET status=?,assigned_responder_user_id=NULL WHERE audit_case_id=?',[caseStatus,item.audit_case_id]);
   await connection.query('UPDATE operational_reviews SET status=? WHERE operational_review_id=?',[reviewStatus,item.operational_review_id]);
   await appendReviewEvent(connection,{reviewId:item.operational_review_id,eventType:'audit_case_flow_updated',fromStatus:item.review_status,toStatus:reviewStatus,message:'Existing case continued in the independent correction verification workflow. Earlier evidence and events were preserved.',metadata:{auditCaseId:item.audit_case_id,previousCaseStatus:item.status,previousAssignee:item.assigned_responder_user_id||null}});
   if(corrected)await notifyAuditors(connection,{reviewId:item.operational_review_id,auditCaseId:item.audit_case_id,type:'audit_correction_recheck',title:'Correction awaiting Auditor verification',message:item.correction_summary});
   else await notifyCorrectionOwners(connection,item,{...item,assigned_responder_user_id:null});
  }
  await connection.commit();return cases.length;
 }catch(error){await connection.rollback();throw error}finally{connection.release()}
};

// Older clients can submit a completed correction for audit, never close it.
export const resolveAuditCaseWithNotes = async (connection,{auditCase,actor,notes}) => {
 assertAuditCaseCorrectionActor(actor,auditCase);
 if(auditCase.status==='pending_auditor_recheck')return;
 if(auditCase.status!=='pending_system_admin_correction'||!auditCase.correction_applied_at)throw Object.assign(new Error('Apply the controlled correction first. Only an Auditor can verify and close this case.'),{statusCode:409,code:'AUDIT_CORRECTION_NOT_APPLIED'});
 const summary=String(notes||'').trim();if(summary.length<5||summary.length>5000)throw Object.assign(new Error('Enter correction notes between 5 and 5,000 characters.'),{statusCode:400});
 await connection.query("UPDATE audit_cases SET status='pending_auditor_recheck' WHERE audit_case_id=?",[auditCase.audit_case_id]);
 await connection.query("UPDATE operational_reviews SET status='pending_auditor_recheck' WHERE operational_review_id=?",[auditCase.operational_review_id]);
 await appendReviewEvent(connection,{reviewId:auditCase.operational_review_id,eventType:'correction_submitted_for_verification',actor,fromStatus:'correction_required',toStatus:'pending_auditor_recheck',message:summary,metadata:{auditCaseId:auditCase.audit_case_id}});
 await notifyAuditors(connection,{reviewId:auditCase.operational_review_id,auditCaseId:auditCase.audit_case_id,type:'audit_correction_recheck',title:'Correction awaiting verification',message:summary});
};
