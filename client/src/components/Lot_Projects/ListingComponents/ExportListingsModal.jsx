import { useState } from 'react'
import { FiDownload, FiPrinter, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { exportListingWorkbook, LISTING_EXPORT_STATUS_OPTIONS } from '../../../utils/listingBulkExcel'

const ExportListingsModal = ({ projectSlug, projectName, canPrint, onClose }) => {
  const [format, setFormat] = useState('editable')
  const [status, setStatus] = useState('all')
  const [months, setMonths] = useState('20')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const handleFormat = (value) => { setFormat(value); setStatus(value === 'print' ? 'available' : 'all'); setError('') }
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (busy) return
    if (format === 'print' && (!Number.isInteger(Number(months)) || Number(months) < 1 || Number(months) > 120)) {
      setError('Straight Payment (Months) must be a whole number from 1–120.')
      return
    }
    setBusy(true)
    let printWindow = null
    try {
      if (format === 'print') {
        printWindow = window.open('about:blank', '_blank')
        if (printWindow) printWindow.opener = null
        await useFetchPost(`/projects/lot-projects/${projectSlug}/price-list/print-audit`, { straightPaymentMonths: Number(months), status }, { confirmationHandled: 'technical' })
        const params = new URLSearchParams({ straightPaymentMonths: months, status })
        const url = `/portal/lot-projects/${projectSlug}/price-list/print?${params.toString()}`
        if (printWindow) printWindow.location.replace(url)
        else window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const response = await useFetch(`/projects/lot-projects/${projectSlug}/listing-bulk/export?status=${encodeURIComponent(status)}`)
        if (!response?.data) throw new Error('Could not load listings for export.')
        await useFetchPost(`/projects/lot-projects/${projectSlug}/listing-bulk/export-audit`, { status, format }, { confirmationHandled: 'technical' })
        exportListingWorkbook({ listings: response.data, project: response.project, status, editable: format === 'editable' })
      }
      onClose()
    } catch (err) {
      try { printWindow?.close() } catch { /* no popup */ }
      setError(err?.message || 'Unable to export listings.')
    } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div><h2 className="text-xl font-black text-slate-950">Export Listings</h2><p className="text-sm font-semibold text-slate-500">{projectName || 'Project'} · All matching units, not just the visible page.</p></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close export" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>
        <div className="grid gap-5 p-5">
          <fieldset className="grid gap-2"><legend className="mb-2 text-xs font-black uppercase text-slate-600">Export Type</legend>
            {[
              ...(canPrint ? [{ value: 'print', label: 'Price List — Print / PDF', helper: 'Existing printable price list and monthly computation' }] : []),
              { value: 'inventory', label: 'Complete Listings — Excel', helper: 'Read-only reference inventory and calculated TCPs' },
              { value: 'editable', label: 'Editable Listings Template — Excel', helper: 'Edit existing lot areas, Unit IDs, cadastral lots and prices' },
            ].map((choice) => <label key={choice.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${format === choice.value ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
              <input type="radio" name="format" value={choice.value} checked={format === choice.value} onChange={() => handleFormat(choice.value)} className="mt-1" />
              <span><span className="block text-sm font-black text-slate-900">{choice.label}</span><span className="block text-xs font-semibold text-slate-500">{choice.helper}</span></span>
            </label>)}
          </fieldset>
          <label className="grid gap-2"><span className="text-xs font-black uppercase text-slate-600">Unit Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">{LISTING_EXPORT_STATUS_OPTIONS.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
          </label>
          {format === 'print' ? <label className="grid gap-2"><span className="text-xs font-black uppercase text-slate-600">Straight Payment (Months)</span><input type="number" min="1" max="120" data-example="20 months" value={months} onChange={(e) => setMonths(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3" /><span className="text-xs text-slate-500">Existing installment selling price less reservation fee, divided by the selected month count.</span></label> : null}
          {error ? <StatusAlert type="error" message={error} /> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold">Cancel</button>
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60">{format === 'print' ? <FiPrinter /> : <FiDownload />}{busy ? 'Preparing…' : format === 'print' ? 'Print Price List' : 'Download Excel'}</button>
        </footer>
      </form>
    </div>
  )
}
export default ExportListingsModal

