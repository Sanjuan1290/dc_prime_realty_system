/** Common, non-destructive evidence interpretation for Audit Details and Excel. */
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
    for (const [i,c] of metadata.changes.entries()) if (c && typeof c === 'object') add(c.field || c.key || `Change ${i + 1}`, c.before ?? c.oldValue, c.after ?? c.newValue)
  } else if (metadata.changes && typeof metadata.changes === 'object') {
    for (const [key, c] of Object.entries(metadata.changes)) {
      if (c && typeof c === 'object' && ('before' in c || 'after' in c)) add(key,c.before,c.after)
    }
  }
  return results
}
export const getAuditExtraFields = (log = {}) => {
  const meta = redactEvidence(log.metadata || {})
  const fields = {}
  for (const key of ['reason','verificationMethod','documentName','previousStatus','newStatus','newStatusLabel','employeeName','employeeCode','attendanceDate','previousTimeIn','newTimeIn','previousTimeOut','newTimeOut','timeIn','timeOut','actualTimeIn','actualTimeOut','requestId']) {
    if (meta[key] !== undefined) fields[key] = text(meta[key])
  }
  fields.timeIn = fields.actualTimeIn ?? fields.timeIn
  fields.timeOut = fields.actualTimeOut ?? fields.timeOut
  fields.newTimeIn = fields.actualTimeIn ?? fields.newTimeIn
  fields.newTimeOut = fields.actualTimeOut ?? fields.newTimeOut
  fields.newStatus = fields.newStatusLabel ?? fields.newStatus
  const documentResubmission = log.title === 'Requested client document resubmission'
    || (log.action === 'reject' && log.module === 'Documents' && meta.newStatus === 'Rejected')
  if (documentResubmission) {
    fields.documentName = fields.documentName || log.entityLabel || 'Not recorded'
    fields.previousStatus = fields.previousStatus || '-'
    fields.newStatus = fields.newStatus || 'Needs Resubmission'
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
