import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiKey, FiLock, FiMail } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPatch, useFetchPost } from '../../../utils/useFetch'

const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none disabled:bg-slate-100'
const DeactivateSystemUserModal = ({ user, onClose, onSaved }) => {
  const sellerConfirmation = user.role === 'sales_agent'
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [code, setCode] = useState('')
  const [alert, setAlert] = useState(null)
  const sendCodeMutation = useMutation({
    mutationFn: () => useFetchPost(`/user/deactivate/${user.id}/code`, { reason: reason.trim(), password }, { confirmationHandled: 'technical' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Sending verification code...' }),
    onSuccess: result => { setVerificationId(result?.data?.verificationId || null); setMaskedEmail(result?.data?.maskedEmail || ''); setPassword(''); setAlert({ type: 'success', message: 'Verification code sent.' }) },
    onError: error => setAlert({ type: 'error', message: error.message }),
  })
  const mutation = useMutation({
    mutationFn: () => useFetchPatch(`/user/deactivate/${user.id}`, {
      reason: reason.trim(), ...(sellerConfirmation ? { confirmDeactivation: true } : { verificationId, code }),
    }, { confirmationHandled: 'technical' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Deactivating account...' }),
    onSuccess: result => { onSaved?.(result.message || 'Account deactivated.'); onClose?.() },
    onError: error => setAlert({ type: 'error', message: error.message }),
  })
  const busy = sendCodeMutation.isPending || mutation.isPending
  const submit = event => {
    event.preventDefault()
    if (reason.trim().length < 5) return setAlert({ type: 'error', message: 'Enter a reason (at least 5 characters).' })
    if (sellerConfirmation) return mutation.mutate()
    if (!verificationId) {
      if (!password) return setAlert({ type: 'error', message: 'Enter your administrator password.' })
      return sendCodeMutation.mutate()
    }
    if (!/^\d{6}$/.test(code)) return setAlert({ type: 'error', message: 'Enter the 6-digit email code.' })
    mutation.mutate()
  }
  return <div role="dialog" aria-modal="true" aria-label="Deactivate Account" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
    <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
      <div className="border-b p-5"><h2 className="text-xl font-black">Deactivate {sellerConfirmation ? 'Sales Agent' : 'Account'}</h2><p className="mt-1 text-sm text-slate-500">{user.account_code || user.email}</p></div>
      <form onSubmit={submit} className="grid gap-5 p-5">
        {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950"><FiAlertTriangle className="mt-1 shrink-0" /><span>This prevents future reservations and ends the seller's active login sessions. Previous sales and commissions remain unchanged.</span></div>
        <label className="grid gap-1.5 text-sm font-bold">Deactivation Reason *<textarea required rows={3} maxLength={500} value={reason} disabled={Boolean(verificationId) || busy} onChange={event => setReason(event.target.value)} className="rounded-xl border border-slate-300 p-3 disabled:bg-slate-100" placeholder="Why deactivate this seller?" /></label>
        {!sellerConfirmation && (!verificationId ? <label className="grid gap-1.5"><span className="flex items-center gap-2 text-sm font-bold"><FiLock /> Administrator Password</span><input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className={inputClass} disabled={busy} /></label> : <label className="grid gap-1.5"><span className="flex items-center gap-2 text-sm font-bold"><FiMail /> Email Verification Code</span><input inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className={inputClass} disabled={busy} /><span className="text-xs text-slate-500">Sent to {maskedEmail || 'your email'}.</span></label>)}
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border px-5 font-bold">Cancel</button>
          <button type="submit" disabled={busy || reason.trim().length < 5} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 font-bold text-white disabled:opacity-50">{sellerConfirmation ? <FiCheckCircle /> : <FiKey />}{busy ? 'Working...' : sellerConfirmation ? 'Confirm Deactivation' : verificationId ? 'Deactivate Account' : 'Send Email Code'}</button>
        </div>
      </form>
    </div>
  </div>
}
export default DeactivateSystemUserModal

