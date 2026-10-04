import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FiKey, FiLock, FiMail } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPatch, useFetchPost } from '../../../utils/useFetch'

const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50 disabled:bg-slate-100'

const DeactivateSystemUserModal = ({ user, onClose, onSaved }) => {
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [code, setCode] = useState('')
  const [alert, setAlert] = useState(null)

  const sendCodeMutation = useMutation({
    mutationFn: () => useFetchPost(
      `/user/deactivate/${user.id}/code`,
      { reason: reason.trim(), password },
      { confirmationHandled: 'technical' }
    ),
    onMutate: () => setAlert({ type: 'loading', message: 'Verifying administrator password and sending email code...' }),
    onSuccess: (result) => {
      setVerificationId(result?.data?.verificationId || null)
      setMaskedEmail(result?.data?.maskedEmail || '')
      setPassword('')
      setAlert({ type: 'success', message: result?.message || 'Verification code sent.' })
    },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const mutation = useMutation({
    mutationFn: () => useFetchPatch(
      `/user/deactivate/${user.id}`,
      {
        status: 'inactive',
        reason: reason.trim(),
        verificationId,
        code: code.trim(),
      },
      { confirmationHandled: 'compact' }
    ),
    onMutate: () => setAlert({ type: 'loading', message: 'Permanently deactivating account...' }),
    onSuccess: (result) => {
      onSaved?.(result.message || 'Account permanently deactivated.')
      onClose?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const requestCode = () => {
    if (reason.trim().length < 5) {
      setAlert({ type: 'error', message: 'Enter a clear deactivation reason for the historical record.' })
      return
    }
    if (!password) {
      setAlert({ type: 'error', message: 'Administrator password is required.' })
      return
    }
    sendCodeMutation.mutate()
  }

  const submit = (event) => {
    event.preventDefault()
    if (!verificationId) {
      requestCode()
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setAlert({ type: 'error', message: 'Enter the 6-digit email verification code.' })
      return
    }
    mutation.mutate()
  }

  const busy = sendCodeMutation.isPending || mutation.isPending

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="border-b p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Protected Authorization</p>
          <h2 className="mt-1 text-xl font-black">Deactivate Account</h2>
          <p className="mt-1 text-sm text-slate-500">{user.account_code || user.email}</p>
        </div>
        <form onSubmit={submit} className="grid gap-5 p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-900">
            <strong>This action is permanent.</strong><br />
            This account can never be activated again.<br />
            If the employee changes position or returns later, create a new account.
          </div>

          <label className="grid gap-1.5 text-sm font-bold">
            Deactivation Reason *
            <textarea
              required
              rows={4}
              value={reason}
              disabled={Boolean(verificationId) || busy}
              onChange={(event) => setReason(event.target.value)}
              className="rounded-xl border border-slate-300 p-3 disabled:bg-slate-100"
              placeholder="Why is this account being permanently deactivated?"
            />
          </label>

          {!verificationId ? (
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiLock /> Administrator Password *</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                placeholder="Enter your current administrator password"
                disabled={busy}
              />
              <span className="text-xs font-semibold text-slate-500">Your password is verified before an authorization code is sent to your administrator email.</span>
            </label>
          ) : (
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiMail /> Email Verification Code *</span>
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className={`${inputClass} tracking-[0.35em]`}
                placeholder="000000"
                disabled={busy}
              />
              <span className="text-xs font-semibold text-slate-500">Code sent to {maskedEmail || 'your administrator email'}.</span>
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border px-5 font-bold disabled:opacity-50">Cancel</button>
            {!verificationId ? (
              <button type="button" onClick={requestCode} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 font-black text-white disabled:opacity-50">
                <FiKey /> {sendCodeMutation.isPending ? 'Sending Code...' : 'Verify Password & Send Code'}
              </button>
            ) : (
              <button type="submit" disabled={busy || code.trim().length !== 6} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 font-black text-white disabled:opacity-50">
                <FiLock /> {mutation.isPending ? 'Deactivating...' : 'Permanently Deactivate'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default DeactivateSystemUserModal
