import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiKey, FiLock, FiMail, FiRotateCcw } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

const sellerRoles = new Set(['sales_agent', 'unit_manager', 'sales_director', 'division_manager'])
const ReactivateSystemUserModal = ({ user, onClose, onSaved }) => {
  const sellerConfirmation = sellerRoles.has(user.role)
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [verification, setVerification] = useState(null)
  const [alert, setAlert] = useState(null)
  const teamCheck = useQuery({
    queryKey: ['seller-activation-team-check', user.id],
    queryFn: () => useFetch(`/user/reactivate/${user.id}/team-check`),
    enabled: sellerConfirmation && Boolean(user.id), staleTime: 0,
  })
  const sendCode = useMutation({
    mutationFn: () => useFetchPost(`/user/reactivate/${user.id}/code`, { reason: reason.trim(), password }, { confirmationHandled: 'technical' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Sending verification code...' }),
    onSuccess: result => { setVerification(result?.data || null); setPassword(''); setAlert({ type: 'success', message: 'Check your administrator email for the code.' }) },
    onError: error => setAlert({ type: 'error', message: error.message }),
  })
  const activate = useMutation({
    mutationFn: () => useFetchPost(`/user/reactivate/${user.id}`, {
      reason: reason.trim(), ...(sellerConfirmation ? { confirmActivation: true } : { verificationId: verification?.verificationId, code }),
    }, { confirmationHandled: 'technical' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Activating account...' }),
    onSuccess: result => { onSaved?.(result.message || 'Account activated.'); onClose?.() },
    onError: error => setAlert({ type: 'error', message: error.message }),
  })
  const busy = sendCode.isPending || activate.isPending
  const submit = event => {
    event.preventDefault()
    if (reason.trim().length < 5) return setAlert({ type: 'error', message: 'Enter a reason (at least 5 characters).' })
    if (sellerConfirmation) {
      if (teamCheck.isPending || teamCheck.isError) return setAlert({ type: 'error', message: 'Seller and manager assignments must be complete. Check the seller team status before activating. Retry the check if it failed.' })
      return activate.mutate()
    }
    if (!verification) {
      if (!password) return setAlert({ type: 'error', message: 'Enter your administrator password.' })
      return sendCode.mutate()
    }
    if (!/^\d{6}$/.test(code)) return setAlert({ type: 'error', message: 'Enter the 6-digit email code.' })
    activate.mutate()
  }
  return <div role="dialog" aria-modal="true" aria-label="Activate Account" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="border-b p-5"><div className="flex items-center gap-2"><FiRotateCcw className="text-emerald-700" /><h2 className="text-xl font-bold">Activate {sellerConfirmation ? 'Seller' : 'Account'}</h2></div><p className="mt-1 text-sm text-slate-500">{user.account_code || user.email}</p></div>
      <form onSubmit={submit} className="grid gap-4 p-5">
        {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
        {sellerConfirmation ? <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><FiCheckCircle className="mt-0.5 shrink-0"/><span>Activation requires a valid upward reporting chain. Missing downstream team members are advisory and do not prevent activation.</span></div>
          {teamCheck.isPending ? <p role="status" className="text-sm text-slate-500">Checking team completeness…</p> : null}
          {teamCheck.isError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Could not check this team. <button type="button" onClick={() => teamCheck.refetch()} className="underline font-bold">Retry team check</button></div> : null}
          {teamCheck.data?.data?.warning ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><FiAlertTriangle className="mt-0.5 shrink-0"/><span><strong>Team completeness notice:</strong> {teamCheck.data.data.warning}</span></div> : null}
        </div> : null}
        <label className="grid gap-1 text-sm font-semibold">Reason for Activation *<textarea required rows={2} maxLength={500} disabled={busy || Boolean(verification)} value={reason} onChange={event => setReason(event.target.value)} placeholder="Why activate this account?" className="rounded-xl border border-slate-300 p-3 disabled:bg-slate-100" /></label>
        {!sellerConfirmation && (!verification ? <label className="grid gap-1 text-sm font-semibold"><span className="flex items-center gap-2"><FiLock /> Administrator Password</span><input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} className="h-11 rounded-xl border border-slate-300 px-3" required /></label> : <label className="grid gap-1 text-sm font-semibold"><span className="flex items-center gap-2"><FiMail /> Email Code</span><input inputMode="numeric" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-3 tracking-widest" placeholder="000000" required /><span className="text-xs font-normal text-slate-500">Sent to {verification.maskedEmail || 'your administrator email'}.</span></label>)}
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border px-4 font-semibold">Cancel</button><button type="submit" disabled={busy || reason.trim().length < 5 || (sellerConfirmation && (teamCheck.isPending || teamCheck.isError))} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white disabled:opacity-50">{sellerConfirmation ? <FiCheckCircle /> : <FiKey />}{busy ? 'Working...' : sellerConfirmation ? 'Confirm Activation' : verification ? 'Activate Account' : 'Send Email Code'}</button></div>
      </form>
    </div>
  </div>
}
export default ReactivateSystemUserModal

