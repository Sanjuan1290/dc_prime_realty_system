// D&C Prime Realty
// Who must answer an Audit Case (plan items 16-17).
//
// Order of precedence:
//   1. A responder System Admin explicitly reassigned the case to.
//   2. Admin direct entries (including legacy emergency_super_admin): eligible
//      System Admin(s) answer, whether System Admin or Super Admin entered it.
//   3. The Head who confirmed / pre-approved / corrected the record, while that
//      Head is still active, still holds the Head role, and still has access
//      to the project.
//   4. Otherwise any active Head of the same department with project access,
//      so a case never gets stuck because the original Head left.

import { DEPARTMENT_HEAD_ROLE } from '../config/permissions.js';

const projectAccessSql = `(COALESCE(u.all_projects_access, u.admin_all_projects, 0) = 1
  OR ? IS NULL
  OR EXISTS (SELECT 1 FROM user_project_access upa WHERE upa.user_id = u.id AND upa.lot_project_id = ?))`;


const loadEligibleSystemAdmins = async (connection, { projectId }) => {
  const [rows] = await connection.query(
    `SELECT u.id FROM users u WHERE u.role = 'system_admin' AND u.status = 'active' AND ${projectAccessSql}`,
    [projectId || null, projectId || null]
  );
  return rows.map((row) => Number(row.id));
};

const loadEligibleHeads = async (connection, { department, projectId }) => {
  const role = DEPARTMENT_HEAD_ROLE[department];
  if (!role) return [];
  const [rows] = await connection.query(
    `SELECT u.id FROM users u WHERE u.role = ? AND u.status = 'active' AND ${projectAccessSql}`,
    [role, projectId || null, projectId || null]
  );
  return rows.map((row) => Number(row.id));
};

/**
 * @param caseRow audit_cases row joined with review fields:
 *   department, lot_project_id, head_reviewed_by_user_id, approval_type,
 *   initiated_by_user_id, assigned_responder_user_id (optional)
 * @returns {{ mode: string, userIds: number[], originalHeadUserId: number|null }}
 */
// Existing direct-entry reviews also use 'emergency_super_admin' for
// System Admin changes. It is an approval path, NOT the responder's role.
export const isAdminDirectAuditCase = (caseRow = {}) => (
  ['system_admin_direct', 'emergency_super_admin'].includes(String(caseRow.approval_type || ''))
);

export const resolveAuditCaseResponders = async (connection, caseRow = {}) => {
  const assigned = Number(caseRow.assigned_responder_user_id || 0);
  if (assigned) {
    const [rows] = await connection.query("SELECT id FROM users WHERE id = ? AND status = 'active' LIMIT 1", [assigned]);
    if (rows.length) return { mode: 'reassigned', userIds: [assigned], originalHeadUserId: Number(caseRow.head_reviewed_by_user_id || 0) || null };
  }

  if (isAdminDirectAuditCase(caseRow)) {
    const eligibleAdmins = await loadEligibleSystemAdmins(connection, { projectId: caseRow.lot_project_id });
    const initiatingAdmin = caseRow.initiated_by_role === 'system_admin'
      ? Number(caseRow.initiated_by_user_id || 0) || null
      : null;
    if (initiatingAdmin && eligibleAdmins.includes(initiatingAdmin)) {
      return { mode: 'initiating_system_admin', userIds: [initiatingAdmin], originalHeadUserId: null };
    }
    return {
      mode: caseRow.approval_type === 'system_admin_direct' ? 'system_admin_fallback' : 'system_admin_case_responder',
      userIds: eligibleAdmins,
      originalHeadUserId: null,
    };
  }

  const eligibleHeads = await loadEligibleHeads(connection, {
    department: caseRow.department,
    projectId: caseRow.lot_project_id,
  });
  const originalHead = Number(caseRow.head_reviewed_by_user_id || 0) || null;
  if (originalHead && eligibleHeads.includes(originalHead)) {
    return { mode: 'original_head', userIds: [originalHead], originalHeadUserId: originalHead };
  }
  return { mode: originalHead ? 'department_head_fallback' : 'department_head', userIds: eligibleHeads, originalHeadUserId: originalHead };
};

export const RESPONDER_MODE_LABELS = Object.freeze({
  reassigned: 'Specifically assigned responder',
  initiating_system_admin: 'System Admin who made the change',
  system_admin_fallback: 'Available System Admin with project access',
  system_admin_case_responder: 'System Admin responsible for this Audit Case',
  original_head: 'Head who confirmed the record',
  department_head_fallback: 'Any active Head of the department (original Head is no longer available)',
  department_head: 'Any active Head of the department',
});



