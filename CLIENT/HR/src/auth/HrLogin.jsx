import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import useCurrentUser from '../utils/useCurrentUser'
import { requestApi } from '../utils/apiClient'
const HrLogin = () => {
  const navigate = useNavigate(); const cache = useQueryClient();const current = useCurrentUser()
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  if (current.data?.user) return <Navigate replace to="/" />
  const login = async (event) => {
    event.preventDefault();setBusy(true);setError('')
    try { await requestApi('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      await cache.invalidateQueries({queryKey:['hr','currentUser']});navigate('/',{replace:true})
    } catch(e){setError(e.status===401?'Invalid HR credentials.': e.message || 'HR login failed.')}
    finally {setBusy(false);setPassword('')}
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
    <form onSubmit={login} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">D&amp;C Prime Realty</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">HR &amp; Payroll</h1>
      <p className="mt-2 text-sm text-slate-600">Use your separately assigned HR login, not your Realty login.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="mt-6 block text-sm font-semibold">HR email<input type="email" autoComplete="username" required maxLength={150} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-lg border p-3"/></label>
      <label className="mt-4 block text-sm font-semibold">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-lg border p-3"/></label>
      <button type="submit" disabled={busy} className="mt-6 w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{busy?'Signing in…':'Sign in to HR'}</button>
      <p className="mt-4 text-xs text-slate-500">Password reset and invitations will be added before HR production cutover.</p>
    </form>
  </main>
}
export default HrLogin
