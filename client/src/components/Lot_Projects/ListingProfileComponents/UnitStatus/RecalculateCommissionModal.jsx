import { useMemo, useState } from 'react'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiKey,
  FiLoader,
  FiLock,
  FiMail,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import CommissionDistribution from './CommissionDistribution'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const roundRate = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

const RecalculateCommissionModal = ({
  listing,
  commissionState = {},
  isRequestingCode = false,
  isSaving = false,
  onClose,
  onRequestCode,
  onConfirm,
}) => {
  const currentHierarchy = useMemo(
    () => (Array.isArray(commissionState.currentHierarchy) ? commissionState.currentHierarchy : []),
    [commissionState.currentHierarchy]
  )
  const initialGroupRate = useMemo(
    () => Number(commissionState.groupRate || roundRate(currentHierarchy.reduce((sum, row) => sum + Number(row.rate || 0), 0))),
    [commissionState.groupRate, currentHierarchy]
  )
  const [groupRate, setGroupRate] = useState(initialGroupRate ? String(initialGroupRate) : '')
  const [rates, setRates] = useState(() => Object.fromEntries(
    currentHierarchy.map((row) => [String(row.commissionId), String(Number(row.rate || 0))])
  ))
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [requestData, setRequestData] = useState(null)
  const [code, setCode] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [notice, setNotice] = useState(null)

  const unitId = listing?.unit_id || listing?.unitCode || '-'
  const isAllowed = Boolean(commissionState.allowed)
  const busy = isRequestingCode || isSaving
  const numericGroupRate = Number(groupRate)
  const proposalRows = useMemo(() => currentHierarchy.map((row) => {
    const rate = Number(rates[String(row.commissionId)] || 0)
    const commissionBase = Number(row.commissionBase || commissionState.commissionBase || currentHierarchy.find((item) => Number(item.commissionBase || 0) > 0)?.commissionBase || 0)
    return {
      ...row,
      rate,
      grossCommission: commissionBase > 0 ? commissionBase * (rate / 100) : 0,
    }
  }), [commissionState.commissionBase, currentHierarchy, rates])
  const allocatedRate = roundRate(proposalRows.reduce((sum, row) => sum + Number(row.rate || 0), 0))
  const difference = roundRate(numericGroupRate - allocatedRate)
  const unallocatedRate = Math.max(difference, 0)
  const overallocatedRate = Math.max(-difference, 0)

  const validationMessage = useMemo(() => {
    if (!isAllowed) return commissionState.reason || 'This commission cannot be adjusted.'
    if (!currentHierarchy.length) return 'No saved commission recipients are available for adjustment.'
    if (!Number.isFinite(numericGroupRate) || numericGroupRate < 6 || numericGroupRate > 15) {
      return 'Unit Group Rate must be between 6.00% and 15.00%.'
    }
    for (const row of proposalRows) {
      if (!Number.isFinite(row.rate) || row.rate <= 0) return `${row.roleLabel || row.role} rate must be greater than 0%.`
      if (row.rate > numericGroupRate + 0.0001) return `${row.roleLabel || row.role} rate cannot be greater than the Unit Group Rate.`
    }
    if (unallocatedRate > 0.0001) return `Allocate the remaining ${unallocatedRate.toFixed(2)}% before saving. Unallocated must be 0.00%.`
    if (overallocatedRate > 0.0001) return `Allocated commission exceeds the Unit Group Rate by ${overallocatedRate.toFixed(2)}%.`
    if (reason.trim().length < 10) return 'Enter an adjustment reason with at least 10 characters.'
    return ''
  }, [isAllowed, commissionState.reason, currentHierarchy.length, numericGroupRate, proposalRows, reason, unallocatedRate, overallocatedRate])

  const adjustmentPayload = () => ({
    groupRate: roundRate(numericGroupRate),
    rates: proposalRows.map((row) => ({ commissionId: Number(row.commissionId), rate: roundRate(row.rate) })),
    reason: reason.trim(),
  })

  const requestCode = async (event) => {
    event.preventDefault()
    if (validationMessage) return setNotice({ type: 'warning', message: validationMessage })
    if (!password) return setNotice({ type: 'warning', message: 'Enter the current Super Admin password.' })

    setNotice({ type: 'loading', message: 'Verifying password and sending the email verification code...' })
    try {
      const result = await onRequestCode?.({ ...adjustmentPayload(), password })
      setRequestData(result?.data || null)
      setPassword('')
      setNotice({ type: 'success', message: result?.message || 'Verification code sent.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to request the verification code.' })
    }
  }

  const confirmAdjustment = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) return setNotice({ type: 'warning', message: 'Enter the six-digit email verification code.' })
    if (!confirmed) return setNotice({ type: 'warning', message: 'Confirm that you reviewed the final commission distribution.' })

    setNotice({ type: 'loading', message: `Applying the unit commission adjustment for ${unitId}...` })
    try {
      await onConfirm?.({
        ...adjustmentPayload(),
        verificationId: requestData?.verificationId,
        code,
      })
      onClose?.()
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to adjust the unit commission.' })
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form
        onSubmit={requestData ? confirmAdjustment : requestCode}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FiEdit3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-950">Adjust Unit Commission</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Change the saved rates for {unitId} only. Group Settings and other reservations are not changed.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50" aria-label="Close commission adjustment">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}

          <StatusAlert
            type={isAllowed ? (commissionState.hasInvalidSnapshot ? 'warning' : 'success') : 'warning'}
            title={isAllowed ? (commissionState.hasInvalidSnapshot ? 'Saved commission needs correction' : 'Unit adjustment available') : 'Unit adjustment locked'}
            message={commissionState.hasInvalidSnapshot
              ? 'The saved commission contains a zero or invalid amount. Review every rate carefully before applying the correction.'
              : commissionState.reason || 'Commission release status could not be verified.'}
          />

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Unit</p><p className="mt-1 text-sm font-black text-slate-950">{unitId}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Assigned Seller</p><p className="mt-1 text-sm font-black text-slate-950">{listing?.seller || '-'}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Saved Recipients</p><p className="mt-1 text-sm font-black text-slate-950">{currentHierarchy.length}</p></div>
          </section>

          <CommissionDistribution
            rows={currentHierarchy}
            title="Current Saved Commission Distribution"
            description="This is the reservation snapshot currently saved for this buyer account."
          />

          {!requestData ? (
            <>
              <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-950">Proposed Unit Commission</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-600">The Unit Group Rate is editable, but the final role allocation must equal it exactly.</p>
                  </div>
                  <label className="mt-3 sm:mt-0">
                    <span className="mb-1 block text-xs font-black text-slate-700">Unit Group Rate *</span>
                    <div className="relative w-full sm:w-44">
                      <input type="number" min="6" max="15" step="0.01" value={groupRate} onChange={(event) => { setGroupRate(event.target.value); setNotice(null) }} disabled={busy} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-9 text-right text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-black text-slate-500">%</span>
                    </div>
                  </label>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                      <tr><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Role</th><th className="px-4 py-3 text-right">Current Rate</th><th className="px-4 py-3 text-right">New Rate</th><th className="px-4 py-3 text-right">New Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proposalRows.map((row) => (
                        <tr key={row.commissionId}>
                          <td className="px-4 py-3 font-bold text-slate-900">{row.sellerName || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{row.roleLabel || row.role}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-600">{Number(currentHierarchy.find((item) => item.commissionId === row.commissionId)?.rate || 0).toFixed(2)}%</td>
                          <td className="px-4 py-3">
                            <div className="relative ml-auto w-36">
                              <input type="number" min="0.01" max={Number.isFinite(numericGroupRate) ? numericGroupRate : 15} step="0.01" value={rates[String(row.commissionId)] ?? ''} onChange={(event) => { setRates((current) => ({ ...current, [String(row.commissionId)]: event.target.value })); setNotice(null) }} disabled={busy} className="h-10 w-full rounded-xl border border-slate-300 px-3 pr-8 text-right font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-black text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-950">{money(row.grossCommission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-blue-200 bg-white p-3"><p className="text-[10px] font-black uppercase text-slate-500">Unit Group Rate</p><p className="mt-1 text-lg font-black text-blue-800">{Number.isFinite(numericGroupRate) ? numericGroupRate.toFixed(2) : '0.00'}%</p></div>
                  <div className="rounded-xl border border-emerald-200 bg-white p-3"><p className="text-[10px] font-black uppercase text-slate-500">Allocated</p><p className="mt-1 text-lg font-black text-emerald-800">{allocatedRate.toFixed(2)}%</p></div>
                  <div className={`rounded-xl border bg-white p-3 ${Math.abs(difference) <= 0.0001 ? 'border-emerald-200' : 'border-amber-300'}`}><p className="text-[10px] font-black uppercase text-slate-500">Unallocated / Over</p><p className={`mt-1 text-lg font-black ${Math.abs(difference) <= 0.0001 ? 'text-emerald-800' : 'text-amber-800'}`}>{unallocatedRate > 0 ? `${unallocatedRate.toFixed(2)}% unallocated` : overallocatedRate > 0 ? `${overallocatedRate.toFixed(2)}% over` : '0.00%'}</p></div>
                </div>

                {Math.abs(difference) > 0.0001 ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    <FiAlertTriangle className="mr-2 inline" />The final saved distribution must have Allocated = Unit Group Rate and Unallocated = 0.00%.
                  </div>
                ) : null}
              </section>

              <label className="block rounded-2xl border border-slate-200 p-4">
                <span className="block text-sm font-black text-slate-900">Adjustment Reason *</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">Explain the promo, event rate, or correction for this specific reservation.</span>
                <textarea rows={3} value={reason} onChange={(event) => { setReason(event.target.value); setNotice(null) }} disabled={busy} placeholder="Example: Special project event commission approved for this reservation." className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </label>

              <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><FiLock className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="commission-adjustment-password" className="block text-sm font-black text-slate-900">Super Admin Password <span className="text-red-500">*</span></label>
                    <p className="mt-1 text-xs font-semibold text-slate-600">Password verification is required before the six-digit email code is sent.</p>
                    <div className="relative mt-3">
                      <input id="commission-adjustment-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setNotice(null) }} disabled={busy} autoComplete="current-password" placeholder="Enter Super Admin password" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-12 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                      <button type="button" onClick={() => setShowPassword((current) => !current)} disabled={busy} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <FiEyeOff /> : <FiEye />}</button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                <FiMail className="mr-2 inline" />A six-digit code was sent to <strong>{requestData.maskedEmail}</strong>. It expires in {requestData.expiresInMinutes} minutes. The verified rates are now locked; choose Start Over to edit them.
              </div>

              <CommissionDistribution
                rows={requestData.after || proposalRows}
                title="Final Commission Distribution"
                description={`Unit Group Rate ${Number(requestData.groupRate || numericGroupRate || 0).toFixed(2)}% · Allocated ${Number(requestData.allocatedRate || allocatedRate || 0).toFixed(2)}% · Unallocated 0.00%`}
              />

              <label className="block rounded-2xl border border-slate-200 p-4">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-black text-slate-700"><FiKey /> Email Verification Code *</span>
                <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setNotice(null) }} disabled={busy} placeholder="000000" className="h-14 w-full rounded-xl border border-slate-300 px-4 text-center font-mono text-2xl font-black tracking-[0.4em] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <input type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setNotice(null) }} disabled={busy} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span><span className="block text-sm font-black text-slate-900">I reviewed the final rates and amounts for this buyer account.</span><span className="mt-1 block text-xs font-semibold text-slate-500">This does not change the In-House/External Group default rate. Existing released commission activity is never modified.</span></span>
              </label>
            </>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={requestData ? () => { setRequestData(null); setCode(''); setConfirmed(false); setNotice(null) } : onClose} disabled={busy} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">{requestData ? 'Start Over' : 'Close'}</button>
          {!requestData ? (
            <button type="submit" disabled={busy || Boolean(validationMessage) || !password} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
              {isRequestingCode ? <FiLoader className="animate-spin" /> : <FiMail />} {isRequestingCode ? 'Sending Code...' : 'Verify Password & Send Code'}
            </button>
          ) : (
            <button type="submit" disabled={busy || code.length !== 6 || !confirmed} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300">
              {isSaving ? <FiLoader className="animate-spin" /> : <FiCheckCircle />} {isSaving ? 'Applying...' : 'Apply Unit Commission'}
            </button>
          )}
        </footer>
      </form>
    </div>
  )
}

export default RecalculateCommissionModal
