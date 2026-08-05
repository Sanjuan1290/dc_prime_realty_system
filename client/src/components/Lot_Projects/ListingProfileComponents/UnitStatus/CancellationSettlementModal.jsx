import { useMemo, useState } from 'react'
import { FiArchive, FiTrash2, FiX } from 'react-icons/fi'
import { LuPhilippinePeso } from 'react-icons/lu'
import StatusAlert from '../../../Shared/StatusAlert'

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
  onClose,
  onConfirm,
  isSaving = false,
}) => {
  const [historyTreatment, setHistoryTreatment] = useState('keep')
  const [refundType, setRefundType] = useState('no_refund')
  const [refundAmount, setRefundAmount] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [refundDate, setRefundDate] = useState(today())
  const [refundReference, setRefundReference] = useState('')
  const [settlementNotes, setSettlementNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [notice, setNotice] = useState(null)

  const collected = Number(cashCollected || 0)
  const hasNoPayment = collected <= 0.009
  const voidWithoutHistory = hasNoPayment && historyTreatment === 'discard'
  const effectiveRefund = useMemo(() => {
    if (voidWithoutHistory || refundType === 'no_refund') return 0
    if (refundType === 'full_refund') return collected
    return Math.max(Number(refundAmount || 0), 0)
  }, [collected, refundAmount, refundType, voidWithoutHistory])
  const discontinued = voidWithoutHistory ? 0 : Math.max(collected - effectiveRefund, 0)

  const changeHistoryTreatment = (value) => {
    setHistoryTreatment(value)
    setConfirmed(false)
    setNotice(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    setNotice(null)

    if (!voidWithoutHistory && refundType === 'partial_refund' && (effectiveRefund <= 0 || effectiveRefund >= collected)) {
      setNotice({ type: 'error', message: 'Partial refund must be greater than ₱0 and less than verified collections.' })
      return
    }

    if (!voidWithoutHistory && effectiveRefund > collected) {
      setNotice({ type: 'error', message: 'Refund amount cannot exceed verified collections.' })
      return
    }

    if (!cancellationReason.trim()) {
      setNotice({ type: 'error', message: 'Enter the cancellation reason.' })
      return
    }

    if (!confirmed) {
      setNotice({
        type: 'warning',
        message: voidWithoutHistory
          ? 'Confirm that the unpaid reservation may be permanently removed.'
          : 'Confirm the settlement amounts before continuing.',
      })
      return
    }

    try {
      await onConfirm?.({
        cancellationAccountHistoryTreatment: voidWithoutHistory ? 'discard' : 'keep',
        cancellationRefundType: voidWithoutHistory ? 'no_refund' : refundType,
        refundAmount: voidWithoutHistory ? 0 : effectiveRefund,
        cancellationReason: cancellationReason.trim(),
        refundDate: !voidWithoutHistory && effectiveRefund > 0 ? refundDate || null : null,
        refundReference: !voidWithoutHistory && effectiveRefund > 0 ? refundReference.trim() || null : null,
        cancellationSettlementNotes: settlementNotes.trim() || null,
      })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to complete cancellation.' })
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-orange-700">Cancellation Settlement</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{unitId || '-'} · {buyerName || '-'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Choose whether to retain this cancelled buyer account or void an unpaid reservation.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label="Close settlement modal">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} className="mb-4" /> : null}

          {hasNoPayment ? (
            <section>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Buyer Account Treatment</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => changeHistoryTreatment('keep')}
                  className={`rounded-2xl border p-4 text-left transition ${historyTreatment === 'keep' ? 'border-blue-400 bg-blue-50 ring-4 ring-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-black text-slate-950"><FiArchive className="h-4 w-4 text-blue-700" /> Keep in Buyer Account History</span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">Complete the normal cancellation settlement and retain the buyer, SOA, documents, and commission records.</span>
                </button>
                <button
                  type="button"
                  onClick={() => changeHistoryTreatment('discard')}
                  className={`rounded-2xl border p-4 text-left transition ${historyTreatment === 'discard' ? 'border-red-400 bg-red-50 ring-4 ring-red-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-black text-red-800"><FiTrash2 className="h-4 w-4" /> Void Without Account History</span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-red-700">Return the unit directly to Available and permanently remove this unpaid buyer account. The server blocks this option if any payment or uploaded file exists.</span>
                </button>
              </div>
            </section>
          ) : null}

          {voidWithoutHistory ? (
            <StatusAlert
              type="warning"
              message="This action does not create a Buyer Account History entry. The current unpaid reservation, generated SOA rows, checklist rows, and unreleased commission setup will be permanently removed. The system audit log remains."
              className="mt-5"
            />
          ) : (
            <>
              <section className={`${hasNoPayment ? 'mt-5' : ''} grid gap-3 sm:grid-cols-3`}>
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
                    <LuPhilippinePeso className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
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
              </div>
            </>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Cancellation Reason</span>
              <textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} rows={3} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50" placeholder="Reason approved by management" />
            </label>

            {!voidWithoutHistory ? (
              <>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Refund Date</span>
                  <input type="date" value={refundDate} onChange={(event) => setRefundDate(event.target.value)} disabled={effectiveRefund <= 0} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 disabled:bg-slate-100" />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Refund Reference</span>
                  <input value={refundReference} onChange={(event) => setRefundReference(event.target.value)} disabled={effectiveRefund <= 0} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 disabled:bg-slate-100" placeholder="Check, transfer, or voucher number" />
                </label>
              </>
            ) : null}

            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">{voidWithoutHistory ? 'Internal Notes' : 'Settlement Notes'}</span>
              <textarea value={settlementNotes} onChange={(event) => setSettlementNotes(event.target.value)} rows={3} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50" placeholder="Internal approval, conditions, and supporting details" />
            </label>
          </div>

          <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${voidWithoutHistory ? 'border-red-200 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
            <span>
              <span className={`block text-sm font-black ${voidWithoutHistory ? 'text-red-900' : 'text-slate-900'}`}>
                {voidWithoutHistory ? 'I confirm this unpaid reservation may be permanently removed.' : 'I confirm these settlement amounts.'}
              </span>
              <span className={`mt-1 block text-xs font-semibold ${voidWithoutHistory ? 'text-red-700' : 'text-slate-500'}`}>
                {voidWithoutHistory ? 'This cannot be restored from Buyer Account History.' : 'Refund + discontinued amount must equal verified collections.'}
              </span>
            </span>
          </label>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isSaving || !confirmed} className={`h-11 rounded-xl px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${voidWithoutHistory ? 'bg-red-700 hover:bg-red-800' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {isSaving ? 'Saving...' : voidWithoutHistory ? 'Void Reservation & Make Available' : 'Complete Settlement'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default CancellationSettlementModal
