import { FiSave, FiX } from 'react-icons/fi'

const AddPaymentModal = ({ setShowAddPaymentModal }) => {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Add Payment</h3>
            <p className="text-sm text-slate-500">Payment is linked to LA-0402 and one SOA row.</p>
          </div>
          <button type="button" onClick={() => setShowAddPaymentModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">SOA Row</span>
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option>Reservation Fee - 2026-07-01</option>
                <option>1st Downpayment - 2026-07-15</option>
                <option>Monthly Amortization - 2026-08-15</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Payment Type</span>
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option>Reservation</option>
                <option>Downpayment</option>
                <option>Monthly Amortization</option>
                <option>Advance Payment</option>
                <option>Full Payment</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Payment Date</span>
              <input type="date" defaultValue="2026-07-20" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Amount Paid</span>
              <input defaultValue="5000" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Method</span>
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>Online</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Reference ID</span>
              <input defaultValue="Auto for cash / manual for bank" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Remarks</span>
              <textarea rows={4} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="Payment note" />
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowAddPaymentModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">
            <FiSave className="h-4 w-4" />
            Save Payment
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddPaymentModal
