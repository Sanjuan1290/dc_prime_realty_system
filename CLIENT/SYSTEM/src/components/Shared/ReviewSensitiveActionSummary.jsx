import { useMemo, useState } from 'react'
import { FiArrowRight, FiSearch, FiShield, FiUsers } from 'react-icons/fi'

// Uses only values persisted in the historical Review snapshots. Live seller,
// Network or commission lookups would rewrite the meaning of older evidence.
const parse = (value) => {
  if (!value) return {}
  if (typeof value === 'object') return value
  try { return JSON.parse(value) || {} } catch { return {} }
}
const label = (value) => value === null || value === undefined || value === '' ? 'Not Recorded' : String(value)
const money = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value)) : 'Not Recorded'
const ROLE = {sales_agent:'Sales Agent',unit_manager:'Unit Manager',sales_director:'Sales Director',division_manager:'Division Manager',external_group:'External Network'}
const displayRole = (role) => ROLE[String(role || '')] || label(role)
const panel = 'rounded-xl border border-slate-200 bg-slate-50 p-3'

const ManagerSummary = ({ before, after }) => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const changes = useMemo(() => Array.isArray(after.reportingSellers) ? after.reportingSellers : (Array.isArray(before.reportingSellers) ? before.reportingSellers : []), [after.reportingSellers, before.reportingSellers])
  const filtered = changes.filter(row => `${row.name || ''} ${row.fullName || ''} ${row.sellerId || ''}`.toLowerCase().includes(search.toLowerCase().trim()))
  const perPage = 10
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const current = Math.min(page, pages)
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Manager replacement history">
    <div className="mb-4 flex items-center gap-2"><FiUsers className="text-blue-600" aria-hidden="true" /><h3 className="font-black">Manager Replacement — Before &amp; After</h3></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={panel}><p className="text-xs font-semibold text-slate-500">Before · Previous Manager</p><p className="mt-2 font-bold">{label(before.manager?.name)}</p><p className="text-xs text-slate-500">{displayRole(before.manager?.role)}</p><p className="mt-2 text-sm">Account: {label(before.accountStatus)}</p></div>
      <div className={panel}><p className="text-xs font-semibold text-slate-500">After · New Manager</p><p className="mt-2 font-bold">{label(after.manager?.name)}</p><p className="text-xs text-slate-500">{displayRole(after.manager?.role)}</p><p className="mt-2 text-sm">Former manager: {label(after.formerManagerStatus)}</p></div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-2"><h4 className="font-bold">Sellers Reassigned ({changes.length})</h4><label className="relative"><FiSearch aria-hidden="true" className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search affected sellers" className="h-10 w-48 rounded-xl border border-slate-300 pl-9 pr-2 text-sm"/></label></div>
    <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-500"><th className="p-2">Seller</th><th className="p-2">Previous Manager</th><th className="p-2">New Manager</th></tr></thead><tbody>{filtered.slice((current-1)*perPage,current*perPage).map((row,i)=><tr className="border-b" key={row.sellerId || i}><td className="p-2">{label(row.name || row.fullName || row.sellerId)}</td><td className="p-2">{label(before.manager?.name)}</td><td className="p-2">{label(after.manager?.name)}</td></tr>)}</tbody></table></div>
    {!filtered.length ? <p className="py-3 text-sm text-slate-500">No matching sellers.</p> : null}
    {pages>1 ? <div className="mt-3 flex items-center justify-end gap-2"><button type="button" disabled={current<=1} onClick={()=>setPage(v=>v-1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Previous</button><span className="text-sm">{current} of {pages}</span><button type="button" disabled={current>=pages} onClick={()=>setPage(v=>v+1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Next</button></div> : null}
    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><FiShield aria-hidden="true"/> Existing sales and commissions were not reassigned by this operation.</p>
  </section>
}

const SellerChangeSummary = ({ before, after }) => {
  const oldRows = Array.isArray(before.hierarchy) ? before.hierarchy : []
  const newRows = Array.isArray(after.hierarchy) ? after.hierarchy : []
  const max = Math.max(oldRows.length,newRows.length)
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Assigned seller change history">
    <div className="mb-3 flex items-center gap-2"><FiArrowRight aria-hidden="true" className="text-blue-600"/><h3 className="font-black">Assigned Seller Changed — Before &amp; After</h3></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={panel}><p className="text-xs font-semibold text-slate-500">Before · Assigned Seller</p><p className="mt-2 font-bold">{label(before.assignedSellerName || before.assignedSellerId)}</p></div>
      <div className={panel}><p className="text-xs font-semibold text-slate-500">After · Assigned Seller</p><p className="mt-2 font-bold">{label(after.assignedSellerName || after.assignedSellerId)}</p></div>
    </div>
    <h4 className="mb-2 mt-4 font-bold">Commission Distribution</h4>
    <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr className="border-b"><th className="p-2">Before</th><th className="p-2">After</th></tr></thead><tbody>{Array.from({length:max},(_,i)=>{
      const a=oldRows[i],b=newRows[i]
      const summary=x=>x ? <><p className="font-semibold">{label(x.sellerName || x.full_name || x.seller_display_name_snapshot || x.accreditedSellerId)}</p><p className="text-xs text-slate-500">{displayRole(x.role || x.commission_role)} · {label(x.rate ?? x.commissionRate)}%</p><p className="text-xs">{money(x.grossCommission ?? x.grossCommissionAmount ?? x.gross_commission_amount)}</p></> : <span className="text-slate-500">Not Recorded</span>
      return <tr key={i} className="border-b align-top"><td className="p-2">{summary(a)}</td><td className="p-2">{summary(b)}</td></tr>
    })}</tbody></table></div>
    {!max ? <p className="mt-3 text-sm text-slate-500">Individual commission values were not recorded in this review.</p>:null}
    <p className="mt-3 text-xs text-slate-500">Amounts shown are saved historical values; they are not recalculated.</p>
  </section>
}

export default function ReviewSensitiveActionSummary({actionKey,beforeValue,afterValue}){
 const before=parse(beforeValue),after=parse(afterValue)
 if(actionKey==='seller.manager_replace') return <ManagerSummary before={before} after={after}/>
 if(actionKey==='commission.assigned_seller_change') return <SellerChangeSummary before={before} after={after}/>
 return null
}

