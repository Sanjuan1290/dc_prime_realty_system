/** Common, non-destructive evidence interpretation for Audit Details and Excel. */
import { formatPhilippineCalendarDate } from './formatDateTime.js'

const hasValue = (value) => value !== undefined && value !== null &&
  (typeof value !== 'string' || !['', 'undefined', 'null'].includes(value.trim().toLowerCase()))

const label = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const text = (value) => value === undefined ? 'Not recorded' : value === null ? '(empty)' : typeof value === 'object' ? JSON.stringify(value) : String(value)
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const secret = /(password|passcode|otp|one[_-]?time|token|jwt|authorization|cookie|secret|signature|private[_-]?key|pin|verification[_-]?code|reset[_-]?code)/i
const account = /(account[_-]?number|bank[_-]?account)/i
export const safeAuditText = (value) => {
  const str = text(value)
  // Excel and LibreOffice may interpret the leading characters as formulas.
  return /^[\s\u0000-\u001f]*[=+@\-\t\r]/.test(str) ? `'${str}` : str
}
export const redactEvidence = (value, key = '', depth = 0) => {
  if (secret.test(key)) return '[REDACTED]'
  if (account.test(key)) return `****${String(value ?? '').replace(/\s+/g, '').slice(-4)}`
  if (depth > 16) return '[Nested details omitted]'
  if (Array.isArray(value)) return value.map((v) => redactEvidence(v, '', depth + 1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, redactEvidence(v,k,depth+1)]))
  return value
}
export const getAuditChanges = (log = {}) => {
  const metadata = log.metadata || {}
  const results = []
  const add = (path, before, after) => {
    if (equal(before, after)) return
    const key = String(path).split('.').at(-1)
    // Older listing logs saved the form's empty cadastral/document fields with
    // no corresponding before value. Those fields do not establish a change.
    if (before === undefined && (!hasValue(after) || (
      key === 'cadastralLots' && Array.isArray(after) && after.every((lot) => !hasValue(lot) || ['-', '—'].includes(lot))
    ))) return
    results.push({ field: label(path), before: text(redactEvidence(before, key)), after: text(redactEvidence(after, key)), path })
  }
  const diff = (a, b, path = '', depth = 0) => {
    if (equal(a,b)) return
    if (depth < 12 && a && b && !Array.isArray(a) && !Array.isArray(b) && typeof a === 'object' && typeof b === 'object') {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key],b[key],path ? `${path}.${key}` : key,depth+1)
    } else add(path || 'Value',a,b)
  }
  if (metadata.before && metadata.after && typeof metadata.before === 'object' && typeof metadata.after === 'object') {
    diff(metadata.before,metadata.after)
  } else if (Array.isArray(metadata.changes)) {
    for (const [i,c] of metadata.changes.entries()) if (c && typeof c === 'object') add(c.field || c.key || `Change ${i + 1}`, Object.hasOwn(c, 'before') ? c.before : c.oldValue, Object.hasOwn(c, 'after') ? c.after : c.newValue)
  } else if (metadata.changes && typeof metadata.changes === 'object') {
    for (const [key, c] of Object.entries(metadata.changes)) {
      if (c && typeof c === 'object' && ('before' in c || 'after' in c)) add(key,c.before,c.after)
    }
  }
  return results
}
/** Describes what the source event actually saved, not whether a business operation happened. */
export const getAuditEvidenceCoverage = (log = {}) => {
  const meta = log.metadata && typeof log.metadata === 'object' ? log.metadata : {}
  const before = Object.prototype.hasOwnProperty.call(meta,'before')
  const after = Object.prototype.hasOwnProperty.call(meta,'after')
  if (before && after) return 'Before and After recorded'
  if (before) return 'Before only recorded'
  if (after) return 'After only recorded'
  if (meta.changes && (Array.isArray(meta.changes) ? meta.changes.length : typeof meta.changes === 'object')) return 'Changed fields recorded'
  return 'No Before/After recorded'
}

