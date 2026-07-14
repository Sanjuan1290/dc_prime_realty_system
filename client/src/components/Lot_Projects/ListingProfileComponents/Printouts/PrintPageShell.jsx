import { FiPrinter, FiX } from 'react-icons/fi'
import { printWithTemporaryBlankTitle } from './pdfExportUtils'

const PrintPageShell = ({ title, children, printDisabled = false, printDisabledMessage = '' }) => {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0 !important;
        }

        html,
        body,
        #root {
          background: #ffffff;
        }

        @media print {
          html,
          body,
          #root {
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-hidden {
            display: none !important;
          }

          .print-content {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .print-page,
          .print-export-page {
            margin: 0 auto !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
          }

          .print-page:last-child,
          .print-export-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }

        .pdf-export-root .print-page,
        .pdf-export-root .print-export-page {
          margin: 0 auto !important;
          box-shadow: none !important;
          break-after: page;
          page-break-after: always;
        }

        .pdf-export-root .print-page:last-child,
        .pdf-export-root .print-export-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }
      `}</style>

      <div className="print-hidden sticky top-0 z-50 flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={printWithTemporaryBlankTitle}
              disabled={printDisabled}
              title={printDisabled ? printDisabledMessage : 'Print'}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:bg-blue-300 disabled:active:scale-100"
            >
              <FiPrinter className="h-4 w-4" />
              Print
            </button>
          </div>

          <div>
            <h1 className="text-base font-black text-slate-950">{title}</h1>
            <p className="text-xs font-semibold text-slate-500">
              {printDisabled ? printDisabledMessage : 'Print or Save as PDF.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <FiX className="h-4 w-4" />
          Close
        </button>
      </div>

      <div className="print-content p-6 print:p-0">
        {children}
      </div>
    </main>
  )
}

export default PrintPageShell


