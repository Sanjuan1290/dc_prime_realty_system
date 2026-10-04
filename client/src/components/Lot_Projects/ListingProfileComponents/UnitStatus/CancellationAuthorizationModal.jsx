import { useState } from 'react'
import { FiKey, FiLock, FiMail } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-50 disabled:bg-slate-100'

const labels = {
  settle_cancellation: 'Cancellation Settlement / Refund',
  void_unpaid_cancellation: 'Void Unpaid Cancellation',
  reset_to_available: 'Return Cancelled Unit to Available',
}

const CancellationAuthorizationModal = ({
  payload,
  onRequestCode,
  onConfirm,
  onClose,
  isSaving = false,
  isRequestingCode = false,
}) => {
  const [password, setPassword] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [code, setCode] = useState('')
  const [alert, setAlert] = useState(null)

  const action = payload?.statusTransitionAction || ''
  const actionLabel = labels[action] || 'Cancellation Action'
  const busy = isSaving || isRequestingCode

  const requestCode = async () => {
    if (!password) {
      setAlert({ type: 'error', message: 'Current account password is required.' })
      return
    }
    try {
      setAlert({ type: 'loading', message: 'Verifying password and sending email code...' })
      const result = await onRequestCode?.({ ...payload, password })
      setVerificationId(result?.data?.verificationId || null)
      setMaskedEmail(result?.data?.maskedEmail || '')
      setPassword('')
      setAlert({ type: 'success', message: result?.message || 'Verification code sent.' })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to send verification code.' })
    }
  }

  const confirm = async (event) => {
    event.preventDefault()
    if (!verificationId) {
      await requestCode()
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setAlert({ type: 'error', message: 'Enter the 6-digit email verification code.' })
      return
    }
    try {
      setAlert({ type: 'loading', message: `Authorizing ${actionLabel.toLowerCase()}...` })
      await onConfirm?.({ ...payload, verificationId, code: code.trim() })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Cancellation action failed.' })
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/65 p-4">
      <form onSubmit={confirm} className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Protected Authorization</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{actionLabel}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">This sensitive buyer/account action requires your current password and a one-time code sent to your account email.</p>
        </div>

        <div className="grid gap-5 p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold leading-6 text-orange-900">
            <strong>Review before authorizing.</strong><br />
            {action === 'reset_to_available'
              ? 'The cancelled buyer account will be closed and preserved in Account History, then the unit will return to Available.'
              : action === 'void_unpaid_cancellation'
                ? 'The unpaid reservation may be permanently removed if the server confirms there are no protected financial/file records.'
                : `Refund amount: ₱${Number(payload?.refundAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`}
          </div>

          {!verificationId ? (
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiLock /> Current Account Password *</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} disabled={busy} />
            </label>
          ) : (
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiMail /> Email Verification Code *</span>
              <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className={`${inputClass} tracking-[0.35em]`} disabled={busy} placeholder="000000" />
              <span className="text-xs font-semibold text-slate-500">Code sent to {maskedEmail || 'your account email'}.</span>
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-slate-300 bg-white px-5 font-black text-slate-700 disabled:opacity-50">Cancel</button>
            {!verificationId ? (
              <button type="button" onClick={requestCode} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 font-black text-white disabled:opacity-50"><FiKey />{isRequestingCode ? 'Sending Code...' : 'Verify Password & Send Code'}</button>
            ) : (
              <button type="submit" disabled={busy || code.trim().length !== 6} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 font-black text-white disabled:opacity-50"><FiLock />{isSaving ? 'Authorizing...' : 'Authorize Action'}</button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default CancellationAuthorizationModal
