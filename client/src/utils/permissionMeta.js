import { PERMISSIONS } from '../config/permissions'

// Plan items 29-30 and 36: plain-language metadata for each permission.
//
// type          View | Edit | Delete | Export / Print  (replaces READ / OPERATE)
// sensitive     money, cancellations, deletes, access control, payroll release
// headApproval  Staff need Department Head approval before the change saves
//               (mirrors server/config/reviewActions.js)

const HEAD_APPROVAL = new Set([
  PERMISSIONS.LOT_RESERVATION_CORRECT,
  PERMISSIONS.LOT_COMMISSIONS_ADJUST,
  PERMISSIONS.LOT_PENALTY_CORRECT,
  PERMISSIONS.LOT_SETTINGS_MANAGE,
  PERMISSIONS.LOT_PAYMENTS_EDIT,
  PERMISSIONS.LOT_PAYMENT_DELETE,
  PERMISSIONS.LOT_CANCELLATIONS_MANAGE,
  PERMISSIONS.LOT_CANCELLATIONS_SETTLE,
  PERMISSIONS.LOT_CANCELLATIONS_RELEASE_UNIT,
  PERMISSIONS.LOT_LISTINGS_EDIT,
  PERMISSIONS.LOT_LISTINGS_DELETE,
])

// Network project-rate changes are action-level governed under the broader
// SYSTEM_SELLER_GROUPS_MANAGE permission. Do not mark that broad permission
// here or ordinary Network create/edit/status actions would be mislabeled.

const SENSITIVE_PATTERN = /delete|purge|archive|deactivate|cancellation|refund|settle|penalt|commissions\.(adjust|release|hold|unhold)|payments\.(edit|delete)|employee_salary\.(finalize|correct_finalized|release)|compensation|access_control\.manage|settings\.manage|emergency|reservation\.correct|system_correction/

export const getPermissionType = (key = '') => {
  const value = String(key)
  if (/delete|purge|archive|void|deactivate/.test(value)) return 'Delete'
  if (/export|print|printouts/.test(value)) return 'Export / Print'
  if (/\.view$|\.view\.|history\.view|_view$/.test(value) || value.endsWith('.view')) return 'View'
  return 'Edit'
}

export const isSensitivePermission = (key = '') => SENSITIVE_PATTERN.test(String(key))
export const needsHeadApproval = (key = '') => HEAD_APPROVAL.has(String(key))

// "(Governed)" was internal wording; the "Needs Head approval" tag replaces it.
export const cleanPermissionLabel = (label = '') => String(label).replace(/\s*\(Governed\)\s*/g, '').trim()

// Sections each department works in most. Shown first for that role.
export const DEPARTMENT_PRIORITY_GROUPS = Object.freeze({
  marketing: ['Seller Groups', 'Accredited Sellers', 'Reports', 'Dashboard', 'Documents'],
  sales: ['Listings / Units', 'Reservations', 'Buyer / Profile', 'Project Dashboard & Reports', 'Accredited Sellers', 'Reports'],
  accounting: ['Payments', 'Commissions', 'Employee Salary', 'Buyer / Profile', 'Reports'],
  operations: ['Projects', 'Listings / Units', 'Reservations', 'Project Settings', 'Documents', 'Document Templates', 'Employees', 'Attendance'],
})

export const getRoleDepartment = (role = '') => String(role).replace(/_(staff|head)$/, '')


// Access levels for the module-level selector. Every permission falls into one
// tier, and a level grants its own tier plus every tier below it:
//   view  View only   - look at records
//   edit  Can edit    - everyday create / edit / export / print work
//   full  Full access - deletes and sensitive actions (money corrections,
//                       cancellations, releases, payroll finalisation, ...)
// Storage is unchanged: a level is only a shortcut that ticks permission keys.
export const ACCESS_LEVELS = Object.freeze([
  { value: 'none', label: 'No access', tiers: [] },
  { value: 'view', label: 'View only', tiers: ['view'] },
  { value: 'edit', label: 'Can edit', tiers: ['view', 'edit'] },
  { value: 'full', label: 'Full access', tiers: ['view', 'edit', 'full'] },
])

const VIEW_TIER_PRINTS = new Set([
  PERMISSIONS.SYSTEM_PROJECTS_PRINT_PRICE_LIST,
  PERMISSIONS.LOT_PRINTOUTS_USE,
])

export const getAccessTier = (key = '') => {
  const type = getPermissionType(key)
  if (type === 'View') return 'view'
  // Printing the price list or buyer printouts only outputs what the user can
  // already see. Exports and seller-record printing stay at editing level.
  if (VIEW_TIER_PRINTS.has(String(key))) return 'view'
  if (type === 'Delete' || isSensitivePermission(key)) return 'full'
  return 'edit'
}