export const getAuditExtraFields = (log = {}) => {
  const meta = redactEvidence(log.metadata || {})
  const fields = {}
  for (const key of ['reason','originalCancellationReason','verificationMethod','documentName','previousStatus','newStatus','newStatusLabel','employeeName','employeeCode','attendanceDate','previousTimeIn','newTimeIn','previousTimeOut','newTimeOut','timeIn','timeOut','actualTimeIn','actualTimeOut','requestId']) {
    if (hasValue(meta[key])) fields[key] = text(meta[key])
  }
  if (fields.actualTimeIn !== undefined) fields.timeIn = fields.newTimeIn = fields.actualTimeIn
  if (fields.actualTimeOut !== undefined) fields.timeOut = fields.newTimeOut = fields.actualTimeOut
  if (fields.newStatusLabel !== undefined) fields.newStatus = fields.newStatusLabel
  const settlement = meta.cancellationSettlement
  if (log.module === 'Listings' && settlement && typeof settlement === 'object') {
    for (const key of ['refundType','refundAmount','discontinuedAmount','refundDate','refundReference','settlementNotes']) {
      if (hasValue(settlement[key])) fields[key] = text(settlement[key])
    }
  }
  const documentResubmission = log.title === 'Requested client document resubmission'
    || (log.action === 'reject' && log.module === 'Documents' && meta.newStatus === 'Rejected')
  if (documentResubmission) {
    fields.documentName = fields.documentName || log.entityLabel || 'Not recorded'
    fields.previousStatus = fields.previousStatus || '-'
    fields.newStatus = fields.newStatusLabel || 'Needs Resubmission'
  }
  const manualAttendance = log.module === 'Attendance' && log.title === 'Added manual attendance'
  const correctedAttendance = log.module === 'Attendance' && log.title === 'Corrected attendance time'
  if (manualAttendance || correctedAttendance) {
    const parts = String(log.entityLabel || '').split(' - ')
    fields.employeeName = fields.employeeName || String(log.description || '').match(/for (.+?)(?:\. Reason:|\.$)/)?.[1] || log.entityLabel || 'Not recorded'
    fields.employeeCode = fields.employeeCode || parts[0] || '-'
    fields.attendanceDate = fields.attendanceDate || parts[1] || '-'
  }
  if (['super_admin_password_email_code','administrator_password_email_code'].includes(fields.verificationMethod)) fields.verificationMethod = 'Administrator password + email verification'
  return fields
}
export const getAuditReferences = (metadata = {}) => {
  const number = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null
  return {
    reviewId: number(metadata?.operationalReviewId ?? metadata?.operational_review_id ?? metadata?.reviewId ?? metadata?.review_id),
    caseId: number(metadata?.auditCaseId ?? metadata?.audit_case_id),
  }
}




const fieldLabels = Object.freeze({
  soldSubstatus: 'Sale status',
  tcp: 'Total contract price',
  legalMiscAmount: 'Legal and miscellaneous fees',
  legalMiscRate: 'Legal and miscellaneous fee rate',
  lotAreaSqm: 'Lot area',
  discontinuedAmount: 'Amount retained',
  refundType: 'Refund decision',
  refundReference: 'Refund reference',
  verificationMethod: 'Authorization method',
})

export const auditFieldLabel = (path) => String(path).split('.')
  .map((field) => fieldLabels[field] || label(field)).join(' / ')

