import { useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import AddPaymentModal from '../../PaymentComponents/AddPaymentModal/AddPaymentModal'
import { formatMoney } from '../../../../utils/formatMoney'

const Payments_SOA = ({ listing, soaRows = [], payments = [] }) => {
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
        <div><h2 className="text-lg font-bold text-slate-950">Payments & SOA</h2><p className="text-sm font-semibold text-slate-500">Payments are saved here and copied to Payments Audit as read-only logs.</p></div>
        <button onClick={() => setShowAddPaymentModal(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"><FiPlus />Add Payment</button>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Due Amount</th><th className="px-4 py-3">Penalty</th><th className="px-4 py-3">Date Paid</th><th className="px-4 py-3">Amount Paid</th><th className="px-4 py-3">Reference ID</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{soaRows.length === 0 ? <tr><td colSpan="9" className="px-4 py-8 text-center font-semibold text-slate-500">No SOA rows yet.</td></tr> : soaRows.map(row=><tr key={row.soa_row_id}><td className="px-4 py-4 font-bold">{row.due_date}</td><td className="px-4 py-4">{row.description}</td><td className="px-4 py-4 font-bold text-blue-700">{formatMoney(row.due_amount)}</td><td className="px-4 py-4">{formatMoney(row.penalty)}</td><td className="px-4 py-4">{row.date_paid || '-'}</td><td className="px-4 py-4 font-bold text-emerald-700">{formatMoney(row.amount_paid)}</td><td className="px-4 py-4">{row.reference_id || '-'}</td><td className="px-4 py-4">{formatMoney(row.ending_balance)}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{row.status}</span></td></tr>)}</tbody></table></div>
      <div className="border-t border-slate-200 p-5"><h3 className="font-bold text-slate-950">Posted Payments</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{payments.length === 0 ? <p className="text-sm font-semibold text-slate-500">No payments yet.</p> : payments.map(payment=><div key={payment.payment_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-bold text-slate-950">{formatMoney(payment.amount)} • {payment.payment_type?.replaceAll('_',' ')}</p><p className="text-sm font-semibold text-slate-500">{payment.payment_date} • {payment.payment_method?.replaceAll('_',' ')} • {payment.reference_id}</p></div>)}</div></div>
      {showAddPaymentModal ? <AddPaymentModal setShowAddPaymentModal={setShowAddPaymentModal} defaultListingId={listing.bailen_listing_id} /> : null}
    </section>
  )
}

export default Payments_SOA
