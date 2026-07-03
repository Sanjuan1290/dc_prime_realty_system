const UnitStatus = () => {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Unit &amp; Status</h2>
        <p className="text-sm text-slate-500">Edit status, property description, price details, and cadastral lots.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">Unit Code</span>
          <input defaultValue="LA-0402" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">Lot Area (sqm)</span>
          <input defaultValue="300" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">Price per SQM</span>
          <input defaultValue="3200" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">Net Selling Price</span>
          <input defaultValue="960000" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">LMF Amount</span>
          <input defaultValue="48000" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">TCP</span>
          <input defaultValue="1008000" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-bold text-slate-700">Reservation Fee</span>
          <input defaultValue="50000" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">Annual Interest Rate (%)</span>
          <input defaultValue="0" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2 xl:col-span-3">
          <span className="text-sm font-bold text-slate-700">Cadastral Lot Numbers</span>
          <input defaultValue="CAD-001, CAD-002" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
        <label className="flex flex-col gap-2 xl:col-span-3">
          <span className="text-sm font-bold text-slate-700">Description / Improvements</span>
          <textarea rows={5} defaultValue="Unit LA-0402" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
      </div>
    </div>
  )
}

export default UnitStatus
