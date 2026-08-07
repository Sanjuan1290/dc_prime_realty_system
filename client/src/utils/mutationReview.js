const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let reviewHandler = null
let reviewQueue = Promise.resolve()

export const setMutationReviewHandler = (handler) => {
  reviewHandler = typeof handler === 'function' ? handler : null
  return () => {
    if (reviewHandler === handler) reviewHandler = null
  }
}

const normalizePath = (value) => String(value || '').split('?')[0].replace(/\/+$/, '') || '/'

const technicalSkipPatterns = [
  /\/user\/(?:login|logout|change-password)$/i,
  /\/user\/forgot-password(?:\/|$)/i,
  /\/system-status$/i,
  /\/preview(?:\/|$)/i,
  /\/upload-signature(?:\/|$)/i,
  /\/file-access(?:\/|$)/i,
  /\/access-url(?:\/|$)/i,
  /\/read(?:-all)?$/i,
  /\/purge-code$/i,
  /\/archive\/request$/i,
]

export const shouldReviewMutation = (path, method, { skipReview = false } = {}) => {
  if (skipReview) return false
  const normalizedMethod = String(method || 'GET').toUpperCase()
  if (!MUTATING_METHODS.has(normalizedMethod)) return false
  const normalizedPath = normalizePath(path)
  return !technicalSkipPatterns.some((pattern) => pattern.test(normalizedPath))
}

const parseBody = (body) => {
  if (body == null || body === '') return null

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const result = {}
    body.forEach((value, key) => {
      const normalized = typeof File !== 'undefined' && value instanceof File
        ? { name: value.name, size: value.size, type: value.type }
        : value
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = Array.isArray(result[key]) ? [...result[key], normalized] : [result[key], normalized]
      } else {
        result[key] = normalized
      }
    })
    return result
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }

  return body
}

const includesAny = (value, terms) => terms.some((term) => value.includes(term))

