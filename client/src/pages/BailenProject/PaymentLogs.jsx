import { FiAlertCircle, FiCreditCard, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'

const PaymentLogs = () => {
  const cards = [
    { label: 'Verified Collections', value: '₱168,800.00', note: 'Confirmed payments' },
    { label: 'Pending Payments', value: '₱5,000.00', note: 'Needs admin review' },
    { label: 'Audit Log Count', value: '3', note: 'All recorded payment entries' },
    { label: 'Source', value: 'Listings', note: 'Payments are recorded per listing' },
  ]

  const logs = [
    { date: '2026-07-01', verified: '2026-07-01', client: 'Robert San Juan', unit: 'LA-0402', type: 'Reservation', method: 'Cash', amount: '₱50,000.00', reference: 'CASH-20260701-LA0402-0001', status: 'Verified' },
    { date: '2026-07-15', verified: '2026-07-15', client: 'Robert San Juan', unit: 'LA-0402', type: 'Downpayment', method: 'Bank Transfer', amount: '₱118,800.00', reference: 'BDO-874612', status: 'Verified' },
    { date: '2026-07-20', verified: '-', client: 'Robert San Juan', unit: 'LA-0402', type: 'Advance Payment', method: 'Online', amount: '₱5,000.00', reference: 'GCASH-770011', status: 'Pending' },
  ]

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Bailen Payments Audit / Logs" description="Payments are added inside each listing. This page is for auditing all Bailen payment records." icon={FiCreditCard} />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>New workflow: add payments from Listings / Units → Details → Payments &amp; SOA. This page stays read-only.</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">{card.value}</h3>
            <p className="mt-1 text-sm text-slate-500">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Payment Audit Logs</h2>
            <p className="text-sm text-slate-500">Read-only payment history from all Bailen listing SOA records.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80" placeholder="Search client, unit, reference, or type" />
            </label>
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option>All Status</option>
              <option>Verified</option>
              <option>Pending</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Verified Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.reference}>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.date}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.verified}</td>
                  <td className="px-4 py-4 font-bold text-slate-950">{log.client}</td>
                  <td className="px-4 py-4 font-bold text-slate-700">{log.unit}</td>
                  <td className="px-4 py-4 text-slate-700">{log.type}</td>
                  <td className="px-4 py-4 text-slate-700">{log.method}</td>
                  <td className="px-4 py-4 font-bold text-blue-700">{log.amount}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.reference}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${log.status === 'Verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-slate-500">Showing 1-3 of 3 records</p>
          <div className="flex items-center gap-2">
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-400">Previous</button>
            <span className="h-9 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">Page 1 of 1</span>
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-400">Next</button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default PaymentLogs
