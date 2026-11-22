import {auditLabel} from '../../../../shared/auditDetails.js'
import AuditEventDetails from '../../../../shared/AuditEventDetails.jsx'
import Pagination from '../../../../shared/Pagination.jsx'
import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {requestApi} from '../../utils/apiClient'

const emptyFilters={from:'',to:'',module:'',action:''}
const field='block rounded border border-slate-300 bg-white p-2'

export default function AuditLogs(){
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(10)
  const [form,setForm]=useState(emptyFilters),[filters,setFilters]=useState(emptyFilters),[selected,setSelected]=useState(null)
  const query=new URLSearchParams({page,page_size:pageSize,...Object.fromEntries(Object.entries(filters).filter(([,value])=>value))}).toString()
  const {data,isPending,isFetching,error}=useQuery({queryKey:['hr-audit',query],queryFn:()=>requestApi('/audit-logs?'+query)})
  const change=event=>setForm({...form,[event.target.name]:event.target.value})
  const options=data?.filter_options||{modules:[],actions:[]}
  return <section className="space-y-5">
    <div><h1 className="text-2xl font-bold">HR &amp; Payroll audit log</h1><p className="text-sm text-slate-600">Review who changed employee, attendance and payroll records. All times are in Asia/Manila.</p></div>
    <form className="flex flex-wrap gap-3 rounded-xl border bg-white p-4" onSubmit={event=>{event.preventDefault();setFilters({...form});setPage(1)}}>
      <label className="text-sm">From<input name="from" type="date" value={form.from} max={form.to||undefined} required={Boolean(form.to)} onChange={change} className={field}/></label>
      <label className="text-sm">To<input name="to" type="date" value={form.to} min={form.from||undefined} required={Boolean(form.from)} onChange={change} className={field}/></label>
      <label className="text-sm">Module<select name="module" value={form.module} onChange={change} className={field}><option value="">All modules</option>
        {options.modules.map(module=><option key={module} value={module}>{module}</option>)}
      </select></label>
      <label className="text-sm">Action<select name="action" value={form.action} onChange={change} className={field}><option value="">All actions</option>
        {options.actions.map(action=><option key={action} value={action}>{auditLabel(action)}</option>)}
      </select></label>
      <button className="self-end rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Apply filters</button>
      <button type="button" className="self-end rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold" onClick={()=>{setForm(emptyFilters);setFilters({...emptyFilters});setPage(1)}}>Reset</button>
    </form>
    {error&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-3">{error.message}</p>}
    {isPending?<p role="status">Loading audit history…</p>:data&&<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
      <thead className="bg-slate-100"><tr>{['Recorded','Actor','Module','Action','Record','Details'].map(label=><th className="p-3" key={label}>{label}</th>)}</tr></thead>
      <tbody>{data.items.map(row=><tr key={row.id} className="border-t">
        <td className="whitespace-nowrap p-3">{row.recorded_at}</td><td className="p-3">{row.actor_name_snapshot}</td><td className="p-3">{row.module}</td>
        <td className="p-3">{auditLabel(row.action)}</td><td className="p-3">{auditLabel(row.entity_type)} #{row.entity_id}</td>
        <td className="p-3"><button onClick={()=>setSelected(row)} className="font-semibold text-blue-700">View details</button></td>
      </tr>)}{!data.items.length&&<tr><td colSpan={6} className="p-8 text-center text-slate-500">No audit events match these filters.</td></tr>}</tbody>
    </table></div>}
    {data&&<Pagination label="HR audit pagination" page={data.page} pageSize={pageSize} total={data.total} disabled={isFetching} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
    {selected&&<AuditEventDetails event={selected} onClose={()=>setSelected(null)}/>}
  </section>
}
