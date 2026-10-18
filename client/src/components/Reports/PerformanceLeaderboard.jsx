import { useMemo, useState } from 'react'
import { rankPerformance } from '../../utils/reportPerformance'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))
const selectClass = 'h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700'
const metrics = [{ value: 'salesAmount', label: 'Sales Value' }, { value: 'units', label: 'Units Sold' }, { value: 'cashCollected', label: 'Cash Collected' }, { value: 'grossCommission', label: 'Earnings' }, { value: 'releasedCommission', label: 'Released' }]

const PerformanceLeaderboard = ({ sellers = [], networks = [], scope = 'project', rosterLoading = false, rosterError = false }) => {
  const [tab,setTab] = useState('seller')
  const [type,setType] = useState('all')
  const [role,setRole] = useState('all')
  const [metric,setMetric] = useState('salesAmount')
  const [search,setSearch] = useState('')
  const [page,setPage] = useState(1)
  const [pageSize,setPageSize] = useState(10)
  const [expanded,setExpanded] = useState(null)
  const zeroSaleSellers = sellers.filter((seller) => Number(seller.units || 0) === 0).length
  const roles = useMemo(() => [...new Set(sellers.map((seller) => seller.role).filter(Boolean))].sort(), [sellers])
  const filtered = useMemo(() => rankPerformance(tab === 'network' ? networks : sellers, { metric, search, networkType: type, role: tab === 'seller' ? role : 'all' }), [tab, networks, sellers, metric, search, type, role])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, totalPages)
  const rows = filtered.slice((current-1)*pageSize, current*pageSize)
  const changeFilter = (setter) => (value) => { setter(value); setPage(1); setExpanded(null) }
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Seller Performance Details</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Compare every accredited Seller, including those with zero sales during the selected period, and Company/Network performance. Sales use buyer accounts reserved in the selected period; cash includes their verified payments in that period. Each account is attributed once. Manager overrides are earnings, not additional sales. {scope === 'system' ? 'All selected projects.' : 'Current Lot Project only.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { changeFilter(setTab)('network') }} className={`rounded-xl px-4 py-2 text-xs font-black ${tab === 'network' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Company / Network</button>
          <button type="button" onClick={() => { changeFilter(setTab)('seller') }} className={`rounded-xl px-4 py-2 text-xs font-black ${tab === 'seller' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Sellers</button>
        </div>
      </header>
      {rosterLoading ? <p className="border-b border-slate-100 bg-blue-50 px-5 py-3 text-xs font-semibold text-blue-800">Loading accredited seller directory…</p> : null}
      {rosterError ? <p role="alert" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-800">Accredited seller directory could not load. Sellers with no reported activity may be missing from this list; try refreshing.</p> : null}
      <div className="border-b border-slate-100 px-5 py-3 text-xs font-semibold text-slate-600" aria-live="polite">
        {tab === 'seller' ? `${number(sellers.length)} accredited sellers ranked · ${number(zeroSaleSellers)} with no sales in selected period` : `${number(networks.length)} Networks ranked`}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-black text-slate-500">Search<input aria-label="Search performance" value={search} onChange={(event) => changeFilter(setSearch)(event.target.value)} placeholder="Seller, Network, payee..." className={selectClass} /></label>
        <label className="flex flex-col gap-1 text-xs font-black text-slate-500">Network Type<select aria-label="Network Type" className={selectClass} value={type} onChange={(event) => changeFilter(setType)(event.target.value)}><option value="all">All Networks</option><option value="in_house">In-House</option><option value="external">External</option></select></label>
        {tab === 'seller' ? <label className="flex flex-col gap-1 text-xs font-black text-slate-500">Seller Role<select aria-label="Seller Role" value={role} className={selectClass} onChange={(event) => changeFilter(setRole)(event.target.value)}><option value="all">All Roles</option>{roles.map((r) => <option key={r} value={r}>{r.replaceAll('_',' ')}</option>)}</select></label> : null}
        <label className="flex flex-col gap-1 text-xs font-black text-slate-500">Rank By<select aria-label="Rank By" value={metric} className={selectClass} onChange={(event) => changeFilter(setMetric)(event.target.value)}>{metrics.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1010px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{['Rank',tab === 'network' ? 'Company / Network' : 'Seller','Type / Role','Projects','Units Sold','Sales Value','Cash Collected',tab === 'network' ? 'Network Earnings' : 'Gross Commission','Released','Remaining','Breakdown'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {rows.map((row,idx) => {
          const key = `${tab}:${row.id}`
          const open = expanded === key
          return <tr key={key} className="align-top">
            <td className="px-3 py-4 font-black text-blue-700">#{(current-1)*pageSize+idx+1}</td>
            <td className="px-3 py-4"><p className="font-black text-slate-900">{tab === 'network' ? row.group : row.seller}</p><p className="mt-1 text-xs text-slate-500">{tab === 'network' ? row.payee : row.group}</p>{tab === 'seller' && Number(row.units || 0) === 0 ? <span className="mt-2 inline-block rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">No sales in period</span> : null}{tab === 'seller' && row.status === 'inactive' ? <span className="ml-1 inline-block rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Inactive</span> : null}</td>
            <td className="px-3 py-4 font-semibold capitalize text-slate-600">{tab === 'network' ? (row.groupType === 'in_house' ? 'In-House' : 'External') : String(row.role || '').replaceAll('_',' ')}</td>
            <td className="px-3 py-4">{number(row.projectCount ?? 1)}</td><td className="px-3 py-4 font-black">{number(row.units)}</td>
            <td className="px-3 py-4 font-black text-blue-700">{money(row.salesAmount)}</td>
            <td className="px-3 py-4 font-semibold text-emerald-700">{money(row.cashCollected)}</td>
            <td className="px-3 py-4"><p className="font-black">{money(row.grossCommission)}</p>{tab === 'network' ? <p className="mt-1 text-[10px] text-slate-500">{row.groupType === 'in_house' ? 'In-House Company Profit' : 'External Network Commission'}</p> : null}</td>
            <td className="px-3 py-4 font-semibold text-emerald-700">{money(row.releasedCommission)}</td><td className="px-3 py-4 font-semibold text-amber-700">{money(row.remainingCommission)}</td>
            <td className="px-3 py-4"><button type="button" onClick={() => setExpanded(open ? null : key)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-blue-700">{open ? 'Hide' : 'Details'}</button>{open ? <div className="mt-2 min-w-52 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><p className="font-black">Project breakdown</p>{row.projects?.length === 0 ? <p className="mt-2">No project activity in this reporting scope.</p> : null}{(row.projects || [{ name: 'Current project', ...row }]).map((p) => <p key={p.id || p.name} className="mt-2">{p.name}: {number(p.units)} sales · {money(p.salesAmount)} · Collected {money(p.cashCollected)}</p>)}</div> : null}</td>
          </tr>
        })}
        {!rows.length ? <tr><td colSpan={11} className="px-5 py-10 text-center font-semibold text-slate-500">No accredited sellers or Networks match the current filters.</td></tr> : null}
      </tbody></table></div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-4 text-xs font-semibold text-slate-600"><span>Showing {filtered.length ? (current-1)*pageSize+1 : 0}–{Math.min(current*pageSize,filtered.length)} of {filtered.length} · {scope === 'system' ? 'Cross-project' : 'Project'} ranking</span><div className="flex items-center gap-2"><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className={selectClass}>{[5,10,20,50].map((size) => <option key={size} value={size}>{size}</option>)}</select><button type="button" onClick={() => setPage((p) => Math.max(1,p-1))} disabled={current === 1} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span>{current} / {totalPages}</span><button type="button" onClick={() => setPage((p) => Math.min(totalPages,p+1))} disabled={current >= totalPages} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div></footer>
    </section>
  )
}

export default PerformanceLeaderboard

