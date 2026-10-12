import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiPrinter, FiX, FiSearch } from 'react-icons/fi'
import { useFetch } from '../../../utils/useFetch'
import { groupNetworkProfitReceiptRows } from '../../../utils/networkProfitReceiptGroups'
import StatusAlert from '../../Shared/StatusAlert'
import NetworkProfitProofOfIncomeModal from './NetworkProfitProofOfIncomeModal'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

export default function NetworkProfitAcknowledgementLibrary({ canPrint = false, canViewFiles = false, canUpload = false, onClose, embedded = false }) {
  const [openGroupKey, setOpenGroupKey] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['network-company-profit-acknowledgments'],
    queryFn: () => useFetch('/accredited/network-company-profit-acknowledgments'),
  })
  const groups = useMemo(() => groupNetworkProfitReceiptRows(data?.data || []), [data])
  const filtered = groups.filter((g) => [g.network, g.payee, ...g.records.flatMap((r) => [r.profit.project, r.profit.unit, r.profit.buyer, r.profit.accountReference])]
    .some((v) => String(v || '').toLowerCase().includes(search.trim().toLowerCase())))
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const pageGroups = filtered.slice((activePage-1)*pageSize, activePage*pageSize)
  const activeGroup = groups.find((g) => g.key === openGroupKey)
  return <section className={embedded ? 'rounded-2xl border border-slate-200 bg-white shadow-sm' : 'fixed inset-0 z-[75] overflow-y-auto bg-slate-950/60 p-4'}>
    <div className={embedded ? '' : 'mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl'}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-4">
        <div><h2 className="text-lg font-black text-slate-950">Proof of Income &amp; Network Company Profit</h2>
          <p className="mt-1 text-sm text-slate-500">One row per Network/Realty payee. Open Print Proof of Income to review each property and its released stages.</p>
        </div>
        {!embedded && onClose ? <button type="button" aria-label="Close Network Company Profit" onClick={onClose} className="rounded border px-3 py-2"><FiX/></button> : null}
      </header>
      <div className="p-4"><label className="relative block max-w-sm"><FiSearch className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input aria-label="Search Company Profit Networks" value={search} onChange={(e) => {setSearch(e.target.value);setPage(1)}}
          placeholder="Search Network, payee, project, unit or buyer..." className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm" /></label></div>
      {isLoading ? <p className="px-4 py-7 text-sm text-slate-500">Loading Network Company Profit...</p> : null}
      {isError ? <div className="p-4"><StatusAlert type="error" message={error?.message || 'Could not load Network Company Profit.'}/></div> : null}
      {!isLoading && !isError && !filtered.length ? <p className="px-4 py-7 text-sm text-slate-500">No released Network Company Profit matches this search.</p> : null}
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500"><tr>
          {['Network / Realty','Registered Payee','Properties','Released Stages','Released Total','Actions'].map((heading) => <th key={heading} className="border-y border-slate-200 px-4 py-3">{heading}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{pageGroups.map((group) => <tr key={group.key} className="hover:bg-slate-50">
          <td className="px-4 py-4 font-black text-slate-950">{group.network}</td>
          <td className="px-4 py-4 text-slate-700">{group.payee || '-'}</td>
          <td className="px-4 py-4 font-semibold text-slate-700">{group.propertyCount}</td>
          <td className="px-4 py-4 text-slate-700">{group.releaseCount}</td>
          <td className="px-4 py-4 font-black text-emerald-700">{money(group.releasedAmount)}</td>
          <td className="px-4 py-4">{canPrint || canViewFiles || canUpload ? <button type="button" onClick={() => setOpenGroupKey(group.key)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-blue-50"><FiPrinter/>{canPrint ? 'Print Proof of Income' : 'View Acknowledgments'}</button>
            : <span className="text-xs font-semibold text-slate-400">View only</span>}</td>
        </tr>)}</tbody>
      </table></div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500">Showing page {activePage} of {totalPages} · {filtered.length} Network/Realty payee records</p>
        <div className="flex items-center gap-2"><select aria-label="Networks per page" value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value));setPage(1)}} className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select>
          <button type="button" disabled={activePage===1} onClick={()=>setPage((p)=>Math.max(1,p-1))} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Prev</button>
          <button type="button" disabled={activePage===totalPages} onClick={()=>setPage((p)=>Math.min(totalPages,p+1))} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Next</button>
        </div>
      </footer>
    </div>
    {activeGroup ? <NetworkProfitProofOfIncomeModal group={activeGroup} canPrint={canPrint} canViewFiles={canViewFiles} canUpload={canUpload} onClose={()=>setOpenGroupKey(null)}/> : null}
  </section>
}
