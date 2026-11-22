import {useEffect,useState} from 'react';
import AuditEventDetails from '../../shared/AuditEventDetails.jsx';
import {api} from './api.js';
import {Notice,Spinner} from './FinanceFeedback.jsx';
import {financeActionLabel,financeActions,financeDateTime} from './financeFormat.js';
import Pagination from '../../shared/Pagination.jsx';

const emptyFilters={from:'',to:'',actor:'',action:''};

export default function FinanceAudit({users,refreshKey,onViewTransaction}){
  const [form,setForm]=useState(emptyFilters),[filters,setFilters]=useState(emptyFilters);
  const [page,setPage]=useState(1),[report,setReport]=useState(null),[loading,setLoading]=useState(true);
  const [pageSize,setPageSize]=useState(10);
  const [error,setError]=useState(''),[retry,setRetry]=useState(0),[event,setEvent]=useState(null);
  useEffect(()=>{
    let current=true;
    const params=new URLSearchParams(Object.entries(filters).filter(([,value])=>value));
    params.set('page',String(page));
    params.set('page_size',String(pageSize));
    setLoading(true);
    setError('');
    api('/finance/audit?'+params).then(data=>{if(current)setReport(data)}).catch(err=>{
      if(current){setReport(null);setError(err.message)}
    }).finally(()=>{if(current)setLoading(false)});
    return ()=>{current=false};
  },[filters,page,pageSize,retry,refreshKey]);

  const apply=event=>{event.preventDefault();setPage(1);setFilters({...form})};
  const change=event=>setForm({...form,[event.target.name]:event.target.value});
  const selectedActions=[...new Set([...Object.keys(financeActions),...(report?.items||[]).map(row=>row.action)])]
    .sort((a,b)=>financeActionLabel(a).localeCompare(financeActionLabel(b)));
  const format=row=>financeDateTime(row.recorded_at_utc||row.created_at,{local:!row.recorded_at_utc});

  return <section className="panel" aria-busy={loading}>
    <div className="panel-heading"><h2>Audit history</h2><span>Philippine Time</span></div>
    <form className="filters finance-admin-filters" onSubmit={apply}>
      <label>From<input type="date" name="from" max={form.to||undefined} value={form.from} onChange={change}/></label>
      <label>To<input type="date" name="to" min={form.from||undefined} value={form.to} onChange={change}/></label>
      <label>User<select name="actor" value={form.actor} onChange={change}><option value="">All users</option>
        {users.map(user=><option key={user.id} value={user.id}>{user.display_name}</option>)}
      </select></label>
      <label>Action<select name="action" value={form.action} onChange={change}><option value="">All actions</option>
        {selectedActions.map(action=><option key={action} value={action}>{financeActionLabel(action)}</option>)}
      </select></label>
      <button className="btn primary" type="submit">Apply filters</button>
      <button className="btn" type="button" onClick={()=>{setForm(emptyFilters);setFilters({...emptyFilters});setPage(1)}}>Reset</button>
    </form>
    {loading&&<div role="status" className="loading-bar"><Spinner label="Loading audit history…"/></div>}
    {error&&<Notice type="error" title="Couldn’t load audit history">{error} <button className="text-btn" type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></Notice>}
    {report&&<div className="table-wrap"><table>
      <thead><tr><th>Recorded</th><th>Action</th><th>Record</th><th>Recorded by</th><th>Details</th></tr></thead>
      <tbody>{report.items.length===0&&<tr><td colSpan={5} className="empty">No audit events match these filters.</td></tr>}
        {report.items.map(row=><tr key={row.id}>
          <td>{format(row)}</td><td>{financeActionLabel(row.action)}</td>
          <td>{row.entity_type==='transaction'
            ?<button type="button" className="text-btn" onClick={()=>onViewTransaction(row.entity_id)}>Transaction #{row.entity_id}</button>
            :<>{row.entity_type.replaceAll('_',' ')} #{row.entity_id}</>}</td>
          <td>{row.actor_name||(row.actor_user_id?`User #${row.actor_user_id}`:'System')}</td>
          <td><button type="button" className="text-btn" onClick={()=>setEvent({...row,recorded_at:format(row)})}>View details</button></td>
        </tr>)}
      </tbody>
    </table></div>}
    {report&&<Pagination label="Finance audit pagination" page={report.page} pageSize={pageSize} total={report.total} disabled={loading} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
    {event&&<AuditEventDetails event={event} onClose={()=>setEvent(null)}/>}
  </section>;
}
