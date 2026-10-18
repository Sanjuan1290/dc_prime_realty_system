import { Fragment, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCheckCircle, FiClock, FiFileText, FiUpload, FiArrowLeft, FiChevronDown, FiChevronRight, FiSearch } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { parseBulkWorkbook } from '../../../utils/listingBulkExcel'
import { BULK_PREVIEW_PAGE_SIZES, bulkPreviewFields, filterBulkPreview, paginateBulkPreview } from '../../../utils/listingBulkPreview'

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
  const [previewPageSize, setPreviewPageSize] = useState(10)
  const [previewSearch, setPreviewSearch] = useState('')
  const [expandedListings, setExpandedListings] = useState(() => new Set())
  const [pendingApproval, setPendingApproval] = useState(null)
  const matchingPreview = filterBulkPreview(preview?.preview || [], previewSearch)
  const visiblePreview = paginateBulkPreview(matchingPreview, previewPage, previewPageSize)
  const toggleListing = (listingId) => {
    setExpandedListings((previous) => {
      const next = new Set(previous)
      const id = String(listingId)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const setPageExpanded = (expanded) => {
    setExpandedListings((previous) => {
      const next = new Set(previous)
      visiblePreview.items.forEach((item) => {
        if (expanded) next.add(String(item.listingId))
        else next.delete(String(item.listingId))
      })
      return next
    })
  }
  const historyQuery = useQuery({
    queryKey: ['listing-bulk-history', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listing-bulk/history`),
    enabled: showHistory,
  })
  const selectFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPreview(null); setRows([]); setError(''); setFilename(''); setPendingApproval(null); setPreviewPage(1); setPreviewSearch(''); setExpandedListings(new Set())
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
      setPreview(data); setPreviewPage(1); setPreviewSearch(''); setExpandedListings(new Set((data.preview || []).length <= 5 ? (data.preview || []).map((item) => String(item.listingId)) : []))
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
            {preview.preview?.length ? <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="relative min-w-[230px] flex-1" htmlFor="bulk-preview-search">
                  <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input id="bulk-preview-search" type="search" value={previewSearch}
                    onChange={(event) => { setPreviewSearch(event.target.value); setPreviewPage(1) }}
                    placeholder="Search unit ID, field, or value" aria-label="Search changed units"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  Rows per page
                  <select aria-label="Changed units per page" value={previewPageSize}
                    onChange={(event) => { setPreviewPageSize(Number(event.target.value)); setPreviewPage(1) }}
                    className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800">
                    {BULK_PREVIEW_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <button type="button" onClick={() => setPageExpanded(true)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">Expand page</button>
                  <button type="button" onClick={() => setPageExpanded(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">Collapse page</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[700px] table-fixed text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700"><tr>
                    <th scope="col" className="w-[23%] p-3">Unit ID</th>
                    <th scope="col" className="w-[31%] p-3">Fields</th>
                    <th scope="col" className="w-[23%] p-3">Before</th>
                    <th scope="col" className="w-[23%] p-3">After</th>
                  </tr></thead>
                  <tbody>
                    {visiblePreview.items.map((item) => {
                      const fields = bulkPreviewFields(item)
                      const first = fields[0]
                      const expanded = expandedListings.has(String(item.listingId))
                      const unitLabel = item.before?.unitCode || item.after?.unitCode || String(item.listingId)
                      return <Fragment key={item.listingId}>
                        <tr className="border-t border-slate-200 bg-white align-top">
                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-start gap-2">
                              <button type="button" aria-expanded={expanded}
                                aria-label={`${expanded ? 'Collapse' : 'Expand'} changes for ${unitLabel}`}
                                onClick={() => toggleListing(item.listingId)}
                                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                                {expanded ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
                              </button>
                              <span className="min-w-0 break-words">
                                {unitLabel}
                                {unitLabel !== item.after?.unitCode ? <span className="block text-xs font-medium text-blue-700">→ {item.after?.unitCode}</span> : null}
                                {item.contractProtected ? <span className="mt-1 block text-xs font-semibold text-amber-700">Head approval required</span> : null}
                              </span>
                            </div>
                          </td>
                          <td className="break-words p-3">
                            <span className="font-semibold">{expanded ? `${fields.length} ${fields.length === 1 ? 'field' : 'fields'} changed` : (first?.label || 'Updated listing')}</span>
                            {!expanded && fields.length > 1 ? <button type="button" onClick={() => toggleListing(item.listingId)}
                              aria-label={`Show ${fields.length - 1} more changed fields for ${unitLabel}`}
                              className="ml-2 inline-block rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100">
                              +{fields.length - 1} more
                            </button> : null}
                          </td>
                          <td className="break-words p-3 text-slate-600">{expanded ? '—' : (first?.before || '—')}</td>
                          <td className="break-words p-3 font-semibold text-slate-900">{expanded ? '—' : (first?.after || '—')}</td>
                        </tr>
                        {expanded && fields.map((field) => <tr key={`${item.listingId}-${field.key}`} className="border-t border-slate-100 bg-blue-50/40 align-top">
                          <td className="p-3" aria-hidden="true" />
                          <td className="break-words p-3 font-medium text-slate-700">{field.label}</td>
                          <td className="break-words p-3 text-slate-600">{field.before}</td>
                          <td className="break-words p-3 font-semibold text-slate-900">{field.after}</td>
                        </tr>)}
                      </Fragment>
                    })}
                  </tbody>
                </table>
                {!visiblePreview.total ? <p className="p-5 text-center text-sm text-slate-500">No changed units match your search. Try a different unit ID or field.</p> : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <span>Showing {visiblePreview.from}–{visiblePreview.to} of {visiblePreview.total} matching changed units{previewSearch ? ` (${preview.preview.length} total changes)` : ''}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={visiblePreview.page <= 1} onClick={() => setPreviewPage(visiblePreview.page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                  <span>Page {visiblePreview.page} of {visiblePreview.totalPages}</span>
                  <button type="button" disabled={visiblePreview.page >= visiblePreview.totalPages} onClick={() => setPreviewPage(visiblePreview.page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                </div>
              </div>
              <p className="text-xs text-slate-500">Search, pagination, and collapsed rows change only this preview. Confirmation applies every validated change in the workbook.</p>
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

