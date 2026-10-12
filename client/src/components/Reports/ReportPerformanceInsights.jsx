import { useMemo } from 'react'

const pesos = (value) => new Intl.NumberFormat('en-PH', {style:'currency',currency:'PHP'}).format(Number(value||0))
const percent = (numerator, denominator) => Number(denominator||0)>0 ? `${(100*Number(numerator||0)/Number(denominator)).toFixed(1)}%` : '—'
const metricKeys = [{key:'days1To30',label:'1–30 days'},{key:'days31To60',label:'31–60 days'},{key:'days61To90',label:'61–90 days'},{key:'daysOver90',label:'90+ days'}]
const ReportPerformanceInsights = ({stats={},aging={},networks=[],scope='project'}) => {
  const split = useMemo(() => networks.reduce((totals,row) => {
    if (row.groupType === 'in_house') totals.inHouse += Number(row.grossCommission||0)
    if (row.groupType === 'external') totals.external += Number(row.grossCommission||0)
    return totals
  },{inHouse:0,external:0}),[networks])
  const grossSales = Number(stats.totalGrossSales || 0)
  const cash = Number(stats.totalCashCollected ?? stats.cashCollected ?? 0)
  const cancellations = Number(stats.cancelledCount || 0)
  const reservations = Number(stats.reservationCount || 0)
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Collection, Cancellation &amp; Commission Insights</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">Additional operational indicators; the existing financial snapshot amounts and formulas are unchanged.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Collected / Gross Sales</p><p className="mt-2 text-xl font-black text-emerald-700">{percent(cash,grossSales)}</p><p className="mt-1 text-xs text-slate-500">Ratio of selected-period cash to gross sales; not a repayment-compliance rate.</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Cancellation Activity Ratio</p><p className="mt-2 text-xl font-black text-amber-700">{percent(cancellations,reservations)}</p><p className="mt-1 text-xs text-slate-500">Finalized cancellation events / reservation events in range; not a cohort cancellation rate.</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">In-House Company Profit</p><p className="mt-2 text-xl font-black text-blue-700">{pesos(split.inHouse)}</p><p className="mt-1 text-xs text-slate-500">Company Profit for sales attributed to In-House Networks.</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">External Network Commission</p><p className="mt-2 text-xl font-black text-indigo-700">{pesos(split.external)}</p><p className="mt-1 text-xs text-slate-500">External Network earnings—not classified as Company Profit.</p></div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-black text-slate-900">Current Overdue Aging — {scope === 'system' ? 'Included Projects' : 'This Project'}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Current unpaid SOA obligations aged through today, grouped by due date. These are current-state operational balances, not historical balances reconstructed for the selected date range.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{metricKeys.map((item) => <div key={item.key} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="mt-1 font-black text-slate-900">{pesos(aging[item.key])}</p></div>)}</div>
      </div>
    </section>
  )
}
export default ReportPerformanceInsights
