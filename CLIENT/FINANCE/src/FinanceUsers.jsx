import {useState} from 'react';
import {Notice,Spinner} from './FinanceFeedback.jsx';
import {api} from './api.js';
const blank={email:'',display_name:'',role:'viewer'};
export default function FinanceUsers({users,onChanged}){
  const [form,setForm]=useState(blank),[busy,setBusy]=useState(false),[message,setMessage]=useState(null);
  const send=async(id=null)=>{setBusy(true);setMessage(null);try{
    const result=await api(id?`/finance/users/${id}/invitation`:'/finance/users',{method:'POST',data:id?{}:form});
    setMessage({type:result.invitation_status==='sent'?'success':'warning',text:result.invitation_status==='sent'?`Invitation emailed to ${result.email}. The recipient must choose a new password on first sign-in.`:result.message});
    if(!id)setForm(blank);await onChanged();
  }catch(error){setMessage({type:'error',text:error.message})}finally{setBusy(false)}};
  return <section className="panel"><div className="panel-heading"><h2>Finance accounts</h2><span>{users.length} accounts</span></div><p className="muted">Invite colleagues by email. Each recipient receives a temporary password valid for 24 hours and must replace it before accessing Finance.</p>
    {message&&<Notice type={message.type} onDismiss={()=>setMessage(null)}>{message.text}</Notice>}
    <form className="entry-form invite-form" onSubmit={e=>{e.preventDefault();send()}}><div className="two-col"><label>Full name<input required maxLength={160} autoComplete="name" value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))}/></label><label>Work email<input required type="email" maxLength={190} autoComplete="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></label></div><label>Access level<select aria-label="Access level" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}><option value="viewer">Viewer — view balances and transactions</option><option value="accountant">Accountant — record cash transactions</option><option value="admin">Admin — manage accounts, imports and corrections</option></select></label><div><button className="btn primary" disabled={busy}>{busy?<Spinner label="Sending…"/>:'Send account invitation'}</button></div></form>
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Account status</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.display_name}</td><td>{u.email}</td><td><span className="pill">{u.role}</span></td><td>{!Number(u.is_active)?'Disabled':Number(u.must_change_password)?(u.invitation_sent_at?'Awaiting password setup':'Invitation pending delivery'):'Active'}</td><td>{Number(u.is_active)&&Number(u.must_change_password)?<button type="button" className="text-btn" disabled={busy} onClick={()=>send(u.id)}>Resend invitation</button>:null}</td></tr>)}</tbody></table></div>
  </section>;
}
