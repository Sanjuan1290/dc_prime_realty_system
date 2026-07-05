import { FiPrinter } from 'react-icons/fi'

const PrintPageShell = ({ title, children }) => {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <div className="sticky top-0 z-50 flex h-16 items-center justify-start gap-3 border-b border-slate-200 bg-white px-5 shadow-sm print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <FiPrinter className="h-4 w-4" />
          Print / Save PDF
        </button>

        <div>
          <h1 className="text-base font-black text-slate-950">{title}</h1>
          <p className="text-xs font-semibold text-slate-500">Print preview page</p>
        </div>
      </div>

      <div className="p-6 print:p-0">{children}</div>
    </main>
  )
}

export default PrintPageShell
