import { useMemo } from 'react'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const roleLabel = (value) =>
  String(value || '-')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

const statusTone = (value = '') => {
  const status = String(value || '').toLowerCase()
  if (status === 'released') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'eligible') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'partially released') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (status === 'on hold') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'cancelled') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

const typeTone = (value = '') =>
  String(value || '').toLowerCase() === 'direct'
    ? 'bg-blue-50 text-blue-700'
    : 'bg-violet-50 text-violet-700'

const SummaryCard = ({ label, value, tone = 'slate' }) => {
  const toneClasses = {
    slate: 'border-slate-200 bg-slate-50 text-slate-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
  }

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone] || toneClasses.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-base font-black">{value}</p>
    </div>
  )
}

const summarizeCommissionDistribution = (rows = []) => {
  const activeRows = Array.isArray(rows) ? rows : []
  const firstBase = activeRows.find((row) => Number(row.commissionBase || 0) > 0)?.commissionBase || 0

  return activeRows.reduce(
    (summary, row) => {
      summary.commissionBase = Number(firstBase || summary.commissionBase || 0)
      summary.allocatedRate += Number(row.rate || 0)
      summary.grossCommission += Number(row.grossCommission || 0)
      summary.releasedAmount += Number(row.releasedAmount || 0)
      summary.cashAdvanceDeduction += Number(row.cashAdvanceDeduction || 0)
      summary.remainingAmount += Number(row.remainingAmount || 0)
      return summary
    },
    {
      commissionBase: Number(firstBase || 0),
      allocatedRate: 0,
      grossCommission: 0,
      releasedAmount: 0,
      cashAdvanceDeduction: 0,
      remainingAmount: 0,
    }
  )
}

const CommissionDistribution = ({
  rows = [],
  title = 'Saved Commission Distribution',
  description = 'Commission recipients and amounts saved when this unit was reserved.',
  emptyMessage = 'No saved commission hierarchy exists for this unit yet.',
  showSummary = true,
}) => {
  const hierarchy = useMemo(() => (Array.isArray(rows) ? rows : []), [rows])
  const summary = useMemo(() => summarizeCommissionDistribution(hierarchy), [hierarchy])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {showSummary ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="Commission Base" value={money(summary.commissionBase)} />
            <SummaryCard label="Saved Pool Rate" value={`${summary.allocatedRate.toFixed(2)}%`} tone="blue" />
            <SummaryCard label="Gross Commission" value={money(summary.grossCommission)} tone="emerald" />
            <SummaryCard label="Released" value={money(summary.releasedAmount)} tone="blue" />
            <SummaryCard label="Deductions" value={money(summary.cashAdvanceDeduction)} tone="amber" />
            <SummaryCard label="Remaining" value={money(summary.remainingAmount)} tone="violet" />
          </div>
        ) : null}

        {hierarchy.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1180px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {[
                      'Order',
                      'Seller',
                      'Role',
                      'Commission Type',
                      'Reports Under',
                      'Rate',
                      'Gross',
                      'Released',
                      'Remaining',
                      'Status',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {hierarchy.map((row, index) => (
                    <tr key={row.commissionId || `${row.accreditedSellerId}-${row.role}-${index}`} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-black text-slate-500">{index + 1}</td>
                      <td className="px-4 py-4">
                        <p className="font-black text-slate-950">{row.sellerName || '-'}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{row.sellerGroup || 'No group'}</p>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-700">{row.roleLabel || roleLabel(row.role)}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${typeTone(row.commissionType)}`}>
                          {row.commissionType || 'Override'}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">{row.reportsUnder || 'Developer'}</td>
                      <td className="px-4 py-4 font-black text-blue-700">{Number(row.rate || 0).toFixed(2)}%</td>
                      <td className="px-4 py-4 font-black text-slate-950">{money(row.grossCommission)}</td>
                      <td className="px-4 py-4 font-semibold text-slate-700">{money(row.releasedAmount)}</td>
                      <td className="px-4 py-4 font-black text-violet-700">{money(row.remainingAmount)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>
                          {row.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {hierarchy.map((row, index) => (
                <article
                  key={row.commissionId || `${row.accreditedSellerId}-${row.role}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Order {index + 1}</p>
                      <h4 className="mt-1 text-sm font-black text-slate-950">{row.sellerName || '-'}</h4>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">{row.roleLabel || roleLabel(row.role)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${typeTone(row.commissionType)}`}>
                      {row.commissionType || 'Override'}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="font-bold text-slate-500">Reports Under</dt><dd className="mt-1 font-black text-slate-800">{row.reportsUnder || 'Developer'}</dd></div>
                    <div><dt className="font-bold text-slate-500">Rate</dt><dd className="mt-1 font-black text-blue-700">{Number(row.rate || 0).toFixed(2)}%</dd></div>
                    <div><dt className="font-bold text-slate-500">Gross</dt><dd className="mt-1 font-black text-slate-950">{money(row.grossCommission)}</dd></div>
                    <div><dt className="font-bold text-slate-500">Released</dt><dd className="mt-1 font-black text-slate-800">{money(row.releasedAmount)}</dd></div>
                    <div><dt className="font-bold text-slate-500">Deductions</dt><dd className="mt-1 font-black text-amber-700">{money(row.cashAdvanceDeduction)}</dd></div>
                    <div><dt className="font-bold text-slate-500">Remaining</dt><dd className="mt-1 font-black text-violet-700">{money(row.remainingAmount)}</dd></div>
                  </dl>

                  <span className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>
                    {row.status || 'Pending'}
                  </span>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm font-semibold text-slate-500">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  )
}

export default CommissionDistribution

