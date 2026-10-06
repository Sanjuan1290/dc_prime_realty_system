import { db } from '../../db/connect.js';
import {
  CONFIGURABLE_SYSTEM_ROLES,
  PERMISSIONS,
  ROLE_DEFAULT_EDITABLE_ROLES,
  ROLE_LABELS,
  SYSTEM_ADMIN_MANAGEABLE_ROLES,
  SYSTEM_USER_ROLES,
} from '../../config/permissions.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from '../../config/recommendedRolePermissions.js';
import {
  copyRoleDefaultsToUser,
  getAllRoleDefaults,
  getRolePolicyForAccessControl,
  getUserPermissionKeys,
  replaceRoleDefaults,
  replaceUserPermissions,
} from '../../services/accessControl.service.js';
import {
  getUserProjectAccess,
  replaceUserProjectAccess,
} from '../../services/projectAccess.service.js';
import { writeAuditLog } from './auditLogs.controller.js';

const permissionCatalog = [
  { group: 'Dashboard', kind: 'READ', items: [['View Dashboard', PERMISSIONS.SYSTEM_DASHBOARD_VIEW]] },
  { group: 'Reports', kind: 'READ', items: [['View Reports', PERMISSIONS.SYSTEM_REPORTS_VIEW], ['Export Reports', PERMISSIONS.SYSTEM_REPORTS_EXPORT]] },
  { group: 'Projects', kind: 'OPERATE', items: [['View Projects', PERMISSIONS.SYSTEM_PROJECTS_VIEW], ['Add Project', PERMISSIONS.SYSTEM_PROJECTS_CREATE], ['Edit Project', PERMISSIONS.SYSTEM_PROJECTS_EDIT], ['Delete Project', PERMISSIONS.SYSTEM_PROJECTS_DELETE], ['Print Price List', PERMISSIONS.SYSTEM_PROJECTS_PRINT_PRICE_LIST]] },
  { group: 'Project Dashboard & Reports', kind: 'READ', items: [['Open Project Workspace', PERMISSIONS.LOT_PROJECT_VIEW], ['View Project Dashboard', PERMISSIONS.LOT_DASHBOARD_VIEW], ['View Project Reports', PERMISSIONS.LOT_REPORTS_VIEW], ['Export Project Reports', PERMISSIONS.LOT_REPORTS_EXPORT]] },
  { group: 'Listings / Units', kind: 'OPERATE', items: [['View Listings', PERMISSIONS.LOT_LISTINGS_VIEW], ['Import Listings', PERMISSIONS.LOT_LISTINGS_IMPORT], ['Add Listing', PERMISSIONS.LOT_LISTINGS_CREATE], ['Edit Listing', PERMISSIONS.LOT_LISTINGS_EDIT], ['Delete Listing', PERMISSIONS.LOT_LISTINGS_DELETE], ['View Listing Profile', PERMISSIONS.LOT_LISTING_PROFILE_VIEW], ['Reserve Unit', PERMISSIONS.LOT_RESERVATIONS_CREATE], ['Correct Reservation (Governed)', PERMISSIONS.LOT_RESERVATION_CORRECT]] },
  { group: 'Buyer / Profile', kind: 'OPERATE', items: [['Edit Buyer Profile', PERMISSIONS.LOT_BUYER_PROFILE_EDIT], ['View Buyer Documents', PERMISSIONS.LOT_BUYER_DOCUMENTS_VIEW], ['Update Buyer Documents', PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE], ['View Account History', PERMISSIONS.LOT_ACCOUNT_HISTORY_VIEW], ['Use Printouts', PERMISSIONS.LOT_PRINTOUTS_USE], ['Manage Cancellation', PERMISSIONS.LOT_CANCELLATIONS_MANAGE], ['Process Cancellation Settlement / Refund', PERMISSIONS.LOT_CANCELLATIONS_SETTLE], ['Return Cancelled Unit to Available', PERMISSIONS.LOT_CANCELLATIONS_RELEASE_UNIT]] },
  { group: 'Payments', kind: 'OPERATE', items: [['View Payments', PERMISSIONS.LOT_PAYMENTS_VIEW], ['Add Payment', PERMISSIONS.LOT_PAYMENTS_CREATE], ['Edit Payment', PERMISSIONS.LOT_PAYMENTS_EDIT], ['Delete Payment', PERMISSIONS.LOT_PAYMENT_DELETE], ['Penalty / LMF Adjustment (Governed)', PERMISSIONS.LOT_PENALTY_CORRECT], ['View Payments Audit', PERMISSIONS.LOT_PAYMENT_LOGS_VIEW]] },
  { group: 'Commissions', kind: 'OPERATE', items: [['View Commission', PERMISSIONS.LOT_COMMISSIONS_VIEW], ['Adjust Distribution (Governed)', PERMISSIONS.LOT_COMMISSIONS_ADJUST], ['Release Commission', PERMISSIONS.LOT_COMMISSIONS_RELEASE], ['Hold Commission', PERMISSIONS.LOT_COMMISSIONS_HOLD], ['Unhold Commission', PERMISSIONS.LOT_COMMISSIONS_UNHOLD]] },
  { group: 'Project Settings', kind: 'OPERATE', items: [['View Settings', PERMISSIONS.LOT_SETTINGS_VIEW], ['Edit Settings', PERMISSIONS.LOT_SETTINGS_MANAGE]] },
  { group: 'Users', kind: 'SYSTEM', items: [['View Users', PERMISSIONS.SYSTEM_USERS_VIEW], ['Create User', PERMISSIONS.SYSTEM_USERS_CREATE], ['Edit User Details', PERMISSIONS.SYSTEM_USERS_EDIT], ['Reset Password', PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD], ['Deactivate User', PERMISSIONS.SYSTEM_USERS_DEACTIVATE], ['View Role & Access Control', PERMISSIONS.SYSTEM_ACCESS_CONTROL_VIEW], ['Manage Role & Access Control', PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE]] },
  { group: 'System Settings', kind: 'OWNER', items: [['View System Settings', PERMISSIONS.SYSTEM_SETTINGS_VIEW], ['Manage System Settings (Owner Only)', PERMISSIONS.SYSTEM_SETTINGS_MANAGE]] },
  { group: 'Review & Approval', kind: 'REVIEW', items: [
    ['Open Review Center', PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW],
    ['Review Department Work', PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW],
    ['Return for Correction', PERMISSIONS.WORKFLOW_DEPARTMENT_RETURN_FOR_CORRECTION],
    ['Approve Protected Change', PERMISSIONS.WORKFLOW_DEPARTMENT_APPROVE_PROTECTED_CHANGE],
    ['Respond to Audit Case', PERMISSIONS.WORKFLOW_DEPARTMENT_CASE_RESPOND],
    ['Audit Review', PERMISSIONS.WORKFLOW_AUDIT_REVIEW],
    ['Open Audit Case', PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE],
    ['Resolve Audit Case', PERMISSIONS.WORKFLOW_AUDIT_CASE_RESOLVE],
    ['Verify Corrected Case', PERMISSIONS.WORKFLOW_AUDIT_CORRECTION_VERIFY],
    ['Apply Audit-Approved Correction', PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY],
    ['Emergency Override', PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE],
  ] },
  { group: 'Accredited Sellers', kind: 'OPERATE', items: [['View', PERMISSIONS.SYSTEM_ACCREDITED_VIEW], ['Print', PERMISSIONS.SYSTEM_ACCREDITED_PRINT], ['Upload Proof of Income', PERMISSIONS.SYSTEM_ACCREDITED_UPLOAD_PROOF]] },
  { group: 'Seller Groups', kind: 'OPERATE', items: [['View', PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW], ['Manage', PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE]] },
  { group: 'Employees', kind: 'OPERATE', items: [['View', PERMISSIONS.EMPLOYEES_VIEW], ['Manage Employee Profile', PERMISSIONS.EMPLOYEES_MANAGE], ['Manage Compensation', PERMISSIONS.EMPLOYEE_COMPENSATION_MANAGE], ['Create Employment Change', PERMISSIONS.EMPLOYMENT_CHANGE_CREATE], ['View Employment History', PERMISSIONS.EMPLOYMENT_HISTORY_VIEW]] },
  { group: 'Employee Salary', kind: 'OPERATE', items: [['View Employee Salary', PERMISSIONS.EMPLOYEE_SALARY_VIEW], ['Generate Payroll', PERMISSIONS.PAYROLL_GENERATE], ['Recalculate Draft Payroll', PERMISSIONS.PAYROLL_RECALCULATE_DRAFT], ['Finalize Payroll', PERMISSIONS.PAYROLL_FINALIZE], ['Correct Finalized Payroll', PERMISSIONS.PAYROLL_CORRECT_FINALIZED], ['Mark Payroll as Released', PERMISSIONS.PAYROLL_RELEASE], ['View Payroll History', PERMISSIONS.PAYROLL_HISTORY_VIEW], ['Print Payroll Receipt', PERMISSIONS.PAYROLL_RECEIPT_PRINT], ['Export Payroll Receipt', PERMISSIONS.PAYROLL_RECEIPT_EXPORT], ['Export Payroll Summary', PERMISSIONS.PAYROLL_SUMMARY_EXPORT], ['Manage Payroll Settings', PERMISSIONS.PAYROLL_SETTINGS_MANAGE]] },
  { group: 'Attendance', kind: 'OPERATE', items: [['View', PERMISSIONS.ATTENDANCE_VIEW], ['Manage', PERMISSIONS.ATTENDANCE_MANAGE]] },
  { group: 'Audit Logs', kind: 'AUDIT', items: [['View', PERMISSIONS.AUDIT_LOGS_VIEW], ['Archive (Owner Only)', PERMISSIONS.AUDIT_LOGS_ARCHIVE]] },
  { group: 'Data Integrity', kind: 'AUDIT', items: [['View Data Integrity', PERMISSIONS.SYSTEM_DATA_INTEGRITY_VIEW]] },
  { group: 'Notifications', kind: 'OPERATE', items: [['View', PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW], ['Manage', PERMISSIONS.SYSTEM_NOTIFICATIONS_MANAGE]] },
  { group: 'Documents', kind: 'OPERATE', items: [['View Documents', PERMISSIONS.SYSTEM_DOCUMENTS_VIEW], ['Create Documents', PERMISSIONS.SYSTEM_DOCUMENTS_CREATE], ['Edit Documents', PERMISSIONS.SYSTEM_DOCUMENTS_EDIT], ['Delete Documents', PERMISSIONS.SYSTEM_DOCUMENTS_DELETE], ['View Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_VIEW], ['Create Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_CREATE], ['Edit Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_EDIT], ['Delete Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_DELETE]] },
];

