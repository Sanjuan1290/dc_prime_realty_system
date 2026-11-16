import {useState} from 'react';
import {requestApi} from '../utils/apiClient';
import PasswordField from './PasswordField';
export default function HrPasswordRecovery({token='',initialEmail='',onClose}) {
  const [email,setEmail]=useState(initialEmail),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const submit=async event=>{
    event.preventDefault();if(busy)return;setError('');
    if(token&&password!==confirmation){setError('The passwords do not match.');return}
    setBusy(true);
    try{const result=await requestApi(token?'/auth/reset-password':'/auth/forgot-password',{method:'POST',body:JSON.stringify(token?{token,new_password:password,confirm_password:confirmation}:{email})});setMessage(result.message);setPassword('');setConfirmation('');}
    catch(e){setError(e.message)}finally{setBusy(false)}
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5"><form className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm" onSubmit={submit} aria-busy={busy}>
    <p className="text-sm font-bold uppercase tracking-wide text-blue-700">D&amp;C Prime HR</p><h1 className="mt-2 text-2xl font-bold text-slate-950">{token?'Choose a new password':'Forgot password?'}</h1>
    <p className="mt-2 text-sm leading-6 text-slate-600">{token?'Use a unique password with at least 12 characters. Resetting it signs out your existing HR sessions.':'Enter your HR email. We will email a private link to reset your password.'}</p>
    {message?<p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{message}</p>:token?<>
      <PasswordField label="New password" required autoComplete="new-password" minLength={12} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/>
      <PasswordField label="Confirm new password" required autoComplete="new-password" minLength={12} maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>
    </>:<label className="mt-6 block text-sm font-semibold">HR email<input type="email" required maxLength={150} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-3 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-50"/></label>}
    {error&&<p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!message&&<button className="mt-6 w-full rounded-lg bg-blue-700 p-3 font-semibold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" type="submit" disabled={busy}>{busy?(token?'Saving password…':'Sending link…'):token?'Save new password':'Email reset link'}</button>}
    <button className="mt-4 w-full rounded-lg p-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" type="button" disabled={busy} onClick={onClose}>Back to sign in</button>
  </form></main>;
}
