import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiDownload, FiRefreshCw, FiSearch, FiShieldOff, FiX, FiEye } from 'react-icons/fi'
import { useFetch } from '../../../utils/useFetch'
import { getSellerRoleLabel } from '../../../config/sellerRoles'
import { getTeamCompletenessLabel, getTeamCompletenessHint } from '../../../utils/sellerTeamStatus'

const tones={ready:'text-emerald-700 bg-emerald-50',attention:'text-amber-800 bg-amber-50',blocked:'text-red-700 bg-red-50',inactive:'text-slate-600 bg-slate-100'}
const names={ready:'Ready',attention:'Needs Attention',blocked:'Cannot Reserve',inactive:'Inactive'}
const csvEscape=(value)=>`"${String(value??'').replace(/^[=+@-]/,'\u0027$&').replaceAll('"','""')}"`
const downloadReport=(audit)=>{
  const columns=['Seller ID','Seller','Position','Account Status','Seller Status','Reservation Setup','Setup Issues','Team Completeness','Active Direct Reports','Missing Position','Team Gaps','Buyer Accounts'];
  const rows=(audit.records||[]).map(r=>[r.userId,r.name,getSellerRoleLabel(r.role),r.accountStatus,r.sellerStatus,names[r.readiness],r.issues.map(i=>i.message).join('; '),getTeamCompletenessLabel(r.team, r.role),r.team?.directReportCount || 0,getSellerRoleLabel(r.team?.missingRole || '')||'',(r.team?.messages||[]).join('; '),r.assignedBuyerCount]);
  const csv='\uFEFF'+[columns,...rows].map(line=>line.map(csvEscape).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`seller-setup-${audit.group.id}.csv`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url)
}
const SellerSetupCheck=({groupId,onClose,onViewSeller,onAssignSeller})=>{
  const [search,setSearch]=useState('');const [onlyIssues,setOnlyIssues]=useState(false);const [teamFilter,setTeamFilter]=useState('all');const [page,setPage]=useState(1)
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus() }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [onClose])
  const {data,error,isLoading,isFetching,refetch}=useQuery({queryKey:['seller-setup-check',Number(groupId)],queryFn:()=>useFetch(`/seller-groups/${groupId}/setup-check`),enabled:Boolean(groupId),staleTime:30000});
  const audit=data?.data;const rows=useMemo(()=> (audit?.records||[]).filter(r=>(!onlyIssues || r.readiness!=='ready' || ['needs_assignment','partial'].includes(r.team?.status)) && (teamFilter==='all' || r.team?.status===teamFilter) && `${r.name} ${r.role} ${r.issues.map(i=>i.message).join(' ')} ${(r.team?.messages || []).join(' ')} ${getTeamCompletenessLabel(r.team,r.role)}`.toLowerCase().includes(search.toLowerCase())),[audit,onlyIssues,teamFilter,search])
  useEffect(()=>setPage(1),[search,onlyIssues,teamFilter,groupId])
  const pageCount=Math.max(Math.ceil(rows.length/10),1)
  const pageRows=rows.slice((Math.min(page,pageCount)-1)*10,Math.min(page,pageCount)*10)
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} id="seller-setup-check" role="dialog" aria-modal="true" aria-labelledby="seller-setup-title" className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4"><div className="flex items-center gap-2"><FiCheckCircle className="text-blue-700"/><h2 id="seller-setup-title" className="text-base font-bold text-slate-950">Check Seller Setup</h2></div><div className="flex gap-2"><button type="button" onClick={()=>refetch()} disabled={isFetching} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><FiRefreshCw/> Refresh</button><button type="button" ref={closeRef} onClick={onClose} aria-label="Close seller setup" className="rounded-lg border p-2"><FiX/></button></div></header>
    <div className="grid min-h-0 gap-4 overflow-y-auto p-5">
      {isLoading && <p role="status" className="text-sm text-slate-500">Checking seller assignments...</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error.message||'Could not check seller setup.'}</p>}
      {audit && <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
          ['Ready',audit.summary.ready,'text-emerald-700'],['Needs Attention',audit.summary.attention,'text-amber-800'],['Cannot Reserve',audit.summary.blocked,'text-red-700'],['Inactive',audit.summary.inactive,'text-slate-600']
        ].map(([label,value,color])=><div key={label} className="rounded-xl border p-3"><p className="text-xs text-slate-500">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></div>)}</div>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600"><span>Complete Manager Teams: {audit.teamSummary?.complete || 0}</span><span>Managers Needing Attention: {audit.teamSummary?.needsAssignment || 0}</span><span>Some Teams Incomplete: {audit.teamSummary?.partial || 0}</span><span>Agents With Assignment Issues: {audit.teamSummary?.agentsNeedingManager || 0}</span></div>
        {audit.networkWarnings.length>0 && <div role="alert" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><FiAlertTriangle className="mt-0.5 shrink-0"/><span>{audit.networkWarnings.join('. ')}.</span></div>}
        <div className="flex flex-wrap items-center gap-2"><label className="relative min-w-[220px] flex-1"><FiSearch className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sellers or issues" aria-label="Search sellers or issues" className="h-10 w-full rounded-xl border pl-9 pr-3 text-sm"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyIssues} onChange={e=>setOnlyIssues(e.target.checked)}/> Needs attention only</label><label className="text-xs font-semibold">Team completeness <select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)} aria-label="Filter team completeness" className="ml-2 rounded-lg border p-2"><option value="all">All</option><option value="needs_assignment">Needs Attention</option><option value="partial">Some Teams Incomplete</option><option value="complete">Team Complete</option><option value="inactive">Inactive</option></select></label><button type="button" onClick={()=>downloadReport(audit)} className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold"><FiDownload/> Export Results</button></div>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Seller</th><th className="p-3">Position</th><th className="p-3">Status</th><th className="p-3">Setup</th><th className="p-3">Team Completeness</th><th className="p-3">What needs fixing</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y">{pageRows.map(r=><tr key={r.accreditedSellerId}><td className="p-3 font-semibold">{r.name}</td><td className="p-3">{getSellerRoleLabel(r.role)}</td><td className="p-3">{r.accountStatus==='active' && r.sellerStatus==='active'?'Active':'Inactive'}</td><td className="p-3"><span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${tones[r.readiness]}`}>{r.readiness==='ready'?<FiCheckCircle/>:r.readiness==='inactive'?<FiShieldOff/>:<FiAlertTriangle/>}{names[r.readiness]}</span></td><td className="p-3 text-xs font-semibold"><span title={getTeamCompletenessHint(r.team, r.role)}>{getTeamCompletenessLabel(r.team, r.role)}</span>{r.team?.directReportCount ? <span className="block text-slate-500">{r.team.directReportCount} direct reports</span> : null}</td><td className="p-3"><ul className="space-y-1">{r.issues.length?r.issues.map(i=><li key={i.code}>{i.message}</li>):<li className="text-slate-500">No setup issues</li>}{(r.team?.messages||[]).map((message,i)=><li key={`team-${i}`} className="text-amber-800">{message}</li>)}</ul></td><td className="p-3"><button type="button" onClick={()=>onViewSeller?.(r.userId)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold"><FiEye/> View Seller</button>{r.team?.missingRole && onAssignSeller ? <button type="button" onClick={()=>onAssignSeller(r)} className="ml-2 rounded-lg border border-blue-200 px-2 py-1 text-xs font-bold text-blue-700">Assign {getSellerRoleLabel(r.team.missingRole)}</button> : null}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No sellers match your search.</td></tr>}</tbody></table></div>
        <div className="flex items-center justify-between text-xs text-slate-600"><span>{rows.length} sellers · Page {Math.min(page,pageCount)} of {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))} className="rounded-lg border px-3 py-1 disabled:opacity-40">Previous</button><button type="button" disabled={page>=pageCount} onClick={()=>setPage(v=>Math.min(pageCount,v+1))} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button></div></div>
        <p className="text-xs text-slate-500">Read-only check. No sellers, reservations or commissions were changed.</p>
      </>}
    </div>
      </section>
    </div>,
    document.body
  )
}
export default SellerSetupCheck



