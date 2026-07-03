import { useState } from 'react'
import { FiDollarSign, FiEye } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import ReleaseDetailsModal from '../../components/BailenProject/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal'

const Commission = () => {
  const [showReleaseDetailsModal, setShowReleaseDetailsModal] = useState(false)

  const records = [
    {
      unit: 'LA-0402',
      buyer: 'Robert San Juan',
      seller: 'Rowena Cortez',
      group: 'NORTH STAR GROUP',
      tcp: '₱1,008,000.00',
      gross: '₱80,640.00',
      released: '₱0.00',
      cashAdvance: '₱0.00',
      netRemaining: '₱80,640.00',
      status: 'Pending',
    },
  ]

  const cards = [
    { label: 'Commission Records', value: '1', note: 'Generated from sold listings' },
    { label: 'Gross Commission', value: '₱80,640.00', note: 'Before cash advance deductions' },
    { label: 'Released Commission', value: '₱0.00', note: 'Paid to sellers' },
    { label: 'Next Release Day', value: '7th / 22nd', note: 'Release days only' },
  ]

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Bailen Commissions" description="View listing-based commission snapshots and release readiness." icon={FiDollarSign} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-5 shadow-sm ${card.label === 'Next Release Day' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <p className={`text-sm font-bold ${card.label === 'Next Release Day' ? 'text-amber-700' : 'text-slate-500'}`}>{card.label}</p>
            <h3 className={`mt-2 text-2xl font-bold ${card.label === 'Next Release Day' ? 'text-amber-800' : 'text-slate-950'}`}>{card.value}</h3>
            <p className={`mt-1 text-sm ${card.label === 'Next Release Day' ? 'text-amber-700' : 'text-slate-500'}`}>{card.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-950">Commission Records</h2>
          <p className="text-sm text-slate-500">Each record should come from a sold listing with saved seller snapshot.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">TCP</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Released</th>
                <th className="px-4 py-3">Cash Advance</th>
                <th className="px-4 py-3">Net Remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.unit}>
                  <td className="px-4 py-4 font-bold text-slate-950">{record.unit}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{record.buyer}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{record.seller}</td>
                  <td className="px-4 py-4 font-bold text-slate-700">{record.group}</td>
                  <td className="px-4 py-4 font-bold text-slate-950">{record.tcp}</td>
                  <td className="px-4 py-4 font-bold text-blue-700">{record.gross}</td>
                  <td className="px-4 py-4 font-bold text-slate-700">{record.released}</td>
                  <td className="px-4 py-4 font-bold text-red-600">{record.cashAdvance}</td>
                  <td className="px-4 py-4 font-bold text-emerald-700">{record.netRemaining}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{record.status}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setShowReleaseDetailsModal(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <FiEye className="h-3.5 w-3.5" />
                      View Releases
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showReleaseDetailsModal ? <ReleaseDetailsModal setShowReleaseDetailsModal={setShowReleaseDetailsModal} /> : null}
    </main>
  )
}

export default Commission
