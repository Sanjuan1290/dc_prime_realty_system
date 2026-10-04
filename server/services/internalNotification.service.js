import { DEPARTMENT_HEAD_ROLE } from '../config/permissions.js';

const uniqueIds = (values = []) => [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))];

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
