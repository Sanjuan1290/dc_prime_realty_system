import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import Pagination from '../../../../shared/Pagination'
import {useFetch} from '../../utils/useFetch'
import ReviewFormComparison from './ReviewFormComparison'
import {BULK_PREVIEW_FIELD_LABELS} from '../../utils/listingBulkPreview'
import StatusAlert from './StatusAlert'
import useCurrentUser from '../../utils/useCurrentUser'
const parse=value=>{try{return typeof value==='string'?JSON.parse(value):value||{}}catch{return {}}}
const button='min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40'
export default function ProtectedApprovalDialog({request,onClose,onDecision,busy,error}){
 const {data:me}=useCurrentUser(),actor=me?.user||{}
 const [page,setPage]=useState(1),[limit,setLimit]=useState(20),[search,setSearch]=useState(''),[opened,setOpened]=useState(null),[note,setNote]=useState('')
 const bulk=request.entity_type==='lot_project_listing_bulk_batch',payload=parse(request.request_payload_json)
 const query=useQuery({queryKey:['bulk-approval',actor.id,actor.role,request.protected_change_request_id,page,limit,search],queryFn:()=>useFetch(`/workflow/protected-changes/${request.protected_change_request_id}/bulk-rows?${new URLSearchParams({page,limit,search})}`),enabled:bulk})
 const data=query.data,items=data?.data||[],selected=opened==null?null:items.find(row=>Number(row.listingId)===opened)
 return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-3"><section role="dialog" aria-modal="true" aria-label="Approval Details" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white">
  <header className="flex items-center justify-between border-b p-4"><div><p className="font-mono text-xs text-blue-700">{request.request_number}</p><h2 className="font-black">{bulk?'Bulk Listing Approval':'Approval Details'}</h2></div><button className={button} onClick={onClose} disabled={busy}>Close</button></header>
  <div className="min-h-0 space-y-4 overflow-y-auto p-4"><p className="text-sm">{request.reason}</p>{(error||query.isError)&&<StatusAlert type="error" message={error||query.error.message}/>}
   {bulk?<><input aria-label="Search approval units" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);setOpened(null)}} placeholder="Search Unit ID" className="w-full rounded-lg border p-2 text-sm"/><div className="overflow-x-auto"><table className="min-w-[480px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Unit ID','Changed Fields',''].map((label,index)=><th key={index} className="p-3">{label}</th>)}</tr></thead><tbody>{items.map(row=><tr key={row.listingId} className="border-b"><td className="p-3 font-semibold">{row.after.unitCode}</td><td className="p-3">{Object.keys(row.changes).map(key=>BULK_PREVIEW_FIELD_LABELS[key]||key).join(', ')}</td><td className="p-3 text-right"><button className={button} onClick={()=>setOpened(Number(row.listingId))}>Inspect</button></td></tr>)}</tbody></table></div><Pagination label="Bulk approval pagination" page={data?.pagination?.page||page} pageSize={limit} total={data?.pagination?.total||0} onPageChange={value=>{setPage(value);setOpened(null)}} onPageSizeChange={value=>{setLimit(value);setPage(1);setOpened(null)}} disabled={query.isFetching}/>{selected&&<ReviewFormComparison beforeValue={selected.before} afterValue={selected.after} entityType="lot_project_listing"/>}</>:<ReviewFormComparison beforeValue={payload.before||payload.current||null} afterValue={payload.after||payload.proposed||payload} entityType={request.entity_type}/>}
   {request.status==='pending'&&<label className="grid gap-2 text-sm font-semibold">Decision Notes<textarea aria-label="Decision Notes" rows={3} maxLength={5000} value={note} onChange={event=>setNote(event.target.value)} className="rounded-lg border p-3"/></label>}
  </div>
  {request.status==='pending'&&<footer className="flex flex-wrap justify-end gap-2 border-t p-4"><button className={button} disabled={busy||note.trim().length<5} onClick={()=>onDecision('reject',note)}>Reject</button><button className={button} disabled={busy||note.trim().length<5} onClick={()=>onDecision('return',note)}>Return for Correction</button><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40" disabled={busy} onClick={()=>{if(window.confirm('Approve these exact proposed changes?'))onDecision('approve',note)}}>Approve</button></footer>}
 </section></div>
}
