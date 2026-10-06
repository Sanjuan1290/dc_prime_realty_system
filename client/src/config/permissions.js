// Mirrors server/config/permissions.js. Super Admin is break-glass owner access;
 // Auditor is enforced read-only; every other internal account uses effective permissions returned by /user/me.
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
  SYSTEM_ACCESS_CONTROL_VIEW: 'system.access_control.view',
  SYSTEM_ACCESS_CONTROL_MANAGE: 'system.access_control.manage',
  WORKFLOW_REVIEW_CENTER_VIEW: 'workflow.review_center.view',
  WORKFLOW_DEPARTMENT_REVIEW: 'workflow.department.review',
  WORKFLOW_DEPARTMENT_RETURN_FOR_CORRECTION: 'workflow.department.return_for_correction',
  WORKFLOW_DEPARTMENT_APPROVE_PROTECTED_CHANGE: 'workflow.department.approve_protected_change',
  WORKFLOW_DEPARTMENT_CASE_RESPOND: 'workflow.department.case.respond',
  WORKFLOW_AUDIT_REVIEW: 'workflow.audit.review',
  WORKFLOW_AUDIT_CASE_CREATE: 'workflow.audit.case.create',
  WORKFLOW_AUDIT_CASE_RESOLVE: 'workflow.audit.case.resolve',
  WORKFLOW_AUDIT_CORRECTION_VERIFY: 'workflow.audit.correction.verify',
  WORKFLOW_SYSTEM_CORRECTION_APPLY: 'workflow.system_correction.apply',
  WORKFLOW_EMERGENCY_OVERRIDE: 'workflow.emergency_override',
  SYSTEM_USERS_VIEW: 'system.users.view',
  SYSTEM_USERS_CREATE: 'system.users.create',
  SYSTEM_USERS_EDIT: 'system.users.edit',
  SYSTEM_USERS_RESET_PASSWORD: 'system.users.reset_password',
  SYSTEM_USERS_DEACTIVATE: 'system.users.deactivate',
  SYSTEM_SETTINGS_VIEW: 'system.settings.view',
  SYSTEM_SETTINGS_MANAGE: 'system.settings.manage',
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_MANAGE: 'employees.manage',
  EMPLOYEE_COMPENSATION_MANAGE: 'employees.compensation.manage',
  EMPLOYMENT_CHANGE_CREATE: 'employees.employment_change.create',
  EMPLOYMENT_HISTORY_VIEW: 'employees.employment_history.view',
  EMPLOYEE_SALARY_VIEW: 'employee_salary.view',
  PAYROLL_GENERATE: 'employee_salary.generate',
  PAYROLL_RECALCULATE_DRAFT: 'employee_salary.recalculate_draft',
  PAYROLL_FINALIZE: 'employee_salary.finalize',
  PAYROLL_CORRECT_FINALIZED: 'employee_salary.correct_finalized',
  PAYROLL_RELEASE: 'employee_salary.release',
  PAYROLL_HISTORY_VIEW: 'employee_salary.history.view',
  PAYROLL_RECEIPT_PRINT: 'employee_salary.receipt.print',
  PAYROLL_RECEIPT_EXPORT: 'employee_salary.receipt.export',
  PAYROLL_SETTINGS_MANAGE: 'employee_salary.settings.manage',
  PAYROLL_SUMMARY_EXPORT: 'employee_salary.summary.export',
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
  LOT_CANCELLATIONS_MANAGE: 'lot_project.cancellations.manage',
  LOT_CANCELLATIONS_SETTLE: 'lot_project.cancellations.settle',
  LOT_CANCELLATIONS_RELEASE_UNIT: 'lot_project.cancellations.release_unit',
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
  LOT_COMMISSIONS_ADJUST: 'lot_project.commissions.adjust',
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

export const SYSTEM_USER_ROLES = Object.freeze([
  'super_admin',
  'system_admin',
  'auditor',
  'marketing_staff', 'marketing_head',
  'sales_staff', 'sales_head',
  'accounting_staff', 'accounting_head',
  'operations_staff', 'operations_head',
]);

export const DEPARTMENT_STAFF_ROLES = Object.freeze([
  'marketing_staff', 'sales_staff', 'accounting_staff', 'operations_staff',
]);

