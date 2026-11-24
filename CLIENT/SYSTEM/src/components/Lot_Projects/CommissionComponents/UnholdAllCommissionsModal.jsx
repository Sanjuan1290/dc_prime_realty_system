import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useFetchPost as postJson } from '../../../utils/useFetch'
import { getReleaseAllRecipients } from './ReleaseAllCommissionsModal'
import { unholdAllBlockedReason } from './unholdAllEligibility'
import StatusAlert from '../../Shared/StatusAlert'

export default function UnholdAllCommissionsModal({ profit, sellers, stage, projectSlug, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const recipients = getReleaseAllRecipients(profit, sellers, stage.stage)
  const heldCount = recipients.filter(row => row.stage?.status === 'On Hold').length
  const blocked = unholdAllBlockedReason(profit, sellers, recipients)
  const mutation = useMutation({
    mutationFn: () => postJson(`/projects/lot-projects/${projectSlug}/network-company-profit/${profit.id}/unhold-all`, {
      stage: stage.stage,
      confirmUnholdAll: true,
      recipients: recipients.map(row => ({ type: row.type, commissionId: row.commissionId })),
    }, { confirmationHandled: 'compact' }),
    onSuccess: async result => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['network-company-profit', projectSlug] }),
        queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] }),
      ])
      onSuccess?.(result)
      onClose()
    },
    onError: err => setError(err?.message || 'Could not remove the holds. Refresh and try again.'),
  })
  return <div role="dialog" aria-modal="true" aria-label="Review all commission holds" className="fixed inset-0 z-[96] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4">
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
      <h3 className="text-lg font-black text-slate-950">Unhold All — {stage.stage}</h3>
      <p className="mt-1 text-sm font-semibold text-slate-500">{profit.unit} · {profit.network}</p>
      <p className="mt-3 text-sm text-slate-700">Remove {heldCount} hold(s) for this milestone after confirming 100% payment and completion of all required documents. Payouts require a separate release on a scheduled release day.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="p-3">Recipient</th><th className="p-3">Current status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{recipients.map(row => <tr key={row.key}>
            <td className="p-3 font-semibold">{row.name}<p className="text-xs text-slate-500">{row.role}</p></td>
            <td className="p-3">{row.stage?.status === 'Released' ? 'Completed' : row.stage?.status || 'Missing'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {blocked || error ? <StatusAlert className="mt-4" type={error ? 'error' : 'warning'} message={error || blocked} /> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
        <button type="button" disabled={mutation.isPending || Boolean(blocked)} onClick={() => mutation.mutate()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Removing holds...' : 'Unhold All'}</button>
      </div>
    </div>
  </div>
}
