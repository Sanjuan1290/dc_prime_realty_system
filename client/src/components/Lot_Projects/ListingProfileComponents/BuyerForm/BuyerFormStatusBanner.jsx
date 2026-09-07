import { FiAlertCircle, FiCheckCircle, FiXCircle } from 'react-icons/fi'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date)
}

const BuyerFormStatusBanner = ({ submission, onReview, onReject, isSaving = false }) => {
  if (!submission) return null

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <FiAlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Buyer Form Submitted</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">{submission.buyerName || 'Buyer information awaiting review'}</h2>
            <p className="mt-1 text-sm font-semibold text-blue-900">
              Submitted {formatDateTime(submission.submittedAt)}. The unit is temporarily held. No SOA, document checklist, or commission has been created yet.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-blue-800">
              <span>{submission.buyerContactNumber || 'No mobile number'}</span>
              <span>{submission.buyerEmail || 'No email'}</span>
              <span className="capitalize">{String(submission.buyerType || 'single').replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => onReject?.(submission)} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-60">
            <FiXCircle className="h-4 w-4" /> Reject
          </button>
          <button type="button" onClick={() => onReview?.(submission)} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
            <FiCheckCircle className="h-4 w-4" /> Review & Complete Reservation
          </button>
        </div>
      </div>
    </section>
  )
}

export default BuyerFormStatusBanner
