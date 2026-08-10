import { FiEye } from 'react-icons/fi'
import { formatDateTime } from '../../../utils/formatDateTime'

const actionStyles = {
  create: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  update: 'bg-blue-50 text-blue-700 ring-blue-100',
  delete: 'bg-red-50 text-red-700 ring-red-100',
  send: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  approve: 'bg-green-50 text-green-700 ring-green-100',
  release: 'bg-purple-50 text-purple-700 ring-purple-100',
  system: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const ActionBadge = ({ value }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1 ${actionStyles[value] || actionStyles.system}`}>
    {String(value || 'system').replace(/_/g, ' ')}
  </span>
)

const AuditLogTable = ({ logs = [], isLoading, pagination, onView, page, setPage, limit, setLimit }) => {
  const totalPages = pagination?.totalPages || 1

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-black text-slate-950">Audit Trail Records</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          System activity from real database records. Audit entries cannot be edited manually.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Date & Time', 'User', 'Action', 'Module', 'Title', 'Entity', 'Actions'].map((head) => (
                <th key={head} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center font-semibold text-slate-500">Loading audit logs...</td>
              </tr>
            ) : null}

            {!isLoading && logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center font-semibold text-slate-500">
                  No audit logs found for the selected filters.
                </td>
              </tr>
            ) : null}

            {!isLoading && logs.map((log) => (
              <tr key={log.id} className="align-top transition hover:bg-slate-50">
                <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">{formatDateTime(log.createdAt)}</td>
                <td className="px-5 py-4">
                  <p className="font-black text-slate-900">{log.actorName || 'System'}</p>
                  <p className="text-xs font-semibold text-slate-500">{log.actorEmail || log.actorRole || '-'}</p>
                </td>
                <td className="px-5 py-4"><ActionBadge value={log.action} /></td>
                <td className="px-5 py-4 font-black text-blue-700">{log.module}</td>
                <td className="px-5 py-4">
                  <p className="font-black text-slate-900">{log.title}</p>
                  <p className="mt-1 line-clamp-2 max-w-md text-xs font-semibold text-slate-500">{log.description || 'No description provided.'}</p>
                </td>
                <td className="px-5 py-4 font-semibold text-slate-600">
                  {log.entityLabel || (log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId}` : ''}` : '-')}
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onView(log)}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <FiEye className="h-4 w-4" /> Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-600">
          Showing page {page} of {totalPages} • {pagination?.total || 0} total record(s)
        </p>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value))
              setPage(1)
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700"
          >
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setPage(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}

export default AuditLogTable


