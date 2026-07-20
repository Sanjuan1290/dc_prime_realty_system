import { useMemo, useState } from 'react'
import { FiAlertCircle, FiLoader, FiPauseCircle, FiPlayCircle, FiSave, FiX } from 'react-icons/fi'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const statusLabel = (status) => ({
  Pending: 'Not Eligible',
  Eligible: 'Eligible',
  'Earned on Cancellation': 'Earned on Cancellation',
  'Forfeited on Cancellation': 'Forfeited on Cancellation',
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
    'Earned on Cancellation': 'border-violet-200 bg-violet-50 text-violet-700',
    'Forfeited on Cancellation': 'border-slate-300 bg-slate-100 text-slate-600',
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

const ModalNotice = ({ notice, onClose }) => {
  if (!notice) return null

  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    loading: 'border-slate-200 bg-slate-50 text-slate-900',
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${styles[notice.type] || styles.info}`}>
        <div className="flex items-start gap-3">
          {notice.type === 'loading' ? (
            <FiLoader className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          ) : (
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{notice.title || 'Commission notice'}</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed">{notice.message}</p>
          </div>
        </div>

        {notice.type !== 'loading' ? (
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={onClose} className="h-10 rounded-xl bg-white px-5 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50">
              OK
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const ConfirmDialog = ({ action, stage, isSaving, onCancel, onConfirm }) => {
  if (!action || !stage) return null

  const labels = {
    release_stage: 'release this stage',
    hold_stage: 'hold this stage',
    unhold_stage: 'unhold this stage',
    cancel_stage: 'cancel this stage',
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900 shadow-2xl">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Confirm Action</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed">
              Are you sure you want to {labels[action] || action} for {stage.stage}?
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
            No
          </button>

          <button type="button" onClick={onConfirm} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
            Yes, Continue
          </button>
        </div>
      </div>
    </div>
  )
}

const ReleaseDetailsModal = ({ commissionGroup, onClose, onAction, isSaving = false, serverNotice = null, onClearServerNotice }) => {
  const sellers = Array.isArray(commissionGroup?.sellers) ? commissionGroup.sellers : []
  const [selectedCommissionId, setSelectedCommissionId] = useState(() => String(sellers[0]?.commissionId || sellers[0]?.id || ''))
  const commission = sellers.find((seller) => String(seller.commissionId || seller.id) === selectedCommissionId) || sellers[0] || {}
  const grossCommission = Number(commission.grossCommission || commission.gross || 0)
  const released = Number(commission.released || 0)
  const netRemaining = Math.max(Number(commission.netRemaining ?? grossCommission - released), 0)
  const milestones = useMemo(() => commission.releaseMilestones || [], [commission.releaseMilestones])
  const releaseDateInfo = commission.releaseDateInfo || {}
  const retentionReady = Boolean(commission.retentionReady || (commission.paymentComplete && commission.documentsComplete))
  const retentionBlockedMessage = 'Retention can only be unheld when all required documents are complete and the account is fully paid.'
  const [confirmAction, setConfirmAction] = useState(null)
  const [selectedStage, setSelectedStage] = useState(null)
  const [notice, setNotice] = useState(null)
  const activeNotice = notice || serverNotice

  const changeSeller = (event) => {
    setSelectedCommissionId(event.target.value)
    setConfirmAction(null)
    setSelectedStage(null)
    setNotice(null)
    onClearServerNotice?.()
  }

  const openConfirm = (action, stage) => {
    if (!stage?.releaseId) {
      setNotice({ type: 'error', title: 'Missing release stage', message: 'This release stage is missing a database id. Refresh the page first.' })
      return
    }

    if (action === 'release_stage' && !stage.isReleaseDate) {
      setNotice({
        type: 'warning',
        title: 'Release date locked',
        message: `Eligible commissions can only be released every ${releaseDateInfo.releaseDays?.join(' and ') || '7 and 22'} of the month. Next release date: ${releaseDateInfo.nextReleaseDate || '-'}.`,
      })
      return
    }

    if (action === 'release_stage' && !['Eligible', 'Earned on Cancellation'].includes(stage.status)) {
      setNotice({ type: 'error', title: 'Not eligible', message: `${stage.stage} is not eligible for release yet.` })
      return
    }

    if (action === 'unhold_stage' && stage.stage === 'Retention' && !retentionReady) {
      setNotice({ type: 'warning', title: 'Retention locked', message: retentionBlockedMessage })
      return
    }

    setSelectedStage(stage)
    setConfirmAction(action)
  }

  const submitAction = () => {
    if (!confirmAction || !selectedStage || isSaving) return

    onAction?.(commission, {
      action: confirmAction,
      releaseId: selectedStage.releaseId,
    })
    setConfirmAction(null)
    setSelectedStage(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-0 sm:p-4">
      <div className="flex min-h-dvh w-full max-w-[1120px] flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl sm:my-2 sm:min-h-0 sm:rounded-xl">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-black text-slate-950">Commission Details</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {commissionGroup?.unit || '-'} · {commissionGroup?.client || '-'} · {sellers.length} recipient{sellers.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex w-full items-end gap-2 md:w-auto">
            <label className="min-w-0 flex-1 md:w-[360px] md:flex-none">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Commission Seller</span>
              <select
                value={selectedCommissionId}
                onChange={changeSeller}
                disabled={isSaving || sellers.length <= 1}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100 disabled:text-slate-500"
                aria-label="Select commission seller"
              >
                {sellers.map((seller) => (
                  <option key={seller.commissionId || seller.id} value={String(seller.commissionId || seller.id)}>
                    {seller.seller || 'Unnamed seller'} · {seller.role || '-'} · {seller.commissionType || '-'}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close commission details">
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-3">
          <section>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-sm font-black text-slate-950">Commission Information</h3><p className="text-xs font-semibold text-slate-500">Showing {commission.seller || 'selected seller'}</p></div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <InfoCard label="Seller" value={commission.seller || '-'} />
              <InfoCard label="Seller Email" value={commission.sellerEmail || '-'} />
              <InfoCard label="Seller Contact No." value={commission.sellerContactNo || '-'} />
              <InfoCard label="Role" value={commission.role || '-'} />
              <InfoCard label="Commission Type" value={commission.commissionType || commission.sellerType || '-'} />
              <InfoCard label="Commission Base" value={money(commission.commissionBase)} />
              <InfoCard label="Rate" value={`${commission.rate || 0}%`} />
              <InfoCard label="Gross Commission" value={money(grossCommission)} />
              <InfoCard label="Released" value={money(released)} />
              <InfoCard label="Net Remaining" value={money(netRemaining)} />
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

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[840px] w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['Stage', 'Trigger %', 'Release %', 'Gross', 'Net', 'Status', 'Actions'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-black text-slate-700">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {milestones.map((stage) => {
                    const isReleased = stage.status === 'Released'
                    const isOnHold = stage.status === 'On Hold'
                    const isCancelled = stage.status === 'Cancelled'
                    const isEarnedOnCancellation = stage.status === 'Earned on Cancellation'
                    const isForfeitedOnCancellation = stage.status === 'Forfeited on Cancellation'

                    return (
                      <tr key={stage.id || stage.stage} className="align-top">
                        <td className="px-4 py-3 font-black text-slate-900">{stage.stage}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{stage.stage === 'Retention' ? '-' : `${Number(stage.triggerPercent || 0)}%`}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{Number(stage.releasePercent || 0)}%</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{money(stage.grossAmount)}</td>
                        <td className="px-4 py-3 font-black text-slate-900">{money(stage.netAmount)}</td>
                        <td className="px-4 py-3"><StatusPill status={stage.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {['Eligible', 'Earned on Cancellation'].includes(stage.status) ? (
                              <button type="button" onClick={() => openConfirm('release_stage', stage)} disabled={isSaving} title={!stage.isReleaseDate ? 'Release is locked until the next allowed release date.' : undefined} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                {isSaving ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiSave className="h-3.5 w-3.5" />}
                                {stage.releaseButtonLabel || 'Release'}
                              </button>
                            ) : null}

                            {!isReleased && !isOnHold && !isCancelled && !isEarnedOnCancellation && !isForfeitedOnCancellation ? (
                              <button type="button" onClick={() => openConfirm('hold_stage', stage)} disabled={isSaving} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                <FiPauseCircle className="h-3.5 w-3.5" />
                                Hold
                              </button>
                            ) : null}

                            {isOnHold ? (
                              <button type="button" onClick={() => openConfirm('unhold_stage', stage)} disabled={isSaving} title={stage.stage === 'Retention' && !retentionReady ? retentionBlockedMessage : undefined} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                <FiPlayCircle className="h-3.5 w-3.5" />
                                Unhold
                              </button>
                            ) : null}

                            {!isReleased && !isCancelled && !isForfeitedOnCancellation ? (
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
                      <td colSpan={7} className="px-4 py-10 text-center font-semibold text-slate-500">
                        No release milestones found for this commission.
                      </td>
                    </tr>
                  ) : null}
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

      <ConfirmDialog
        action={confirmAction}
        stage={selectedStage}
        isSaving={isSaving}
        onCancel={() => {
          setConfirmAction(null)
          setSelectedStage(null)
        }}
        onConfirm={submitAction}
      />

      <ModalNotice notice={activeNotice} onClose={() => {
        if (notice) setNotice(null)
        else onClearServerNotice?.()
      }} />
    </div>
  )
}

export default ReleaseDetailsModal


