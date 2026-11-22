import { appendReviewEvent } from './operationalReview.service.js';
import {PERMISSIONS,roleHasPermission} from '../config/permissions.js';
import {notifyAuditors} from './internalNotification.service.js';

export const getAuditCorrectionRole = () => 'system_admin';
export const canApplyAuditCaseCorrection = (actor, row = {}) => Boolean(
  actor?.id && ['system_admin','super_admin'].includes(actor.role)
  && roleHasPermission(actor,PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY)
  && (!Number(row.assigned_responder_user_id) || Number(row.assigned_responder_user_id)===Number(actor.id))
  && Number(row.opened_by_auditor_user_id || 0)!==Number(actor.id)
);
export const assertAuditCaseCorrectionActor = (actor,row) => {
  if(!canApplyAuditCaseCorrection(actor,row))throw Object.assign(new Error('Only the assigned System Admin or Super Admin may apply this controlled correction.'),{statusCode:403,code:'AUDIT_CORRECTION_ASSIGNEE_REQUIRED'});
};

export const getPendingAuditCorrectionCase = async (connection, {
  auditCaseId,
  entityType,
  entityId,
  actor = null,
  correctionReason = null,
  forUpdate = true,
  explainState = false,
}) => {
  const id = Number(auditCaseId || 0);
  if (!id) return null;
  const [rows] = await connection.query(
    `SELECT c.*, r.review_number, r.entity_type, r.entity_id, r.operational_review_id,
            r.approval_type, r.initiated_by_role, r.initiated_by_user_id, r.lot_project_id,r.status AS review_status
     FROM audit_cases c
     INNER JOIN operational_reviews r ON r.operational_review_id = c.operational_review_id
     WHERE c.audit_case_id = ?
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id]
  );
  const row = rows[0] || null;
  if (!row) return null;
  if (String(row.entity_type) !== String(entityType) || String(row.entity_id) !== String(entityId)) return null;
  if (row.status !== 'pending_system_admin_correction' || row.review_status !== 'correction_required') {
    if(explainState){
      const awaiting=row.status==='pending_auditor_recheck'||row.review_status==='pending_auditor_recheck';
      throw Object.assign(new Error(awaiting?'This case is already awaiting Auditor verification. Return to Review Center; the Auditor must verify it or return it before another correction.':'This case is no longer awaiting correction. Return to Review Center to check its current status.'),{statusCode:409,code:awaiting?'AUDIT_CASE_AWAITING_VERIFICATION':'AUDIT_CASE_NOT_AWAITING_CORRECTION'});
    }
    return null;
  }

  const correctionRole = getAuditCorrectionRole(row);
  if (!canApplyAuditCaseCorrection(actor,row)) {
    throw Object.assign(
      new Error('This Audit Case requires its assigned System Admin or Super Admin to apply the controlled correction.'),
      { statusCode: 403, code: 'AUDIT_CORRECTION_ROLE_REQUIRED', correctionRole }
    );
  }
  const reason=String(correctionReason||'').trim();
  if(reason.length<5||reason.length>1000)throw Object.assign(new Error('Enter a correction reason between 5 and 1,000 characters.'),{statusCode:400,code:'AUDIT_CORRECTION_REASON_REQUIRED'});
  return { ...row, correction_role: correctionRole,correction_reason:reason };
};

// Retain the exported name for existing module callers; this records a correction
// and submits the same case for independent Auditor verification.
export const advanceAuditCaseToRecheck = async (connection, {
  auditCase,
  actor,
  correctionSummary,
  afterSnapshot = null,
  beforeSnapshot = null,
  metadata = null,
}) => {
  if (!auditCase?.audit_case_id || !auditCase?.operational_review_id) {
    throw Object.assign(new Error('A valid Audit Case is required to record the correction.'), { statusCode: 409 });
  }
  const expectedRole = auditCase.correction_role || getAuditCorrectionRole(auditCase);
  if (!canApplyAuditCaseCorrection(actor,auditCase)) {
    throw Object.assign(
      new Error('Only the assigned System Admin or Super Admin may apply this Audit Case correction.'),
      { statusCode: 403, code: 'AUDIT_CORRECTION_ROLE_REQUIRED', correctionRole: expectedRole }
    );
  }
  const summary = String(auditCase.correction_reason || correctionSummary || '').trim();
  if (summary.length < 5) throw Object.assign(new Error('Describe the correction that was applied.'), { statusCode: 400 });
  const [result] = await connection.query(
    `UPDATE audit_cases
     SET status='pending_auditor_recheck', system_admin_user_id=?, correction_summary=?, correction_applied_at=NOW()
     WHERE audit_case_id=? AND status='pending_system_admin_correction'`,
    [actor?.id || null, summary, auditCase.audit_case_id]
  );
  if (!Number(result.affectedRows || 0)) {
    throw Object.assign(new Error('This Audit Case is no longer awaiting controlled correction.'), { statusCode: 409 });
  }
  // Protect the prior evidence before changing the review's AFTER snapshot.
  // A correction is a separate saved version of the SAME review, not a rewrite
  // of its first business operation or a new operational review.
  const [[previous]] = await connection.query(
    `SELECT revision, action_key, before_snapshot_json, after_snapshot_json
     FROM operational_reviews WHERE operational_review_id=? FOR UPDATE`,
    [auditCase.operational_review_id]
  );
  if (!previous) throw Object.assign(new Error('The linked review no longer exists.'), { statusCode: 409 });
  const priorRevision = Math.max(1, Number(previous.revision || 1));
  await connection.query(
    `UPDATE operational_reviews
     SET status='pending_auditor_recheck', revision=revision+1, after_snapshot_json=COALESCE(?, after_snapshot_json)
     WHERE operational_review_id=?`,
    [afterSnapshot == null ? null : JSON.stringify(afterSnapshot), auditCase.operational_review_id]
  );
  await appendReviewEvent(connection, {
    reviewId: auditCase.operational_review_id,
    eventType: 'controlled_correction_applied',
    actor,
    fromStatus: 'correction_required',
    toStatus: 'pending_auditor_recheck',
    message: summary,
    metadata: {
      auditCaseId: auditCase.audit_case_id, correctionRole: expectedRole,
      previousRevision: priorRevision, reviewRevision: priorRevision + 1,
      previousActionKey: previous.action_key, latestActionKey: 'audit_case.correction',
      previousBeforeSnapshot: previous.before_snapshot_json ?? null,
      previousAfterSnapshot: previous.after_snapshot_json ?? null,
      originalBaselinePreserved: true,
      // No explicit per-action BEFORE was supplied. The version renderer labels
      // the preceding saved AFTER as evidence, not a verified immediate BEFORE.
      nextAfterSnapshot: afterSnapshot,
      nextBeforeSnapshot: beforeSnapshot,
      immediateBeforeAvailable: beforeSnapshot != null,
      ...(metadata || {}),
    },
  });
  await connection.query("UPDATE lot_project_listing_bulk_rows SET review_status='awaiting_verification' WHERE operational_review_id=?",[auditCase.operational_review_id]);
  await notifyAuditors(connection,{reviewId:auditCase.operational_review_id,auditCaseId:auditCase.audit_case_id,type:'audit_correction_recheck',title:`Correction awaiting independent verification · ${auditCase.case_number || ''}`,message:summary});
  return { reviewId: auditCase.operational_review_id, auditCaseId: auditCase.audit_case_id, status: 'pending_auditor_recheck' };
};




