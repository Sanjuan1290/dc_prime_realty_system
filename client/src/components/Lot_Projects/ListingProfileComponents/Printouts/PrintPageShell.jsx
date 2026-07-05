import { FiPrinter, FiX } from 'react-icons/fi'

const PrintPageShell = ({ title, children }) => {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <div className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <FiPrinter className="h-4 w-4" />
            Print
          </button>

          <div>
            <h1 className="text-base font-black text-slate-950">{title}</h1>
            <p className="text-xs font-semibold text-slate-500">
              Complete print preview page
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <FiX className="h-4 w-4" />
          Close
        </button>
      </div>

      <div className="p-6 print:p-0">{children}</div>
    </main>
  )
}

export default PrintPageShell