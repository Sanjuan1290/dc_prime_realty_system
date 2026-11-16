import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import useCurrentUser from '../utils/useCurrentUser'
import { requestApi } from '../utils/apiClient'
import useRetryCooldown from '../utils/useRetryCooldown'
import PasswordField from './PasswordField'
import HrPasswordRecovery from './HrPasswordRecovery'
const HrLogin = () => {
  const navigate = useNavigate(); const cache = useQueryClient();const current = useCurrentUser({refetchOnWindowFocus:false})
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const [forgot,setForgot]=useState(false),[resetToken,setResetToken]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('reset-password')||'')
  const {retrySeconds,delayRetry}=useRetryCooldown(current.error?.status===401?null:current.error)
  useEffect(()=>{if(current.error && current.error.status!==401)setError(current.error.message)},[current.error])
  useEffect(()=>{
    const receiveResetLink=()=>{const token=new URLSearchParams(window.location.hash.slice(1)).get('reset-password');if(token){setResetToken(token);window.history.replaceState(null,'',window.location.pathname+window.location.search)}}
    receiveResetLink();window.addEventListener('hashchange',receiveResetLink);return()=>window.removeEventListener('hashchange',receiveResetLink)
  },[])
  if(forgot||resetToken)return <HrPasswordRecovery key={resetToken||'forgot'} token={resetToken} initialEmail={email} onClose={()=>{setForgot(false);setResetToken('');setPassword('');cache.setQueryData(['hr','currentUser'],null)}}/>
  if (current.data?.user) return <Navigate replace to="/" />
  const login = async (event) => {
    event.preventDefault();if(busy||retrySeconds>0)return;setBusy(true);setError('')
    try { await requestApi('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      await cache.invalidateQueries({queryKey:['hr','currentUser']});navigate('/',{replace:true})
    } catch(e){delayRetry(e);setError(e.status===401?'Invalid HR credentials.': e.message || 'HR login failed.');if(e.status===401)setPassword('')}
    finally {setBusy(false)}
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
    <form onSubmit={login} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">D&amp;C Prime Realty</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">HR &amp; Payroll</h1>
      <p className="mt-2 text-sm text-slate-600">Use your separately assigned HR login, not your Realty login.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="mt-6 block text-sm font-semibold">HR email<input type="email" autoComplete="username" required maxLength={150} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-lg border p-3"/></label>
      <PasswordField autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/>
      <button type="button" onClick={()=>{setError('');setPassword('');setForgot(true)}} className="mt-3 rounded-md text-sm font-semibold text-blue-700 transition hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Forgot password?</button>
      <button type="submit" disabled={busy||current.isPending||retrySeconds>0} className="mt-6 w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{current.isPending?'Connecting to HR…':busy?'Signing in…':retrySeconds>0?`Try again in ${retrySeconds}s`:'Sign in to HR'}</button>
      <p className="mt-4 text-xs text-slate-500">For HR account access, contact your administrator.</p>
    </form>
  </main>
}
export default HrLogin
