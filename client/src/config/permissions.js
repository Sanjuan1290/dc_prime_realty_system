// Permission names mirror the API rules so the interface never advertises blocked actions.
export const PERMISSIONS = Object.freeze({
  SYSTEM_PROJECTS_VIEW: 'system.projects.view',
  SYSTEM_PROJECTS_MANAGE: 'system.projects.manage',
  SYSTEM_ACCREDITED_VIEW: 'system.accredited.view',
  SYSTEM_ACCREDITED_MANAGE: 'system.accredited.manage',
  SYSTEM_SELLER_GROUPS_VIEW: 'system.seller_groups.view',
  SYSTEM_SELLER_GROUPS_MANAGE: 'system.seller_groups.manage',
  SYSTEM_DOCUMENTS_VIEW: 'system.documents.view',
  SYSTEM_DOCUMENTS_MANAGE: 'system.documents.manage',
  SYSTEM_NOTIFICATIONS_VIEW: 'system.notifications.view',
  SYSTEM_NOTIFICATIONS_MANAGE: 'system.notifications.manage',
  AUDIT_LOGS_VIEW: 'audit.logs.view',
  AUDIT_LOGS_ARCHIVE: 'audit.logs.archive',
  SYSTEM_USERS_VIEW: 'system.users.view',
  SYSTEM_USERS_MANAGE: 'system.users.manage',
  SYSTEM_USERS_CREATE: 'system.users.create',
  SYSTEM_USERS_EDIT: 'system.users.edit',
  SYSTEM_USERS_RESET_PASSWORD: 'system.users.reset_password',
  SYSTEM_USERS_CHANGE_STATUS: 'system.users.change_status',
  SYSTEM_SETTINGS_VIEW: 'system.settings.view',
  SYSTEM_SETTINGS_MANAGE: 'system.settings.manage',
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_MANAGE: 'employees.manage',
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  EMPLOYEE_CASH_ADVANCES_VIEW: 'employee.cash_advances.view',
  EMPLOYEE_CASH_ADVANCES_MANAGE: 'employee.cash_advances.manage',
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_MANAGE: 'payroll.manage',
  LOT_DASHBOARD_VIEW: 'lot_project.dashboard.view',
  LOT_LISTINGS_VIEW: 'lot_project.listings.view',
  LOT_LISTINGS_MANAGE: 'lot_project.listings.manage',
  LOT_PAYMENT_LOGS_VIEW: 'lot_project.payment_logs.view',
  LOT_COMMISSIONS_VIEW: 'lot_project.commissions.view',
  LOT_SETTINGS_VIEW: 'lot_project.settings.view',
  LOT_SETTINGS_MANAGE: 'lot_project.settings.manage',
});

export const USER_ROLES = Object.freeze([
  'super_admin',
  'admin',
  'broker_network_manager',
  'broker',
  'manager',
  'agent',
]);

export const ADMIN_CREATABLE_USER_ROLES = Object.freeze([
  'broker_network_manager',
  'broker',
  'manager',
  'agent',
]);

// Kept for compatibility with older imports. Admin can manage every existing account.
export const ADMIN_MANAGEABLE_USER_ROLES = USER_ROLES;

const allPermissions = new Set(Object.values(PERMISSIONS));
const knownUserRoles = new Set(USER_ROLES);
const adminPermissions = new Set([
  PERMISSIONS.SYSTEM_PROJECTS_VIEW,
  PERMISSIONS.SYSTEM_ACCREDITED_VIEW,
  PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW,
  PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE,
  PERMISSIONS.SYSTEM_DOCUMENTS_VIEW,
  PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW,
  PERMISSIONS.SYSTEM_NOTIFICATIONS_MANAGE,
  PERMISSIONS.AUDIT_LOGS_VIEW,
  PERMISSIONS.SYSTEM_USERS_VIEW,
  PERMISSIONS.SYSTEM_USERS_CREATE,
  PERMISSIONS.SYSTEM_USERS_EDIT,
  PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD,
  PERMISSIONS.SYSTEM_USERS_CHANGE_STATUS,
  PERMISSIONS.SYSTEM_SETTINGS_VIEW,
  PERMISSIONS.EMPLOYEES_VIEW,
  PERMISSIONS.EMPLOYEES_MANAGE,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.PAYROLL_VIEW,
  PERMISSIONS.PAYROLL_MANAGE,
  PERMISSIONS.LOT_LISTINGS_VIEW,
  PERMISSIONS.LOT_LISTINGS_MANAGE,
  PERMISSIONS.LOT_PAYMENT_LOGS_VIEW,
  PERMISSIONS.LOT_SETTINGS_VIEW,
]);

const rolePermissions = { super_admin: allPermissions, admin: adminPermissions };

export const hasPermission = (role, permission) => Boolean(rolePermissions[role]?.has(permission));
export const canManageUserRole = (actorRole, targetRole) => (
  knownUserRoles.has(String(targetRole || ''))
  && (actorRole === 'super_admin' || actorRole === 'admin')
);
export const getRoleHome = (role) => role === 'admin' ? '/admin/projects' : role === 'super_admin' ? '/super_admin' : '/';

