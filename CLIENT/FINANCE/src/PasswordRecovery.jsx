import {useState} from 'react';
import {api} from './api.js';
import {Notice,Spinner} from './FinanceFeedback.jsx';
import PasswordField from './PasswordField.jsx';
export default function PasswordRecovery({token='',initialEmail='',onClose}) {
  const [email,setEmail]=useState(initialEmail),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const submit=async event=>{
    event.preventDefault();if(busy)return;setError('');
    if(token&&password!==confirmation){setError('The passwords do not match.');return}
    setBusy(true);
    try{const result=await api(token?'/auth/reset-password':'/auth/forgot-password',{method:'POST',data:token?{token,new_password:password,confirm_password:confirmation}:{email}});setMessage(result.message);setPassword('');setConfirmation('');}
    catch(e){setError(e.message)}finally{setBusy(false)}
  };
  return <main className="login-shell"><form className="login-box" onSubmit={submit} aria-busy={busy}>
    <div className="eyebrow">D&amp;C Prime Finance</div><h1>{token?'Choose a new password':'Forgot password?'}</h1>
    <p>{token?'Use a unique password with 12–128 characters. Resetting it signs out your existing Finance sessions.':'Enter your Finance email. We will email a private link to reset your password.'}</p>
    {message?<Notice type="success">{message}</Notice>:token?<>
      <PasswordField label="New password" required autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>
      <PasswordField label="Confirm new password" required autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>
    </>:<label>Finance email<input type="email" required maxLength={150} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    {error&&<Notice type="error">{error}</Notice>}
    {!message&&<button className="btn primary" type="submit" disabled={busy}>{busy?<Spinner label={token?'Saving password…':'Sending link…'}/>:token?'Save new password':'Email reset link'}</button>}
    <button className="text-btn" type="button" disabled={busy} onClick={onClose}>Back to sign in</button>
  </form></main>;
}
