import { useState } from 'react'
import { FiFileText, FiPrinter } from 'react-icons/fi'
import PrintPreviewModal from './PrintPreviewModal'

const Printouts = () => {
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false)

  const printouts = [
    { title: 'Offer to Buy', description: 'Buyer offer form with unit, TCP, reservation fee, and terms.' },
    { title: 'Buyer Profile', description: 'Client information sheet for buyer records.' },
    { title: 'Statement of Account', description: 'SOA schedule with payments, balances, and references.' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Printouts</h2>
        <p className="text-sm text-slate-500">Generate printable forms after the client profile and SOA are complete.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {printouts.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FiFileText className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-950">{item.title}</h3>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{item.description}</p>
            <button
              type="button"
              onClick={() => setShowPrintPreviewModal(true)}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <FiPrinter className="h-4 w-4" />
              Preview / Print
            </button>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        Printouts should be blocked when the client profile, required documents, or SOA setup is incomplete.
      </section>

      {showPrintPreviewModal ? <PrintPreviewModal setShowPrintPreviewModal={setShowPrintPreviewModal} /> : null}
    </div>
  )
}

export default Printouts