export const describeMutation = (path, method = 'POST') => {
  const normalizedPath = normalizePath(path).toLowerCase()
  const normalizedMethod = String(method || 'POST').toUpperCase()
  const isDelete = normalizedMethod === 'DELETE' || /\/(?:delete|remove)$/.test(normalizedPath)
  const isEdit = ['PUT', 'PATCH'].includes(normalizedMethod)

  if (normalizedPath.includes('proof-of-income-receipts')) {
    return { title: 'Review Proof of Income', confirmLabel: 'Confirm & Generate Receipt', description: 'Double-check the released commission stages and receipt details before creating the permanent proof-of-income record.' }
  }
  if (normalizedPath.includes('/reserve')) {
    return { title: 'Final Reservation Review', confirmLabel: 'Confirm & Reserve Listing', description: 'Nothing has been saved yet. Review the buyer, documents, payment terms, seller assignment, and calculated amounts before reserving.' }
  }
  if (normalizedPath.includes('buyer-form')) {
    return { title: 'Review Buyer Form Action', confirmLabel: normalizedPath.includes('/submit') ? 'Confirm & Submit Buyer Form' : 'Confirm & Continue', description: 'Verify the buyer-form information, target listing, expiry, and action before saving it.' }
  }
  if (normalizedPath.includes('template')) {
    return { title: isEdit ? 'Review Template Changes' : 'Review New Template', confirmLabel: isEdit ? 'Confirm & Save Template' : 'Confirm & Add Template', description: 'Verify the template name and mapped documents before saving.' }
  }
  if (normalizedPath.includes('document-requirements')) {
    return { title: 'Review Listing Document Requirements', confirmLabel: 'Confirm & Save Requirements', description: 'Verify every required/optional document before replacing the listing-specific checklist.' }
  }
  if (normalizedPath.includes('commission')) {
    if (normalizedPath.includes('release')) return { title: 'Review Commission Release', confirmLabel: 'Confirm & Release Commission', description: 'Verify the release stage, beneficiary, amounts, deductions, and references before posting the release.' }
    return { title: 'Review Commission Changes', confirmLabel: 'Confirm & Save Commission', description: 'Verify the commission action, hierarchy, stage, and amounts before saving them.' }
  }
  if (normalizedPath.includes('/payments')) {
    if (isDelete) return { title: 'Review Payment Deletion', confirmLabel: 'Confirm & Delete Payment', description: 'Verify the payment record before removing it.' }
    return { title: isEdit ? 'Review Payment Changes' : 'Review SOA Payment', confirmLabel: isEdit ? 'Confirm & Save Payment Changes' : 'Confirm & Add Payment', description: 'Double-check the payment amount, date, method, reference, and allocation before posting it to the account.' }
  }
  if (normalizedPath.includes('soa-terms') || normalizedPath.includes('/soa')) {
    return { title: 'Review SOA Changes', confirmLabel: 'Confirm & Save SOA', description: 'Verify the schedule, downpayment, interest, penalty, and due-date settings before recalculating the account.' }
  }
  if (normalizedPath.includes('penalty')) {
    return { title: 'Review Penalty Adjustment', confirmLabel: 'Confirm & Save Adjustment', description: 'Verify the penalty adjustment, effective dates, amount, and reason before saving it.' }
  }
  if (normalizedPath.includes('/client-profile')) {
    return { title: 'Review Buyer / Client Profile Changes', confirmLabel: 'Confirm & Save Buyer Profile', description: 'Verify the buyer identity, contact, civil/work information, and related profile fields before saving.' }
  }
  if (normalizedPath.includes('/accounts/') && normalizedPath.endsWith('/purge')) {
    return { title: 'Final Account Purge Review', confirmLabel: 'Confirm & Purge Account', description: 'Verify the buyer account and purge authorization before permanently removing the eligible account records.' }
  }
  if (normalizedPath.includes('/settings')) {
    return { title: 'Review Settings Changes', confirmLabel: 'Confirm & Save Settings', description: 'Review every changed setting before applying it.' }
  }
  if (normalizedPath.includes('/listings')) {
    if (normalizedPath.endsWith('/hold')) return { title: 'Review Listing Hold', confirmLabel: 'Confirm & Hold Listing', description: 'Verify the listing and hold reason/state before making it unavailable for reservation.' }
    if (normalizedPath.endsWith('/unhold')) return { title: 'Review Listing Unhold', confirmLabel: 'Confirm & Unhold Listing', description: 'Verify the listing before returning it to its allowed active state.' }
    if (isDelete) return { title: 'Review Listing Deletion', confirmLabel: 'Confirm & Delete Listing', description: 'Verify the listing before permanently deleting the eligible empty record.' }
    return { title: isEdit ? 'Review Listing Changes' : 'Review New Listing', confirmLabel: isEdit ? 'Confirm & Save Listing' : 'Confirm & Add Listing', description: 'Review all listing values and document requirements before saving them to the database.' }
  }
  if (normalizedPath.includes('/projects')) {
    if (isDelete) return { title: 'Review Project Deletion', confirmLabel: 'Confirm & Delete Project', description: 'Verify the project before deleting it.' }
    if (normalizedPath.endsWith('/status')) return { title: 'Review Project Status Change', confirmLabel: 'Confirm & Change Project Status', description: 'Verify the project before changing whether it is active for system use.' }
    const isCreateProject = /\/lot-projects$/.test(normalizedPath)
    return { title: isCreateProject ? 'Review New Project' : 'Review Project Changes', confirmLabel: isCreateProject ? 'Confirm & Add Project' : 'Confirm & Save Project', description: 'Review the project details, pricing/configuration, cadastral lots, and default documents before saving.' }
  }
  if (normalizedPath.includes('/users') || normalizedPath.includes('/user/')) {
    if (normalizedPath.includes('toggleuserstatus')) return { title: 'Review User Status Change', confirmLabel: 'Confirm & Change User Status', description: 'Verify the user and requested activation/deactivation before changing access.' }
    if (normalizedPath.includes('resetpassword')) return { title: 'Review User Password Reset', confirmLabel: 'Confirm & Reset Password', description: 'Verify the target user before replacing the login password. Password values stay masked in this review.' }
    const isCreateUser = normalizedPath.endsWith('/createuser')
    return { title: isCreateUser ? 'Review New User' : 'Review User Changes', confirmLabel: isCreateUser ? 'Confirm & Create User' : 'Confirm & Save User', description: 'Verify the user identity, role, access, and related assignments before saving.' }
  }
  if (normalizedPath.includes('/accredited')) {
    return { title: isEdit ? 'Review Accredited Seller Changes' : 'Review Accredited Seller Action', confirmLabel: isDelete ? 'Confirm & Delete' : 'Confirm & Save Seller', description: 'Verify the accredited seller identity, hierarchy, project assignments, and financial information before saving.' }
  }
  if (includesAny(normalizedPath, ['seller-group', 'seller_group', '/groups'])) {
    return { title: isEdit ? 'Review Group Changes' : 'Review New Group', confirmLabel: isEdit ? 'Confirm & Save Group' : 'Confirm & Add Group', description: 'Verify group details, hierarchy, representative information, and project accreditation before saving.' }
  }
  if (normalizedPath.includes('/documents')) {
    if (normalizedPath.includes('approve')) return { title: 'Review Document Approval', confirmLabel: 'Confirm & Approve Document', description: 'Verify the document before marking it approved.' }
    if (normalizedPath.includes('clear')) return { title: 'Review Document Clear', confirmLabel: 'Confirm & Clear Document', description: 'Verify the document before clearing the submitted file.' }
    if (isDelete) return { title: 'Review Document Deletion', confirmLabel: 'Confirm & Delete Document', description: 'Verify the reusable document before deleting it.' }
    return { title: isEdit ? 'Review Document Changes' : 'Review Document', confirmLabel: isEdit ? 'Confirm & Save Document' : 'Confirm & Save Document', description: 'Review the document information and requirement settings before saving.' }
  }
  if (normalizedPath.includes('employee')) {
    return { title: isEdit ? 'Review Employee Changes' : 'Review Employee Action', confirmLabel: isDelete ? 'Confirm & Delete' : 'Confirm & Save Employee', description: 'Verify employee, payroll, attendance, or cash-advance information before saving.' }
  }
  if (normalizedPath.includes('attendance')) {
    return { title: 'Review Attendance Action', confirmLabel: isDelete ? 'Confirm & Delete Attendance' : 'Confirm & Save Attendance', description: 'Verify the attendance details before saving.' }
  }
  if (normalizedPath.includes('notification')) {
    return { title: 'Review Notification', confirmLabel: 'Confirm & Send Notification', description: 'Verify the recipient and message details before sending and recording the notification.' }
  }
  if (normalizedPath.includes('audit')) {
    return { title: 'Review Audit Log Action', confirmLabel: isDelete ? 'Confirm & Delete' : 'Confirm & Continue', description: 'Review the selected audit-log action before applying it.' }
  }

  return {
    title: isDelete ? 'Review Deletion' : isEdit ? 'Review Changes' : 'Review Before Saving',
    confirmLabel: isDelete ? 'Confirm & Delete' : isEdit ? 'Confirm & Save Changes' : 'Confirm & Submit',
    description: 'Nothing has been saved yet. Double-check the information below before committing this action to the database.',
  }
}

export const buildMutationReviewRequest = ({ path, method, body, review }) => {
  const defaults = describeMutation(path, method)
  return {
    path: normalizePath(path),
    method: String(method || 'POST').toUpperCase(),
    payload: parseBody(body),
    ...defaults,
    ...(review || {}),
  }
}

export const requestMutationReview = async (request) => {
  if (typeof window === 'undefined' || typeof reviewHandler !== 'function') return true
  const run = async () => Boolean(await reviewHandler(request))
  const queued = reviewQueue.then(run, run)
  reviewQueue = queued.catch(() => false)
  return queued
}
