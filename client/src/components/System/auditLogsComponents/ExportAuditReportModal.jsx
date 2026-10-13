import { useState } from 'react'
import { FiDownload, FiFileText, FiX } from 'react-icons/fi'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { downloadAuditReportWorkbook } from '../../../utils/auditReportExcel'
import { getAuditReferences } from '../../../utils/auditReportEvidence'

const dateSelections = [
  ['all','All Time'], ['today','Today'], ['yesterday','Yesterday'],
  ['this_month','This Month'], ['this_year','This Year'], ['custom','Custom Range'],
]
const actions = ['all','create','update','delete','login','logout','send','approve','reject','release','system','view','import','export','correct']
const dateInManila = () => {
  const p = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const x=Object.fromEntries(p.map((item)=>[item.type,item.value]))
  return `${x.year}-${x.month}-${x.day}`
}
const resolvedRange = (range, from, to) => {
  if (range === 'custom') return { from, to }
  if (range === 'all') return { from:'',to:'' }
  const today=dateInManila(), now=new Date(`${today}T00:00:00Z`)
  if (range === 'today') return {from:today,to:today}
  if (range === 'yesterday') {now.setUTCDate(now.getUTCDate()-1);const day=now.toISOString().slice(0,10);return {from:day,to:day}}
  if (range === 'this_month') return {from:`${today.slice(0,7)}-01`,to:today}
  if (range === 'this_year') return {from:`${today.slice(0,4)}-01-01`,to:today}
  return {from:'',to:''}
}
const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
const ExportAuditReportModal = ({ initial, modules, onClose, actorName, canIncludeArchived, canIncludeCaseHistory }) => {
  const [range,setRange] = useState(initial.dateRange)
  const [from,setFrom] = useState(initial.from || dateInManila())
  const [to,setTo] = useState(initial.to || dateInManila())
  const [action,setAction] = useState(initial.action)
  const [module,setModule] = useState(initial.module)
  const [search,setSearch] = useState(initial.search)
  const [includeArchived,setIncludeArchived] = useState(false)
  const [includeCaseHistory,setIncludeCaseHistory] = useState(Boolean(canIncludeCaseHistory))
  const [progress,setProgress] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')

  const exportReport = async () => {
    setBusy(true);setError('');setProgress('Checking selected records…')
    try {
      const dates=resolvedRange(range,from,to)
      if (dates.from && dates.to && dates.from > dates.to) throw new Error('From date must be on or before To date.')
      if (range === 'custom' && (!dates.from || !dates.to)) throw new Error('Select both From and To dates.')
      const filters={...dates,action,module,search:search.trim(),includeArchived,includeCaseHistory}
      const params=new URLSearchParams()
      for (const [key,value] of Object.entries(filters)) if (key !== 'includeCaseHistory' && (value !== '' || key === 'includeArchived')) params.set(key,String(value))
      let cursor=null, snapshot=null, logs=[], pages=0
      while (true) {
        const query=new URLSearchParams(params)
        if (cursor !== null) query.set('cursor',String(cursor))
        if (snapshot !== null) query.set('snapshot',String(snapshot))
        const result=await useFetch(`/audit-logs/report/data?${query}`)
        if (!result?.success || !Array.isArray(result.data)) throw new Error('The Audit Report could not be loaded. Try again.')
        if (snapshot === null) snapshot=result.snapshot
        logs.push(...result.data)
        pages+=1
        if (logs.length > 100000) throw new Error('This report exceeds 100,000 events. Select a shorter date range and export separate reports.')
        setProgress(`Loading audit records… ${logs.length.toLocaleString()} loaded`)
        if (!result.hasMore) break
        if (!result.nextCursor || result.nextCursor === cursor || pages > 500) throw new Error('Audit records did not advance. Start a new export.')
        cursor=result.nextCursor
      }
      if (!logs.length) throw new Error('No audit activity matches these filters. Try another date range or filter.')
      let cases={reviews:[],events:[],cases:[]}
      if (includeCaseHistory) {
        setProgress('Finding related reviews and Audit Cases…')
        const reviewIds=[...new Set(logs.map((row)=>getAuditReferences(row.metadata).reviewId).filter(Boolean))]
        const caseIds=[...new Set(logs.map((row)=>getAuditReferences(row.metadata).caseId).filter(Boolean))]
        // Bounded per-request history lookups. No name-based matching.
        const groups=[]
        for(let i=0;i<Math.max(reviewIds.length,caseIds.length);i+=250) groups.push({reviewIds:reviewIds.slice(i,i+250),caseIds:caseIds.slice(i,i+250)})
        for(const group of groups) {
          const result=await useFetchPost('/audit-logs/report/cases',group,{confirmationHandled:'technical'})
          if (result?.unavailable) throw new Error('Related review history is unavailable because the review tables have not been installed. Uncheck Include Related Case History to export the audit records without it.')
          for(const key of ['reviews','events','cases']) cases[key].push(...(result[key] || []))
        }
        for(const key of ['reviews','events','cases']) {
          const idKey={reviews:'operational_review_id',events:'operational_review_event_id',cases:'audit_case_id'}[key]
          cases[key]=[...new Map(cases[key].map((x)=>[x[idKey],x])).values()]
        }
      }
      setProgress('Preparing Excel report…')
      await downloadAuditReportWorkbook({logs,cases,filters,generatedBy:actorName})
      try {
        await useFetchPost('/audit-logs/report/record',{...filters,recordCount:logs.length},{confirmationHandled:'technical'})
      } catch {
        setError('Excel download started, but the system could not record the export in Audit Logs. Notify your administrator.')
        return
      }
      onClose()
    } catch(e) {setError(e?.message || 'The audit report could not be exported.');}
    finally {setBusy(false);setProgress('')}
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="Export Audit Report">
    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3"><FiFileText className="h-5 w-5 text-blue-600"/><div><h2 className="font-black text-slate-950">Export Audit Report</h2><p className="text-xs font-semibold text-slate-500">Include complete activity details and recorded evidence in Excel.</p></div></div>
        <button type="button" aria-label="Close" disabled={busy} onClick={onClose}><FiX/></button>
      </div>
      <div className="grid gap-4 p-5">
        <label className="grid gap-1 text-xs font-black text-slate-600">Date Range
          <select className={inputClass} value={range} onChange={(e)=>setRange(e.target.value)}>{dateSelections.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        </label>
        {range === 'custom' && <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-black text-slate-600">From <input type="date" className={inputClass} value={from} onChange={(e)=>setFrom(e.target.value)}/></label>
          <label className="grid gap-1 text-xs font-black text-slate-600">To <input type="date" className={inputClass} value={to} onChange={(e)=>setTo(e.target.value)}/></label>
        </div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-black text-slate-600">Action
            <select className={inputClass} value={action} onChange={(e)=>setAction(e.target.value)}>{actions.map((v)=><option key={v} value={v}>{v === 'all' ? 'All Actions' : v.replace(/^./,(x)=>x.toUpperCase())}</option>)}</select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">Module
            <select className={inputClass} value={module} onChange={(e)=>setModule(e.target.value)}><option value="all">All Modules</option>{modules.map((item)=><option key={item.module} value={item.module}>{item.module}</option>)}</select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-black text-slate-600">Search in Audit Logs
          <input className={inputClass} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="All activity"/>
        </label>
        {canIncludeArchived && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={includeArchived} onChange={(e)=>setIncludeArchived(e.target.checked)} /> Include archived audit logs</label>}
        {canIncludeCaseHistory ? <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={includeCaseHistory} onChange={(e)=>setIncludeCaseHistory(e.target.checked)} /> Include full history of explicitly linked reviews and Audit Cases</label> : null}
        <div className="rounded-xl bg-blue-50 p-3 text-xs font-semibold leading-5 text-slate-600">Includes Audit Log Details, Before & After Changes, Reviews & Audit Cases, and Technical Details. Exports all matching events, not just the visible table page. No records are deleted or archived.</div>
        {progress && <p aria-live="polite" className="text-sm font-bold text-blue-700">{progress}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t bg-slate-50 p-4">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button>
        <button type="button" disabled={busy} onClick={exportReport} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"><FiDownload /> {busy ? 'Preparing…' : 'Export Excel'}</button>
      </div>
    </div>
  </div>
}
export default ExportAuditReportModal
