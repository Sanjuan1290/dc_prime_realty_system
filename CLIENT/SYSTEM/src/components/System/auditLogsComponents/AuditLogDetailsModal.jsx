import { FiArrowUpRight, FiInfo, FiSearch, FiX } from 'react-icons/fi'
import { formatPhilippineDateTime } from '../../../utils/formatDateTime'
import {
  auditActivityTitle,
  auditFieldLabel,
  auditRecordLabel,
  formatAuditRecordedValue,
  getAuditChanges,
  getAuditDisplayChanges,
  getAuditExtraFields,
  getAuditReferences,
} from '../../../utils/auditReportEvidence'


const formatAttendanceDate = (value) => {
  const date = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value || '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

const formatAttendanceTime = (value) => {
  const clean = String(value || '').slice(0, 8)
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return value || '-'
  const hour = Number(match[1])
  const minute = match[2]
  const second = match[3] || '00'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute}${second !== '00' ? `:${second}` : ''} ${suffix}`
}


const dayOfMonth = (value) => {
  const number = Number(value || 0)
  if (!Number.isInteger(number) || number < 1 || number > 31) return value || 'Not provided'
  const suffix = [11, 12, 13].includes(number % 100)
    ? 'th'
    : number % 10 === 1
      ? 'st'
      : number % 10 === 2
        ? 'nd'
        : number % 10 === 3
          ? 'rd'
          : 'th'
  return `${number}${suffix} of the month`
}

const titleCase = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

const sameAuditValue = (left, right) => String(left ?? '') === String(right ?? '')
const enabledDisabled = (value) => value === true || value === 1 || String(value || '').toLowerCase() === 'true' || String(value || '') === '1' ? 'Enabled' : 'Disabled'

const formatAuditValue = (value, formatter) => {
  if (formatter) return formatter(value)
  if (value === null || value === undefined || value === '') return 'Not provided'
  return String(value)
}

const settingsChangeDefinitions = {
  'System Settings': [
    { key: 'companyName', label: 'Company Name' },
    { key: 'companyTin', label: 'Company TIN' },
    { key: 'companyEmail', label: 'Company Email' },
    { key: 'companyContactNumber', label: 'Company Contact Number' },
    { key: 'companyAddress', label: 'Company Address' },
    { key: 'reservationContactName', label: 'Reservation Contact Name' },
    { key: 'reservationContactEmail', label: 'Reservation Contact Email' },
    { key: 'reservationContactNumber', label: 'Reservation Contact Number' },
    { key: 'defaultReleaseDayOne', label: 'Default Release Day 1', formatter: dayOfMonth },
    { key: 'defaultReleaseDayTwo', label: 'Default Release Day 2', formatter: dayOfMonth },
    { key: 'systemStatus', label: 'System Status', formatter: titleCase },
    { key: 'maintenanceMessage', label: 'Maintenance Message' },
  ],
  'Project Settings': [
    { key: 'releaseDayOne', label: 'First Release Day', formatter: dayOfMonth },
    { key: 'releaseDayTwo', label: 'Second Release Day', formatter: dayOfMonth },
    { key: 'reservationContactName', label: 'Reservation Contact Name' },
    { key: 'reservationContactEmail', label: 'Reservation Contact Email' },
    { key: 'reservationContactNumber', label: 'Reservation Contact Number' },
    { key: 'companyName', label: 'Company Name' },
    { key: 'companyEmail', label: 'Company Email' },
    { key: 'companyContactNumber', label: 'Company Contact Number' },
    { key: 'paymentEntryEmailNotificationEnabled', label: 'Payment Entry Notifications', formatter: enabledDisabled },
  ],
}

const getSettingsChanges = (log = {}) => {
  const definitions = settingsChangeDefinitions[log.module] || []
  const before = log.metadata?.before
  const after = log.metadata?.after
  if (!definitions.length || !before || !after || typeof before !== 'object' || typeof after !== 'object') return []

  return definitions.flatMap(({ key, label, formatter }) => {
    if (sameAuditValue(before[key], after[key])) return []
    return [{
      key,
      label,
      before: formatAuditValue(before[key], formatter),
      after: formatAuditValue(after[key], formatter),
    }]
  })
}

const getAuthorizationLabel = (verificationMethod) => (
  ['super_admin_password_email_code','administrator_password_email_code'].includes(verificationMethod)
    ? 'Administrator password + email verification'
    : verificationMethod
      ? titleCase(verificationMethod)
      : '-'
)

const DetailRow = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-bold text-slate-900">{value || '-'}</p>
  </div>
)

const AuditLogDetailsModal = ({ log, onClose, onViewReview, onResolveRecord, destination, destinationBusy = false, destinationError = '' }) => {
  if (!log) return null

  const isDocumentResubmission = log.title === 'Requested client document resubmission'
    || (log.action === 'reject' && log.module === 'Documents' && log.metadata?.newStatus === 'Rejected')
  const isManualAttendance = log.module === 'Attendance' && log.title === 'Added manual attendance'
  const isAttendanceCorrection = log.module === 'Attendance' && log.title === 'Corrected attendance time'
  const isAttendanceAudit = isManualAttendance || isAttendanceCorrection
  const entityParts = String(log.entityLabel || '').split(' - ')
  const attendanceEmployeeName = log.metadata?.employeeName
    || String(log.description || '').match(/for (.+?)(?:\. Reason:|\.$)/)?.[1]
    || log.entityLabel
  const attendanceEmployeeCode = log.metadata?.employeeCode || entityParts[0] || '-'
  const attendanceDate = log.metadata?.attendanceDate || entityParts[1] || ''
  const { reviewId: linkedReviewId } = getAuditReferences(log.metadata)
  const settingsChanges = getSettingsChanges(log)
  const changes = getAuditDisplayChanges(log, getAuditChanges(log))
  const contextFields = getAuditExtraFields(log)
  const isSettingsAudit = Boolean(settingsChangeDefinitions[log.module])
  const contextRows = Object.entries(contextFields).filter(([key, value]) => {
    if (['requestId', 'reason', 'newStatusLabel'].includes(key)) return false
    if (key === 'verificationMethod' && isSettingsAudit) return false
    if (key === 'originalCancellationReason' && value === contextFields.reason) return false
    if (isDocumentResubmission && ['documentName', 'previousStatus', 'newStatus'].includes(key)) return false
    if (isAttendanceAudit && /^(employee|attendanceDate)|time(in|out)/i.test(key)) return false
    return true
  })
  const settingsAuthorization = getAuthorizationLabel(log.metadata?.verificationMethod)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Audit Log Details" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FiInfo className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Audit Log Details</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Recorded activity and changes.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close audit details" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <section aria-label="What happened">
            <h3 className="text-lg font-black text-slate-950">{auditActivityTitle(log)}</h3>
            {log.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-600">{log.description}</p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailRow label="Who recorded it" value={log.actorName || 'System'} />
              <DetailRow label="Date and time" value={formatPhilippineDateTime(log.createdAt, { timeZoneLabel: true, fallback: 'Not recorded' })} />
              <DetailRow label="Record" value={auditRecordLabel(log)} />
              <DetailRow label="Module" value={log.module} />
            </div>
          </section>

          {isDocumentResubmission ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <DetailRow label="Document" value={log.metadata?.documentName || log.entityLabel} />
              <DetailRow label="Previous Status" value={formatAuditRecordedValue('previousStatus', contextFields.previousStatus === '-' ? undefined : contextFields.previousStatus)} />
              <DetailRow label="New Status" value={formatAuditRecordedValue('newStatus', contextFields.newStatus)} />
            </div>
          ) : null}

          {isAttendanceAudit ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Attendance Details</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <DetailRow label="Employee" value={attendanceEmployeeName} />
                <DetailRow label="Employee Code" value={attendanceEmployeeCode} />
                <DetailRow label="Attendance Date" value={formatAttendanceDate(attendanceDate)} />
                {isManualAttendance ? (
                  <>
                    <DetailRow label="Time In" value={formatAttendanceTime(log.metadata?.actualTimeIn)} />
                    <DetailRow label="Time Out" value={formatAttendanceTime(log.metadata?.actualTimeOut)} />
                  </>
                ) : (
                  <>
                    <DetailRow label="Previous Time In" value={formatAttendanceTime(log.metadata?.previousTimeIn)} />
                    <DetailRow label="New Time In" value={formatAttendanceTime(log.metadata?.actualTimeIn)} />
                    <DetailRow label="Previous Time Out" value={formatAttendanceTime(log.metadata?.previousTimeOut)} />
                    <DetailRow label="New Time Out" value={formatAttendanceTime(log.metadata?.actualTimeOut)} />
                  </>
                )}
              </div>
            </div>
          ) : null}

          {!isSettingsAudit ? (
            <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4" aria-label="What changed">
              <h3 className="text-sm font-black text-slate-900">What changed</h3>
              {changes.length ? (
                <div className="mt-3 space-y-2">
                  {changes.map((change, index) => (
                    <div key={`${change.path}-${index}`} className="rounded-xl border border-blue-100 bg-white p-3">
                      <p className="text-xs font-bold text-slate-600">{change.field}</p>
                      <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-xs text-slate-500">Before</span><p className="whitespace-pre-line break-words font-semibold">{change.before}</p></div>
                        <div><span className="text-xs text-slate-500">After</span><p className="whitespace-pre-line break-words font-semibold">{change.after}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-slate-600">No field changes were recorded for this entry.</p>}
              {changes.some((change) => change.before === 'Not recorded' || change.after === 'Not recorded') ? (
                <p className="mt-2 text-xs text-slate-500">“Not recorded” means the audit log saved no value for that field at that point.</p>
              ) : null}
            </section>
          ) : null}

          {contextFields.reason ? (
            <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-black text-amber-900">Reason</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-amber-950">{contextFields.reason}</p>
            </section>
          ) : null}

          {contextRows.length ? (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-black text-slate-900">Recorded details</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {contextRows.map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-semibold text-slate-500">{auditFieldLabel(key)}</dt>
                    <dd className="mt-1 whitespace-pre-line break-words text-sm font-semibold text-slate-900">{formatAuditRecordedValue(key, value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Record navigation">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Original Record</p>
                <p className="mt-1 text-sm text-slate-600">{auditRecordLabel(log)}</p>
              </div>
              {destination?.status === 'available' && destination.destination?.path ? (
                <a href={destination.destination.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                  <FiArrowUpRight /> Open {destination.destination.label || 'Record'}
                </a>
              ) : (
                <button type="button" onClick={() => onResolveRecord?.(log)} disabled={destinationBusy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
                  <FiSearch /> {destinationBusy ? 'Checking Record…' : destination ? 'Recheck Record' : 'Find Original Record'}
                </button>
              )}
            </div>
            {destination?.status === 'available' ? <p className="mt-3 text-xs text-slate-600">{destination.destination?.precision === 'parent-record' ? 'The verified link opens the related buyer account, not the exact sub-record. Use this Audit Log for the recorded event details. ' : 'The record was verified in the current database. '}The page opens in a new tab under its existing permissions. Current details may differ from the historical evidence.</p> : null}
            {destination?.status === 'historical' ? <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{destination.reason}</p> : null}
            {destinationError ? <p role="alert" className="mt-3 text-sm text-red-700">{destinationError}</p> : null}
          </section>
          <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold text-slate-800">Technical details</summary>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <DetailRow label="Audit Log ID" value={String(log.id)} />
              <DetailRow label="User email" value={log.actorEmail || 'Not recorded'} />
              <DetailRow label="Record ID" value={log.entityId || 'Not recorded'} />
              <DetailRow label="Actor User ID" value={String(log.actorUserId ?? '-')} />
              <DetailRow label="Actor Role" value={log.actorRole || '-'} />
              <DetailRow label="Request ID" value={log.metadata?.requestId || 'Not recorded'} />
              <DetailRow label="IP Address" value={log.ipAddress || 'Not recorded'} />
              <DetailRow label="Browser / Client" value={log.userAgent || 'Not recorded'} />
            </dl>
          </details>
          {linkedReviewId ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <span className="text-sm font-semibold text-blue-950">Related Review #{linkedReviewId}</span>
            <button type="button" onClick={() => onViewReview?.(linkedReviewId)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">View Review</button>
          </div> : null}
          {isSettingsAudit ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700">Settings Changes</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Only values changed by this protected settings update are shown.</p>
                </div>
                <span className="mt-2 inline-flex w-fit rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-blue-700 sm:mt-0">
                  {settingsChanges.length} change{settingsChanges.length === 1 ? '' : 's'}
                </span>
              </div>

              {settingsChanges.length ? (
                <div className="mt-4 grid gap-3">
                  {settingsChanges.map((change) => (
                    <div key={change.key} className="rounded-2xl border border-blue-100 bg-white p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{change.label}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Before</p>
                          <p className="mt-1 break-words text-sm font-bold text-slate-800">{change.before}</p>
                        </div>
                        <span className="hidden text-lg font-black text-blue-500 md:block" aria-hidden="true">→</span>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">After</p>
                          <p className="mt-1 break-words text-sm font-black text-emerald-950">{change.after}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">No changed settings values were recorded.</p>
              )}

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">Authorization</p>
                <p className="mt-1 text-sm font-black text-amber-950">{settingsAuthorization}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">Verification secrets and email codes are never displayed in Audit Logs.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AuditLogDetailsModal





