// Permission names mirror the API rules so the interface never advertises blocked actions.
export const PERMISSIONS = Object.freeze({
  SYSTEM_DASHBOARD_VIEW: 'system.dashboard.view',
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

export const ADMIN_TYPES = Object.freeze([
  {
    value: 'admin_1',
    label: 'Admin 1',
    description: 'Full operational access with owner-only safeguards and a 12-month dashboard limit.',
  },
  { value: 'admin_2', label: 'Admin 2', description: 'Permission set will be configured later.', disabled: true },
  { value: 'admin_3', label: 'Admin 3', description: 'Permission set will be configured later.', disabled: true },
]);

export const ADMIN_CREATABLE_USER_ROLES = Object.freeze(USER_ROLES.filter((role) => role !== 'super_admin'));
export const ADMIN_MANAGEABLE_USER_ROLES = ADMIN_CREATABLE_USER_ROLES;

const allPermissions = new Set(Object.values(PERMISSIONS));
const knownUserRoles = new Set(USER_ROLES);

const normalizeActor = (userOrRole, adminType = '') => {
  if (userOrRole && typeof userOrRole === 'object') {
    return {
      role: String(userOrRole.role || ''),
      adminType: String(userOrRole.admin_type || ''),
    };
  }

  return {
    role: String(userOrRole || ''),
    adminType: String(adminType || ''),
  };
};

export const isAdmin1 = (userOrRole, adminType = '') => {
  const actor = normalizeActor(userOrRole, adminType);
  return actor.role === 'admin' && (!actor.adminType || actor.adminType === 'admin_1');
};

export const isFullAccessAdministrator = (userOrRole, adminType = '') => {
  const actor = normalizeActor(userOrRole, adminType);
  return actor.role === 'super_admin' || isAdmin1(actor.role, actor.adminType);
};

export const hasPermission = (userOrRole, permission, adminType = '') => {
  if (!permission) return false;
  const actor = normalizeActor(userOrRole, adminType);
  return (actor.role === 'super_admin' || isAdmin1(actor.role, actor.adminType))
    && allPermissions.has(permission);
};

export const canManageUserRole = (userOrRole, targetRole, adminType = '') => {
  const actor = normalizeActor(userOrRole, adminType);
  const target = String(targetRole || '');
  if (!knownUserRoles.has(target)) return false;
  if (target === 'super_admin') return actor.role === 'super_admin';
  return actor.role === 'super_admin' || isAdmin1(actor.role, actor.adminType);
};

export const canCreateUserRole = (userOrRole, requestedRole, adminType = '') => {
  const actor = normalizeActor(userOrRole, adminType);
  const requested = String(requestedRole || '');
  if (!knownUserRoles.has(requested)) return false;
  if (requested === 'super_admin') return actor.role === 'super_admin';
  return actor.role === 'super_admin' || isAdmin1(actor.role, actor.adminType);
};

export const canChangeUserRole = (userOrRole, currentRole, requestedRole, adminType = '') => {
  const actor = normalizeActor(userOrRole, adminType);
  const current = String(currentRole || '');
  const requested = String(requestedRole || '');
  if (!knownUserRoles.has(current) || !knownUserRoles.has(requested)) return false;
  if (current === 'super_admin' || requested === 'super_admin') return actor.role === 'super_admin';
  return actor.role === 'super_admin' || isAdmin1(actor.role, actor.adminType);
};

export const getRoleHome = (role) => role === 'admin' ? '/admin/dashboard' : role === 'super_admin' ? '/super_admin' : '/';
