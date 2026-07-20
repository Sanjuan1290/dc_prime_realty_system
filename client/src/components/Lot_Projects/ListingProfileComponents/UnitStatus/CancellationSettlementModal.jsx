import { useMemo, useState } from 'react'
import { FiAlertTriangle, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { LuPhilippinePeso } from "react-icons/lu";

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const today = () => {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const CancellationSettlementModal = ({
  unitId,
  buyerName,
  cashCollected = 0,
  commissionBase = 0,
  onClose,
  onConfirm,
  isSaving = false,
}) => {
  const [refundType, setRefundType] = useState('partial_refund')
  const [refundAmount, setRefundAmount] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [refundDate, setRefundDate] = useState(today())
  const [refundReference, setRefundReference] = useState('')
  const [settlementNotes, setSettlementNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [notice, setNotice] = useState(null)

  const collected = Number(cashCollected || 0)
  const effectiveRefund = useMemo(() => {
    if (refundType === 'no_refund') return 0
    if (refundType === 'full_refund') return collected
    return Math.max(Number(refundAmount || 0), 0)
  }, [collected, refundAmount, refundType])
  const discontinued = Math.max(collected - effectiveRefund, 0)
  const retainedPercent = Number(commissionBase || 0) > 0 ? Math.min(100, (discontinued / Number(commissionBase)) * 100) : 0
  const commissionStages = [
    { label: '1st Release', trigger: 20 },
    { label: '2nd Release', trigger: 40 },
    { label: '3rd Release', trigger: 60 },
    { label: '4th Release', trigger: 75 },
    { label: 'Retention', trigger: 100 },
  ]

  const submit = async (event) => {
    event.preventDefault()
    setNotice(null)

    if (refundType === 'partial_refund' && (effectiveRefund <= 0 || effectiveRefund >= collected)) {
      setNotice({ type: 'error', message: 'Partial refund must be greater than ₱0 and less than verified collections.' })
      return
    }

    if (effectiveRefund > collected) {
      setNotice({ type: 'error', message: 'Refund amount cannot exceed verified collections.' })
      return
    }

    if (!cancellationReason.trim()) {
      setNotice({ type: 'error', message: 'Enter the cancellation reason.' })
      return
    }

    if (!confirmed) {
      setNotice({ type: 'warning', message: 'Confirm the settlement amounts before continuing.' })
      return
    }

    try {
      await onConfirm?.({
        cancellationRefundType: refundType,
        refundAmount: effectiveRefund,
        cancellationReason: cancellationReason.trim(),
        refundDate: effectiveRefund > 0 ? refundDate || null : null,
        refundReference: effectiveRefund > 0 ? refundReference.trim() || null : null,
        cancellationSettlementNotes: settlementNotes.trim() || null,
      })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to complete cancellation settlement.' })
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-orange-700">Cancellation Settlement</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{unitId || '-'} · {buyerName || '-'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Record the buyer refund and the amount retained by the company.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label="Close settlement modal">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} className="mb-4" /> : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Verified Collections</p>
              <p className="mt-1 text-lg font-black text-slate-950">{money(collected)}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Refund Amount</p>
              <p className="mt-1 text-lg font-black text-blue-950">{money(effectiveRefund)}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Discontinued Amount</p>
              <p className="mt-1 text-lg font-black text-amber-950">{money(discontinued)}</p>
            </div>
          </section>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Refund Type</span>
              <select value={refundType} onChange={(event) => { setRefundType(event.target.value); setNotice(null) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50">
                <option value="no_refund">No Refund</option>
                <option value="partial_refund">Partial Refund</option>
                <option value="full_refund">Full Refund</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Refund Amount</span>
              <div className="relative">
                <LuPhilippinePeso  className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  max={collected}
                  step="0.01"
                  value={refundType === 'partial_refund' ? refundAmount : effectiveRefund}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  disabled={refundType !== 'partial_refund'}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-black text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
            </label>

            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Cancellation Reason</span>
              <textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} rows={3} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50" placeholder="Reason approved by management" />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Refund Date</span>
              <input type="date" value={refundDate} onChange={(event) => setRefundDate(event.target.value)} disabled={effectiveRefund <= 0} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 disabled:bg-slate-100" />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Refund Reference</span>
              <input value={refundReference} onChange={(event) => setRefundReference(event.target.value)} disabled={effectiveRefund <= 0} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 disabled:bg-slate-100" placeholder="Check, transfer, or voucher number" />
            </label>

            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Settlement Notes</span>
              <textarea value={settlementNotes} onChange={(event) => setSettlementNotes(event.target.value)} rows={3} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50" placeholder="Internal approval, conditions, and supporting details" />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="w-full">
                <p className="font-black">Cancellation commission preview</p>
                <p className="mt-1 font-semibold">The retained commissionable amount is {money(discontinued)}, equal to {retainedPercent.toFixed(2)}% of the saved commission base. Reached milestones remain payable. Unreached milestones become forfeited. Released commissions remain unchanged.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-5">
                  {commissionStages.map((stage) => {
                    const earned = retainedPercent >= stage.trigger
                    return (
                      <div key={stage.label} className={`rounded-xl border px-3 py-2 ${earned ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                        <p className="text-xs font-black">{stage.label}</p>
                        <p className="mt-1 text-[11px] font-semibold">{stage.trigger}% · {earned ? 'Earned' : 'Forfeited'}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
            <span>
              <span className="block text-sm font-black text-slate-900">I confirm these settlement amounts.</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">Refund + discontinued amount must equal verified collections.</span>
            </span>
          </label>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isSaving || !confirmed} className="h-11 rounded-xl bg-orange-600 px-5 text-sm font-black text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300">
            {isSaving ? 'Saving Settlement...' : 'Complete Settlement'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default CancellationSettlementModal
