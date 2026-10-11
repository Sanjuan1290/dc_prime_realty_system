import { appendReviewEvent } from './operationalReview.service.js';
import { notifyAuditors } from './internalNotification.service.js';

export const getAuditCorrectionRole = (row = {}) => (
  row.approval_type === 'emergency_super_admin' || row.initiated_by_role === 'super_admin'
    ? 'super_admin'
    : 'system_admin'
);

export const getPendingAuditCorrectionCase = async (connection, {
  auditCaseId,
  entityType,
  entityId,
  actor = null,
  forUpdate = true,
}) => {
  const id = Number(auditCaseId || 0);
  if (!id) return null;
  const [rows] = await connection.query(
    `SELECT c.*, r.review_number, r.entity_type, r.entity_id, r.operational_review_id,
            r.approval_type, r.initiated_by_role, r.initiated_by_user_id
     FROM audit_cases c
     INNER JOIN operational_reviews r ON r.operational_review_id = c.operational_review_id
     WHERE c.audit_case_id = ?
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id]
  );
  const row = rows[0] || null;
  if (!row || row.status !== 'pending_system_admin_correction') return null;
  if (String(row.entity_type) !== String(entityType) || String(row.entity_id) !== String(entityId)) return null;

  const correctionRole = getAuditCorrectionRole(row);
  if (actor?.role && actor.role !== correctionRole) {
    throw Object.assign(
      new Error(correctionRole === 'super_admin'
        ? 'This Audit Case originated from a Super Admin direct entry and must be corrected by Super Admin before Auditor recheck.'
        : 'This Audit Case requires a controlled System Admin correction before Auditor recheck.'),
      { statusCode: 403, code: 'AUDIT_CORRECTION_ROLE_REQUIRED', correctionRole }
    );
  }
  return { ...row, correction_role: correctionRole };
};

export const advanceAuditCaseToRecheck = async (connection, {
  auditCase,
  actor,
  correctionSummary,
  afterSnapshot = null,
  metadata = null,
  notificationTitle = null,
}) => {
  if (!auditCase?.audit_case_id || !auditCase?.operational_review_id) {
    throw Object.assign(new Error('A valid Audit Case is required to record the correction.'), { statusCode: 409 });
  }
  const expectedRole = auditCase.correction_role || getAuditCorrectionRole(auditCase);
  if (actor?.role !== expectedRole) {
    throw Object.assign(
      new Error(expectedRole === 'super_admin'
        ? 'Only Super Admin may apply this Audit Case correction.'
        : 'Only System Admin may apply this Audit Case correction.'),
      { statusCode: 403, code: 'AUDIT_CORRECTION_ROLE_REQUIRED', correctionRole: expectedRole }
    );
  }
  const summary = String(correctionSummary || '').trim();
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
  await connection.query(
    `UPDATE operational_reviews
     SET status='pending_auditor_recheck', after_snapshot_json=COALESCE(?, after_snapshot_json)
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
    metadata: { auditCaseId: auditCase.audit_case_id, correctionRole: expectedRole, ...(metadata || {}) },
  });
  await notifyAuditors(connection, {
    reviewId: auditCase.operational_review_id,
    auditCaseId: auditCase.audit_case_id,
    type: 'audit_correction_recheck',
    title: notificationTitle || `Correction needs Auditor recheck · ${auditCase.case_number || auditCase.review_number}`,
    message: summary,
  });
  return { reviewId: auditCase.operational_review_id, auditCaseId: auditCase.audit_case_id, status: 'pending_auditor_recheck' };
};