const actorCanManageRoleDefaults = (actor, role) => {
  if (actor?.role === 'super_admin') {
    return [...ROLE_DEFAULT_EDITABLE_ROLES, 'system_admin', 'auditor'].includes(role);
  }
  return actor?.role === 'system_admin' && ROLE_DEFAULT_EDITABLE_ROLES.includes(role);
};

const actorCanViewUserAccess = (actor, targetRole) => {
  if (actor?.role === 'super_admin' || actor?.role === 'auditor') return SYSTEM_USER_ROLES.includes(targetRole);
  if (actor?.role === 'system_admin') return SYSTEM_ADMIN_MANAGEABLE_ROLES.includes(targetRole) || targetRole === 'system_admin' || targetRole === 'auditor';
  return false;
};

const actorCanManageUserAccess = (actor, targetRole) => {
  if (actor?.role === 'super_admin') return targetRole !== 'super_admin';
  return actor?.role === 'system_admin' && SYSTEM_ADMIN_MANAGEABLE_ROLES.includes(targetRole);
};

export const getRoleAccessDefaults = async (req, res) => {
  try {
    const defaults = await getAllRoleDefaults();
    const policies = Object.fromEntries(await Promise.all(
      CONFIGURABLE_SYSTEM_ROLES.map(async (role) => [role, await getRolePolicyForAccessControl(role)])
    ));
    return res.json({
      roles: CONFIGURABLE_SYSTEM_ROLES,
      defaults,
      policies,
      recommendedDefaults: RECOMMENDED_ROLE_PERMISSIONS,
      catalog: permissionCatalog,
      roleLabels: ROLE_LABELS,
      editableRoles: CONFIGURABLE_SYSTEM_ROLES.filter((role) => actorCanManageRoleDefaults(req.authUser, role)),
      actor: { role: req.authUser?.role || null },
      superAdmin: { role: 'super_admin', fullAccess: true, locked: true },
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Failed to load role access defaults.' });
  }
};

export const updateRoleAccessDefaults = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const role = String(req.params.role || '');
    if (!CONFIGURABLE_SYSTEM_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid configurable role.' });
    if (!actorCanManageRoleDefaults(req.authUser, role)) {
      return res.status(403).json({ message: 'You cannot modify the default template for this role.' });
    }

    await connection.beginTransaction();
    const permissions = await replaceRoleDefaults(connection, {
      role,
      permissionKeys: req.body?.permissions,
      changedByUserId: req.authUser?.id || null,
    });
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Access Control', entityType: 'role_permission_default', entityId: role,
      entityLabel: ROLE_LABELS[role] || role, title: 'Updated role permission defaults',
      description: `Updated default permissions for ${ROLE_LABELS[role] || role}. Existing Staff accounts were not changed; Head inheritance remains structural.`,
      metadata: { role, permissions },
    });
    await connection.commit();
    return res.json({ message: 'Role defaults updated. Existing Staff accounts keep their current direct permissions.', role, permissions });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ code: error?.code, message: error?.message || 'Failed to update role defaults.' });
  } finally { connection.release(); }
};

