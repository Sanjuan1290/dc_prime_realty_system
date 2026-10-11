import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiDownload, FiFileText, FiPrinter, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import { downloadElementAsPdf, openElementInPdfPrintWindow, sanitizePdfFileName } from '../../Lot_Projects/ListingProfileComponents/Printouts/pdfExportUtils'
import FundReleaseReceipt from './FundReleaseReceipt'

const FundReleaseReceiptModal = ({ payrollId, canPrint = false, canExport = false, historyMode = false, onClose }) => {
  const contentRef = useRef(null)
  const [notice, setNotice] = useState(null)
  const query = useQuery({
    queryKey: ['employee-salary-receipt', payrollId],
    queryFn: () => useFetch(historyMode ? `/employee-payroll/history/payrolls/${payrollId}/receipt` : `/employee-payroll/drafts/${payrollId}/receipt`),
    enabled: Boolean(payrollId),
  })
  const receipt = query.data?.data || null

  const filename = sanitizePdfFileName(
    `fund-release-${receipt?.employee_name || 'employee'}-${receipt?.pay_period?.start || ''}-${receipt?.pay_period?.end || ''}`
  )

  const assertOfficial = () => {
    if (receipt?.official) return true
    setNotice({ type: 'warning', message: 'Draft receipts are Preview only. Finalize the payroll before official Print or PDF Export.' })
    return false
  }

  const handlePrint = async () => {
    if (!contentRef.current || !assertOfficial()) return
    setNotice({ type: 'loading', message: 'Opening clean print window...' })
    try {
      await openElementInPdfPrintWindow(contentRef.current, { filename })
      setNotice({ type: 'success', message: 'Print window opened.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Unable to open the print window.' })
    }
  }

  const handleExport = async () => {
    if (!contentRef.current || !assertOfficial()) return
    setNotice({ type: 'loading', message: 'Opening PDF save window...' })
    try {
      await downloadElementAsPdf(contentRef.current, { filename })
      setNotice({ type: 'success', message: 'PDF window opened. Choose Save as PDF in the print dialog.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Unable to open the PDF save window.' })
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4">
      <style>{`
        @page { size: A4 portrait; margin: 0 !important; }
        @media print {
          html, body, #root { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
          .fund-release-receipt { margin: 0 auto !important; box-shadow: none !important; }
        }
      `}</style>
      <div className="flex max-h-[97vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiFileText /><span className="text-xs font-black uppercase tracking-[0.16em]">Fund Release Receipt</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Acknowledgement Receipt for Fund Release</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">The preview, print view, and PDF export all use this same receipt component and payroll snapshot.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        {notice ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /></div> : null}
        {query.isError ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="error" message={query.error?.message || 'Unable to load the Fund Release Receipt.'} /></div> : null}
        {receipt && !receipt.official ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="warning" message={receipt.finalized_snapshot_missing ? 'This historical Finalized payroll does not contain an immutable finalized snapshot, so official Print / PDF Export is blocked. Create or correct the payroll through the controlled workflow instead of exporting live values.' : 'This payroll is still Draft. The receipt is Preview only and cannot be officially printed or exported until Finalization.'} /></div> : null}
        {receipt?.official && !canPrint && !canExport ? <div className="shrink-0 px-5 pt-4 sm:px-6"><StatusAlert type="info" message="You can preview this finalized receipt, but your account does not have Print Payroll Receipt or Export Payroll Receipt permission." /></div> : null}

        <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-5 sm:p-7">
          {query.isLoading ? <div className="mx-auto max-w-xl"><StatusAlert type="loading" message="Preparing receipt preview..." /></div> : null}
          {receipt ? <div ref={contentRef} className="print-preview-pages"><FundReleaseReceipt receipt={receipt} /></div> : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500">{receipt?.source === 'finalized_snapshot' ? 'Source: immutable finalized payroll snapshot.' : 'Source: current Draft payroll calculation (Preview only).'}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Close</button>
            {receipt?.official && canPrint ? <button type="button" onClick={handlePrint} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-900 bg-white px-5 text-sm font-black text-slate-900 hover:bg-slate-50"><FiPrinter />Print Receipt</button> : null}
            {receipt?.official && canExport ? <button type="button" onClick={handleExport} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-black"><FiDownload />Export PDF</button> : null}
          </div>
        </footer>
      </div>
    </div>
  )
}

export default FundReleaseReceiptModal

