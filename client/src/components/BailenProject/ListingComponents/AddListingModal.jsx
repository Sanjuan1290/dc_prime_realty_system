import { FiPlus, FiX } from 'react-icons/fi'

const AddListingModal = ({ setShowAddListingModal }) => {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Add Bailen Listing</h3>
            <p className="text-sm text-slate-500">Design only. Connect fields to API later.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddListingModal(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Unit Code</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="LA-0405" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Lot Type</span>
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option>Inner</option>
                <option>Corner</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Lot Area (sqm)</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="300" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Price per SQM</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="3200" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Net Selling Price</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="960000" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">LMF Amount</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="48000" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">TCP</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="1008000" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Reservation Fee</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="50000" />
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Cadastral Lot Numbers</span>
              <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="CAD-001, CAD-002" />
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Description / Improvements</span>
              <textarea rows={4} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="Unit description" />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <h4 className="font-bold text-blue-900">Documents</h4>
            <p className="mt-1 text-sm text-blue-800">Choose project default documents here later. This keeps listing document overrides inside the listing setup.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {['Valid Government ID', 'Proof of Billing', 'Proof of Income', 'Signed Reservation Form'].map((doc) => (
                <label key={doc} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" defaultChecked />
                  {doc}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowAddListingModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancel</button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700">
            <FiPlus className="h-4 w-4" />
            Save Listing
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddListingModal
