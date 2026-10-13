import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiClock, FiFileText, FiUpload, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { parseBulkWorkbook } from '../../../utils/listingBulkExcel'

const BulkEditListingsModal = ({ project, projectSlug, onClose, onSaved }) => {
  const inputRef = useRef(null)
  const [filename, setFilename] = useState('')
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const historyQuery = useQuery({
    queryKey: ['listing-bulk-history', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listing-bulk/history`),
    enabled: showHistory,
  })
  const selectFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPreview(null); setRows([]); setError(''); setFilename('')
    try {
      const parsed = await parseBulkWorkbook(file, project.id ?? project.lot_project_id)
      setRows(parsed); setFilename(file.name)
    } catch (err) { setError(err?.message || 'Invalid Excel file.') }
  }
  const validate = async () => {
    if (!rows.length || busy) return
    setBusy(true); setError(''); setPreview(null)
    try {
      const data = await useFetchPost(`/projects/lot-projects/${projectSlug}/listing-bulk/validate`, { rows }, { confirmationHandled: 'technical' })
      setPreview(data)
    } catch (err) { setError(err?.message || 'Validation failed.') }
    finally { setBusy(false) }
  }
  const apply = async () => {
    if (!preview?.valid || !preview.changedCount || busy) return
    if (reason.trim().length < 5) { setError('Please enter a clear reason (at least 5 characters).'); return }
    setBusy(true); setError('')
    try {
      const result = await useFetchPost(`/projects/lot-projects/${projectSlug}/listing-bulk/apply`, { rows, filename, reason: reason.trim() }, { confirmationHandled: 'compact' })
      await onSaved(result)
    } catch (err) {
      setPreview(null)
      setError(err?.message || 'Bulk update could not be saved. Validate the workbook again.')
    } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Bulk Edit Listings" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-black">Bulk Edit Listings</h2><p className="text-sm text-slate-500">Upload the Editable Listings Template from Export Listings to apply survey and price corrections.</p></div><button type="button" aria-label="Close bulk editor" disabled={busy} onClick={onClose} className="p-2 text-slate-500"><FiX /></button></header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"><FiAlertTriangle className="shrink-0" />Sold, fully paid, cancellation and other protected unit corrections must use Edit Listing with the existing authorization workflow. Financial contract amounts are never modified here.</div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={inputRef} type="file" accept=".xlsx" onChange={selectFile} className="hidden" />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700"><FiUpload />Choose Edited Excel</button>
            <span className="text-sm font-semibold text-slate-600">{filename || 'No file selected'}</span>
            <button type="button" onClick={() => setShowHistory((value) => !value)} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold"><FiClock />{showHistory ? 'Hide History' : 'Update History'}</button>
          </div>
          {showHistory ? <section className="rounded-xl border border-slate-200 p-4"><h3 className="mb-2 font-black">Recent Bulk Adjustments</h3>{historyQuery.isLoading ? 'Loading history…' : (historyQuery.data?.data || []).length ? <div className="max-h-48 space-y-2 overflow-y-auto">{historyQuery.data.data.map((batch) => <div key={batch.batch_id} className="border-b border-slate-100 py-2 text-sm"><strong>Batch #{batch.batch_id}</strong> — {batch.changed_count} listing(s) — {batch.adjustment_reason} <span className="text-slate-500">({String(batch.created_at).slice(0, 10)})</span></div>)}</div> : <p className="text-sm text-slate-500">No batch history yet. The SQL migration must be applied before saving edits.</p>}</section> : null}
          {error ? <StatusAlert type="error" message={error} /> : null}
          {rows.length ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold"><FiFileText className="mr-2 inline" />{rows.length} spreadsheet rows loaded</span><button type="button" disabled={busy} onClick={validate} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy ? 'Validating…' : 'Validate & Preview'}</button></div> : null}
          {preview ? <section className="space-y-3">
            <div className="grid grid-cols-3 gap-2">{[['To Update', preview.changedCount], ['Unchanged', preview.unchangedCount], ['Errors', preview.errors.length]].map(([label, count]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-black">{count}</p></div>)}</div>
            {preview.errors?.length ? <div className="max-h-52 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3"><h3 className="font-black text-red-900">Validation failed. Nothing will be saved.</h3>{preview.errors.map((row, i) => <p key={`${row.listingId}-${i}`} className="mt-2 text-xs text-red-800">Excel row {row.excelRowNumber}, Unit {row.unitCode || row.listingId}: {(row.errors || []).join('; ')}</p>)}</div> : null}
            {preview.preview?.length > 200 ? <p className="text-xs text-slate-500">Showing the first 200 changes in the preview; all validated changes are included in the batch.</p> : null}
            {preview.preview?.length ? <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Unit ID</th><th className="p-3">Changed Values</th></tr></thead><tbody>{preview.preview.slice(0, 200).map((item) => <tr key={item.listingId} className="border-t border-slate-100"><td className="p-3 font-bold">{item.before.unitCode}{item.before.unitCode !== item.after.unitCode ? ` → ${item.after.unitCode}` : ''}</td><td className="p-3">{Object.entries(item.changes).map(([field, values]) => <p key={field} className="mb-1 text-xs"><strong>{field}:</strong> {String(values.before || '—')} → <strong>{String(values.after || '—')}</strong></p>)}</td></tr>)}</tbody></table></div> : null}
            {preview.valid && preview.changedCount ? <label className="block space-y-2"><span className="text-sm font-black">Reason for changes *</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={2} placeholder="Example: Updated survey measurements and project price schedule" className="w-full rounded-xl border border-slate-300 p-3 text-sm" /></label> : null}
            {preview.valid && !preview.changedCount ? <p className="text-sm font-semibold text-slate-600">No differences detected; no import is necessary.</p> : null}
          </section> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold">Cancel</button><button type="button" disabled={!preview?.valid || !preview?.changedCount || busy} onClick={apply} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"><FiCheckCircle />{busy ? 'Saving…' : `Confirm ${preview?.changedCount || 0} Listing Changes`}</button></footer>
      </div>
    </div>
  )
}
export default BulkEditListingsModal
