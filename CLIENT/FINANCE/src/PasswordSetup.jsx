import {useState} from 'react';
import {Notice,Spinner} from './FinanceFeedback.jsx';
import {api} from './api.js';
import PasswordField from './PasswordField.jsx';
export default function PasswordSetup({user,onChanged,onSignOut}){
  const [form,setForm]=useState({current_password:'',new_password:'',confirm_password:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setError('');if(form.new_password!==form.confirm_password){setError('The new passwords do not match.');return}setBusy(true);try{const result=await api('/auth/change-password',{method:'POST',data:form});onChanged(result.user)}catch(e){setError(e.message)}finally{setBusy(false)}};
  return <main className="login-shell"><form className="login-box" onSubmit={submit}><div className="eyebrow">D&amp;C Prime Finance</div><h1>Choose your password</h1><p>Welcome, {user.display_name}. Replace the password emailed to you to finish setting up your account.</p>{[['current_password','Temporary password','current-password'],['new_password','New password (12–128 characters)','new-password'],['confirm_password','Confirm new password','new-password']].map(([key,label,autoComplete])=><PasswordField key={key} label={label} required minLength={key==='current_password'?1:12} maxLength={128} autoComplete={autoComplete} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>)}{error&&<Notice type="error">{error}</Notice>}<button className="btn primary" disabled={busy}>{busy?<Spinner label="Saving…"/>:'Set password and open Finance'}</button><button className="text-btn" type="button" onClick={onSignOut}>Sign out</button></form></main>;
}
