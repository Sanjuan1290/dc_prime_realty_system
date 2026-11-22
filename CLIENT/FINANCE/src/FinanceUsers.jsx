import {useState} from 'react';
import {Dialog,Notice,Spinner} from './FinanceFeedback.jsx';
import {api} from './api.js';
import {financeDateTime} from './financeFormat.js';
import Pagination from '../../shared/Pagination.jsx';

const blank={email:'',display_name:'',role:'viewer'};
const roles={viewer:'Viewer',accountant:'Accountant',admin:'Admin'};
const accountStatus={
  active:'Active',pending:'Invitation Pending',expired:'Invitation Expired',disabled:'Disabled',
};
const statusOf=(user)=>{
  if(!Number(user.is_active)) return 'disabled';
  if(!Number(user.must_change_password)) return 'active';
  const expires=user.temporary_password_expires_at;
  if(expires&&Date.parse(expires.replace(' ','T')+'Z')<=Date.now()) return 'expired';
  return 'pending';
};

export default function FinanceUsers({users,currentUserId,onChanged}){
  const [form,setForm]=useState(blank),[busy,setBusy]=useState('');
  const [message,setMessage]=useState(null),[dialogError,setDialogError]=useState('');
  const [search,setSearch]=useState(''),[role,setRole]=useState(''),[status,setStatus]=useState('');
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(10);
  const [editing,setEditing]=useState(null),[removing,setRemoving]=useState(null);
  const searchTerm=search.trim().toLowerCase();
  const shown=users.filter(user=>(!searchTerm||[user.display_name,user.email].some(value=>value.toLowerCase().includes(searchTerm)))&&
    (!role||role===user.role)&&(!status||status===statusOf(user)));
  const currentPage=Math.min(page,Math.max(1,Math.ceil(shown.length/pageSize)));
  const pageRows=shown.slice((currentPage-1)*pageSize,currentPage*pageSize);

  const send=async(id=null)=>{
    setBusy(id?'resend-'+id:'invite');
    setMessage(null);
    try {
      const result=await api(id?`/finance/users/${id}/invitation`:'/finance/users',{method:'POST',data:id?{}:form});
      const sent=result.invitation_status==='sent';
      setMessage({type:sent?'success':'warning',text:sent?`Invitation emailed to ${result.email}.`:result.message});
      if(!id)setForm(blank);
      await onChanged();
    } catch(error) {
      setMessage({type:'error',text:error.message});
    } finally {
      setBusy('');
    }
  };

  const edit=user=>{
    setDialogError('');
    setEditing({id:user.id,name:user.display_name,role:user.role,is_active:Boolean(Number(user.is_active))});
  };
  const save=async event=>{
    event.preventDefault();
    setBusy('save');
    setDialogError('');
    setMessage(null);
    try {
      await api('/finance/users/'+editing.id,{method:'PATCH',data:{role:editing.role,is_active:editing.is_active}});
      setEditing(null);
      setMessage({type:'success',text:'Finance access updated.'});
      await onChanged();
    } catch(error) {
      setDialogError(error.message);
    } finally {
      setBusy('');
    }
  };
  const remove=async()=>{
    setBusy('delete');
    setDialogError('');
    setMessage(null);
    try {
      await api('/finance/users/'+removing.id,{method:'DELETE'});
      setRemoving(null);
      setMessage({type:'success',text:'Invitation deleted.'});
      await onChanged();
    } catch(error) {
      setDialogError(error.message);
    } finally {
      setBusy('');
    }
  };
  const updateForm=event=>setForm({...form,[event.target.name]:event.target.value});

  return <section className="panel">
    <div className="panel-heading"><h2>Finance accounts</h2><span>{users.length} accounts</span></div>
    {message&&<Notice type={message.type} onDismiss={()=>setMessage(null)}>{message.text}</Notice>}
    <form className="entry-form invite-form" onSubmit={event=>{event.preventDefault();send()}}>
      <div className="two-col">
        <label>Full name<input name="display_name" required maxLength={160} autoComplete="name" value={form.display_name} onChange={updateForm}/></label>
        <label>Work email<input name="email" required type="email" maxLength={190} autoComplete="email" value={form.email} onChange={updateForm}/></label>
      </div>
      <label>Access level<select name="role" value={form.role} onChange={updateForm}>
        <option value="viewer">Viewer · View balances, reports and transactions</option>
        <option value="accountant">Accountant · Record cash transactions</option>
        <option value="admin">Admin · Manage accounts, imports and corrections</option>
      </select></label>
      <div><button className="btn primary" disabled={Boolean(busy)}>{busy==='invite'?<Spinner label="Sending…"/>:'Send account invitation'}</button></div>
    </form>
    <div className="filters finance-admin-filters">
      <label>Search accounts<input type="search" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}} placeholder="Name or email"/></label>
      <label>Role<select value={role} onChange={event=>{setRole(event.target.value);setPage(1)}}><option value="">All roles</option>
        {Object.entries(roles).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Status<select value={status} onChange={event=>{setStatus(event.target.value);setPage(1)}}><option value="">All statuses</option>
        {Object.entries(accountStatus).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <div className="table-wrap"><table>
      <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Invitation · Philippine Time</th><th>Actions</th></tr></thead>
      <tbody>{!shown.length&&<tr><td colSpan={5} className="empty">No Finance accounts match your filters.</td></tr>}
        {pageRows.map(user=>{
          const state=statusOf(user);
          return <tr key={user.id}>
            <td><strong>{user.display_name}</strong><span className="cell-secondary">{user.email}</span></td>
            <td><span className="pill">{roles[user.role]}</span></td><td>{accountStatus[state]}</td>
            <td>{user.invitation_sent_at?financeDateTime(user.invitation_sent_at):state==='pending'?'Awaiting delivery':'—'}
              {['pending','expired'].includes(state)&&user.temporary_password_expires_at&&
                <span className="cell-secondary">Expires {financeDateTime(user.temporary_password_expires_at)}</span>}</td>
            <td>{String(user.id)===String(currentUserId)?<span className="muted" title="Ask another Finance Admin to change your access.">Your account</span>:<button type="button" className="text-btn" disabled={Boolean(busy)} onClick={()=>edit(user)}>Edit access</button>}
              {['pending','expired'].includes(state)&&<button type="button" className="text-btn cell-secondary" disabled={Boolean(busy)} onClick={()=>send(user.id)}>
                {busy==='resend-'+user.id?'Sending…':'Resend invitation'}</button>}
              {Number(user.must_change_password)!==0&&String(user.id)!==String(currentUserId)&&
                <button type="button" className="text-btn danger cell-secondary" disabled={Boolean(busy)} onClick={()=>{setDialogError('');setRemoving(user)}}>Delete invitation</button>}</td>
          </tr>;
        })}
      </tbody>
    </table></div>
    <Pagination label="Finance users pagination" page={currentPage} pageSize={pageSize} total={shown.length} disabled={Boolean(busy)} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>
    {removing&&<Dialog title="Delete Finance invitation?" description={removing.display_name} busy={busy==='delete'} danger onClose={()=>setRemoving(null)}>
      <p>This removes the invitation for <strong>{removing.email}</strong>. Their temporary password will no longer work. You can invite them again later.</p>
      {dialogError&&<Notice type="error">{dialogError}</Notice>}
      <div className="action-row"><button type="button" className="btn" disabled={Boolean(busy)} onClick={()=>setRemoving(null)}>Cancel</button>
        <button type="button" className="btn danger" disabled={Boolean(busy)} onClick={remove}>{busy==='delete'?'Deleting…':'Delete invitation'}</button></div>
    </Dialog>}
    {editing&&<Dialog title="Edit Finance access" description={editing.name} busy={busy==='save'} onClose={()=>setEditing(null)}>
      <form className="entry-form" onSubmit={save}>
        {dialogError&&<Notice type="error">{dialogError}</Notice>}
        <label>Role<select value={editing.role} onChange={event=>setEditing({...editing,role:event.target.value})}>
          {Object.entries(roles).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Account status<select value={editing.is_active?'enabled':'disabled'} onChange={event=>setEditing({...editing,is_active:event.target.value==='enabled'})}>
          <option value="enabled">Enabled</option><option value="disabled">Disabled</option>
        </select></label>
        <div className="action-row"><button type="button" className="btn" disabled={Boolean(busy)} onClick={()=>setEditing(null)}>Cancel</button>
          <button className="btn primary" disabled={Boolean(busy)}>{busy==='save'?'Saving…':'Save access'}</button></div>
      </form>
    </Dialog>}
  </section>;
}
