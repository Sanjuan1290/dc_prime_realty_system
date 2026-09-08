import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheckSquare, FiRotateCcw, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../../utils/useFetch'

const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-PH') : '-'

const ListingImportHistoryModal = ({ projectSlug, onClose }) => {
  const queryClient = useQueryClient()
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [selectedListingIds, setSelectedListingIds] = useState([])
  const [reason, setReason] = useState('')
  const [alert, setAlert] = useState(null)

  const historyQuery = useQuery({
    queryKey: ['listing-import-history', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listing-imports`),
    enabled: Boolean(projectSlug),
  })
  const batchQuery = useQuery({
    queryKey: ['listing-import-batch', projectSlug, selectedBatchId],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listing-imports/${selectedBatchId}`),
    enabled: Boolean(projectSlug && selectedBatchId),
  })

  useEffect(() => { setSelectedListingIds([]); setReason('') }, [selectedBatchId])

  const batches = historyQuery.data?.data || []
  const batch = batchQuery.data?.data?.batch || null
  const rows = batchQuery.data?.data?.rows || []
  const importedRows = useMemo(() => rows.filter((row) => row.validation_status === 'imported' && row.lot_project_listing_id), [rows])

  const revertMutation = useMutation({
    mutationFn: ({ mode, listingIds = [] }) => useFetchPost(`/projects/lot-projects/${projectSlug}/listing-imports/${selectedBatchId}/revert`, {
      mode,
      listingIds,
      reason,
    }, {
      doubleCheck: {
        type: 'listing-import-reversal',
        title: mode === 'all' ? 'Review Full Import Reversal' : 'Review Imported Listing Removal',
        confirmLabel: mode === 'all' ? 'Confirm & Undo Entire Import' : 'Confirm & Remove Listings',
        data: { batchReference: batch?.batch_reference, filename: batch?.original_filename, mode, listingCount: mode === 'selected' ? listingIds.length : importedRows.length, reason },
      },
    }),
    onMutate: () => setAlert({ type: 'loading', message: 'Checking imported listings and preparing the reversal...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Import history updated.' })
      setSelectedListingIds([])
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['listing-import-history', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['listing-import-batch', projectSlug, selectedBatchId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      const blocked = error?.data?.protectedListings || error?.protectedListings || []
      setAlert({ type: 'error', message: blocked.length ? `${error.message} Blocked: ${blocked.slice(0, 5).map((item) => `${item.unitCode} (${item.reasons?.join(', ')})`).join('; ')}` : (error?.message || 'Import reversal failed.') })
    },
  })

  const toggleListing = (listingId) => {
    const id = Number(listingId)
    setSelectedListingIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const canReverse = reason.trim().length > 0 && !revertMutation.isPending

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><h2 className="text-xl font-black text-slate-950">Listing Import History</h2><p className="mt-1 text-sm font-semibold text-slate-500">Review each Excel upload, inspect its rows, and safely undo imports that have no protected buyer activity.</p></div>
          <button type="button" onClick={onClose} disabled={revertMutation.isPending} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX className="h-5 w-5" /></button>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]">
          <aside className="overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
            {historyQuery.isLoading ? <StatusAlert type="loading" message="Loading import history..." /> : null}
            <div className="grid gap-2">
              {batches.map((item) => <button key={item.lot_project_listing_import_batch_id} type="button" onClick={() => setSelectedBatchId(item.lot_project_listing_import_batch_id)} className={`rounded-2xl border p-4 text-left transition ${Number(selectedBatchId) === Number(item.lot_project_listing_import_batch_id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2"><p className="font-black text-slate-950">{item.batch_reference}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{String(item.import_status || '').replaceAll('_', ' ')}</span></div>
                <p className="mt-1 truncate text-xs font-semibold text-slate-600">{item.original_filename}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Imported {item.imported_rows || 0} · Removed {item.removed_rows || 0}<br />{formatDateTime(item.imported_at || item.created_at)}</p>
              </button>)}
              {!historyQuery.isLoading && !batches.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">No Excel imports yet.</p> : null}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-5">
            {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
            {!selectedBatchId ? <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">Select an import batch to inspect it.</div> : null}
            {selectedBatchId && batchQuery.isLoading ? <StatusAlert type="loading" message="Loading import batch..." /> : null}
            {batch ? <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase text-blue-700">{batch.batch_reference}</p><h3 className="mt-1 text-lg font-black text-slate-950">{batch.original_filename}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Imported {batch.imported_rows || 0} · Currently remaining {importedRows.length}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">{String(batch.import_status || '').replaceAll('_', ' ')}</span></div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="max-h-[380px] overflow-auto">
                  <table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="px-3 py-3 text-left"><FiCheckSquare /></th>{['Excel Row','Unit','Status','Import Row State'].map((head) => <th key={head} className="px-3 py-3 text-left text-xs font-black uppercase text-slate-600">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const active = row.validation_status === 'imported' && row.lot_project_listing_id
                      return <tr key={row.lot_project_listing_import_row_id}><td className="px-3 py-3"><input type="checkbox" disabled={!active} checked={active && selectedListingIds.includes(Number(row.lot_project_listing_id))} onChange={() => toggleListing(row.lot_project_listing_id)} /></td><td className="px-3 py-3">{row.excel_row_number}</td><td className="px-3 py-3 font-black">{row.unit_id_snapshot}</td><td className="px-3 py-3">{row.lot_project_listing_status || (active ? 'Unknown' : '-')}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.validation_status}</span></td></tr>
                    })}
                  </tbody></table>
                </div>
              </div>

              {importedRows.length ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                <label className="grid gap-2"><span className="text-xs font-black uppercase text-red-700">Reason for removal / undo *</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={1000} placeholder="Example: Wrong project inventory file was uploaded." className="rounded-xl border border-red-200 bg-white p-3 text-sm font-semibold outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100" /></label>
                <p className="mt-2 text-xs font-semibold text-red-700">Full Undo and Remove Selected are all-or-nothing. If any targeted unit has buyer/account activity or a changed status, nothing in that action is deleted. Safe-only removal is a separate explicit action.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={!canReverse} onClick={() => revertMutation.mutate({ mode: 'all' })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white disabled:bg-red-300"><FiRotateCcw />Undo Entire Import</button>
                  <button type="button" disabled={!canReverse} onClick={() => revertMutation.mutate({ mode: 'safe_only' })} className="h-10 rounded-xl border border-red-300 bg-white px-4 text-sm font-black text-red-700 disabled:opacity-50">Remove Safe Listings Only</button>
                  <button type="button" disabled={!canReverse || !selectedListingIds.length} onClick={() => revertMutation.mutate({ mode: 'selected', listingIds: selectedListingIds })} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50">Remove Selected ({selectedListingIds.length})</button>
                </div>
              </div> : null}
            </> : null}
          </section>
        </div>
        <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={onClose} disabled={revertMutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Close</button></footer>
      </div>
    </div>
  )
}

export default ListingImportHistoryModal
