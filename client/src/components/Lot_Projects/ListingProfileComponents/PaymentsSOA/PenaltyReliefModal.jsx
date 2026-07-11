import { useState } from 'react'
import { FiClock, FiEdit2, FiRefreshCw, FiRotateCcw, FiShield, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const addDaysISO = (days) => {
  const [year, month, day] = todayISO().split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + Number(days || 0))).toISOString().slice(0, 10)
}

const reliefLabel = (type) => {
  const labels = {
    penalty_free_extension: 'Penalty-Free Extension',
    full_waiver: 'Full Waiver',
    partial_waiver: 'Partial Waiver',
    penalty_correction: 'Penalty Reset (Correction)',
    restoration: 'Penalty Restoration',
  }
  return labels[type] || type || 'Penalty Relief'
}

const PenaltyReliefModal = ({
  row,
  alert,
  canManage = false,
  canCorrect = false,
  isSaving = false,
  onClose,
  onGrantExtension,
  onEditExtension,
  onWaive,
  onCorrect,
  onRestore,
}) => {
  const activeExtension = row?.activePenaltyExtension?.status === 'active'
    ? row.activePenaltyExtension
    : null
  const extensionAvailable = Boolean(activeExtension || row?.canGrantPenaltyExtension)
  const defaultAction = extensionAvailable ? 'extension' : row?.canWaivePenalty ? 'waiver' : canCorrect ? 'correction' : 'history'

  const [action, setAction] = useState(defaultAction)
  const [promisedPaymentDate, setPromisedPaymentDate] = useState(
    activeExtension?.promisedPaymentDate || addDaysISO(1)
  )
  const [waiverType, setWaiverType] = useState('full')
  const [waiverAmount, setWaiverAmount] = useState('')
  const [reason, setReason] = useState(activeExtension?.reason || '')
  const [internalNotes, setInternalNotes] = useState(activeExtension?.internalNotes || '')
  const [localAlert, setLocalAlert] = useState(null)
  const [restoreRelief, setRestoreRelief] = useState(null)
  const [restoreAmount, setRestoreAmount] = useState('')
  const [restoreReason, setRestoreReason] = useState('')

  const visibleAlert = alert || localAlert
  const reliefs = row?.penaltyReliefs || []

  const restorationExists = (target = {}) => {
    const targetId = Number(target.penaltyReliefId || target.id || 0)
    return reliefs.some(
      (relief) =>
        relief.reliefType === 'restoration' &&
        Number(relief.restoresPenaltyReliefId || 0) === targetId &&
        relief.status !== 'cancelled'
    )
  }

  const getRestorableAmount = (relief = {}) => {
    if (relief.reliefType === 'penalty_correction') {
      return restorationExists(relief) ? 0 : Number(relief.reliefAmount || 0)
    }

    const reliefId = Number(relief.penaltyReliefId || relief.id || 0)
    const restored = reliefs
      .filter(
        (item) =>
          item.reliefType === 'restoration' &&
          Number(item.restoresPenaltyReliefId || 0) === reliefId &&
          item.status !== 'cancelled'
      )
      .reduce((sum, item) => sum + Number(item.reliefAmount || 0), 0)
    return Math.max(Number(relief.reliefAmount || 0) - restored, 0)
  }

  const canRestore = (relief = {}) => {
    if (relief.status === 'cancelled' || relief.status === 'restored') return false
    if (relief.reliefType === 'penalty_correction') return canCorrect && !restorationExists(relief)
    return canManage && ['full_waiver', 'partial_waiver'].includes(relief.reliefType) && getRestorableAmount(relief) > 0.009
  }

  const switchAction = (nextAction) => {
    setAction(nextAction)
    setLocalAlert(null)
    if (nextAction === 'extension' && activeExtension) {
      setPromisedPaymentDate(activeExtension.promisedPaymentDate || addDaysISO(1))
      setReason(activeExtension.reason || '')
      setInternalNotes(activeExtension.internalNotes || '')
    } else {
      setReason('')
      setInternalNotes('')
    }
  }

  const submitPrimary = (event) => {
    event.preventDefault()
    setLocalAlert(null)

    if (!reason.trim()) {
      setLocalAlert({ type: 'error', message: 'Reason is required.' })
      return
    }

    const payload = {
      reason: reason.trim(),
      internalNotes: internalNotes.trim(),
    }

    if (action === 'extension') {
      if (!promisedPaymentDate) {
        setLocalAlert({ type: 'error', message: 'Promised payment date is required.' })
        return
      }
      if (promisedPaymentDate < todayISO() || promisedPaymentDate > addDaysISO(31)) {
        setLocalAlert({ type: 'error', message: 'Promised payment date must be within the next 31 days.' })
        return
      }

      if (activeExtension) {
        onEditExtension?.({
          ...payload,
          promisedPaymentDate,
          reliefId: activeExtension.penaltyReliefId || activeExtension.id,
        })
      } else {
        onGrantExtension?.({ ...payload, promisedPaymentDate })
      }
      return
    }

    if (action === 'correction') {
      onCorrect?.(payload)
      return
    }

    const amount = Number(waiverAmount || 0)
    if (waiverType === 'partial' && (amount <= 0 || amount > Number(row?.outstandingPenaltyAmount || 0))) {
      setLocalAlert({
        type: 'error',
        message: 'Partial waiver amount must be greater than 0 and cannot exceed the outstanding penalty.',
      })
      return
    }

    onWaive?.({
      ...payload,
      waiverType,
      amount: waiverType === 'partial' ? amount : undefined,
    })
  }

  const submitRestore = (event) => {
    event.preventDefault()
    if (!restoreRelief) return
    if (!restoreReason.trim()) {
      setLocalAlert({ type: 'error', message: 'Restore reason is required.' })
      return
    }

    const isCorrection = restoreRelief.reliefType === 'penalty_correction'
    const amount = isCorrection || restoreAmount === '' ? undefined : Number(restoreAmount)
    if (!isCorrection && amount !== undefined && amount <= 0) {
      setLocalAlert({ type: 'error', message: 'Restore amount must be greater than 0.' })
      return
    }

    onRestore?.({
      reliefId: restoreRelief.penaltyReliefId || restoreRelief.id,
      amount,
      reason: restoreReason.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FiShield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">Penalty Relief</h3>
              <p className="text-sm font-semibold text-slate-500">{row?.description || 'Selected SOA row'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" aria-label="Close penalty relief modal">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {visibleAlert ? (
            <StatusAlert type={visibleAlert.type} message={visibleAlert.message} onClose={visibleAlert.type === 'loading' ? undefined : () => setLocalAlert(null)} className="mb-4" />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Installment Due</p><p className="mt-1 text-sm font-black text-slate-950">{money(row?.dueAmount)}</p></div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-600">Calculated Penalty</p><p className="mt-1 text-sm font-black text-red-800">{money(row?.calculatedPenaltyAmount)}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-600">Waived</p><p className="mt-1 text-sm font-black text-emerald-800">{money(row?.waivedPenaltyAmount)}</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-700">Outstanding Penalty</p><p className="mt-1 text-sm font-black text-amber-900">{money(row?.outstandingPenaltyAmount)}</p></div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
            <p>Daily rate: <span className="font-black text-slate-900">{Number(row?.penaltyRatePercent || 0)}%</span>{' · '}Grace period: <span className="font-black text-slate-900">{Number(row?.penaltyGraceDays || 0)} day(s)</span></p>
            <p className="mt-1 text-xs text-slate-500">Penalty stays separate from TCP and the principal balance.</p>
          </div>

          {!canManage ? <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Penalty relief is view-only for your account.</div> : null}

          {canManage ? (
            <div className="mt-5 grid gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-3">
              <button type="button" onClick={() => switchAction('extension')} disabled={!extensionAvailable} className={`rounded-lg px-3 py-2 text-sm font-black transition ${action === 'extension' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'} disabled:cursor-not-allowed disabled:opacity-40`}>
                {activeExtension ? 'Edit Extension' : 'Penalty-Free Extension'}
              </button>
              <button type="button" onClick={() => switchAction('waiver')} disabled={!row?.canWaivePenalty} className={`rounded-lg px-3 py-2 text-sm font-black transition ${action === 'waiver' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'} disabled:cursor-not-allowed disabled:opacity-40`}>Waive Penalty</button>
              {canCorrect ? <button type="button" onClick={() => switchAction('correction')} className={`rounded-lg px-3 py-2 text-sm font-black transition ${action === 'correction' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Reset Correction</button> : null}
            </div>
          ) : null}

          {canManage && action !== 'history' ? (
            <form onSubmit={submitPrimary} className="mt-4 rounded-2xl border border-slate-200 p-4">
              {action === 'extension' ? (
                <div>
                  <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    {activeExtension ? <FiEdit2 className="mt-0.5 h-5 w-5 shrink-0" /> : <FiClock className="mt-0.5 h-5 w-5 shrink-0" />}
                    <p className="font-semibold">Penalty earned before the extension stays recorded. New penalty pauses through the promised date. A broken promise restores normal accrual for the full late period.</p>
                  </div>
                  <label className="mt-4 flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Penalty-Free Until</span><input type="date" min={todayISO()} max={addDaysISO(31)} value={promisedPaymentDate} onChange={(event) => setPromisedPaymentDate(event.target.value)} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
                </div>
              ) : action === 'waiver' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Waiver Type</span><select value={waiverType} onChange={(event) => setWaiverType(event.target.value)} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"><option value="full">Full waiver</option><option value="partial">Partial waiver</option></select></label>
                  <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Waiver Amount</span><input type="number" min="0.01" step="0.01" max={row?.outstandingPenaltyAmount || 0} value={waiverType === 'full' ? row?.outstandingPenaltyAmount || 0 : waiverAmount} onChange={(event) => setWaiverAmount(event.target.value)} disabled={isSaving || waiverType === 'full'} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  <FiRefreshCw className="mt-0.5 h-5 w-5 shrink-0" />
                  <div><p className="font-black">Super Admin Correction</p><p className="mt-1 font-semibold">This sets the selected row’s current calculated penalty to PHP 0.00. It does not change the due date, rate, or grace period. New late days can accrue again after the correction date.</p></div>
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={action === 'correction' ? 'Example: Payment was entered late in the system' : 'Reason for this action'} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
                <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Internal Notes</span><input value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Optional notes" disabled={isSaving} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
              </div>

              <div className="mt-4 flex justify-end"><button type="submit" disabled={isSaving || (action === 'extension' && !extensionAvailable) || (action === 'waiver' && !row?.canWaivePenalty)} className={`h-10 rounded-lg px-5 text-sm font-black text-white transition disabled:cursor-not-allowed ${action === 'correction' ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'}`}>{isSaving ? 'Saving...' : action === 'extension' ? activeExtension ? 'Save Extension' : 'Grant Extension' : action === 'correction' ? 'Reset Penalty to PHP 0.00' : 'Save Waiver'}</button></div>
            </form>
          ) : null}

          <div className="mt-5">
            <h4 className="text-sm font-black text-slate-950">Relief History</h4>
            <div className="mt-3 flex flex-col gap-3">
              {reliefs.map((relief) => (
                <div key={relief.penaltyReliefId || relief.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="text-sm font-black text-slate-900">{reliefLabel(relief.reliefType)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{relief.reason || 'No reason'} · {relief.approvedByName || '-'} · {relief.createdAt || '-'}</p>{relief.promisedPaymentDate && relief.promisedPaymentDate !== '-' ? <p className="mt-1 text-xs font-semibold text-blue-700">Promised payment: {relief.promisedPaymentDate}</p> : null}</div>
                    <div className="flex items-center gap-2">{Number(relief.reliefAmount || 0) > 0 ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{money(relief.reliefAmount)}</span> : null}<span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">{relief.status || 'active'}</span></div>
                  </div>

                  {canRestore(relief) ? (
                    <button type="button" onClick={() => { setRestoreRelief(relief); setRestoreAmount(''); setRestoreReason(''); setLocalAlert(null) }} disabled={isSaving} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"><FiRotateCcw className="h-3.5 w-3.5" />{relief.reliefType === 'penalty_correction' ? 'Restore Penalty Calculation' : 'Restore Waived Penalty'}</button>
                  ) : null}
                </div>
              ))}
              {!reliefs.length ? <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm font-semibold text-slate-500">No penalty relief records for this row.</div> : null}
            </div>
          </div>

          {restoreRelief ? (
            <form onSubmit={submitRestore} className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-black text-amber-950">{restoreRelief.reliefType === 'penalty_correction' ? 'Restore Penalty Calculation' : 'Restore Waived Penalty'}</h4><p className="mt-1 text-xs font-semibold text-amber-800">{restoreRelief.reliefType === 'penalty_correction' ? 'This removes the correction and recalculates the row using its payment history.' : 'Leave amount blank to restore the remaining waiver.'}</p></div><button type="button" onClick={() => setRestoreRelief(null)} className="text-amber-800"><FiX className="h-4 w-4" /></button></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {restoreRelief.reliefType !== 'penalty_correction' ? <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-amber-950">Restore Amount</span><input type="number" min="0.01" step="0.01" value={restoreAmount} onChange={(event) => setRestoreAmount(event.target.value)} max={getRestorableAmount(restoreRelief)} placeholder={`Up to ${money(getRestorableAmount(restoreRelief))}`} disabled={isSaving} className="h-11 rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label> : null}
                <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-amber-950">Reason</span><input value={restoreReason} onChange={(event) => setRestoreReason(event.target.value)} placeholder="Why is this relief being restored?" disabled={isSaving} className="h-11 rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>
              </div>
              <div className="mt-4 flex justify-end"><button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-amber-600 px-5 text-sm font-black text-white transition hover:bg-amber-700 disabled:bg-amber-300">{isSaving ? 'Restoring...' : 'Restore Penalty'}</button></div>
            </form>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-4"><button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Close</button></div>
      </div>
    </div>
  )
}

export default PenaltyReliefModal
