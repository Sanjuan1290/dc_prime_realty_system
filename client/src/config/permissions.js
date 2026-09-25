// Mirrors server/config/permissions.js. Super Admin bypasses the matrix; every
// other internal system account uses the permissions returned by /user/me.
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

  // Legacy names retained for old components while they are migrated.
  SYSTEM_PROJECTS_MANAGE: 'system.projects.manage',
  SYSTEM_ACCREDITED_MANAGE: 'system.accredited.manage',
  SYSTEM_DOCUMENTS_MANAGE: 'system.documents.manage',
  SYSTEM_USERS_MANAGE: 'system.users.manage',
  SYSTEM_USERS_CHANGE_STATUS: 'system.users.change_status',
  LOT_LISTINGS_MANAGE: 'lot_project.listings.manage',
  LOT_COMMISSIONS_MANAGE: 'lot_project.commissions.manage',
})

export const SYSTEM_USER_ROLES = Object.freeze(['super_admin', 'admin', 'marketing', 'sales', 'accounting', 'operations'])
export const CONFIGURABLE_SYSTEM_ROLES = Object.freeze(['admin', 'marketing', 'sales', 'accounting', 'operations'])
export const SELLER_USER_ROLES = Object.freeze(['division_manager', 'sales_director', 'unit_manager', 'sales_agent'])
export const USER_ROLES = Object.freeze([...SYSTEM_USER_ROLES, ...SELLER_USER_ROLES, 'external_group'])
export const ADMIN_CREATABLE_USER_ROLES = CONFIGURABLE_SYSTEM_ROLES
export const ADMIN_MANAGEABLE_USER_ROLES = CONFIGURABLE_SYSTEM_ROLES

export const ROLE_CODES = Object.freeze({
  super_admin: 'SA',
  admin: 'ADM',
  marketing: 'MKT',
  sales: 'SS',
  accounting: 'ACC',
  operations: 'OPS',
})

const allPermissions = new Set(Object.values(PERMISSIONS))

const normalizeActor = (userOrRole) => {
  if (userOrRole && typeof userOrRole === 'object') return userOrRole
  return { role: String(userOrRole || ''), permissions: [] }
}

const permissionSet = (actor) => {
  if (actor?.permissions instanceof Set) return actor.permissions
  if (Array.isArray(actor?.permissions)) return new Set(actor.permissions.map(String))
  if (actor?.permissions && typeof actor.permissions === 'object') {
    return new Set(Object.entries(actor.permissions).filter(([, allowed]) => Boolean(allowed)).map(([key]) => key))
  }
  return new Set()
}

export const isSystemUserRole = (role) => SYSTEM_USER_ROLES.includes(String(role || ''))
export const isConfigurableSystemRole = (role) => CONFIGURABLE_SYSTEM_ROLES.includes(String(role || ''))
export const isAdmin = (userOrRole) => normalizeActor(userOrRole).role === 'admin'
export const isAdmin1 = isAdmin
export const isFullAccessAdministrator = (userOrRole) => normalizeActor(userOrRole).role === 'super_admin'

export const hasPermission = (userOrRole, permission) => {
  if (!permission) return false
  const actor = normalizeActor(userOrRole)
  if (actor.role === 'super_admin') return allPermissions.has(permission)
  return permissionSet(actor).has(permission)
}

export const canManageUserRole = (userOrRole, targetRole) => {
  const actor = normalizeActor(userOrRole)
  if (targetRole === 'super_admin') return actor.role === 'super_admin'
  return actor.role === 'super_admin' || hasPermission(actor, PERMISSIONS.SYSTEM_USERS_EDIT)
}

export const canCreateUserRole = (userOrRole, requestedRole) => {
  const actor = normalizeActor(userOrRole)
  if (requestedRole === 'super_admin') return actor.role === 'super_admin'
  return actor.role === 'super_admin' || hasPermission(actor, PERMISSIONS.SYSTEM_USERS_CREATE)
}

export const canChangeUserRole = (userOrRole, currentRole, requestedRole) => {
  if (String(currentRole || '') === String(requestedRole || '')) return true
  if (SYSTEM_USER_ROLES.includes(String(currentRole || '')) || SYSTEM_USER_ROLES.includes(String(requestedRole || ''))) return false
  const actor = normalizeActor(userOrRole)
  return actor.role === 'super_admin' || hasPermission(actor, PERMISSIONS.SYSTEM_USERS_EDIT)
}

export const getRoleHome = (role) => SYSTEM_USER_ROLES.includes(String(role || '')) ? `/portal/${role}` : '/portal'

const SYSTEM_LANDING_CANDIDATES = Object.freeze([
  [PERMISSIONS.SYSTEM_DASHBOARD_VIEW, ''],
  [PERMISSIONS.SYSTEM_REPORTS_VIEW, 'reports'],
  [PERMISSIONS.SYSTEM_PROJECTS_VIEW, 'projects'],
  [PERMISSIONS.LOT_PROJECT_VIEW, 'lot-projects'],
  [PERMISSIONS.SYSTEM_ACCREDITED_VIEW, 'accredited'],
  [PERMISSIONS.SYSTEM_DOCUMENTS_VIEW, 'documents'],
  [PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW, 'notifications'],
  [PERMISSIONS.AUDIT_LOGS_VIEW, 'audit-logs'],
  [PERMISSIONS.EMPLOYEES_VIEW, 'employees'],
  [PERMISSIONS.ATTENDANCE_VIEW, 'attendance'],
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
  if (user.role === 'super_admin' || user.all_projects_access === true || Number(user.all_projects_access || user.admin_all_projects || 0) === 1) return true
  const projects = Array.isArray(user.projects) ? user.projects : (Array.isArray(user.admin_projects) ? user.admin_projects : [])
  const normalizedSlug = String(projectSlug).trim().toLowerCase()
  return projects.some((project) => String(project?.slug || project?.lot_project_slug || '').trim().toLowerCase() === normalizedSlug)
}

