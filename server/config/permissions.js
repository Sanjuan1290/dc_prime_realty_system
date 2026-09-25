// Central permission names. Super Admin always has all permissions; every other
// internal system account is evaluated from its database-backed user_permissions rows.
export const PERMISSIONS = Object.freeze({
  SYSTEM_DASHBOARD_VIEW: 'system.dashboard.view',
  SYSTEM_REPORTS_VIEW: 'system.reports.view',
  SYSTEM_REPORTS_EXPORT: 'system.reports.export',
  SYSTEM_PROJECTS_VIEW: 'system.projects.view',
  SYSTEM_PROJECTS_CREATE: 'system.projects.create',
  SYSTEM_PROJECTS_EDIT: 'system.projects.edit',
  SYSTEM_PROJECTS_DELETE: 'system.projects.delete',
  SYSTEM_PROJECTS_PRINT_PRICE_LIST: 'system.projects.print_price_list',
  SYSTEM_ACCREDITED_VIEW: 'system.accredited.view',
  SYSTEM_ACCREDITED_PRINT: 'system.accredited.print',
  SYSTEM_ACCREDITED_UPLOAD_PROOF: 'system.accredited.upload_proof',
  SYSTEM_SELLER_GROUPS_VIEW: 'system.seller_groups.view',
  SYSTEM_SELLER_GROUPS_MANAGE: 'system.seller_groups.manage',
  SYSTEM_DOCUMENTS_VIEW: 'system.documents.view',
  SYSTEM_DOCUMENTS_CREATE: 'system.documents.create',
  SYSTEM_DOCUMENTS_EDIT: 'system.documents.edit',
  SYSTEM_DOCUMENTS_DELETE: 'system.documents.delete',
  SYSTEM_DOCUMENT_TEMPLATES_VIEW: 'system.document_templates.view',
  SYSTEM_DOCUMENT_TEMPLATES_CREATE: 'system.document_templates.create',
  SYSTEM_DOCUMENT_TEMPLATES_EDIT: 'system.document_templates.edit',
  SYSTEM_DOCUMENT_TEMPLATES_DELETE: 'system.document_templates.delete',
  SYSTEM_NOTIFICATIONS_VIEW: 'system.notifications.view',
  SYSTEM_NOTIFICATIONS_MANAGE: 'system.notifications.manage',
  SYSTEM_DATA_INTEGRITY_VIEW: 'system.data_integrity.view',
  AUDIT_LOGS_VIEW: 'audit.logs.view',
  AUDIT_LOGS_ARCHIVE: 'audit.logs.archive',
  SYSTEM_USERS_VIEW: 'system.users.view',
  SYSTEM_USERS_CREATE: 'system.users.create',
  SYSTEM_USERS_EDIT: 'system.users.edit',
  SYSTEM_USERS_RESET_PASSWORD: 'system.users.reset_password',
  SYSTEM_USERS_DEACTIVATE: 'system.users.deactivate',
  SYSTEM_SETTINGS_VIEW: 'system.settings.view',
  SYSTEM_SETTINGS_MANAGE: 'system.settings.manage',
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_MANAGE: 'employees.manage',
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',

  LOT_PROJECT_VIEW: 'lot_project.view',
  LOT_DASHBOARD_VIEW: 'lot_project.dashboard.view',
  LOT_REPORTS_VIEW: 'lot_project.reports.view',
  LOT_REPORTS_EXPORT: 'lot_project.reports.export',
  LOT_LISTINGS_VIEW: 'lot_project.listings.view',
  LOT_LISTINGS_IMPORT: 'lot_project.listings.import',
  LOT_LISTINGS_IMPORT_UNDO: 'lot_project.listings.import_undo',
  LOT_LISTINGS_CREATE: 'lot_project.listings.create',
  LOT_LISTINGS_EDIT: 'lot_project.listings.edit',
  LOT_LISTINGS_DELETE: 'lot_project.listings.delete',
  LOT_LISTING_PROFILE_VIEW: 'lot_project.listing_profile.view',
  LOT_RESERVATIONS_CREATE: 'lot_project.reservations.create',
  LOT_RESERVATION_CORRECT: 'lot_project.reservation.correct',
  LOT_BUYER_PROFILE_EDIT: 'lot_project.buyer_profile.edit',
  LOT_PAYMENTS_VIEW: 'lot_project.payments.view',
  LOT_PAYMENTS_CREATE: 'lot_project.payments.create',
  LOT_PAYMENTS_EDIT: 'lot_project.payments.edit',
  LOT_PAYMENT_DELETE: 'lot_project.payments.delete',
  LOT_BUYER_DOCUMENTS_VIEW: 'lot_project.buyer_documents.view',
  LOT_BUYER_DOCUMENTS_UPDATE: 'lot_project.buyer_documents.update',
  LOT_ACCOUNT_HISTORY_VIEW: 'lot_project.account_history.view',
  LOT_PRINTOUTS_USE: 'lot_project.printouts.use',
  LOT_PAYMENT_LOGS_VIEW: 'lot_project.payment_logs.view',
  LOT_COMMISSIONS_VIEW: 'lot_project.commissions.view',
  LOT_COMMISSIONS_RELEASE: 'lot_project.commissions.release',
  LOT_COMMISSIONS_HOLD: 'lot_project.commissions.hold',
  LOT_COMMISSIONS_UNHOLD: 'lot_project.commissions.unhold',
  LOT_SETTINGS_VIEW: 'lot_project.settings.view',
  LOT_SETTINGS_MANAGE: 'lot_project.settings.manage',
  LOT_PENALTY_CORRECT: 'lot_project.penalties.correct',

  // Legacy keys retained while old call-sites/tests are migrated. New route code
  // should use the granular keys above.
  SYSTEM_PROJECTS_MANAGE: 'system.projects.manage',
  SYSTEM_ACCREDITED_MANAGE: 'system.accredited.manage',
  SYSTEM_DOCUMENTS_MANAGE: 'system.documents.manage',
  SYSTEM_USERS_MANAGE: 'system.users.manage',
  SYSTEM_USERS_CHANGE_STATUS: 'system.users.change_status',
  LOT_LISTINGS_MANAGE: 'lot_project.listings.manage',
  LOT_COMMISSIONS_MANAGE: 'lot_project.commissions.manage',
});