export const getUserAccessControl = async (req, res) => {
  try {
    const userId = Number(req.params.id || 0);
    const [rows] = await db.query(
      `SELECT id, account_code, first_name, middle_name, last_name, email, role, status,
              COALESCE(all_projects_access, 0) AS all_projects_access
       FROM users WHERE id = ? LIMIT 1`, [userId]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!SYSTEM_USER_ROLES.includes(user.role)) return res.status(400).json({ message: 'Access Control applies only to internal system users.' });
    if (!actorCanViewUserAccess(req.authUser, user.role)) return res.status(403).json({ message: 'You cannot view access for this account.' });

    if (user.role === 'super_admin') {
      return res.json({ user: { ...user, permissions: Object.values(PERMISSIONS), all_projects_access: true, project_ids: [] }, locked: true, lock_reason: 'owner' });
    }

    const [permissions, projectAccess, policy] = await Promise.all([
      getUserPermissionKeys(userId),
      getUserProjectAccess(user),
      getRolePolicyForAccessControl(user.role),
    ]);
    const manageable = actorCanManageUserAccess(req.authUser, user.role);
    return res.json({
      user: { ...user, permissions, all_projects_access: projectAccess.allProjects, project_ids: projectAccess.projectIds },
      policy,
      locked: !manageable,
      lock_reason: !manageable ? 'governance' : null,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Failed to load user access.' });
  }
};

export const updateUserAccessControl = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = Number(req.params.id || 0);
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, account_code, first_name, middle_name, last_name, email, role, status FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const user = rows[0];
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
    if (!actorCanManageUserAccess(req.authUser, user.role)) throw Object.assign(new Error('You cannot modify access for this account.'), { statusCode: 403 });
    if (user.status !== 'active') throw Object.assign(new Error('This historical account is permanently deactivated and its access can no longer be changed.'), { statusCode: 409, code: 'ACCOUNT_PERMANENTLY_DEACTIVATED' });

    const permissions = await replaceUserPermissions(connection, {
      userId,
      permissionKeys: req.body?.permissions,
      changedByUserId: req.authUser?.id || null,
    });
    const projectAccess = await replaceUserProjectAccess(connection, {
      userId,
      role: user.role,
      allProjects: Boolean(req.body?.all_projects_access),
      projectIds: req.body?.project_ids,
      changedByUserId: req.authUser?.id || null,
    });
    await connection.query('UPDATE users SET auth_version = COALESCE(auth_version, 0) + 1 WHERE id = ?', [userId]);
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Access Control', entityType: 'user_access', entityId: String(userId),
      entityLabel: user.account_code || user.email, title: 'Updated user access',
      description: `Updated permissions and project scope for ${user.account_code || user.email}. Existing sessions were invalidated.`,
      metadata: { permissions, all_projects_access: projectAccess.allProjects, project_ids: projectAccess.projectIds },
    });
    await connection.commit();
    return res.json({ message: 'User access updated. Existing sessions were invalidated.', permissions, ...projectAccess });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ code: error?.code, message: error?.message || 'Failed to update user access.' });
  } finally { connection.release(); }
};

