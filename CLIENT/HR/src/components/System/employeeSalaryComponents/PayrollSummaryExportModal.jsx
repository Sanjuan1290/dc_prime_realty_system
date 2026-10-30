import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiDownload, FiFileText, FiRefreshCw, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import { downloadElementAsPdf, sanitizePdfFileName } from '../../../utils/pdfExportUtils'
import PayrollSummaryPrint from './PayrollSummaryPrint'

const formatAmount = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`

const SummaryMetric = ({ label, amount, note, tone = 'normal' }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-extrabold tabular-nums ${tone === 'paid' ? 'text-emerald-700' : tone === 'pending' ? 'text-amber-800' : 'text-slate-900'}`}>{formatAmount(amount)}</p>
    <p className="mt-1 text-xs text-slate-500">{note}</p>
  </div>
)

const PayrollSummaryExportModal = ({ month, periodType, periodLabel, onClose }) => {
  const contentRef = useRef(null)
  const [notice, setNotice] = useState(null)
  const [exporting, setExporting] = useState(false)
  const queryString = useMemo(() => new URLSearchParams({ month, period_type: periodType }).toString(), [month, periodType])
  const query = useQuery({
    queryKey: ['employee-salary', 'summary-export', queryString],
    queryFn: () => useFetch(`/employee-payroll/summary-export?${queryString}`),
  })
  const summary = query.data?.data || null
  const totals = summary?.totals || {}
  const mismatches = summary?.reconciliation_issues || []
  const hasPayroll = Boolean(summary?.rows?.length)
  const canExport = hasPayroll && summary?.can_export !== false && mismatches.length === 0
  const filename = sanitizePdfFileName(`payroll-summary-${summary?.period?.periodStart || month}-${summary?.period?.periodEnd || periodType}`)

  const exportPdf = async () => {
    if (!contentRef.current || !canExport || exporting) return
    setExporting(true)
    setNotice(null)
    try {
      await downloadElementAsPdf(contentRef.current, { filename, pageSize: 'A4 landscape' })
      setNotice({ type: 'success', message: 'Print window opened. Choose “Save as PDF” to save the payroll summary.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Unable to open the PDF window.' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Employee Payroll Summary export">
      <style>{`
        @page { size: A4 landscape; margin: 0 !important; }
        @media print {
          html, body, #root { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
          .payroll-summary-print { margin: 0 auto !important; box-shadow: none !important; }
        }
      `}</style>
      <div className="flex max-h-[97vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-700"><FiFileText aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wide">Employee salary · Report export</span></div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">Employee Payroll Summary</h2>
            <p className="mt-1 text-sm text-slate-600">{periodLabel || summary?.period?.periodLabel || 'Selected pay period'} · Review and save as PDF</p>
          </div>
          <button type="button" aria-label="Close payroll summary" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"><FiX aria-hidden="true" /></button>
        </header>

        {summary ? <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryMetric label="Total payroll" amount={totals.total_fund_release} note={`${totals.employee_count || 0} payroll records`} />
            <SummaryMetric label="Released / Paid" amount={totals.total_released} note={`${totals.released_count || 0} employees paid`} tone="paid" />
            <SummaryMetric label="Awaiting release" amount={totals.total_awaiting_release} note={`${totals.awaiting_release_count || 0} approved and unpaid`} tone="pending" />
            <SummaryMetric label="Draft estimate" amount={totals.total_draft} note={`${totals.draft_count || 0} payroll drafts`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={`inline-flex items-center gap-1.5 font-bold ${summary.official ? 'text-emerald-700' : 'text-amber-800'}`}>
              {summary.official ? <FiCheckCircle aria-hidden="true" /> : <FiAlertTriangle aria-hidden="true" />}
              {summary.official ? 'Final salary amounts' : 'Includes draft estimates — provisional'}
            </span>
            <span className="text-slate-500">Includes all payroll records for this period, even if the register is filtered.</span>
          </div>
        </div> : null}

        {notice ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /></div> : null}
        {query.isError ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="error" message={query.error?.message || 'Unable to load the payroll summary.'} /></div> : null}
        {mismatches.length ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="error" message={`The amounts for ${mismatches.length} payroll record(s) do not match the saved net salary. Check these records before exporting.`} />
          <p className="mt-1 text-xs text-red-700">{mismatches.slice(0, 3).map((row) => row.employee_name || `Payroll #${row.employee_payroll_id}`).join(', ')}{mismatches.length > 3 ? '…' : ''}</p>
        </div> : null}
        {summary?.warnings?.filter((message) => !mismatches.length || !message.includes('reconcile')).map((message) => <div key={message} className="shrink-0 px-5 pt-3 sm:px-6"><StatusAlert type="warning" message={message} /></div>)}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-6">
          {query.isLoading ? <div className="mx-auto max-w-xl"><StatusAlert type="loading" message="Preparing payroll summary..." /></div> : null}
          {summary ? <div ref={contentRef} className="print-preview-pages w-max min-w-full"><PayrollSummaryPrint summary={summary} /></div> : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="max-w-xl text-xs text-slate-500">Released = paid. Finalized or corrected = awaiting release. Draft = provisional.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {query.isError ? <button type="button" onClick={() => query.refetch()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><FiRefreshCw />Retry</button> : null}
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button>
            <button type="button" disabled={!canExport || exporting} onClick={exportPdf} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><FiDownload aria-hidden="true" />{exporting ? 'Preparing PDF...' : 'Save as PDF'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default PayrollSummaryExportModal

