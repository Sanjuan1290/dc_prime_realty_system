import { useMemo, useState } from 'react'
import { FiAlertCircle, FiLoader, FiPauseCircle, FiPlayCircle, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const statusLabel = (status) => ({
  Pending: 'Not Eligible',
  Eligible: 'Eligible',
  'Partially Released': 'Partial',
  Released: 'Completed',
  'On Hold': 'On Hold',
  Cancelled: 'Cancelled',
}[status] || status || 'Not Eligible')

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
    'On Hold': 'border-amber-200 bg-amber-50 text-amber-700',
    Cancelled: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${styles[status] || styles.Pending}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  )
}

const getActionLabel = (action) => {
  const labels = {
    release_stage: 'release this stage',
    hold_stage: 'hold this stage',
    unhold_stage: 'unhold this stage',
    cancel_stage: 'cancel this stage',
  }
  return labels[action] || action
}

const ReleaseDetailsModal = ({ commission, onClose, onAction, isSaving = false }) => {
  const grossCommission = Number(commission.grossCommission || commission.gross || 0)
  const released = Number(commission.released || 0)
  const netRemaining = Math.max(Number(commission.netRemaining ?? grossCommission - released), 0)
  const milestones = useMemo(() => commission.releaseMilestones || [], [commission.releaseMilestones])
  const releaseDateInfo = commission.releaseDateInfo || {}
  const [confirmAction, setConfirmAction] = useState(null)
  const [selectedStage, setSelectedStage] = useState(null)
  const [alert, setAlert] = useState({
    type: 'info',
    message: 'Review each release stage. Eligible stages are released one milestone at a time.',
  })

  const openConfirm = (action, stage) => {
    if (!stage?.releaseId) {
      setAlert({ type: 'error', message: 'This release stage is missing a database id. Refresh the page first.' })
      return
    }

    if (action === 'release_stage' && stage.status !== 'Eligible') {
      setAlert({ type: 'error', message: `${stage.stage} is not eligible for release yet.` })
      return
    }

    setSelectedStage(stage)
    setConfirmAction(action)
    setAlert({ type: 'info', message: `Please confirm before you ${getActionLabel(action)}.` })
  }

  const submitAction = () => {
    if (!confirmAction || !selectedStage || isSaving) return

    setAlert({ type: 'loading', message: 'Saving commission release stage...' })
    onAction?.(commission, {
      action: confirmAction,
      releaseId: selectedStage.releaseId,
    })
    setConfirmAction(null)
    setSelectedStage(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4">
      <div className="my-2 flex w-full max-w-[1120px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
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

          {confirmAction && selectedStage ? (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                  <div>
                    <p className="text-sm font-black text-blue-900">Confirm Action</p>
                    <p className="mt-1 text-xs font-semibold text-blue-800">
                      Are you sure you want to {getActionLabel(confirmAction)} for {selectedStage.stage}?
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => { setConfirmAction(null); setSelectedStage(null); setAlert({ type: 'info', message: 'Action cancelled.' }) }} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50">No</button>
                  <button type="button" onClick={submitAction} disabled={isSaving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSaving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : null}
                    Yes, Continue
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <section>
            <h3 className="text-sm font-black text-slate-950">Commission Information</h3>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <InfoCard label="Seller" value={commission.seller || '-'} />
              <InfoCard label="Role" value={commission.role || '-'} />
              <InfoCard label="Seller Type" value={commission.sellerType || '-'} />
              <InfoCard label="Sale Type" value={commission.saleType || '-'} />
              <InfoCard label="Commission Base" value={money(commission.commissionBase)} />
              <InfoCard label="Rate" value={`${commission.rate || 0}%`} />
              <InfoCard label="Gross Commission" value={money(grossCommission)} />
              <InfoCard label="Released" value={money(released)} />
              <InfoCard label="Net Remaining" value={money(netRemaining)} />
              <InfoCard label="Cash Advance Deduction" value={money(commission.cashAdvanceDeduction)} />
              <InfoCard label="Seller Group" value={commission.sellerGroup || '-'} />
              <InfoCard label="Reports Under" value={commission.reportsUnder || '-'} />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-black text-slate-950">Property / Payment</h3>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <InfoCard label="Client" value={commission.client || '-'} />
              <InfoCard label="Unit" value={commission.unit || '-'} />
              <InfoCard label="Project" value={commission.project || '-'} />
              <InfoCard label="TCP" value={money(commission.tcp)} />
              <InfoCard label="Paid" value={money(commission.paid)} />
              <InfoCard label="Payment %" value={`${Number(commission.paymentPercent || 0).toFixed(2)}%`} />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-black text-slate-950">Main Release Milestones</h3>

            {!releaseDateInfo.isReleaseDate ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                Eligible commissions can only be released every {releaseDateInfo.releaseDays?.join(' and ') || '7 and 22'} of the month. Next release date: {releaseDateInfo.nextReleaseDate || '-'}.
              </div>
            ) : null}

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[920px] w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['Stage', 'Trigger %', 'Release %', 'Gross', 'Deduction', 'Net', 'Status', 'Actions'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-black text-slate-700">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {milestones.map((stage) => {
                    const isReleased = stage.status === 'Released'
                    const isOnHold = stage.status === 'On Hold'
                    const isCancelled = stage.status === 'Cancelled'

                    return (
                      <tr key={stage.id || stage.stage} className="align-top">
                        <td className="px-4 py-3 font-black text-slate-900">{stage.stage}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{stage.stage === 'Retention' ? '-' : `${Number(stage.triggerPercent || 0)}%`}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{Number(stage.releasePercent || 0)}%</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{money(stage.grossAmount)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{money(stage.deductionAmount)}</td>
                        <td className="px-4 py-3 font-black text-slate-900">{money(stage.netAmount)}</td>
                        <td className="px-4 py-3"><StatusPill status={stage.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {stage.status === 'Eligible' ? (
                              <button type="button" onClick={() => openConfirm('release_stage', stage)} disabled={isSaving || !stage.isReleaseDate} title={!stage.isReleaseDate ? 'Release is locked until the next allowed release date.' : undefined} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                {isSaving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiSave className="h-3.5 w-3.5" />}
                                {stage.releaseButtonLabel || 'Release'}
                              </button>
                            ) : null}

                            {!isReleased && !isOnHold && !isCancelled ? (
                              <button type="button" onClick={() => openConfirm('hold_stage', stage)} disabled={isSaving} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                <FiPauseCircle className="h-3.5 w-3.5" />
                                Hold
                              </button>
                            ) : null}

                            {isOnHold ? (
                              <button type="button" onClick={() => openConfirm('unhold_stage', stage)} disabled={isSaving} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                <FiPlayCircle className="h-3.5 w-3.5" />
                                Unhold
                              </button>
                            ) : null}

                            {!isReleased && !isCancelled ? (
                              <button type="button" onClick={() => openConfirm('cancel_stage', stage)} disabled={isSaving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[11px] font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {!milestones.length ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center font-semibold text-slate-500">
                        No release milestones found for this commission.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-black text-slate-950">Cash Advance Deductions</h3>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[720px] divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['Release Stage', 'Cash Advance', 'Amount', 'Remaining Balance', 'Created By', 'Date'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-black text-slate-700">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center font-black text-slate-700">
                      No cash advance deductions yet
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-3 py-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReleaseDetailsModal
