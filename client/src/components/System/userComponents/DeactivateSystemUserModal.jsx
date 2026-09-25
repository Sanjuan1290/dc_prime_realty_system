import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPatch } from '../../../utils/useFetch'

const DeactivateSystemUserModal = ({ user, onClose, onSaved }) => {
  const [reason, setReason] = useState('')
  const [alert, setAlert] = useState(null)

  const mutation = useMutation({
    mutationFn: () => useFetchPatch(
      `/user/deactivate/${user.id}`,
      { status: 'inactive', reason: reason.trim() },
      { confirmationHandled: 'compact' }
    ),
    onMutate: () => setAlert({ type: 'loading', message: 'Permanently deactivating account...' }),
    onSuccess: (result) => {
      onSaved?.(result.message || 'Account permanently deactivated.')
      onClose?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const submit = (event) => {
    event.preventDefault()
    if (!reason.trim()) {
      setAlert({ type: 'error', message: 'Enter a deactivation reason for the historical record.' })
      return
    }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="border-b p-5">
          <h2 className="text-xl font-black">Deactivate Account</h2>
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
              onChange={(event) => setReason(event.target.value)}
              className="rounded-xl border p-3"
              placeholder="Why is this account being permanently deactivated?"
            />
          </label>
          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-bold">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="h-11 rounded-xl bg-red-600 px-5 font-black text-white disabled:opacity-50">Permanently Deactivate</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DeactivateSystemUserModal
