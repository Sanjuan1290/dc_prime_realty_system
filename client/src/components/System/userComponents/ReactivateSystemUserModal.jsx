import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FiRotateCcw, FiLock } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost } from '../../../utils/useFetch'

const ReactivateSystemUserModal = ({ user, onClose, onSaved }) => {
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState(null)

  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/user/reactivate/${user.id}`, { reason: reason.trim(), password }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Reactivating account...' }),
    onSuccess: (result) => { onSaved?.(result.message || 'Account reactivated.'); onClose?.() },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const submit = (event) => {
    event.preventDefault()
    if (reason.trim().length < 5) return setAlert({ type: 'error', message: 'Enter a clear reactivation reason.' })
    if (!password) return setAlert({ type: 'error', message: 'Administrator password is required.' })
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="border-b p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Owner Authorization</p>
          <h2 className="mt-1 text-xl font-black">Reactivate Account</h2>
          <p className="mt-1 text-sm text-slate-500">{user.account_code || user.email}</p>
        </div>
        <form onSubmit={submit} className="grid gap-5 p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            Reactivation restores login access to this existing account. If the person changed position, keep this account deactivated and create a new account for the new role instead.
          </div>
          <label className="grid gap-1.5 text-sm font-bold">
            Reactivation Reason *
            <textarea required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border border-slate-300 p-3" placeholder="Why should this account be reactivated?" />
          </label>
          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiLock /> Administrator Password *</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
          </label>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border px-5 font-bold">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 font-black text-white disabled:opacity-50"><FiRotateCcw />{mutation.isPending ? 'Reactivating...' : 'Reactivate Account'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ReactivateSystemUserModal

