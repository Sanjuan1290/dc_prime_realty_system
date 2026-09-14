import { FiAlertTriangle, FiTrash2, FiX } from 'react-icons/fi'

const DeleteAuditLogModal = ({ log, onClose, onConfirm, isDeleting }) => {
  if (!log) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700 shadow-sm">
              <FiAlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-red-950">Delete Audit Log?</h2>
              <p className="mt-1 text-sm font-semibold text-red-700">This removes one audit record and writes a deletion audit entry.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-red-500 transition hover:bg-red-100 hover:text-red-900">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm font-semibold text-slate-600">You are about to delete:</p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">{log.title}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{log.module} • {log.action}</p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(log)}
              disabled={isDeleting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiTrash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete Audit Log'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteAuditLogModal
