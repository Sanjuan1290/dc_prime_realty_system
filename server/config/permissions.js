// Central permission names keep route rules consistent across the API.
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
  AUDIT_LOGS_DELETE: 'audit.logs.delete',
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
  LOT_PROJECT_VIEW: 'lot_project.view',
  LOT_DASHBOARD_VIEW: 'lot_project.dashboard.view',
  LOT_LISTINGS_VIEW: 'lot_project.listings.view',
  LOT_LISTINGS_MANAGE: 'lot_project.listings.manage',
  LOT_PAYMENT_LOGS_VIEW: 'lot_project.payment_logs.view',
  LOT_COMMISSIONS_VIEW: 'lot_project.commissions.view',
  LOT_COMMISSIONS_MANAGE: 'lot_project.commissions.manage',
  LOT_SETTINGS_VIEW: 'lot_project.settings.view',
  LOT_SETTINGS_MANAGE: 'lot_project.settings.manage',
  LOT_PAYMENT_DELETE: 'lot_project.payments.delete',
  LOT_PENALTY_CORRECT: 'lot_project.penalties.correct',
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

const knownUserRoles = new Set(USER_ROLES);
const adminCreatableUserRoles = new Set(ADMIN_CREATABLE_USER_ROLES);
const privilegedUserRoles = new Set(['super_admin', 'admin']);

// Super Admin and Admin can manage existing accounts of any declared role.
export const canActorManageUserRole = (actorRole, targetRole) => {
  if (!knownUserRoles.has(String(targetRole || ''))) return false;
  return actorRole === 'super_admin' || actorRole === 'admin';
};

// Admin can create seller accounts only.
export const canActorCreateUserRole = (actorRole, requestedRole) => {
  if (actorRole === 'super_admin') return knownUserRoles.has(String(requestedRole || ''));
  return actorRole === 'admin' && adminCreatableUserRoles.has(String(requestedRole || ''));
};

// Admin cannot assign Admin or Super Admin roles through editing.
// Existing privileged accounts keep their current role while Admin edits other fields.
export const canActorChangeUserRole = (actorRole, currentRole, requestedRole) => {
  const current = String(currentRole || '');
  const next = String(requestedRole || '');

  if (!knownUserRoles.has(current) || !knownUserRoles.has(next)) return false;
  if (actorRole === 'super_admin') return true;
  if (actorRole !== 'admin') return false;

  if (privilegedUserRoles.has(current)) return next === current;
  return adminCreatableUserRoles.has(next);
};

const superAdminPermissions = new Set(Object.values(PERMISSIONS));

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
  PERMISSIONS.LOT_PROJECT_VIEW,
  PERMISSIONS.LOT_LISTINGS_VIEW,
  PERMISSIONS.LOT_LISTINGS_MANAGE,
  PERMISSIONS.LOT_PAYMENT_LOGS_VIEW,
  PERMISSIONS.LOT_SETTINGS_VIEW,
]);

export const ROLE_PERMISSIONS = Object.freeze({
  super_admin: superAdminPermissions,
  admin: adminPermissions,
});

export const roleHasPermission = (role, permission) =>
  Boolean(permission && ROLE_PERMISSIONS[String(role || '')]?.has(permission));
