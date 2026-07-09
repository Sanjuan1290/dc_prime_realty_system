import { FiInfo, FiX } from 'react-icons/fi'
import { formatDateTime } from '../../../utils/formatDateTime'

const DetailRow = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-bold text-slate-900">{value || '-'}</p>
  </div>
)

const AuditLogDetailsModal = ({ log, onClose }) => {
  if (!log) return null

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
              <p className="mt-1 text-sm font-semibold text-slate-500">Complete activity record.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailRow label="Date & Time" value={formatDateTime(log.createdAt)} />
            <DetailRow label="Action" value={log.action} />
            <DetailRow label="User" value={log.actorName} />
            <DetailRow label="User Email" value={log.actorEmail} />
            <DetailRow label="Module" value={log.module} />
            <DetailRow label="Entity" value={`${log.entityType || '-'} ${log.entityId ? `#${log.entityId}` : ''}`} />
            <DetailRow label="IP Address" value={log.ipAddress} />
            <DetailRow label="User Agent" value={log.userAgent} />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Title</p>
            <p className="mt-1 text-base font-black text-slate-950">{log.title}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-600">
              {log.description || 'No description provided.'}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-slate-50">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Metadata JSON</p>
            <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-black/30 p-3 text-xs leading-relaxed">
              {JSON.stringify(log.metadata || {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuditLogDetailsModal
