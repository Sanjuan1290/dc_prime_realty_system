import {useEffect,useRef,useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useFetch,useFetchPost} from '../../../utils/useFetch'
import StatusAlert from '../../Shared/StatusAlert'

const expiryLabel=value=>value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'long',timeStyle:'short'}).format(new Date(value)):'Not yet generated'
export default function KioskPasswordSettings(){
 const status=useQuery({queryKey:['attendance-kiosk-password-status'],queryFn:()=>useFetch('/attendance/kiosk-password'),refetchInterval:60000})
 const [password,setPassword]=useState(null),[remaining,setRemaining]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const deadline=useRef(0),timer=useRef(null),inFlight=useRef(false)
 const hide=()=>{setPassword(null);setRemaining(0);deadline.current=0;if(timer.current)clearTimeout(timer.current)}
 useEffect(()=>{
  const check=()=>{if(deadline.current){const left=deadline.current-performance.now();if(left<=0)hide();else setRemaining(Math.ceil(left/1000))}}
  const interval=setInterval(check,200);document.addEventListener('visibilitychange',check);window.addEventListener('focus',check)
  return()=>{clearInterval(interval);clearTimeout(timer.current);deadline.current=0;document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check)}
 },[])
 const generate=async()=>{
  if(inFlight.current)return
  if(!window.confirm('Regenerate Kiosk Password? All currently opened kiosk sessions on ALL devices will be locked. The new password is shown ONCE for exactly 15 seconds. Copy it during that time; it cannot be revealed again. It is valid for 14 days.'))return
  inFlight.current=true;hide();setBusy(true);setError('')
  try{
   const result=await useFetchPost('/attendance/kiosk-password',{confirmed:true},{confirmationHandled:'kiosk-password'})
   deadline.current=performance.now()+15000;setPassword(result.data.password);setRemaining(15)
   timer.current=setTimeout(hide,15000);await status.refetch()
  }catch(failure){setError(failure.message||'Could not regenerate the kiosk password.')}finally{inFlight.current=false;setBusy(false)}
 }
 const state=status.data?.data
 return <section aria-label="Kiosk password management" className="rounded-2xl border border-slate-200 p-4 sm:p-5">
  <h3 className="font-black text-slate-950">Attendance Kiosk Password</h3>
  <p className="mt-1 text-sm text-slate-600">Regeneration locks every kiosk device. Copy the new password during its one-time 15-second display. Passwords expire after 14 days.</p>
  <p className="mt-2 text-sm font-semibold">Password expiration: {expiryLabel(state?.expiresAt)} (Philippine time)</p>
  {state?.expired&&<StatusAlert type="error" message="The kiosk password has expired. Regenerate it to unlock attendance stations."/>}
  {state?.expiringSoon&&<StatusAlert type="warning" message="The kiosk password expires within 3 days. Regenerate it before expiration."/>}
  {state?.legacy&&<p className="mt-2 text-xs text-amber-800">This station still uses the server PIN. Regenerate to start the 14-day password policy.</p>}
  {(error||status.isError)&&<StatusAlert type="error" message={error||status.error?.message||'Could not load kiosk settings.'}/>}
  <button type="button" onClick={generate} disabled={busy||status.isLoading} className="mt-3 min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy?'Regenerating…':'Regenerate Kiosk Password'}</button>
  {password&&<div role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm font-black">Copy now — hides permanently in {remaining} seconds</p><label className="mt-2 grid gap-1 text-xs font-bold">New kiosk password<input aria-label="New kiosk password" readOnly value={password} autoComplete="off" spellCheck={false} onFocus={event=>event.target.select()} className="w-full rounded-lg border border-amber-300 bg-white p-3 font-mono text-base"/></label><p className="mt-2 text-xs">If you lose this password, regenerate another one. All devices will lock again.</p></div>}
 </section>
}
