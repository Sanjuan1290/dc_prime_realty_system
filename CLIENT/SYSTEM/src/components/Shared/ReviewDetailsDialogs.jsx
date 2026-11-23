import {useEffect,useRef} from 'react'
import {FiX} from 'react-icons/fi'
import {formatPhilippineDateTime} from '../../utils/formatDateTime'
import {ROLE_LABELS} from '../../config/permissions'

const readable=value=>String(value||'').replace(/[._-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())
const date=value=>formatPhilippineDateTime(value,{fallback:'—',timeZoneLabel:true})

export const ReviewDialog=({title,onClose,children})=>{
 const dialog=useRef(null),close=useRef(onClose)
 close.current=onClose
 useEffect(()=>{
  const previous=document.activeElement
  dialog.current?.querySelector('button')?.focus()
  const handle=event=>{
   if(event.key==='Escape'){event.preventDefault();close.current()}
   if(event.key!=='Tab')return
   const elements=[...dialog.current.querySelectorAll('button:not(:disabled),a[href],input,select,textarea')].filter(element=>element.getClientRects().length)
   if(!elements.length)return
   if(event.shiftKey&&document.activeElement===elements[0]){event.preventDefault();elements.at(-1).focus()}
   else if(!event.shiftKey&&document.activeElement===elements.at(-1)){event.preventDefault();elements[0].focus()}
  }
  document.addEventListener('keydown',handle)
  return()=>{document.removeEventListener('keydown',handle);previous?.focus?.()}
 },[])
 return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialog} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><h2 className="text-lg font-black text-slate-950">{title}</h2><button type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><FiX/></button></header>
   <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{children}</div>
  </section>
 </div>
}

export const ReviewInformationDialog=({fields,onClose})=><ReviewDialog title="Review Information" onClose={onClose}>
 <dl className="grid gap-4 sm:grid-cols-2">{fields.map(({label,value})=><div key={label} className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value||'—'}</dd></div>)}</dl>
</ReviewDialog>

export const ReviewHistoryDialog=({events=[],onClose})=><ReviewDialog title="Review History" onClose={onClose}>
 <ol className="space-y-4">{events.map(event=><li key={event.operational_review_event_id} className="border-l-2 border-blue-200 pl-3"><p className="font-bold text-slate-900">{readable(event.event_type)}</p><p className="mt-1 text-xs text-slate-500">{event.actor_name||ROLE_LABELS[event.actor_role]||'System'} · {date(event.created_at)}</p>{event.message&&<p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{event.message}</p>}</li>)}</ol>
 {!events.length&&<p className="text-sm text-slate-500">No history entries.</p>}
</ReviewDialog>
