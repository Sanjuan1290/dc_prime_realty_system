import { appendReviewEvent } from './operationalReview.service.js';
import { getAuditCorrectionRole } from './auditCaseAuthorization.service.js';
import { createInternalNotifications, notifyAuditors } from './internalNotification.service.js';

export const notifyCorrectionOwners = async (connection, review, auditCase) => {
  const role = getAuditCorrectionRole(review);
  const [users] = await connection.query("SELECT id FROM users WHERE role=? AND status='active' AND COALESCE(can_login,1)=1", [role]);
  await createInternalNotifications(connection, {
    userIds: users.map(user => user.id), type: 'system_correction_required',
    title: `${role === 'super_admin' ? 'Owner' : 'System'} correction required · ${auditCase.case_number}`,
    message: auditCase.finding, reviewId: review.operational_review_id, auditCaseId: auditCase.audit_case_id,
  });
};

// Data-only, repeatable transition at startup. Existing responses, assignments,
// snapshots and events remain intact. Closed cases are never reopened.
export const carryForwardOpenAuditCases = async (pool) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [cases] = await connection.query(`SELECT c.*, r.status AS review_status, r.approval_type, r.initiated_by_role
      FROM audit_cases c INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id
      WHERE c.status IN ('awaiting_head_response','under_auditor_review','pending_auditor_recheck')
        AND r.status NOT IN ('closed','auditor_verified') ORDER BY c.audit_case_id FOR UPDATE`);
    for (const item of cases) {
      await connection.query("UPDATE audit_cases SET status='pending_system_admin_correction' WHERE audit_case_id=?", [item.audit_case_id]);
      await connection.query("UPDATE operational_reviews SET status='correction_required' WHERE operational_review_id=?", [item.operational_review_id]);
      await appendReviewEvent(connection, {
        reviewId: item.operational_review_id, eventType: 'audit_case_flow_updated',
        fromStatus: item.review_status, toStatus: 'correction_required',
        message: 'Open case carried into the direct correction flow. Prior findings, responses and correction history were retained.',
        metadata: { auditCaseId: item.audit_case_id, previousCaseStatus: item.status, correctionRole: getAuditCorrectionRole(item) },
      });
      await notifyCorrectionOwners(connection, item, item);
    }
    await connection.commit();
    return cases.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
};

export const resolveAuditCaseWithNotes = async (connection, { auditCase, actor, notes }) => {
  const expectedRole = getAuditCorrectionRole(auditCase);
  if (actor?.role !== expectedRole) throw Object.assign(new Error(`Only ${expectedRole === 'super_admin' ? 'Super Admin' : 'System Admin'} may resolve this case.`), { statusCode: 403 });
  if (auditCase.status !== 'pending_system_admin_correction') throw Object.assign(new Error('This case is no longer awaiting correction.'), { statusCode: 409 });
  const summary = String(notes || '').trim();
  if (summary.length < 5 || summary.length > 5000) throw Object.assign(new Error('Enter resolution notes between 5 and 5,000 characters.'), { statusCode: 400 });
  if (!auditCase.correction_applied_at) {
    const [changes] = await connection.query(`SELECT operational_review_event_id FROM operational_review_events
      WHERE operational_review_id=? AND event_type='record_changed_during_audit_case' AND actor_role=?
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.auditCaseId'))=? LIMIT 1`,
    [auditCase.operational_review_id, expectedRole, String(auditCase.audit_case_id)]);
    if (!changes.length) throw Object.assign(new Error('Correct the underlying record before resolving this case. No authorized correction has been recorded yet.'), { statusCode: 409, code: 'AUDIT_CORRECTION_NOT_APPLIED' });
  }
  const [result] = await connection.query("UPDATE audit_cases SET status='closed',system_admin_user_id=? WHERE audit_case_id=? AND status='pending_system_admin_correction'", [actor.id, auditCase.audit_case_id]);
  if (Number(result.affectedRows) !== 1) throw Object.assign(new Error('This case was already updated. Reload its latest status.'), { statusCode: 409 });
  await connection.query("UPDATE operational_reviews SET status='closed' WHERE operational_review_id=?", [auditCase.operational_review_id]);
  await appendReviewEvent(connection, {
    reviewId: auditCase.operational_review_id, eventType: 'audit_case_resolved', actor,
    fromStatus: 'correction_required', toStatus: 'closed', message: summary,
    metadata: { auditCaseId: auditCase.audit_case_id, correctionRole: expectedRole, resolution: 'resolved_by_admin' },
  });
  await notifyAuditors(connection, {
    reviewId: auditCase.operational_review_id, auditCaseId: auditCase.audit_case_id,
    type: 'audit_case_resolved', title: `Resolved by ${expectedRole === 'super_admin' ? 'Super Admin' : 'System Admin'} · ${auditCase.case_number}`,
    message: summary,
  });
};
