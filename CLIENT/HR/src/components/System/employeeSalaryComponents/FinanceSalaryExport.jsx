import {useEffect,useRef,useState} from 'react'
import {FiDownload,FiLoader,FiShield,FiX} from 'react-icons/fi'
import {requestApiBlob} from '../../../utils/apiClient'
import '../../Shared/actionPanelMotion.css'
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export default function FinanceSalaryExport({period,onClose}){
  const currentDate=today(),dialog=useRef(null),closed=useRef(false)
  const [from,setFrom]=useState(period?.periodStart&&period.periodStart<currentDate?period.periodStart:currentDate)
  const [to,setTo]=useState(period?.periodEnd&&period.periodEnd<currentDate?period.periodEnd:currentDate)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(null)
  useEffect(()=>{
    const previous=document.activeElement;dialog.current?.showModal();closed.current=false
    return()=>{closed.current=true;dialog.current?.close();previous?.focus?.()}
  },[])
  const submit=async e=>{
    e.preventDefault();if(busy)return;setBusy(true);setMessage(null)
    try{
      const {blob}=await requestApiBlob('/employee-payroll/finance-export?'+new URLSearchParams({from,to,format:'csv'}))
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`hr-salary-finance-${from}-${to}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)
      if(!closed.current)setMessage({ok:true,text:'Finance CSV downloaded. Upload this original file in Finance → Imports. Edited files will be rejected.'})
    }catch(error){if(!closed.current)setMessage({ok:false,text:error.message})}finally{if(!closed.current)setBusy(false)}
  }
  return <dialog ref={dialog} aria-labelledby="finance-salary-export-title" onCancel={e=>{e.preventDefault();if(!busy)onClose()}} className="dc-action-panel--in m-auto w-[calc(100%_-_2rem)] max-w-xl rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
    <form onSubmit={submit} aria-busy={busy}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5"><div><p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">HR &amp; Payroll</p><h2 id="finance-salary-export-title" className="mt-1 text-[20px] font-black text-slate-950">Export to Finance (CSV)</h2></div><button type="button" aria-label="Close Finance export" disabled={busy} onClick={onClose} className="flex h-[44px] w-[44px] items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"><FiX/></button></header>
      <div className="space-y-5 p-5"><p className="text-[14px] leading-[22px] text-slate-600">Export salary releases and undo reversals by their cash date. Include the original release period when exporting a reversal. Drafts and unpaid payroll are excluded. Up to 500 events per file.</p>
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-[14px] font-bold text-slate-700">Released from<input required type="date" max={to||currentDate} value={from} disabled={busy} onChange={e=>setFrom(e.target.value)} className="h-[44px] w-full rounded-xl border border-slate-300 px-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"/></label><label className="grid gap-2 text-[14px] font-bold text-slate-700">Released to<input required type="date" min={from} max={currentDate} value={to} disabled={busy} onChange={e=>setTo(e.target.value)} className="h-[44px] w-full rounded-xl border border-slate-300 px-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"/></label></div>
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-[14px] leading-[22px] text-blue-900"><FiShield className="mt-1 shrink-0"/><p>Upload the original CSV without editing it. Finance checks the file and skips payments already imported from HR or Company Finances.</p></div>
        {message&&<p role={message.ok?'status':'alert'} className={`rounded-xl border p-3 text-[14px] leading-[22px] ${message.ok?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</p>}
      </div><footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 p-4"><button type="button" disabled={busy} onClick={onClose} className="h-[44px] rounded-xl border border-slate-300 px-4 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Close</button><button type="submit" disabled={busy} className="inline-flex h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 text-[14px] font-bold text-white transition hover:bg-blue-800 disabled:opacity-50">{busy?<FiLoader className="animate-spin"/>:<FiDownload/>}{busy?'Preparing CSV…':'Download Finance CSV'}</button></footer>
    </form>
  </dialog>
}
