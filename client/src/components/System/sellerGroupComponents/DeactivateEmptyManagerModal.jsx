import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FiAlertTriangle } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost } from '../../../utils/useFetch'

const DeactivateEmptyManagerModal = ({ groupId, manager, networkHeadAssigned, onClose, onSaved }) => {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [alert, setAlert] = useState(null)
  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/seller-groups/${groupId}/managers/${manager.user_id}/deactivate-empty`, {
      reason: reason.trim(), confirmDeactivation: true,
    }, { confirmationHandled: 'technical' }),
    onSuccess: result => { onSaved?.(result?.message || 'Manager deactivated.'); onClose?.() },
    onError: error => setAlert({ type: 'error', message: error.message }),
  })
  const name = manager.display_name || manager.full_name || manager.account_code || 'this manager'
  const position = { division_manager: 'Division Manager', sales_director: 'Sales Director', unit_manager: 'Unit Manager' }[manager.role] || 'Manager'
  return <div role="dialog" aria-modal="true" aria-label="Deactivate Empty Manager"
    className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4">
    <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="border-b p-5">
        <h2 className="text-xl font-bold text-slate-900">Deactivate {position}</h2>
        <p className="mt-1 text-sm text-slate-600">{name}</p>
      </div>
      <form onSubmit={event => {event.preventDefault();if(confirmed && reason.trim().length>=5) mutation.mutate()}} className="space-y-4 p-5">
        {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
        <p className="text-sm text-slate-700">This action is only available when there are no assigned sellers, including inactive accounts. The server checks again before saving.</p>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><FiAlertTriangle className="mr-2 inline" />Deactivation blocks this account from logging in. Other teams, existing reservations, and commission history remain unchanged.</p>
        {!networkHeadAssigned ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">This Network has no valid Network Head. Deactivation will not fix reservation availability. Assign an active Division Manager as Network Head separately.</p> : null}
        <label className="block text-sm font-semibold">Reason for deactivation *
          <textarea required rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={mutation.isPending} placeholder="Explain why this manager account should be inactive" className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={mutation.isPending} className="mt-1" />
          <span>I confirm that I want to deactivate this {position} and that the account can no longer log in.</span>
        </label>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border px-4 py-2 font-semibold">Cancel</button>
          <button type="submit" disabled={mutation.isPending || !confirmed || reason.trim().length<5} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{mutation.isPending ? 'Deactivating…' : 'Deactivate Account'}</button>
        </div>
      </form>
    </div>
  </div>
}
export default DeactivateEmptyManagerModal
