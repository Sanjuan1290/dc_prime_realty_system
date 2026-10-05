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
  sales: ['Listings / Units', 'Buyer / Profile', 'Project Dashboard & Reports', 'Accredited Sellers', 'Reports'],
  accounting: ['Payments', 'Commissions', 'Employee Salary', 'Buyer / Profile', 'Reports'],
  operations: ['Projects', 'Listings / Units', 'Project Settings', 'Documents', 'Employees', 'Attendance'],
})

export const getRoleDepartment = (role = '') => String(role).replace(/_(staff|head)$/, '')
