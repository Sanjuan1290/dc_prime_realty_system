import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiRotateCcw, FiX } from 'react-icons/fi'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import StatusAlert from '../../Shared/StatusAlert'

const dateLabel = (value) => value
  ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

const NetworkMemberImportHistoryModal = ({ groupId, networkName, onClose, onUndone }) => {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const historyQuery = useQuery({
    queryKey: ['network-member-import-history', groupId],
    queryFn: () => useFetch(`/seller-groups/${groupId}/members/import/history`),
  })
  const history = historyQuery.data?.data || []

  const undo = async () => {
    if (!selected?.canUndo || confirmation.trim() !== `UNDO ${selected.batch_id}` || submitting) return
    setSubmitting(true)
    setError('')
    try {
      // The exact-batch text confirmation above is the compact review step.
      const result = await useFetchPost(`/seller-groups/${groupId}/members/import/${selected.batch_id}/undo`, {}, { confirmationHandled: 'compact' })
      await queryClient.invalidateQueries({ queryKey: ['network-member-import-history', groupId] })
      onUndone(result?.message || 'Import undone successfully.')
    } catch (err) {
      // The server checks again inside a transaction: a newly recorded sale
      // will block the operation even if the dialog was opened earlier.
      setError(err?.message || 'Unable to undo this import.')
      await queryClient.invalidateQueries({ queryKey: ['network-member-import-history', groupId] })
      setSelected(null)
      setConfirmation('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Network member import history">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Undo Member Import</h2>
            <p className="mt-1 text-sm text-slate-500">{networkName} · Undo an entire Excel import batch.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Undo is allowed only if <strong>none of the members in that import</strong> has any recorded sale or commission history. Existing members are restored to their pre-import state. Any later changes or dependent records also block undo.
          </p>
          {historyQuery.isPending && <StatusAlert type="loading" message="Checking import history and member sales..." />}
          {historyQuery.isError && <StatusAlert type="error" message={historyQuery.error?.message || 'Could not load import history.'} />}
          {!historyQuery.isPending && !historyQuery.isError && !history.length && (
            <p className="rounded-xl border border-slate-200 p-5 text-sm text-slate-500">No tracked member imports yet. Only imports performed after the undo-history database migration can be safely reversed.</p>
          )}
          {history.map((batch) => (
            <div key={batch.batch_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Import #{batch.batch_id} · {batch.member_count} member{Number(batch.member_count) === 1 ? '' : 's'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{dateLabel(batch.imported_at)}</p>
                </div>
                {batch.status === 'undone' ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600"><FiCheckCircle /> Undone</span>
                ) : batch.canUndo ? (
                  <button type="button" onClick={() => { setSelected(batch); setConfirmation(''); setError('') }} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"><FiRotateCcw /> Undo Import</button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800"><FiAlertTriangle /> Undo unavailable</span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-600">{batch.members?.map((member) => member.email).join(', ')}</p>
              {batch.status !== 'undone' && !batch.canUndo && <p className="mt-2 text-sm text-amber-800">{batch.reason}</p>}
              {batch.status === 'undone' && <p className="mt-1 text-xs text-slate-500">Undone on {dateLabel(batch.undone_at)}</p>}
            </div>
          ))}
          {error && <StatusAlert type="error" message={error} />}
        </div>
        {selected && (
          <div className="border-t border-slate-200 bg-slate-50 p-5">
            <p className="font-semibold text-slate-900">Confirm undo of import #{selected.batch_id}?</p>
            <p className="mt-1 text-sm text-slate-600">All {selected.member_count} members from this batch will be reverted together. This cannot be undone again.</p>
            <label htmlFor="undo-import-confirm" className="mt-3 block text-sm font-medium text-slate-700">Type <strong>UNDO {selected.batch_id}</strong> to confirm</label>
            <input id="undo-import-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-400 focus:outline-none" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => { setSelected(null); setConfirmation('') }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" disabled={submitting || confirmation.trim() !== `UNDO ${selected.batch_id}`} onClick={undo} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Checking & undoing...' : 'Confirm Undo Import'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NetworkMemberImportHistoryModal

