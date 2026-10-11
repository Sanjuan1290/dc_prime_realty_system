import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiDownload, FiFileText, FiTable, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import { downloadElementAsPdf, sanitizePdfFileName } from '../../Lot_Projects/ListingProfileComponents/Printouts/pdfExportUtils'
import { downloadPayrollSummaryCsv, downloadPayrollSummaryExcel } from '../../../utils/payrollSummaryExport'
import PayrollSummaryPrint from './PayrollSummaryPrint'

const PayrollSummaryExportModal = ({ month, periodType, periodLabel, onClose }) => {
  const contentRef = useRef(null)
  const [notice, setNotice] = useState(null)
  const queryString = new URLSearchParams({ month, period_type: periodType }).toString()
  const query = useQuery({
    queryKey: ['employee-salary', 'summary-export', queryString],
    queryFn: () => useFetch(`/employee-payroll/summary-export?${queryString}`),
  })
  const summary = query.data?.data || null
  const filename = sanitizePdfFileName(`payroll-summary-${summary?.period?.periodStart || month}-${summary?.period?.periodEnd || periodType}`)

  const runDownload = (download, label) => {
    if (!summary) return
    try {
      const savedAs = download(summary)
      setNotice({ type: 'success', message: `${label} created: ${savedAs}` })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || `Unable to export ${label}.` })
    }
  }

  const exportPdf = async () => {
    if (!contentRef.current || !summary) return
    setNotice({ type: 'loading', message: 'Opening payroll summary PDF save window...' })
    try {
      await downloadElementAsPdf(contentRef.current, { filename })
      setNotice({ type: 'success', message: 'PDF window opened. Choose Save as PDF in the print dialog.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Unable to export payroll summary PDF.' })
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
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiTable /><span className="text-xs font-black uppercase tracking-[0.16em]">Payroll Summary Export</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">{periodLabel || summary?.period?.periodLabel || 'Payroll Period Summary'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Exports the whole selected half-month period and ignores the page's Department, Status, and Search filters.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        {notice ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /></div> : null}
        {query.isError ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="error" message={query.error?.message || 'Unable to load the payroll summary.'} /></div> : null}
        {summary?.warnings?.map((message) => <div key={message} className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="warning" message={message} /></div>)}

        <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-5 sm:p-7">
          {query.isLoading ? <div className="mx-auto max-w-xl"><StatusAlert type="loading" message="Preparing whole-period payroll summary..." /></div> : null}
          {summary ? <div ref={contentRef} className="print-preview-pages"><PayrollSummaryPrint summary={summary} /></div> : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500">CSV, Excel, and PDF use the same server-generated period summary and stored payroll values.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Close</button>
            <button type="button" disabled={!summary} onClick={() => runDownload(downloadPayrollSummaryCsv, 'CSV summary')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 disabled:opacity-50"><FiFileText />CSV</button>
            <button type="button" disabled={!summary} onClick={() => runDownload(downloadPayrollSummaryExcel, 'Excel summary')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-900 bg-white px-5 text-sm font-black text-slate-900 disabled:opacity-50"><FiTable />Excel</button>
            <button type="button" disabled={!summary} onClick={exportPdf} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50"><FiDownload />Export PDF</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default PayrollSummaryExportModal

