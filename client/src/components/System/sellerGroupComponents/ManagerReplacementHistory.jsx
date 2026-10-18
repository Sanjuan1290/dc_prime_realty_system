import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiClock, FiRepeat, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi'
import { useFetch as fetchApi } from '../../../utils/useFetch'

const ManagerReplacementHistory=({groupId,onClose})=>{
 const [page,setPage]=useState(1)
 const query=useQuery({queryKey:['manager-replacement-history',groupId,page],queryFn:()=>fetchApi(`/seller-groups/${groupId}/managers/replacements?page=${page}`),retry:false})
 const records=query.data?.data||[]
 return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="flex items-center gap-2 text-base font-bold text-slate-950"><FiClock/> Replacement History</h2><button onClick={onClose} aria-label="Close history" className="rounded-lg p-2 hover:bg-slate-100"><FiX/></button></div>
  <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Date','Previous Manager','Replacement','Sellers Moved','Review'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>
  {records.map(item=><tr key={item.replacement_id} className="border-t border-slate-100"><td className="p-3">{item.created_at?new Date(item.created_at).toLocaleDateString('en-PH'):'-'}</td><td className="p-3 font-semibold">{item.outgoing_name}</td><td className="p-3">{item.replacement_name}</td><td className="p-3"><span className="inline-flex items-center gap-1"><FiRepeat/>{item.direct_reports_moved}</span></td><td className="p-3">{item.operational_review_id?`Review #${item.operational_review_id}`:'-'}</td></tr>)}
  {!query.isLoading&&records.length===0?<tr><td colSpan={5} className="p-5 text-center text-slate-500">No manager replacements yet.</td></tr>:null}
  </tbody></table></div>
  {query.isError?<p className="px-5 py-3 text-sm text-red-700">Couldn't load replacement history. Try again.</p>:null}
  <div className="flex justify-end gap-3 border-t p-3"><button onClick={()=>setPage(x=>Math.max(x-1,1))} disabled={page===1} className="rounded-lg border px-3 py-2 disabled:opacity-40"><FiChevronLeft/></button><span className="py-2 text-sm">Page {page}</span><button onClick={()=>setPage(x=>x+1)} disabled={records.length<15} className="rounded-lg border px-3 py-2 disabled:opacity-40"><FiChevronRight/></button></div>
 </section>
}
export default ManagerReplacementHistory