export const SYSTEM_USER_ROLES = Object.freeze(['super_admin', 'admin', 'marketing', 'sales', 'accounting', 'operations']);
export const CONFIGURABLE_SYSTEM_ROLES = Object.freeze(['admin', 'marketing', 'sales', 'accounting', 'operations']);
export const SELLER_USER_ROLES = Object.freeze(['division_manager', 'sales_director', 'unit_manager', 'sales_agent']);
export const USER_ROLES = Object.freeze([...SYSTEM_USER_ROLES, ...SELLER_USER_ROLES, 'external_group']);

export const ROLE_CODES = Object.freeze({
  super_admin: 'SA',
  admin: 'ADM',
  marketing: 'MKT',
  sales: 'SS',
  accounting: 'ACC',
  operations: 'OPS',
});

const knownUserRoles = new Set(USER_ROLES);
const allPermissions = new Set(Object.values(PERMISSIONS));

const normalizeActor = (userOrRole) => {
  if (userOrRole && typeof userOrRole === 'object') return userOrRole;
  return { role: String(userOrRole || ''), permissions: [] };
};

const normalizedPermissionSet = (actor) => {
  if (actor?.permissions instanceof Set) return actor.permissions;
  if (Array.isArray(actor?.permissions)) return new Set(actor.permissions.map(String));
  if (actor?.permissions && typeof actor.permissions === 'object') {
    return new Set(Object.entries(actor.permissions).filter(([, allowed]) => Boolean(allowed)).map(([key]) => key));
  }
  return new Set();
};

export const isSystemUserRole = (role) => SYSTEM_USER_ROLES.includes(String(role || ''));
export const isConfigurableSystemRole = (role) => CONFIGURABLE_SYSTEM_ROLES.includes(String(role || ''));
export const isSellerUserRole = (role) => SELLER_USER_ROLES.includes(String(role || ''));
export const isAdmin = (userOrRole) => normalizeActor(userOrRole).role === 'admin';
export const isAdmin1 = isAdmin;

// Full-access means owner-level bypass. Admin is intentionally NOT included.
export const isFullAccessAdministrator = (userOrRole = {}) => normalizeActor(userOrRole).role === 'super_admin';

export const roleHasPermission = (userOrRole, permission) => {
  if (!permission) return false;
  const actor = normalizeActor(userOrRole);
  if (actor.role === 'super_admin') return allPermissions.has(permission);
  return normalizedPermissionSet(actor).has(permission);
};

export const canActorManageUserRole = (userOrRole, targetRole) => {
  const actor = normalizeActor(userOrRole);
  const target = String(targetRole || '');
  if (!knownUserRoles.has(target)) return false;
  if (target === 'super_admin') return actor.role === 'super_admin';
  if (SYSTEM_USER_ROLES.includes(target)) return actor.role === 'super_admin' || roleHasPermission(actor, PERMISSIONS.SYSTEM_USERS_EDIT);
  return actor.role === 'super_admin' || roleHasPermission(actor, PERMISSIONS.SYSTEM_USERS_EDIT);
};

export const canActorCreateUserRole = (userOrRole, requestedRole) => {
  const actor = normalizeActor(userOrRole);
  const requested = String(requestedRole || '');
  if (!knownUserRoles.has(requested)) return false;
  if (requested === 'super_admin') return actor.role === 'super_admin';
  return actor.role === 'super_admin' || roleHasPermission(actor, PERMISSIONS.SYSTEM_USERS_CREATE);
};

// Internal system roles are immutable after account creation. Position changes create a new account.
// Seller hierarchy roles keep their existing role-change behavior.
export const canActorChangeUserRole = (userOrRole, currentRole, requestedRole) => {
  const actor = normalizeActor(userOrRole);
  const current = String(currentRole || '');
  const requested = String(requestedRole || '');
  if (!knownUserRoles.has(current) || !knownUserRoles.has(requested)) return false;
  if (current === requested) return true;
  if (SYSTEM_USER_ROLES.includes(current) || SYSTEM_USER_ROLES.includes(requested)) return false;
  return actor.role === 'super_admin' || roleHasPermission(actor, PERMISSIONS.SYSTEM_USERS_EDIT);
};

export const ROLE_PERMISSIONS = Object.freeze({ super_admin: allPermissions });

