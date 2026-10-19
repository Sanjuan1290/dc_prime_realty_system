import { FiArrowRight, FiCheckCircle } from 'react-icons/fi'
import { summarizeSellerChangeRows, changedSellerRows } from './sellerChangePresentation'

const money = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
}).format(Number(amount || 0))
const rate = (value) => `${Number(value || 0).toFixed(4)}%`
const roleName = (value) => String(value || 'Seller').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
export default function SellerChangeHierarchy({
  rows = [], comparison = [], title = 'Proposed Commission Hierarchy',
  subtitle = 'Server-calculated preview. Nothing has been saved yet.',
  showSummary = true, showReportsUnder = false, highlightChanges = false,
  proposal = false,
}) {
  const summary = summarizeSellerChangeRows(rows)
  const compared = highlightChanges ? changedSellerRows(rows, comparison) : rows
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${proposal ? 'border-blue-200' : 'border-slate-200'}`} aria-label={title}>
      <header className="border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">
            {proposal ? <FiCheckCircle className="text-emerald-600" aria-hidden="true" /> : null}{title}
          </h3>
          {proposal ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">Preview only</span> : null}
        </div>
        <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
      </header>
      <div className="p-3 sm:p-4">
        {showSummary ? (
          <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Recipients</dt><dd className="mt-1 text-base font-black text-slate-900">{summary.recipients}</dd></div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Allocated rate</dt><dd className="mt-1 text-base font-black text-blue-800 tabular-nums">{rate(summary.allocatedRate)}</dd></div>
            <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 sm:col-span-1"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Recipient commissions</dt><dd className="mt-1 text-base font-black text-emerald-800 tabular-nums">{money(summary.gross)}</dd></div>
          </dl>
        ) : null}
        {compared.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[430px] text-left text-xs sm:min-w-0">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr>
                <th scope="col" className="px-3 py-2.5">Seller / Position</th>
                <th scope="col" className="px-3 py-2.5 text-right">Rate</th>
                <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {compared.map((row, index) => (
                  <tr key={`${row.accreditedSellerId || 'seller'}-${row.role}-${index}`} className={row.changed ? 'bg-blue-50/70' : 'bg-white'}>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-black text-slate-900">{row.sellerName || '-'}</span>
                        {highlightChanges && row.changed ? <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-black text-blue-700">Changed</span> : null}
                      </div>
                      <span className="mt-0.5 block font-semibold text-slate-500">{roleName(row.role)}</span>
                      {showReportsUnder ? <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><FiArrowRight aria-hidden="true"/> Reports to {row.reportsUnder || 'Developer'}</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right align-top font-black text-blue-700 tabular-nums">{rate(row.rate)}</td>
                    <td className="px-3 py-3 text-right align-top font-black text-slate-900 tabular-nums">{money(row.grossCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No commission recipients available.</p>}
      </div>
    </section>
  )
}