const statusLabels = Object.freeze({
  pending_for_cancellation: 'Pending Cancellation',
  pending_cancellation: 'Pending Cancellation',
  sold_active: 'Sold / Active',
  fully_paid: 'Fully Paid',
  no_refund: 'No Refund',
  partial_refund: 'Partial Refund',
  full_refund: 'Full Refund',
})
const statusLabel = (value) => statusLabels[String(value).toLowerCase()] || label(value)
const amountKeys = new Set([
  'amount','refundAmount','discontinuedAmount','netSellingPrice','tcp','reservationFee',
  'legalMiscAmount','installmentPricePerSqm','cashPricePerSqm','paymentAmount',
])
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export const formatAuditRecordedValue = (path, value) => {
  const key = String(path).split('.').at(-1)
  if (!hasValue(value) || value === '(empty)') return value === undefined ? 'Not recorded' : 'None'
  if (value === 'Not recorded' || value === '[REDACTED]') return value
  if (['status','soldSubstatus','previousStatus','newStatus','refundType'].includes(key)) return statusLabel(value)
  if (['refundDate','attendanceDate'].includes(key)) return formatPhilippineCalendarDate(value, { style: 'medium' })
  if (amountKeys.has(key) && /^-?\d+(?:\.\d+)?$/.test(value)) return currency.format(Number(value))
  if (['annualInterestRate','legalMiscRate'].includes(key) && /^\d+(?:\.\d+)?$/.test(value)) return value + '%'
  if (key === 'lotAreaSqm' && /^\d+(?:\.\d+)?$/.test(value)) return value + ' m²'
  if (['cadastralLots','documentRequirements'].includes(key) && String(value).startsWith('[')) {
    let items
    try { items = JSON.parse(value) } catch { return value }
    if (key === 'cadastralLots') return items.filter((lot) => hasValue(lot) && !['-', '—'].includes(lot)).join(', ') || 'None'
    return items.map((item) => {
      const name = item?.name || (item?.documentId ? `Document #${item.documentId}` : 'Document')
      const requirement = [true, 1, '1', 'required'].includes(item?.isRequired) ? 'Required'
        : [false, 0, '0', 'optional'].includes(item?.isRequired) ? 'Optional' : null
      return [name, requirement, item?.responsibleParty && statusLabel(item.responsibleParty), item?.status && statusLabel(item.status)]
        .filter(Boolean).join(' · ')
    }).join('\n') || 'None'
  }
  return String(value)
}

export const getAuditDisplayChanges = (log, changes = getAuditChanges(log)) => {
  const listingStatusChanged = log.entityType === 'lot_project_listing' &&
    log.metadata?.before && log.metadata?.after && changes.some((change) => change.path === 'status')
  const listingStatus = (side, value) => {
    const substatus = log.metadata?.[side]?.soldSubstatus
    if (value === 'sold' && hasValue(substatus)) {
      return String(substatus).toLowerCase() === 'fully_paid' ? 'Fully Paid' : `Sold / ${statusLabel(substatus)}`
    }
    return formatAuditRecordedValue('status', value)
  }
  return changes
    .filter((change) => !listingStatusChanged || change.path !== 'soldSubstatus')
    .map((change) => ({
      ...change,
      field: change.path === 'status' && listingStatusChanged ? 'Listing status' : auditFieldLabel(change.path),
      before: change.path === 'status' && listingStatusChanged
        ? listingStatus('before', change.before) : formatAuditRecordedValue(change.path, change.before),
      after: change.path === 'status' && listingStatusChanged
        ? listingStatus('after', change.after) : formatAuditRecordedValue(change.path, change.after),
    }))
}

export const auditActivityTitle = (log) => {
  if (log.module === 'Listings') {
    if (log.metadata?.statusTransitionAction === 'start_cancellation') return 'Started cancellation'
    if (log.metadata?.statusTransitionAction === 'reset_to_available') return 'Returned unit to Available'
    if (log.title === 'Cancelled pending cancellation') return 'Restored sale to active status'
    if (log.title === 'Settled listing cancellation') return 'Completed cancellation settlement'
  }
  return log.title || 'Recorded activity'
}

export const auditRecordLabel = (log) => {
  if (log.entityLabel) return log.entityLabel
  if (!log.entityType) return 'Record not specified'
  return label(String(log.entityType).replace(/^lot_project_/, '')) + (log.entityId ? ` #${log.entityId}` : '')
}
