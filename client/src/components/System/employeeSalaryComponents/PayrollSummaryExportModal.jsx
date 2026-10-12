import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiDownload, FiFileText, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import { downloadElementAsPdf, sanitizePdfFileName } from '../../Lot_Projects/ListingProfileComponents/Printouts/pdfExportUtils'
import PayrollSummaryPrint from './PayrollSummaryPrint'

const PayrollSummaryExportModal = ({ month, periodType, periodLabel, onClose }) => {
  const contentRef = useRef(null)
  const [notice, setNotice] = useState(null)
  const [exporting, setExporting] = useState(false)
  const queryString = new URLSearchParams({ month, period_type: periodType }).toString()
  const query = useQuery({
    queryKey: ['employee-salary', 'summary-export', queryString],
    queryFn: () => useFetch(`/employee-payroll/summary-export?${queryString}`),
  })
  const summary = query.data?.data || null
  const filename = sanitizePdfFileName(`payroll-summary-${summary?.period?.periodStart || month}-${summary?.period?.periodEnd || periodType}`)

  const exportPdf = async () => {
    if (!contentRef.current || !summary) return
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
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4">
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
            <div className="flex items-center gap-2 text-blue-700"><FiFileText aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wide">Payroll Summary · PDF</span></div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">{periodLabel || summary?.period?.periodLabel || 'Payroll Summary'}</h2>
            <p className="mt-1 text-sm text-slate-600">Review the report below, then save it as a PDF.</p>
          </div>
          <button type="button" aria-label="Close payroll summary" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"><FiX aria-hidden="true" /></button>
        </header>

        {summary ? (
          <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:grid-cols-3 sm:px-6">
            <div><p className="text-xs font-semibold text-slate-500">Employees</p><p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">{Number(summary.totals?.employee_count || 0)}</p></div>
            <div><p className="text-xs font-semibold text-slate-500">Total Net Pay</p><p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">₱{Number(summary.totals?.total_fund_release || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div className="col-span-2 sm:col-span-1"><p className="text-xs font-semibold text-slate-500">Report Status</p><p className={`mt-1 text-sm font-bold ${summary.official ? 'text-emerald-700' : 'text-amber-700'}`}>{summary.official ? 'Official summary' : (summary.rows?.length ? 'Includes draft payroll' : 'No payroll records')}</p></div>
          </div>
        ) : null}

        {notice ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /></div> : null}
        {query.isError ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="error" message={query.error?.message || 'Unable to load the payroll summary.'} /></div> : null}
        {summary?.warnings?.map((message) => <div key={message} className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="warning" message={message} /></div>)}

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-6">
          {query.isLoading ? <div className="mx-auto max-w-xl"><StatusAlert type="loading" message="Preparing payroll summary..." /></div> : null}
          {summary ? <div ref={contentRef} className="print-preview-pages"><PayrollSummaryPrint summary={summary} /></div> : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="max-w-xl text-xs text-slate-500">Includes all employees in this pay period, even if you've filtered the employee list.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button>
            <button type="button" disabled={!summary || exporting} onClick={exportPdf} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><FiDownload aria-hidden="true" />{exporting ? 'Preparing PDF...' : 'Save as PDF'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default PayrollSummaryExportModal


