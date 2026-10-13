import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCheckCircle, FiClock, FiFileText, FiUpload, FiArrowLeft } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { parseBulkWorkbook } from '../../../utils/listingBulkExcel'

const FRIENDLY_FIELDS = { unitCode: 'Unit ID', oldUnitIds: 'Old Unit IDs', cadastralLots: 'Cadastral Lots', lotType: 'Lot Type', lotAreaSqm: 'Lot Area (SQM)', installmentPricePerSqm: 'Installment Price / SQM', cashPricePerSqm: 'Cash Price / SQM', reservationFee: 'Reservation Fee', legalMiscRate: 'Legal / Misc Rate', annualInterestRate: 'Annual Interest Rate' }
const displayValue = (value) => value === null || value === undefined || value === '' ? '—' : String(value)

const BulkEditListingsModal = ({ project, projectSlug, onClose, onSaved }) => {
  const inputRef = useRef(null)
  const [filename, setFilename] = useState('')
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [previewPage, setPreviewPage] = useState(1)
  const previewPageSize = 25
  const [pendingApproval, setPendingApproval] = useState(null)
  const historyQuery = useQuery({
    queryKey: ['listing-bulk-history', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listing-bulk/history`),
    enabled: showHistory,
  })
  const selectFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPreview(null); setRows([]); setError(''); setFilename(''); setPendingApproval(null); setPreviewPage(1)
    try {
      const parsed = await parseBulkWorkbook(file, project.id ?? project.lot_project_id)
      setRows(parsed); setFilename(file.name)
    } catch (err) { setError(err?.message || 'Invalid Excel file.') }
  }
  const validate = async () => {
    if (!rows.length || busy) return
    setBusy(true); setError(''); setPreview(null); setPendingApproval(null)
    try {
      const data = await useFetchPost(`/projects/lot-projects/${projectSlug}/listing-bulk/validate`, { rows }, { confirmationHandled: 'technical' })
      setPreview(data); setPreviewPage(1)
    } catch (err) { setError(err?.message || 'Validation failed.') }
    finally { setBusy(false) }
  }
  const apply = async () => {
    if (!preview?.valid || !preview.changedCount || busy) return
    if (reason.trim().length < 5) { setError('Please enter a clear reason (at least 5 characters).'); return }
    setBusy(true); setError('')
    try {
      const result = await useFetchPost(`/projects/lot-projects/${projectSlug}/listing-bulk/apply`, { rows, filename, reason: reason.trim() }, { confirmationHandled: 'compact' })
      if (result.approvalPending) { setPendingApproval(result); return }
      await onSaved(result)
    } catch (err) {
      setError(err?.message || 'The changes could not be saved. Read the warning, correct the Excel file and validate again.')
      if (err?.data?.errors) setPreview((previous) => previous ? { ...previous, valid: false, errors: err.data.errors } : null)
    } finally { setBusy(false) }
  }
  return (
    <section className="w-full space-y-4">
      <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-2xl font-black">Bulk Edit Listings</h2><p className="mt-1 text-sm text-slate-500">Upload an Editable Listings Template to review changes before saving.</p></div><button type="button" disabled={busy} onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"><FiArrowLeft />Back to Listings</button></header>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={inputRef} type="file" accept=".xlsx" onChange={selectFile} className="hidden" />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700"><FiUpload />Choose Edited Excel</button>
            <span className="text-sm font-semibold text-slate-600">{filename || 'No file selected'}</span>
            <button type="button" onClick={() => setShowHistory((value) => !value)} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold"><FiClock />{showHistory ? 'Hide History' : 'Update History'}</button>
          </div>
          {showHistory ? <section className="rounded-xl border border-slate-200 p-4"><h3 className="mb-2 font-black">Recent Bulk Adjustments</h3>{historyQuery.isLoading ? 'Loading history…' : (historyQuery.data?.data || []).length ? <div className="max-h-48 space-y-2 overflow-y-auto">{historyQuery.data.data.map((batch) => <div key={batch.batch_id} className="border-b border-slate-100 py-2 text-sm"><strong>Batch #{batch.batch_id}</strong> — {batch.changed_count} listing(s) — {batch.adjustment_reason} <span className="text-slate-500">({String(batch.created_at).slice(0, 10)})</span></div>)}</div> : <p className="text-sm text-slate-500">No batch history yet. The SQL migration must be applied before saving edits.</p>}</section> : null}
          {error ? <StatusAlert type="error" message={error} /> : null}
          {pendingApproval ? <section role="status" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <h3 className="font-black">Operations Head approval required — no listings changed</h3>
            <p>{pendingApproval.message}</p>
            {(pendingApproval.pending || []).map((item) => <p key={item.listingId} className="font-semibold">{item.unitCode}: {item.requestNumber} ({item.status === 'approved' ? 'Approved' : 'Awaiting approval'})</p>)}
            <p>When the Operations Head approves, click <strong>Apply Approved Changes</strong> below. Keep the same Excel file and reason so the approved request still matches.</p>
          </section> : null}
          {rows.length ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold"><FiFileText className="mr-2 inline" />{rows.length} spreadsheet rows loaded</span><button type="button" disabled={busy} onClick={validate} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy ? 'Validating…' : 'Validate & Preview'}</button></div> : null}
          {preview ? <section className="space-y-3">
            <div className="grid grid-cols-3 gap-2">{[['To Update', preview.changedCount], ['Protected Edits', preview.protectedCount || 0], ['Rows With Errors', preview.errors.length]].map(([label, count]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-black">{count}</p></div>)}</div>
            {preview.errors?.length ? <div className="rounded-xl border border-red-200 bg-red-50 p-4"><h3 className="font-black text-red-900">Changes cannot be saved. Fix these Excel rows and validate again. No units were updated.</h3>{preview.errors.map((row, i) => <div key={`${row.listingId}-${i}`} className="mt-3 rounded-lg bg-white p-3 text-sm text-red-900"><p className="font-black">Excel Row {row.excelRowNumber} — Unit {row.unitCode || row.listingId}</p><ul className="mt-1 list-disc pl-5">{(row.errors || []).map((message, j) => <li key={j}>{message}</li>)}</ul></div>)}</div> : null}
            {preview.preview?.length > 200 ? <p className="text-xs text-slate-500">The server shows the first 200 changes. All validated changes will be saved.</p> : null}
            {preview.preview?.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Unit ID</th><th className="p-3">Changed Values</th></tr></thead><tbody>{preview.preview.slice((previewPage - 1) * previewPageSize, previewPage * previewPageSize).map((item) => <tr key={item.listingId} className="border-t border-slate-100"><td className="p-3 font-bold">{item.before.unitCode}{item.before.unitCode !== item.after.unitCode ? ` → ${item.after.unitCode}` : ''}{item.contractProtected ? <span className="mt-1 block text-xs font-semibold text-amber-700">Contract protected · Head approval</span> : null}</td><td className="p-3">{Object.entries(item.changes).map(([field, values]) => <p key={field} className="mb-1 text-xs"><strong>{FRIENDLY_FIELDS[field] || field}:</strong> {displayValue(values.before)} → <strong>{displayValue(values.after)}</strong></p>)}</td></tr>)}</tbody></table></div> : null}
            {preview.preview?.length > previewPageSize ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold">
              <span>Showing {((previewPage - 1) * previewPageSize) + 1}–{Math.min(previewPage * previewPageSize, preview.preview.length)} of {preview.preview.length} changed units</span>
              <div className="flex items-center gap-2"><button type="button" disabled={previewPage === 1} onClick={() => setPreviewPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">Previous</button><span>Page {previewPage} of {Math.ceil(preview.preview.length / previewPageSize)}</span><button type="button" disabled={previewPage * previewPageSize >= preview.preview.length} onClick={() => setPreviewPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">Next</button></div>
            </div> : null}
            {preview.valid && preview.changedCount ? <label className="block space-y-2"><span className="text-sm font-black">Reason for changes *</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={Boolean(pendingApproval)} maxLength={1000} rows={2} placeholder="Example: Updated survey measurements and project price schedule" className="w-full rounded-xl border border-slate-300 p-3 text-sm" /></label> : null}
            {preview.valid && !preview.changedCount ? <p className="text-sm font-semibold text-slate-600">No differences detected; no import is necessary.</p> : null}
          </section> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold">Cancel</button><button type="button" disabled={!preview?.valid || !preview?.changedCount || busy} onClick={apply} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"><FiCheckCircle />{busy ? 'Saving…' : pendingApproval ? 'Apply Approved Changes' : `Confirm ${preview?.changedCount || 0} Listing Changes`}</button></footer>
      </div>
    </section>
  )
}
export default BulkEditListingsModal
