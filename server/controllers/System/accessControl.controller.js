import { db } from '../../db/connect.js';
import { CONFIGURABLE_SYSTEM_ROLES, PERMISSIONS, SYSTEM_USER_ROLES } from '../../config/permissions.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from '../../config/recommendedRolePermissions.js';
import {
  copyRoleDefaultsToUser,
  getAllRoleDefaults,
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
  { group: 'Dashboard', items: [['View Dashboard', PERMISSIONS.SYSTEM_DASHBOARD_VIEW]] },
  { group: 'Reports', items: [['View Reports', PERMISSIONS.SYSTEM_REPORTS_VIEW], ['Export Reports', PERMISSIONS.SYSTEM_REPORTS_EXPORT]] },
  { group: 'Projects', items: [['View Projects', PERMISSIONS.SYSTEM_PROJECTS_VIEW], ['Add Project', PERMISSIONS.SYSTEM_PROJECTS_CREATE], ['Edit Project', PERMISSIONS.SYSTEM_PROJECTS_EDIT], ['Delete Project', PERMISSIONS.SYSTEM_PROJECTS_DELETE], ['Print Price List', PERMISSIONS.SYSTEM_PROJECTS_PRINT_PRICE_LIST]] },
  { group: 'Project Dashboard & Reports', items: [['Open Project Workspace', PERMISSIONS.LOT_PROJECT_VIEW], ['View Project Dashboard', PERMISSIONS.LOT_DASHBOARD_VIEW], ['View Project Reports', PERMISSIONS.LOT_REPORTS_VIEW], ['Export Project Reports', PERMISSIONS.LOT_REPORTS_EXPORT]] },
  { group: 'Listings / Units', items: [['View Listings', PERMISSIONS.LOT_LISTINGS_VIEW], ['Import Listings', PERMISSIONS.LOT_LISTINGS_IMPORT], ['Add Listing', PERMISSIONS.LOT_LISTINGS_CREATE], ['Edit Listing', PERMISSIONS.LOT_LISTINGS_EDIT], ['Delete Listing', PERMISSIONS.LOT_LISTINGS_DELETE], ['View Listing Profile', PERMISSIONS.LOT_LISTING_PROFILE_VIEW], ['Reserve Unit', PERMISSIONS.LOT_RESERVATIONS_CREATE]] },
  { group: 'Buyer / Profile', items: [['Edit Buyer Profile', PERMISSIONS.LOT_BUYER_PROFILE_EDIT], ['View Buyer Documents', PERMISSIONS.LOT_BUYER_DOCUMENTS_VIEW], ['Update Buyer Documents', PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE], ['View Account History', PERMISSIONS.LOT_ACCOUNT_HISTORY_VIEW], ['Use Printouts', PERMISSIONS.LOT_PRINTOUTS_USE]] },
  { group: 'Payments', items: [['View Payments', PERMISSIONS.LOT_PAYMENTS_VIEW], ['Add Payment', PERMISSIONS.LOT_PAYMENTS_CREATE], ['Edit Payment', PERMISSIONS.LOT_PAYMENTS_EDIT], ['Delete Payment', PERMISSIONS.LOT_PAYMENT_DELETE], ['View Payments Audit', PERMISSIONS.LOT_PAYMENT_LOGS_VIEW]] },
  { group: 'Commissions', items: [['View Commission', PERMISSIONS.LOT_COMMISSIONS_VIEW], ['Release Commission', PERMISSIONS.LOT_COMMISSIONS_RELEASE], ['Hold Commission', PERMISSIONS.LOT_COMMISSIONS_HOLD], ['Unhold Commission', PERMISSIONS.LOT_COMMISSIONS_UNHOLD]] },
  { group: 'Project Settings', items: [['View Settings', PERMISSIONS.LOT_SETTINGS_VIEW], ['Edit Settings', PERMISSIONS.LOT_SETTINGS_MANAGE]] },
  { group: 'Users', items: [['View Users', PERMISSIONS.SYSTEM_USERS_VIEW], ['Create User', PERMISSIONS.SYSTEM_USERS_CREATE], ['Edit User Details', PERMISSIONS.SYSTEM_USERS_EDIT], ['Reset Password', PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD], ['Deactivate User', PERMISSIONS.SYSTEM_USERS_DEACTIVATE]] },
  { group: 'Accredited Sellers', items: [['View', PERMISSIONS.SYSTEM_ACCREDITED_VIEW], ['Print', PERMISSIONS.SYSTEM_ACCREDITED_PRINT], ['Upload Proof of Income', PERMISSIONS.SYSTEM_ACCREDITED_UPLOAD_PROOF]] },
  { group: 'Seller Groups', items: [['View', PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW], ['Manage', PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE]] },
  { group: 'Employees', items: [['View', PERMISSIONS.EMPLOYEES_VIEW], ['Manage', PERMISSIONS.EMPLOYEES_MANAGE]] },
  { group: 'Attendance', items: [['View', PERMISSIONS.ATTENDANCE_VIEW], ['Manage', PERMISSIONS.ATTENDANCE_MANAGE]] },
  { group: 'Audit Logs', items: [['View', PERMISSIONS.AUDIT_LOGS_VIEW]] },
  { group: 'Notifications', items: [['View', PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW], ['Manage', PERMISSIONS.SYSTEM_NOTIFICATIONS_MANAGE]] },
  { group: 'Documents', items: [['View Documents', PERMISSIONS.SYSTEM_DOCUMENTS_VIEW], ['Create Documents', PERMISSIONS.SYSTEM_DOCUMENTS_CREATE], ['Edit Documents', PERMISSIONS.SYSTEM_DOCUMENTS_EDIT], ['Delete Documents', PERMISSIONS.SYSTEM_DOCUMENTS_DELETE], ['View Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_VIEW], ['Create Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_CREATE], ['Edit Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_EDIT], ['Delete Templates', PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_DELETE]] },
];

export const getRoleAccessDefaults = async (_req, res) => {
  try {
    const defaults = await getAllRoleDefaults();
    return res.json({
      roles: CONFIGURABLE_SYSTEM_ROLES,
      defaults,
      recommendedDefaults: RECOMMENDED_ROLE_PERMISSIONS,
      catalog: permissionCatalog,
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
    await connection.beginTransaction();
    const permissions = await replaceRoleDefaults(connection, {
      role,
      permissionKeys: req.body?.permissions,
      changedByUserId: req.authUser?.id || null,
    });
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Access Control', entityType: 'role_permission_default', entityId: role,
      entityLabel: role, title: 'Updated role permission defaults',
      description: `Updated default permissions for ${role}. Existing accounts were not changed.`,
      metadata: { role, permissions },
    });
    await connection.commit();
    return res.json({ message: 'Role defaults updated. New accounts will use these defaults.', role, permissions });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to update role defaults.' });
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
    if (user.role === 'super_admin') {
      return res.json({ user: { ...user, permissions: Object.values(PERMISSIONS), all_projects_access: true, project_ids: [] }, locked: true });
    }
    const [permissions, projectAccess] = await Promise.all([
      getUserPermissionKeys(userId),
      getUserProjectAccess(user),
    ]);
    return res.json({ user: { ...user, permissions, all_projects_access: projectAccess.allProjects, project_ids: projectAccess.projectIds }, locked: false });
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
    if (user.role === 'super_admin') throw Object.assign(new Error('Super Admin access is always full and cannot be restricted.'), { statusCode: 409 });
    if (user.status !== 'active') throw Object.assign(new Error('This historical account is permanently deactivated and its access can no longer be changed.'), { statusCode: 409, code: 'ACCOUNT_PERMANENTLY_DEACTIVATED' });
    if (!CONFIGURABLE_SYSTEM_ROLES.includes(user.role)) throw Object.assign(new Error('This account does not use the internal system permission matrix.'), { statusCode: 400 });
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
    if (user.status !== 'active') throw Object.assign(new Error('This historical account is permanently deactivated and its permissions can no longer be reset.'), { statusCode: 409, code: 'ACCOUNT_PERMANENTLY_DEACTIVATED' });
    if (!CONFIGURABLE_SYSTEM_ROLES.includes(user.role)) throw Object.assign(new Error('This account does not have editable role defaults.'), { statusCode: 400 });
    const permissions = await copyRoleDefaultsToUser(connection, { userId, role: user.role, changedByUserId: req.authUser?.id || null });
    await connection.query('UPDATE users SET auth_version = COALESCE(auth_version, 0) + 1 WHERE id = ?', [userId]);
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Access Control', entityType: 'user_access', entityId: String(userId),
      entityLabel: user.account_code || user.email, title: 'Reset user permissions to role default',
      description: `Reset ${user.account_code || user.email} permissions to the current ${user.role} role default. Project scope was not changed.`, metadata: { role: user.role, permissions },
    });
    await connection.commit();
    return res.json({ message: 'Permissions reset to the current role default. Project scope was not changed.', permissions });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ code: error?.code, message: error?.message || 'Failed to apply role defaults.' });
  } finally { connection.release(); }
};