export const applyRoleDefaultsToUser = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = Number(req.params.id || 0);
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id, account_code, email, role, status FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    const user = rows[0];
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
    if (!actorCanManageUserAccess(req.authUser, user.role)) throw Object.assign(new Error('You cannot reset access for this account.'), { statusCode: 403 });
    if (user.status !== 'active') throw Object.assign(new Error('This historical account is permanently deactivated and its permissions can no longer be reset.'), { statusCode: 409, code: 'ACCOUNT_PERMANENTLY_DEACTIVATED' });

    const permissions = await copyRoleDefaultsToUser(connection, { userId, role: user.role, changedByUserId: req.authUser?.id || null });
    await connection.query('UPDATE users SET auth_version = COALESCE(auth_version, 0) + 1 WHERE id = ?', [userId]);
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Access Control', entityType: 'user_access', entityId: String(userId),
      entityLabel: user.account_code || user.email, title: 'Reset user permissions to role default',
      description: `Reset ${user.account_code || user.email} permissions to the current ${ROLE_LABELS[user.role] || user.role} role default. Project scope was not changed.`,
      metadata: { role: user.role, permissions },
    });
    await connection.commit();
    return res.json({ message: 'Permissions reset to the current role default. Project scope was not changed.', permissions });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ code: error?.code, message: error?.message || 'Failed to apply role defaults.' });
  } finally { connection.release(); }
};

