import FinanceAudit from './FinanceAudit.jsx';
import FinanceDashboard from './FinanceDashboard.jsx';
import {financePresetRange, todayInManila as today} from './financePeriods.js';
import FinanceReports from './FinanceReports.jsx';
import FinanceTransactionFilters from './FinanceTransactionFilters.jsx';
import FinanceTransactionDetails from './FinanceTransactionDetails.jsx';
import {Dialog,Notice,Spinner} from './FinanceFeedback.jsx';
import FinanceUsers from './FinanceUsers.jsx';
import PasswordSetup from './PasswordSetup.jsx';
import PasswordField from './PasswordField.jsx';
import PasswordRecovery from './PasswordRecovery.jsx';
import React,{useCallback,useEffect,useState,useRef} from 'react';
import {FiBarChart2,FiBookOpen,FiGrid,FiPlus,FiLogOut,FiShield,FiList,FiUserPlus} from 'react-icons/fi';
import {api} from './api.js';
import useRetryCooldown from './useRetryCooldown.js';
import FinanceImport from './FinanceImport.jsx';
const defaultRange=()=>{const to=today();return {from:`${to.slice(0,7)}-01`,to};};
const peso=value=>`₱${String(value??'0.00').replace(/^-?/,'') .replace(/\B(?=(\d{3})+(?!\d))/g,',')}`;
const inputDefault={kind:'expense',amount:'',description:'',notes:'',category_id:'',transaction_date:today()};
function ErrorNotice({message,onDismiss}){return message?<Notice type="error" title="Please review" onDismiss={onDismiss}>{message}</Notice>:null;}
function Login({onLogin,initialError}){const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [forgot,setForgot]=useState(false);
  const {retrySeconds,delayRetry}=useRetryCooldown(initialError);
  useEffect(()=>{if(initialError)setError(initialError.message)},[initialError]);
  const submit=async e=>{e.preventDefault();if(saving||retrySeconds>0)return;setSaving(true);setError('');try{const r=await api('/auth/login',{method:'POST',data:{email,password}});onLogin(r.user);}catch(err){delayRetry(err);setError(err.message);}finally{setSaving(false);}};
  if(forgot)return <PasswordRecovery initialEmail={email} onClose={()=>setForgot(false)}/>;
  return <main className="login-shell"><form className="login-box" onSubmit={submit}><div className="eyebrow">D&C Prime Realty</div><h1>Finance Management</h1><p>Independent finance account. Your Realty and HR sessions do not grant access here.</p><label>Email<input type="email" autoComplete="username" maxLength={150} value={email} required onChange={e=>setEmail(e.target.value)}/></label><PasswordField autoComplete="current-password" value={password} required onChange={e=>setPassword(e.target.value)}/><button className="text-btn forgot-password" type="button" onClick={()=>{setPassword('');setError('');setForgot(true)}}>Forgot password?</button><ErrorNotice message={error} onDismiss={()=>setError('')}/><button disabled={saving||retrySeconds>0} className="btn primary" type="submit">{saving?'Signing in…':retrySeconds>0?`Try again in ${retrySeconds}s`:'Sign in'}</button></form></main>;
}
function EntryForm({categories,initial,onSubmit,onCancel,busy,correcting=false}){
  const [form,setForm]=useState(initial||{...inputDefault,transaction_date:today()});const set=(k,v)=>setForm(p=>({...p,[k]:v,...(k==='kind'?{category_id:''}:{})}));
  const matching=categories.filter(c=>c.kind===form.kind&&Number(c.is_active)===1);
  return <form className="entry-form" onSubmit={e=>{e.preventDefault();onSubmit(form);}}>
    <div className="two-col"><label>Type<select value={form.kind} onChange={e=>set('kind',e.target.value)}><option value="income">Income</option><option value="expense">Expense</option></select></label><label>Transaction date<input type="date" required max={today()} value={form.transaction_date} onChange={e=>set('transaction_date',e.target.value)}/></label></div>
    <div className="two-col"><label>Amount (PHP)<input type="text" inputMode="decimal" placeholder="0.00" pattern="[0-9]+([.][0-9]{1,2})?" required value={form.amount} onChange={e=>set('amount',e.target.value)}/></label><label>Category<select required value={form.category_id} onChange={e=>set('category_id',e.target.value)}><option value="">Select category</option>{matching.map(c=><option value={String(c.id)} key={c.id}>{c.name}</option>)}</select></label></div>
    <label>Description<input required maxLength={240} value={form.description} onChange={e=>set('description',e.target.value)}/></label><label>Notes (optional)<textarea maxLength={1000} rows={2} value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></label>
    {correcting&&<label>Reason for correction<input required minLength={5} maxLength={500} value={form.reason||''} onChange={e=>set('reason',e.target.value)}/></label>}
    <div className="action-row"><button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="btn primary" disabled={busy||!matching.length}>{busy?'Saving…':correcting?'Void and replace':'Post transaction'}</button></div>
  </form>;
}
export default function App(){
  const [source,setSource]=useState('all'),[categoryId,setCategoryId]=useState('');
  const [transactionId,setTransactionId]=useState(null);const[user,setUser]=useState(undefined),[tab,setTab]=useState('overview'),[range,setRange]=useState(defaultRange),[dashboardRange]=useState(()=>financePresetRange('month')),[dashboard,setDashboard]=useState(null),[transactions,setTransactions]=useState([]),[count,setCount]=useState(0),[categories,setCategories]=useState([]),[users,setUsers]=useState([]),[page,setPage]=useState(1),[status,setStatus]=useState('posted'),[kind,setKind]=useState('all'),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[entry,setEntry]=useState(null),[prompt,setPrompt]=useState(null),[categoryInput,setCategoryInput]=useState({kind:'expense',name:''});
  const [sessionError,setSessionError]=useState(null),[notice,setNotice]=useState('');const requestVersion=useRef(0);
  const [resetToken,setResetToken]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('reset-password')||'');
  useEffect(()=>{
    const receiveResetLink=()=>{const token=new URLSearchParams(window.location.hash.slice(1)).get('reset-password');if(token){setResetToken(token);window.history.replaceState(null,'',window.location.pathname+window.location.search)}};
    receiveResetLink();window.addEventListener('hashchange',receiveResetLink);return()=>window.removeEventListener('hashchange',receiveResetLink);
  },[]);
  const canWrite=user?.role==='admin'||user?.role==='accountant';const canAdmin=user?.role==='admin';
  const refresh=useCallback(async()=>{
    if(!user||user.must_change_password)return;
    const version=++requestVersion.current;
    const overview=tab==='overview';
    const dates=overview?{from:dashboardRange.from,to:dashboardRange.to}:range;
    setLoading(true);
    setError('');
    try{
      const query=new URLSearchParams(overview?{...dates,page_size:'5',status:'posted'}:{...dates,page:String(page),status,kind,source,category_id:categoryId});
      const [report,ledger,categoryList,financeUsers]=await Promise.all([
        overview?api('/finance/reports?'+new URLSearchParams(dates)):null,
        tab==='transactions'?api('/finance/transactions?'+query):null,
        api('/finance/categories'),
        canAdmin&&(tab==='audit'||tab==='users')?api('/finance/users'):null,
      ]);
      if(version!==requestVersion.current)return;
      if(overview){
        setDashboard(report);
      }else if(ledger){
        setTransactions(ledger.transactions||[]);
        setCount(ledger.total||0);
      }
      setCategories(categoryList.categories||[]);
      if(financeUsers)setUsers(financeUsers.users||[]);
    }catch(e){
      if(version!==requestVersion.current)return;
      if(overview)setDashboard(null);
      if(tab==='transactions'){setTransactions([]);setCount(0);}
      setCategories([]);
      setError(e.message);
    }finally{
      if(version===requestVersion.current)setLoading(false);
    }
  },[user,range,dashboardRange,page,status,kind,source,categoryId,canAdmin,tab]);
  useEffect(()=>{api('/auth/me').then(r=>setUser(r.user)).catch(error=>{setSessionError(error.status===401?null:error);setUser(null);});},[]);
  useEffect(()=>{if(user)refresh();},[user,refresh]);
  const mutate=async(path,data,method='POST')=>{setBusy(true);setError('');setNotice('');try{await api(path,{method,data});setEntry(null);setPrompt(null);await refresh();setNotice(method==='DELETE'?'Category deleted.':path.endsWith('/void')?'Transaction voided. The original record remains in your history.':path.endsWith('/correct')?'Correction saved. The original and replacement remain in your history.':'Changes saved. Finance records are up to date.');return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}};
  if(resetToken)return <PasswordRecovery key={resetToken} token={resetToken} onClose={()=>{setResetToken('');setUser(null);setSessionError(null)}}/>;
  if(user===undefined)return <main className="login-shell"><p>Connecting to Finance…</p></main>;
  if(!user)return <Login initialError={sessionError} onLogin={value=>{setSessionError(null);setUser(value);}}/>;
  if(user.must_change_password)return <PasswordSetup user={user} onChanged={setUser} onSignOut={async()=>{await api('/auth/logout',{method:'POST'});setUser(null)}}/>;
  const tabs=[{id:'overview',label:'Dashboard',icon:FiGrid},{id:'transactions',label:'Transactions',icon:FiList},{id:'reports',label:'Reports',icon:FiBarChart2},{id:'categories',label:'Categories',icon:FiBookOpen},...(canAdmin?[{id:'audit',label:'Audit Logs',icon:FiShield},{id:'users',label:'Users',icon:FiUserPlus},{id:'imports',label:'Imports',icon:FiBookOpen}]:[])];
  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><span className="brand-mark">D&C</span><div><strong>Prime Finance</strong><small>Independent Management</small></div></div><nav aria-label="Finance navigation">{tabs.map(t=><button key={t.id} type="button" aria-current={tab===t.id?'page':undefined} className={tab===t.id?'nav-item active':'nav-item'} onClick={()=>{setTab(t.id);setNotice('');setEntry(null);setPrompt(null);}}><t.icon/>{t.label}</button>)}</nav><div className="sidebar-bottom"><div>{user.display_name}<small>{user.role}</small></div><button type="button" className="nav-item" onClick={async()=>{try{await api('/auth/logout',{method:'POST'});}finally{setUser(null);}}}><FiLogOut/>Sign out</button></div></aside>
  <main className="main" aria-busy={loading}><header className="topbar"><div><div className="eyebrow">D&C Prime Realty / Finance</div><h1>{tabs.find(t=>t.id===tab)?.label}</h1><p>{{overview:'Track cash received, payments made and your current balance.',transactions:'Review posted payments and trace every correction.',categories:'Organize income and expenses for consistent reporting.',audit:'Review account activity and changes to the ledger.',users:'Invite colleagues and manage their Finance access.',imports:'Bring salary and Company Finances payments into your ledger.',reports:'Review cash movement, balances, and category totals.'}[tab]}</p></div><div className="top-actions">{canWrite&&(tab==='overview'||tab==='transactions')&&<button className="btn primary" type="button" onClick={()=>setEntry({...inputDefault,transaction_date:today()})}><FiPlus/>New entry</button>}</div></header>
  {loading&&(tab!=='overview'||dashboard)&&<div className="loading-bar" role="status"><Spinner label="Updating Finance…"/></div>}
  <ErrorNotice message={error} onDismiss={()=>setError('')}/>
  {notice&&<Notice type="success" title="Changes saved" onDismiss={()=>setNotice('')}>{notice}</Notice>}
  {tab==='transactions'&&<FinanceTransactionFilters categories={categories} loading={loading}
    filters={{...range,kind,status,source,category_id:categoryId}} onApply={next=>{
      setPage(1);setRange({from:next.from,to:next.to});setKind(next.kind);setStatus(next.status);setSource(next.source);setCategoryId(next.category_id);
    }}/>}
  {tab==='overview'&&<FinanceDashboard range={dashboardRange}
    dashboard={dashboard} loading={loading} canAdmin={canAdmin}
    onOpenReports={()=>setTab('reports')} onOpenImports={()=>setTab('imports')} onOpenAudit={()=>setTab('audit')}
    onOpenTransactions={()=>{
      setRange({from:dashboardRange.from,to:dashboardRange.to});setPage(1);setKind('all');setStatus('posted');setSource('all');setCategoryId('');setTab('transactions');
    }}/>}
  {tab==='transactions'&&<div className="panel"><div className="panel-heading"><h2>Transaction history</h2><span>{count} records</span></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Status</th><th className="align-right">Amount</th>{canAdmin&&<th>Action</th>}</tr></thead><tbody>{transactions.length===0?<tr><td colSpan={canAdmin?7:6} className="empty">No transactions for these filters.</td></tr>:transactions.map(t=><tr key={t.id}><td>{t.transaction_date}</td><td><span className={'pill '+t.kind}>{t.kind}</span></td><td>{t.category_name}</td><td title={t.notes||''}><button type="button" className="text-btn" onClick={()=>setTransactionId(t.id)}>{t.description}</button></td><td><span className={'pill '+(t.status==='void'?'decision-duplicate':'decision-new')}>{t.status==='void'&&t.void_reason?.startsWith('Import undone:')?'Import undone':t.status}</span>{t.corrected_from_transaction_id?<span className="cell-secondary">Corrected</span>:null}</td><td className="align-right">{t.kind==='expense'?'-':'+'}{peso(t.amount)}</td>{canAdmin&&<td>{t.status==='posted'&&t.source_system==='manual'?<><button className="text-btn" onClick={()=>setPrompt({type:'void',id:t.id})}>Void</button> <button className="text-btn" onClick={()=>setEntry({...t,category_id:String(t.category_id),reason:'',mode:'correct',original_id:t.id})}>Correct</button></>:null}</td>}</tr>)}</tbody></table></div><div className="pagination"><button disabled={page===1} className="btn" onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(count/50))}</span><button disabled={page*50>=count} className="btn" onClick={()=>setPage(p=>p+1)}>Next</button></div></div>}
  {tab==='categories'&&<div className="panel"><h2>Income and expense categories</h2><p className="muted">Organize manual entries and imported payments. Imports use source categories automatically. Historical transactions stay available when a category is disabled.</p>{canAdmin&&<form className="inline-form" onSubmit={e=>{e.preventDefault();mutate('/finance/categories',categoryInput).then(ok=>{if(ok)setCategoryInput({kind:'expense',name:''});});}}><select aria-label="Category type" value={categoryInput.kind} onChange={e=>setCategoryInput(x=>({...x,kind:e.target.value}))}><option value="expense">Expense</option><option value="income">Income</option></select><input aria-label="Category name" placeholder="Category name" maxLength={90} required value={categoryInput.name} onChange={e=>setCategoryInput(x=>({...x,name:e.target.value}))}/><button className="btn primary" disabled={busy}>Add category</button></form>}<div className="category-list">{categories.map(c=><div className="category" key={c.id}><span className={'pill '+c.kind}>{c.kind}</span><strong>{c.name}</strong><small>{Number(c.is_active)?'Active':'Inactive'}</small>{canAdmin&&<button className="btn" disabled={busy} onClick={()=>mutate(`/finance/categories/${c.id}`,{is_active:!Number(c.is_active)},'PATCH')}>{Number(c.is_active)?'Disable':'Enable'}</button>}
    {canAdmin&&Number(c.can_delete)===1&&<button type="button" className="text-btn text-danger" disabled={busy} onClick={()=>setPrompt({type:'category',id:c.id,name:c.name})}>Delete</button>}</div>)}</div></div>}
  {tab==='reports'&&<FinanceReports categories={categories} initialRange={dashboardRange}/>}
  {tab==='imports'&&canAdmin&&<FinanceImport onLedgerChanged={refresh} onViewTransaction={setTransactionId}/>}
  {tab==='audit'&&canAdmin&&<FinanceAudit users={users} onViewTransaction={setTransactionId}/>}
  {tab==='users'&&canAdmin&&<FinanceUsers users={users} currentUserId={user.id} onChanged={refresh} onAccessChanged={()=>{setTab('overview');api('/auth/me').then(result=>setUser(result.user)).catch(()=>setUser(null))}}/>}
  {transactionId&&<FinanceTransactionDetails key={transactionId} id={transactionId} onClose={()=>setTransactionId(null)}/>}
  {entry&&<Dialog label="Finance entry" title={entry.mode==='correct'?'Correct transaction':'New cash transaction'} onClose={()=>setEntry(null)} busy={busy}><EntryForm key={entry.mode?`correct-${entry.original_id}`:'create'} categories={categories} initial={entry} busy={busy} correcting={entry.mode==='correct'} onCancel={()=>setEntry(null)} onSubmit={v=>mutate(entry.mode==='correct'?`/finance/transactions/${entry.original_id}/correct`:'/finance/transactions',v)}/></Dialog>}
  {prompt?.type==='void'&&<Dialog label="Void transaction" title={`Void transaction #${prompt.id}`} onClose={()=>setPrompt(null)} busy={busy} danger><p>This keeps an audit record and removes the amount from the posted balance.</p><form onSubmit={e=>{e.preventDefault();mutate(`/finance/transactions/${prompt.id}/void`,{reason:e.currentTarget.reason.value});}}><label>Reason<textarea name="reason" minLength={5} maxLength={500} required/></label><div className="action-row"><button className="btn" type="button" disabled={busy} onClick={()=>setPrompt(null)}>Cancel</button><button className="btn danger" disabled={busy}>Confirm void</button></div></form></Dialog>}
  {prompt?.type==='category'&&<Dialog title="Delete category?" description={prompt.name} onClose={()=>setPrompt(null)} busy={busy} danger>
    <p>Finance can delete this category while there are no ledger or import references.</p>
    <ErrorNotice message={error} onDismiss={()=>setError('')}/>
    <div className="action-row"><button className="btn" type="button" disabled={busy} onClick={()=>setPrompt(null)}>Cancel</button>
      <button className="btn danger" type="button" disabled={busy} onClick={()=>mutate(`/finance/categories/${prompt.id}`,undefined,'DELETE')}>{busy?'Deleting…':'Delete category'}</button></div>
  </Dialog>}
  </main></div>;
}