export const DEPARTMENT_HEAD_ROLES = Object.freeze([
  'marketing_head', 'sales_head', 'accounting_head', 'operations_head',
]);

export const CONFIGURABLE_SYSTEM_ROLES = Object.freeze(
  SYSTEM_USER_ROLES.filter((role) => role !== 'super_admin')
);

export const ROLE_DEFAULT_EDITABLE_ROLES = Object.freeze([
  'auditor',
  ...DEPARTMENT_STAFF_ROLES,
  ...DEPARTMENT_HEAD_ROLES,
]);

// Super Admin and System Admin are both owner-level, full-access accounts.
// System Admin cannot create or manage Super Admin / System Admin accounts.
export const OWNER_ROLES = Object.freeze(['super_admin', 'system_admin']);

export const SYSTEM_ADMIN_MANAGEABLE_ROLES = Object.freeze([
  'auditor',
  ...DEPARTMENT_STAFF_ROLES,
  ...DEPARTMENT_HEAD_ROLES,
]);

export const SELLER_USER_ROLES = Object.freeze(['division_manager', 'sales_director', 'unit_manager', 'sales_agent']);
export const USER_ROLES = Object.freeze([...SYSTEM_USER_ROLES, ...SELLER_USER_ROLES, 'external_group']);

export const ROLE_CODES = Object.freeze({
  super_admin: 'SA',
  system_admin: 'ADM',
  auditor: 'AUD',
  marketing_staff: 'MKT',
  marketing_head: 'MKH',
  sales_staff: 'SS',
  sales_head: 'SLH',
  accounting_staff: 'ACC',
  accounting_head: 'ACH',
  operations_staff: 'OPS',
  operations_head: 'OPH',
});

export const ROLE_LABELS = Object.freeze({
  super_admin: 'Super Admin',
  system_admin: 'System Admin',
  auditor: 'Auditor',
  marketing_staff: 'Marketing Staff',
  marketing_head: 'Marketing Head',
  sales_staff: 'Sales Staff',
  sales_head: 'Sales Head',
  accounting_staff: 'Accounting Staff',
  accounting_head: 'Accounting Head',
  operations_staff: 'Operations Staff',
  operations_head: 'Operations Head',
});

export const ROLE_PARENT = Object.freeze({
  marketing_head: 'marketing_staff',
  sales_head: 'sales_staff',
  accounting_head: 'accounting_staff',
  operations_head: 'operations_staff',
});

export const ROLE_DEPARTMENT = Object.freeze({
  marketing_staff: 'marketing',
  marketing_head: 'marketing',
  sales_staff: 'sales',
  sales_head: 'sales',
  accounting_staff: 'accounting',
  accounting_head: 'accounting',
  operations_staff: 'operations',
  operations_head: 'operations',
  auditor: 'audit',
  system_admin: 'system',
  super_admin: 'owner',
});

