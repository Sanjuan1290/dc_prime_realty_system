import { FiDollarSign, FiX } from 'react-icons/fi'

const ReleaseDetailsModal = ({ setShowReleaseDetailsModal }) => {
  const milestones = [
    { name: '20%', gross: '₱16,128.00', deduction: '₱0.00', net: '₱16,128.00', status: 'Pending' },
    { name: '40%', gross: '₱32,256.00', deduction: '₱0.00', net: '₱32,256.00', status: 'Locked' },
    { name: '60%', gross: '₱48,384.00', deduction: '₱0.00', net: '₱48,384.00', status: 'Locked' },
    { name: '75%', gross: '₱60,480.00', deduction: '₱0.00', net: '₱60,480.00', status: 'Locked' },
    { name: 'Retention', gross: '₱20,160.00', deduction: '₱0.00', net: '₱20,160.00', status: 'Locked' },
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Commission Release Details</h3>
            <p className="text-sm text-slate-500">LA-0402 • Robert San Juan • Rowena Cortez</p>
          </div>
          <button type="button" onClick={() => setShowReleaseDetailsModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <section className="grid gap-4 md:grid-cols-4">
            {[
              ['TCP', '₱1,008,000.00'],
              ['Gross Commission', '₱80,640.00'],
              ['Cash Advance', '₱0.00'],
              ['Net Remaining', '₱80,640.00'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-500">{label}</p>
                <h4 className="mt-2 text-lg font-bold text-slate-950">{value}</h4>
              </div>
            ))}
          </section>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Milestone</th>
                  <th className="px-4 py-3">Gross Amount</th>
                  <th className="px-4 py-3">Cash Advance Deduction</th>
                  <th className="px-4 py-3">Net Release</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {milestones.map((item) => (
                  <tr key={item.name}>
                    <td className="px-4 py-4 font-bold text-slate-950">{item.name}</td>
                    <td className="px-4 py-4 font-bold text-blue-700">{item.gross}</td>
                    <td className="px-4 py-4 font-bold text-red-600">{item.deduction}</td>
                    <td className="px-4 py-4 font-bold text-emerald-700">{item.net}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${item.status === 'Pending' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{item.status}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50" disabled={item.status !== 'Pending'}>
                        <FiDollarSign className="h-3.5 w-3.5" />
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            Release action should only work on allowed days: 7th and 22nd.
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={() => setShowReleaseDetailsModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button>
        </div>
      </div>
    </div>
  )
}

export default ReleaseDetailsModal
