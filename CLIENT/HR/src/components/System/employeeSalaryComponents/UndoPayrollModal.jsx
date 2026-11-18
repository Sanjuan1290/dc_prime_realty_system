import {useEffect,useRef,useState} from 'react'
import {useFetchPost} from '../../../utils/useFetch'
import {money} from './payrollFormatters'
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export default function UndoPayrollModal({payroll,onClose,onUndone}) {
  const dialog=useRef(null),[reason,setReason]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[date,setDate]=useState(today),[confirmed,setConfirmed]=useState(false),[challenge,setChallenge]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const released=payroll.payroll_status==='released',id=payroll.employee_payroll_id
  useEffect(()=>{const previous=document.activeElement;dialog.current?.showModal();return()=>{dialog.current?.close();previous?.focus?.()}},[])
  const submit=async e=>{
    e.preventDefault();if(busy)return;setBusy(true);setError('')
    try {
      if(!challenge){const response=await useFetchPost(`/employee-payroll/payrolls/${id}/undo/request`,{reason,password,cash_date:released?date:null,cash_confirmed:confirmed},{confirmationHandled:'payroll-undo'});setChallenge(response.challenge_id)}
      else {const response=await useFetchPost(`/employee-payroll/payrolls/${id}/undo/confirm`,{challenge_id:challenge,password,code},{confirmationHandled:'payroll-undo'});setPassword('');setCode('');onUndone(response)}
    }catch(error){setError(error.message||'Unable to undo payroll.');if(['PAYROLL_UNDO_CODE_EXPIRED','PAYROLL_UNDO_STALE'].includes(error.code)){setChallenge(null);setCode('')}}finally{setBusy(false)}
  }
  const input='mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100'
  return <dialog ref={dialog} aria-labelledby="undo-payroll-title" onCancel={e=>{e.preventDefault();if(!busy)onClose()}} className="m-auto max-h-[92vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-slate-950/60">
    <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
      <header><p className="text-xs font-bold uppercase text-amber-800">Administrator verification required</p><h2 id="undo-payroll-title" className="mt-1 text-xl font-black">Undo {released?'released':'finalized'} payroll</h2><p className="mt-2 text-sm">{payroll.employee_name_snapshot} · {payroll.period_label} · {money(payroll.net_fund_release)}</p></header>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">This returns the salary to Draft for recalculation. The original approval and receipt remain in undo history.{released?' A separate reversal offsets this recorded release in Finance. Export both the original release period and the reversal date. This action does not transfer money to or from the employee.':''}</p>
      <label className="block text-sm font-semibold">Reason<textarea required minLength={5} maxLength={1000} rows={3} value={reason} disabled={busy||Boolean(challenge)} onChange={e=>setReason(e.target.value)} className={input}/></label>
      {released&&<><label className="block text-sm font-semibold">Reversal date<input required type="date" min={payroll.released_date} max={today()} value={date} disabled={busy||Boolean(challenge)} onChange={e=>setDate(e.target.value)} className={input}/></label><label className="flex gap-3 text-sm leading-6"><input type="checkbox" required checked={confirmed} disabled={busy||Boolean(challenge)} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/><span>This payment was recorded incorrectly or its funds have been returned. It is not an outstanding paid salary.</span></label></>}
      <label className="block text-sm font-semibold">Your administrator password<input type="password" autoComplete="current-password" required maxLength={256} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} className={input}/></label>
      {challenge&&<><p role="status" className="text-sm text-blue-800">A code was sent to your administrator email. It expires in 10 minutes.</p><label className="block text-sm font-semibold">Email verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className={input}/></label><button type="button" disabled={busy} onClick={()=>{setChallenge(null);setCode('');setError('')}} className="text-sm font-semibold text-blue-700">Change details or request a new code</button></>}
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <footer className="flex flex-wrap justify-end gap-3 border-t pt-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Cancel</button><button type="submit" disabled={busy} className="rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?'Verifying…':challenge?'Undo payroll':'Send verification code'}</button></footer>
    </form>
  </dialog>
}