export const DEPARTMENT_HEAD_ROLE = Object.freeze({
  marketing: 'marketing_head',
  sales: 'sales_head',
  accounting: 'accounting_head',
  operations: 'operations_head',
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

const AUDITOR_ENFORCED_PERMISSIONS = new Set([
  PERMISSIONS.SYSTEM_DASHBOARD_VIEW,
  PERMISSIONS.SYSTEM_REPORTS_VIEW,
  PERMISSIONS.SYSTEM_PROJECTS_VIEW,
  PERMISSIONS.SYSTEM_ACCREDITED_VIEW,
  PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW,
  PERMISSIONS.SYSTEM_DOCUMENTS_VIEW,
  PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_VIEW,
  PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW,
  PERMISSIONS.SYSTEM_DATA_INTEGRITY_VIEW,
  PERMISSIONS.AUDIT_LOGS_VIEW,
  PERMISSIONS.SYSTEM_USERS_VIEW,
  PERMISSIONS.SYSTEM_SETTINGS_VIEW,
  PERMISSIONS.SYSTEM_ACCESS_CONTROL_VIEW,
  PERMISSIONS.EMPLOYEES_VIEW,
  PERMISSIONS.EMPLOYMENT_HISTORY_VIEW,
  PERMISSIONS.EMPLOYEE_SALARY_VIEW,
  PERMISSIONS.PAYROLL_HISTORY_VIEW,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.LOT_PROJECT_VIEW,
  PERMISSIONS.LOT_DASHBOARD_VIEW,
  PERMISSIONS.LOT_REPORTS_VIEW,
  PERMISSIONS.LOT_LISTINGS_VIEW,
  PERMISSIONS.LOT_LISTING_PROFILE_VIEW,
  PERMISSIONS.LOT_PAYMENTS_VIEW,
  PERMISSIONS.LOT_BUYER_DOCUMENTS_VIEW,
  PERMISSIONS.LOT_ACCOUNT_HISTORY_VIEW,
  PERMISSIONS.LOT_PAYMENT_LOGS_VIEW,
  PERMISSIONS.LOT_COMMISSIONS_VIEW,
  PERMISSIONS.LOT_SETTINGS_VIEW,
  PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW,
  PERMISSIONS.WORKFLOW_AUDIT_REVIEW,
  PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE,
  PERMISSIONS.WORKFLOW_AUDIT_CASE_RESOLVE,
  PERMISSIONS.WORKFLOW_AUDIT_CORRECTION_VERIFY,
]);

export const getAuditorEnforcedPermissions = () => [...AUDITOR_ENFORCED_PERMISSIONS];
export const isSystemUserRole = (role) => SYSTEM_USER_ROLES.includes(String(role || ''));
export const isConfigurableSystemRole = (role) => CONFIGURABLE_SYSTEM_ROLES.includes(String(role || ''));
export const isSellerUserRole = (role) => SELLER_USER_ROLES.includes(String(role || ''));
export const isSystemAdmin = (userOrRole) => normalizeActor(userOrRole).role === 'system_admin';
export const isAdmin = isSystemAdmin;
export const isAdmin1 = isSystemAdmin;
export const isAuditor = (userOrRole) => normalizeActor(userOrRole).role === 'auditor';
export const isDepartmentHead = (userOrRole) => DEPARTMENT_HEAD_ROLES.includes(normalizeActor(userOrRole).role);
export const isDepartmentStaff = (userOrRole) => DEPARTMENT_STAFF_ROLES.includes(normalizeActor(userOrRole).role);
export const getRoleDepartment = (userOrRole) => ROLE_DEPARTMENT[normalizeActor(userOrRole).role] || null;

// Owner-level full access: Super Admin and System Admin.
export const isFullAccessAdministrator = (userOrRole = {}) => OWNER_ROLES.includes(normalizeActor(userOrRole).role);
export const isOwnerAdministrator = isFullAccessAdministrator;

export const roleHasPermission = (userOrRole, permission) => {
  if (!permission) return false;
  const actor = normalizeActor(userOrRole);
  if (OWNER_ROLES.includes(actor.role)) return allPermissions.has(permission);
  return normalizedPermissionSet(actor).has(permission);
};

export const canActorManageUserRole = (userOrRole, targetRole) => {
  const actor = normalizeActor(userOrRole);
  const target = String(targetRole || '');
  if (!knownUserRoles.has(target)) return false;
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'system_admin') return !OWNER_ROLES.includes(target);
  return false;
};

export const canActorCreateUserRole = (userOrRole, requestedRole) => {
  const actor = normalizeActor(userOrRole);
  const requested = String(requestedRole || '');
  if (!knownUserRoles.has(requested)) return false;
  if (actor.role === 'super_admin') return SYSTEM_USER_ROLES.includes(requested) || SELLER_USER_ROLES.includes(requested) || requested === 'external_group';
  // System Admin can create everything Super Admin can, except owner accounts.
  if (actor.role === 'system_admin') return !OWNER_ROLES.includes(requested);
  return false;
};

export const canActorChangeUserRole = (userOrRole, currentRole, requestedRole) => {
  const actor = normalizeActor(userOrRole);
  const current = String(currentRole || '');
  const requested = String(requestedRole || '');
  if (!knownUserRoles.has(current) || !knownUserRoles.has(requested)) return false;
  if (current === requested) return true;

  // Accredited-seller hierarchy keeps its own legacy behavior.
  if (!SYSTEM_USER_ROLES.includes(current) && !SYSTEM_USER_ROLES.includes(requested)) {
    return OWNER_ROLES.includes(actor.role) || roleHasPermission(actor, PERMISSIONS.SYSTEM_USERS_EDIT);
  }

  if (actor.role === 'super_admin') return current !== 'super_admin';
  if (actor.role !== 'system_admin') return false;
  return SYSTEM_ADMIN_MANAGEABLE_ROLES.includes(current) && SYSTEM_ADMIN_MANAGEABLE_ROLES.includes(requested);
};

export const ADMIN_CREATABLE_USER_ROLES = SYSTEM_ADMIN_MANAGEABLE_ROLES
export const ADMIN_MANAGEABLE_USER_ROLES = SYSTEM_ADMIN_MANAGEABLE_ROLES

export const hasPermission = roleHasPermission
export const canManageUserRole = canActorManageUserRole
export const canCreateUserRole = canActorCreateUserRole
export const canChangeUserRole = canActorChangeUserRole

export const getRoleHome = (role) => SYSTEM_USER_ROLES.includes(String(role || '')) ? `/portal/${role}` : '/portal'

const SYSTEM_LANDING_CANDIDATES = Object.freeze([
  [PERMISSIONS.SYSTEM_DASHBOARD_VIEW, ''],
  [PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW, 'review-center'],
  [PERMISSIONS.SYSTEM_REPORTS_VIEW, 'reports'],
  [PERMISSIONS.SYSTEM_PROJECTS_VIEW, 'projects'],
  [PERMISSIONS.LOT_PROJECT_VIEW, 'lot-projects'],
  [PERMISSIONS.SYSTEM_ACCREDITED_VIEW, 'accredited'],
  [PERMISSIONS.SYSTEM_DOCUMENTS_VIEW, 'documents'],
  [PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW, 'notifications'],
  [PERMISSIONS.AUDIT_LOGS_VIEW, 'audit-logs'],
  [PERMISSIONS.EMPLOYEES_VIEW, 'employees'],
  [PERMISSIONS.ATTENDANCE_VIEW, 'attendance'],
  [PERMISSIONS.EMPLOYEE_SALARY_VIEW, 'employee-salary'],
  [PERMISSIONS.SYSTEM_USERS_VIEW, 'users'],
  [PERMISSIONS.SYSTEM_SETTINGS_VIEW, 'settings'],
])

export const getFirstAllowedSystemPath = (user = {}) => {
  if (!isSystemUserRole(user?.role)) return '/portal'
  const basePath = `/portal/${user.role}`
  const match = SYSTEM_LANDING_CANDIDATES.find(([permission]) => hasPermission(user, permission))
  if (!match) return '/portal/access-denied'
  return match[1] ? `${basePath}/${match[1]}` : basePath
}

const LOT_PROJECT_LANDING_CANDIDATES = Object.freeze([
  [PERMISSIONS.LOT_DASHBOARD_VIEW, ''],
  [PERMISSIONS.LOT_REPORTS_VIEW, 'reports'],
  [PERMISSIONS.LOT_LISTINGS_VIEW, 'listings'],
  [PERMISSIONS.LOT_PAYMENT_LOGS_VIEW, 'payments-audit'],
  [PERMISSIONS.LOT_COMMISSIONS_VIEW, 'commissions'],
  [PERMISSIONS.LOT_SETTINGS_VIEW, 'settings'],
])

export const getFirstAllowedLotProjectPath = (user = {}, projectSlug = '') => {
  const slug = String(projectSlug || '').trim()
  if (!slug || !hasPermission(user, PERMISSIONS.LOT_PROJECT_VIEW)) return '/portal/access-denied'
  const match = LOT_PROJECT_LANDING_CANDIDATES.find(([permission]) => hasPermission(user, permission))
  if (!match) return '/portal/access-denied'
  const basePath = `/portal/lot-projects/${slug}`
  return match[1] ? `${basePath}/${match[1]}` : basePath
}

export const hasProjectScope = (user = {}, projectSlug = '') => {
  if (!user || !projectSlug || !isSystemUserRole(user?.role)) return false
  if (['super_admin', 'system_admin', 'auditor'].includes(user.role) || user.all_projects_access === true || Number(user.all_projects_access || user.admin_all_projects || 0) === 1) return true
  const projects = Array.isArray(user.projects) ? user.projects : (Array.isArray(user.admin_projects) ? user.admin_projects : [])
  const normalizedSlug = String(projectSlug).trim().toLowerCase()
  return projects.some((project) => String(project?.slug || project?.lot_project_slug || '').trim().toLowerCase() === normalizedSlug)
}

