import { useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import AddPaymentModal from './AddPaymentModal'

const Payments_SOA = () => {
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false)

  const rows = [
    { dueDate: '2026-07-01', description: 'Reservation Fee', beginning: '₱1,008,000.00', due: '₱50,000.00', penalty: '₱0.00', paidDate: '2026-07-01', paid: '₱50,000.00', reference: 'CASH-20260701-LA0402-0001', status: 'Paid', ending: '₱958,000.00' },
    { dueDate: '2026-07-15', description: '1st Downpayment', beginning: '₱958,000.00', due: '₱118,800.00', penalty: '₱0.00', paidDate: '2026-07-15', paid: '₱118,800.00', reference: 'BDO-874612', status: 'Paid', ending: '₱839,200.00' },
    { dueDate: '2026-08-15', description: 'Monthly Amortization', beginning: '₱839,200.00', due: '₱23,311.11', penalty: '₱0.00', paidDate: '-', paid: '₱0.00', reference: '-', status: 'Unpaid', ending: '₱839,200.00' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Payments &amp; SOA</h2>
          <p className="text-sm text-slate-500">Record payments here so the audit log, SOA row, reference number, and unit stay connected.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddPaymentModal(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          <FiPlus className="h-4 w-4" />
          Add Payment
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['Total TCP', '₱1,008,000.00'],
          ['Total Paid', '₱168,800.00'],
          ['Balance', '₱839,200.00'],
          ['Payment Status', 'Active'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{value}</h3>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Beginning Balance</th>
              <th className="px-4 py-3">Due Amount</th>
              <th className="px-4 py-3">Penalty</th>
              <th className="px-4 py-3">Date Paid</th>
              <th className="px-4 py-3">Amount Paid</th>
              <th className="px-4 py-3">Reference ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ending Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${row.dueDate}-${row.description}`}>
                <td className="px-4 py-4 font-semibold text-slate-700">{row.dueDate}</td>
                <td className="px-4 py-4 font-bold text-slate-950">{row.description}</td>
                <td className="px-4 py-4 text-slate-700">{row.beginning}</td>
                <td className="px-4 py-4 font-bold text-slate-950">{row.due}</td>
                <td className="px-4 py-4 text-slate-700">{row.penalty}</td>
                <td className="px-4 py-4 text-slate-700">{row.paidDate}</td>
                <td className="px-4 py-4 font-bold text-blue-700">{row.paid}</td>
                <td className="px-4 py-4 font-semibold text-slate-700">{row.reference}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${row.status === 'Paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{row.status}</span>
                </td>
                <td className="px-4 py-4 font-bold text-slate-950">{row.ending}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddPaymentModal ? <AddPaymentModal setShowAddPaymentModal={setShowAddPaymentModal} /> : null}
    </div>
  )
}

export default Payments_SOA
