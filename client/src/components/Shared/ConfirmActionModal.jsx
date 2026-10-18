import { FiAlertTriangle, FiLoader, FiX } from 'react-icons/fi'
import StatusAlert from './StatusAlert'

/**
 * Shared confirmation modal for status changes and removals. It keeps API
 * errors inside the modal and disables duplicate submissions while saving.
 */
const ConfirmActionModal = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isPending = false,
  notice = null,
  onConfirm,
  onClose,
}) => {
  if (!open) return null

  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-busy={isPending}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <FiAlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 id="confirm-action-title" className="text-lg font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <FiX />
          </button>
        </header>

        <div className="p-5">
          {notice ? (
            <StatusAlert
              type={notice.type}
              title={notice.title}
              message={notice.message}
              onClose={notice.type === 'loading' ? undefined : notice.onClose}
            />
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white transition disabled:cursor-not-allowed ${confirmClass}`}
          >
            {isPending ? <FiLoader className="animate-spin" /> : null}
            {isPending ? 'Saving...' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ConfirmActionModal


