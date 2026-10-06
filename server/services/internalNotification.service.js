import { DEPARTMENT_HEAD_ROLE } from '../config/permissions.js';

const uniqueIds = (values = []) => [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];

/**
 * Action notifications ask a specific role to do something on a Review at a
 * specific stage. Once the Review leaves that stage (someone acted on it, or it
 * was reassigned), the notification is no longer the recipient's job and is
 * hidden from their Internal Notifications and unread count. Informational
 * notifications (status updates, approvals, closed findings) always stay.
 *
 * Each condition is evaluated against:
 *   r  = the linked operational_reviews row
 *   ac = the latest audit_cases row for that review
 *   n  = the notification row
 */
export const REVIEW_ACTION_NOTIFICATION_STAGES = Object.freeze({
  department_review_required: "r.status = 'pending_head_review'",
  review_has_no_head: "r.status = 'pending_head_review'",
  review_returned: "r.status = 'returned_for_correction'",
  audit_review_required: "r.status = 'pending_auditor_review'",
  audit_case_response_required: "r.status = 'audit_case_open' AND ac.status = 'awaiting_head_response' AND (ac.assigned_responder_user_id IS NULL OR ac.assigned_responder_user_id = n.user_id)",
  audit_case_no_responder: "r.status = 'audit_case_open' AND ac.status = 'awaiting_head_response' AND ac.assigned_responder_user_id IS NULL",
  audit_case_head_response: "r.status = 'audit_case_open' AND ac.status = 'under_auditor_review'",
  system_correction_required: "r.status = 'correction_required'",
  audit_correction_rework: "r.status = 'correction_required'",
  audit_correction_recheck: "r.status = 'pending_auditor_recheck'",
});

const ACTION_TYPES = Object.keys(REVIEW_ACTION_NOTIFICATION_STAGES);
// Head approval requests (no Review yet) that point at an APR-... request.
const PROTECTED_APPROVAL_TYPES = ['department_review_required', 'approval_has_no_head'];
// Status updates where only the newest one per review matters.
const LATEST_ONLY_INFO_TYPES = ['post_action_review_status'];
const sqlList = (values) => values.map((value) => `'${value}'`).join(',');

/**
 * SQL fragment that is TRUE when notification `n` should still be shown.
 * Requires `n` to be internal_notifications; joins are done inline so it can be
 * dropped into any WHERE clause.
 */
export const activeNotificationSql = (alias = 'n') => {
  const cases = ACTION_TYPES
    .map((type) => `WHEN '${type}' THEN (${REVIEW_ACTION_NOTIFICATION_STAGES[type].replaceAll('n.user_id', `${alias}.user_id`)})`)
    .join(' ');
  return `(
    (
      ${alias}.operational_review_id IS NULL
      AND (
        ${alias}.notification_type NOT IN (${sqlList(PROTECTED_APPROVAL_TYPES)})
        OR COALESCE(${alias}.message, '') NOT LIKE 'APR-%'
        /* A protected-change approval request only needs attention while it is still pending. */
        OR EXISTS (
          SELECT 1 FROM protected_change_requests pcr
          WHERE pcr.status = 'pending' AND pcr.expires_at > NOW()
            AND ${alias}.message LIKE CONCAT(pcr.request_number, ' %')
        )
      )
    )
    OR (
      ${alias}.operational_review_id IS NOT NULL
      AND ${alias}.notification_type NOT IN (${sqlList(ACTION_TYPES)})
      /* Repeated "Saved successfully" updates for the same review: keep only the latest. */
      AND NOT (
        ${alias}.notification_type IN (${sqlList(LATEST_ONLY_INFO_TYPES)})
        AND EXISTS (
          SELECT 1 FROM internal_notifications newer_info
          WHERE newer_info.user_id = ${alias}.user_id
            AND newer_info.operational_review_id = ${alias}.operational_review_id
            AND newer_info.notification_type = ${alias}.notification_type
            AND newer_info.internal_notification_id > ${alias}.internal_notification_id
        )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM operational_reviews r
      LEFT JOIN audit_cases ac ON ac.audit_case_id = (
        SELECT MAX(lac.audit_case_id) FROM audit_cases lac WHERE lac.operational_review_id = r.operational_review_id
      )
      WHERE r.operational_review_id = ${alias}.operational_review_id
        AND (CASE ${alias}.notification_type ${cases} ELSE 1 END)
        /* A newer copy of the same action notification replaces older copies. */
        AND NOT EXISTS (
          SELECT 1 FROM internal_notifications newer
          WHERE newer.user_id = ${alias}.user_id
            AND newer.operational_review_id = ${alias}.operational_review_id
            AND newer.notification_type = ${alias}.notification_type
            AND newer.internal_notification_id > ${alias}.internal_notification_id
        )
    )
  )`;
};

/**
 * Marks action notifications that no longer match the Review's current stage
 * as read, so they stop counting toward badges. Listing already hides them via
 * activeNotificationSql(); this keeps the stored read state consistent too.
 */
export const settleReviewNotifications = async (connection, reviewId) => {
  const id = Number(reviewId || 0);
  if (!id) return;
  // Select first: MySQL cannot UPDATE a table that its own subquery reads.
  const [rows] = await connection.query(
    `SELECT n.internal_notification_id
     FROM internal_notifications n
     WHERE n.operational_review_id = ?
       AND n.read_at IS NULL
       AND n.notification_type IN (${sqlList(ACTION_TYPES)})
       AND NOT ${activeNotificationSql('n')}`,
    [id]
  );
  const staleIds = rows.map((row) => Number(row.internal_notification_id)).filter(Boolean);
  if (!staleIds.length) return;
  await connection.query(
    `UPDATE internal_notifications SET read_at = COALESCE(read_at, NOW())
     WHERE internal_notification_id IN (${staleIds.map(() => '?').join(',')})`,
    staleIds
  );
};

export const createInternalNotifications = async (connection, {
  userIds = [], type, title, message = null, link = '/portal/review-center', reviewId = null, auditCaseId = null,
}) => {
  const ids = uniqueIds(userIds);
  if (!ids.length) return [];
  const values = ids.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const params = ids.flatMap((userId) => [userId, type, title, message, link, reviewId || null, auditCaseId || null]);
  await connection.query(
    `INSERT INTO internal_notifications (user_id, notification_type, title, message, link, operational_review_id, audit_case_id) VALUES ${values}`,
    params
  );
  return ids;
};

export const getEligibleRoleUserIds = async (connection, { role, projectId = null }) => {
  const pid = Number(projectId || 0);
  const params = [role];
  const projectClause = pid ? `AND (
    u.role IN ('super_admin','system_admin','auditor')
    OR COALESCE(u.all_projects_access, u.admin_all_projects, 0) = 1
    OR EXISTS (SELECT 1 FROM user_project_access upa WHERE upa.user_id = u.id AND upa.lot_project_id = ?)
  )` : '';
  if (pid) params.push(pid);
  const [rows] = await connection.query(
    `SELECT u.id FROM users u WHERE u.role = ? AND u.status = 'active' AND COALESCE(u.can_login,1) = 1 ${projectClause} ORDER BY u.id`,
    params
  );
  return rows.map((row) => Number(row.id)).filter(Boolean);
};

export const notifyDepartmentHeads = async (connection, { department, projectId, reviewId, title, message }) => {
  const role = DEPARTMENT_HEAD_ROLE[department];
  if (!role) return [];
  const userIds = await getEligibleRoleUserIds(connection, { role, projectId });
  return createInternalNotifications(connection, { userIds, type: 'department_review_required', title, message, reviewId });
};

export const notifyAuditors = async (connection, { reviewId, auditCaseId = null, type = 'audit_review_required', title, message }) => {
  const userIds = await getEligibleRoleUserIds(connection, { role: 'auditor' });
  return createInternalNotifications(connection, { userIds, type, title, message, reviewId, auditCaseId });
};

export const notifySystemAdmins = async (connection, { reviewId, auditCaseId = null, type = 'system_correction_required', title, message }) => {
  const userIds = await getEligibleRoleUserIds(connection, { role: 'system_admin' });
  return createInternalNotifications(connection, { userIds, type, title, message, reviewId, auditCaseId });
};


