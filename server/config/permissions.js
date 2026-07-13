// Central permission names keep route rules consistent across the API.
export const PERMISSIONS = Object.freeze({
  SYSTEM_PROJECTS_VIEW: 'system.projects.view',
  SYSTEM_PROJECTS_MANAGE: 'system.projects.manage',
  SYSTEM_ACCREDITED_VIEW: 'system.accredited.view',
  SYSTEM_ACCREDITED_MANAGE: 'system.accredited.manage',
  SYSTEM_DOCUMENTS_VIEW: 'system.documents.view',
  SYSTEM_DOCUMENTS_MANAGE: 'system.documents.manage',
  SYSTEM_NOTIFICATIONS_VIEW: 'system.notifications.view',
  SYSTEM_NOTIFICATIONS_MANAGE: 'system.notifications.manage',
  AUDIT_LOGS_VIEW: 'audit.logs.view',
  AUDIT_LOGS_DELETE: 'audit.logs.delete',
  SYSTEM_USERS_VIEW: 'system.users.view',
  SYSTEM_USERS_MANAGE: 'system.users.manage',
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

const superAdminPermissions = new Set(Object.values(PERMISSIONS));

const adminPermissions = new Set([
  PERMISSIONS.SYSTEM_PROJECTS_VIEW,
  PERMISSIONS.SYSTEM_ACCREDITED_VIEW,
  PERMISSIONS.SYSTEM_DOCUMENTS_VIEW,
  PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW,
  PERMISSIONS.AUDIT_LOGS_VIEW,
  PERMISSIONS.SYSTEM_USERS_VIEW,
  PERMISSIONS.SYSTEM_SETTINGS_VIEW,
  PERMISSIONS.EMPLOYEES_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.EMPLOYEE_CASH_ADVANCES_VIEW,
  PERMISSIONS.PAYROLL_VIEW,
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
