import { FiPrinter, FiX } from 'react-icons/fi'

const PrintPreviewModal = ({ setShowPrintPreviewModal }) => {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Print Preview</h3>
            <p className="text-sm text-slate-500">Design preview for buyer profile and offer printouts.</p>
          </div>
          <button type="button" onClick={() => setShowPrintPreviewModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto bg-slate-100 p-6">
          <div className="mx-auto min-h-[720px] max-w-3xl rounded-xl bg-white p-8 shadow-sm">
            <div className="border-b border-slate-200 pb-4 text-center">
              <h2 className="text-xl font-bold text-slate-950">D&amp;C Prime Realty</h2>
              <p className="text-sm text-slate-500">Buyer Profile / Offer to Buy</p>
            </div>

            <div className="mt-6 grid gap-4 text-sm md:grid-cols-2">
              <div><span className="font-bold text-slate-500">Buyer:</span> Robert San Juan</div>
              <div><span className="font-bold text-slate-500">Unit:</span> LA-0402</div>
              <div><span className="font-bold text-slate-500">TCP:</span> ₱1,008,000.00</div>
              <div><span className="font-bold text-slate-500">Reservation:</span> ₱50,000.00</div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600">
              This area represents the printable document body. Connect this later to the final print layout and real client data.
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowPrintPreviewModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">
            <FiPrinter className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrintPreviewModal
