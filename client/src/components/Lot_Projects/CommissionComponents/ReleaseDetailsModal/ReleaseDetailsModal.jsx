import { useMemo, useState } from 'react'
import { FiAlertCircle, FiLoader, FiPauseCircle, FiPlayCircle, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const InfoCard = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
  </div>
)

const StatusPill = ({ status }) => {
  const styles = {
    Eligible: 'border-blue-200 bg-blue-50 text-blue-700',
    Pending: 'border-amber-200 bg-amber-50 text-amber-700',
    Released: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'Partially Released': 'border-indigo-200 bg-indigo-50 text-indigo-700',
    'On Hold': 'border-slate-200 bg-slate-100 text-slate-600',
    Cancelled: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${styles[status] || styles.Pending}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

const releaseSuggestions = (grossCommission) => [
  { label: '20% Release', amount: grossCommission * 0.2, trigger: '20%' },
  { label: '40% Release', amount: grossCommission * 0.2, trigger: '40%' },
  { label: '60% Release', amount: grossCommission * 0.2, trigger: '60%' },
  { label: '75% Release', amount: grossCommission * 0.15, trigger: '75%' },
  { label: 'Retention', amount: grossCommission * 0.25, trigger: 'Final' },
]

const ReleaseDetailsModal = ({ commission, onClose, onAction, isSaving = false }) => {
  const grossCommission = Number(commission.grossCommission || commission.gross || 0)
  const released = Number(commission.released || 0)
  const netRemaining = Math.max(Number(commission.netRemaining ?? grossCommission - released), 0)
  const [releaseAmount, setReleaseAmount] = useState(netRemaining ? String(netRemaining.toFixed(2)) : '0')
  const [confirmAction, setConfirmAction] = useState(null)
  const [alert, setAlert] = useState({
    type: 'info',
    message: 'Review this commission record. Release, hold, and unhold actions are saved to the database.',
  })

  const suggestions = useMemo(() => releaseSuggestions(grossCommission), [grossCommission])

  const openConfirm = (action) => {
    if (action === 'release') {
      const amount = Number(releaseAmount || 0)
      if (!amount || amount <= 0) {
        setAlert({ type: 'error', message: 'Release amount must be greater than zero.' })
        return
      }

      if (amount > netRemaining) {
        setAlert({ type: 'error', message: 'Release amount cannot be greater than net remaining.' })
        return
      }
    }

    setConfirmAction(action)
    setAlert({ type: 'info', message: `Please confirm before you ${action.replace('_', ' ')} this commission.` })
  }

  const submitAction = () => {
    if (!confirmAction || isSaving) return

    const payload = {
      action: confirmAction,
      ...(confirmAction === 'release' ? { amount: Number(releaseAmount || 0) } : {}),
    }

    setAlert({ type: 'loading', message: confirmAction === 'release' ? 'Saving commission release...' : 'Saving commission status...' })
    setConfirmAction(null)
    onAction?.(commission, payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4">
      <div className="my-2 flex w-full max-w-[900px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <h2 className="text-base font-black text-slate-950">Commission Details</h2>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close commission details">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          {alert ? (
            <div className="mb-3">
              <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} />
            </div>
          ) : null}

          {confirmAction ? (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                  <div>
                    <p className="text-sm font-black text-blue-900">Confirm Action</p>
                    <p className="mt-1 text-xs font-semibold text-blue-800">
                      Are you sure you want to {confirmAction.replace('_', ' ')} this commission?
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => { setConfirmAction(null); setAlert({ type: 'info', message: 'Action cancelled.' }) }} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50">No</button>
                  <button type="button" onClick={submitAction} disabled={isSaving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSaving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                    Yes, Continue
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-black text-slate-950">Commission Information</h3>
              <StatusPill status={commission.status} />
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <InfoCard label="Seller" value={commission.seller || '-'} />
              <InfoCard label="Role" value={commission.role || '-'} />
              <InfoCard label="Seller Type" value={commission.sellerType || '-'} />
              <InfoCard label="Sale Type" value={commission.saleType || '-'} />
              <InfoCard label="Unit" value={commission.unit || '-'} />
              <InfoCard label="Client" value={commission.client || '-'} />
              <InfoCard label="Commission Base" value={money(commission.commissionBase)} />
              <InfoCard label="Rate" value={`${commission.rate || 0}%`} />
              <InfoCard label="Gross Commission" value={money(grossCommission)} />
              <InfoCard label="Released" value={money(released)} />
              <InfoCard label="Net Remaining" value={money(netRemaining)} />
              <InfoCard label="Payment Progress" value={`${Number(commission.paymentPercent || 0).toFixed(2)}%`} />
            </div>
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-black text-slate-950">Release Amount</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Suggested milestones are shown below. The actual release amount entered here is saved to the commission record.</p>

            <div className="mt-3 grid gap-2 md:grid-cols-5">
              {suggestions.map((item) => (
                <button key={item.label} type="button" onClick={() => setReleaseAmount(String(Math.min(item.amount, netRemaining).toFixed(2)))} disabled={isSaving || netRemaining <= 0} className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">
                  <p className="text-xs font-black text-slate-700">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Trigger: {item.trigger}</p>
                  <p className="mt-2 text-sm font-black text-blue-700">{money(item.amount)}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <input type="number" min="0" step="0.01" value={releaseAmount} onChange={(event) => setReleaseAmount(event.target.value)} placeholder="Enter release amount" disabled={isSaving || netRemaining <= 0} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60" />
              <button type="button" onClick={() => openConfirm('release')} disabled={isSaving || netRemaining <= 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiSave className="h-3.5 w-3.5" />}
                Release
              </button>
              <button type="button" onClick={() => openConfirm('hold')} disabled={isSaving || commission.status === 'On Hold'} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><FiPauseCircle className="h-3.5 w-3.5" />Hold</button>
              <button type="button" onClick={() => openConfirm('unhold')} disabled={isSaving || commission.status !== 'On Hold'} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><FiPlayCircle className="h-3.5 w-3.5" />Unhold</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default ReleaseDetailsModal
