import { FiInfo, FiX } from 'react-icons/fi'
import { formatDateTime } from '../../../utils/formatDateTime'


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

const DetailRow = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-bold text-slate-900">{value || '-'}</p>
  </div>
)

const AuditLogDetailsModal = ({ log, onClose }) => {
  if (!log) return null

  const isDocumentResubmission = log.title === 'Requested client document resubmission'
    || (log.action === 'reject' && log.module === 'Documents' && log.metadata?.newStatus === 'Rejected')
  const actionLabel = isDocumentResubmission ? 'Request Resubmission' : log.action
  const isManualAttendance = log.module === 'Attendance' && log.title === 'Added manual attendance'
  const isAttendanceCorrection = log.module === 'Attendance' && log.title === 'Corrected attendance time'
  const isAttendanceAudit = isManualAttendance || isAttendanceCorrection
  const entityParts = String(log.entityLabel || '').split(' - ')
  const attendanceEmployeeName = log.metadata?.employeeName
    || String(log.description || '').match(/for (.+?)(?:\. Reason:|\.$)/)?.[1]
    || log.entityLabel
  const attendanceEmployeeCode = log.metadata?.employeeCode || entityParts[0] || '-'
  const attendanceDate = log.metadata?.attendanceDate || entityParts[1] || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FiInfo className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Audit Log Details</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Activity, actor, and target information.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailRow label="Date & Time" value={formatDateTime(log.createdAt)} />
            <DetailRow label="Action" value={actionLabel} />
            <DetailRow label="User" value={log.actorName} />
            <DetailRow label="User Email" value={log.actorEmail} />
            <DetailRow label="Module" value={log.module} />
            <DetailRow label="Entity" value={log.entityLabel || (log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId}` : ''}` : '-')} />
          </div>

          {isDocumentResubmission ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <DetailRow label="Document" value={log.metadata?.documentName || log.entityLabel} />
              <DetailRow label="Previous Status" value={log.metadata?.previousStatus || '-'} />
              <DetailRow label="New Status" value={log.metadata?.newStatusLabel || 'Needs Resubmission'} />
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

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Title</p>
            <p className="mt-1 text-base font-black text-slate-950">{log.title}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-600">
              {log.description || 'No description provided.'}
            </p>
          </div>

          {log.metadata?.reason ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-relaxed text-amber-950">{log.metadata.reason}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AuditLogDetailsModal
