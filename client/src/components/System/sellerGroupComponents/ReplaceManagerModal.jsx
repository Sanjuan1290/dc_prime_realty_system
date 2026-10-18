import { useEffect, useState } from 'react'
import { FiAlertTriangle, FiRepeat, FiCheckCircle, FiKey, FiLock, FiMail, FiShield, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch as fetchApi, useFetchPost as postApi } from '../../../utils/useFetch'

const roles = { division_manager: 'Division Manager', sales_director:'Sales Director', unit_manager:'Unit Manager' }
const inputClass='w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

/** Phase 6: one protected replacement flow; all amounts and prior sellers stay historical. */
const ReplaceManagerModal = ({ groupId, manager, onClose, onSaved, onCreateManager }) => {
  const [replacementUserId,setReplacementUserId]=useState('')
  const [reason,setReason]=useState('')
  const [password,setPassword]=useState('')
  const [code,setCode]=useState('')
  const [verificationId,setVerificationId]=useState(null)
  const [plan,setPlan]=useState(null)
  const [busy,setBusy]=useState(false)
  const [alert,setAlert]=useState(null)
  const [step,setStep]=useState('choose')
  const api=`/seller-groups/${groupId}/managers/${manager.user_id}/replace`

  useEffect(()=>{
    let alive=true
    setBusy(true)
    fetchApi(`${api}/preview${replacementUserId?`?replacementUserId=${encodeURIComponent(replacementUserId)}`:''}`)
      .then(response=>{if(alive){setPlan(response.data);setAlert(null)}})
      .catch(e=>{if(alive){setPlan(null);setAlert({type:'error',message:e.message})}})
      .finally(()=>{if(alive)setBusy(false)})
    return ()=>{alive=false}
  },[api,replacementUserId])

  const updateCandidate=value=>{setReplacementUserId(value);setVerificationId(null);setCode('');setStep('choose')}
  const requestCode=async()=>{
    if(!plan?.replacement){setAlert({type:'error',message:'Choose a replacement manager.'});return}
    if(reason.trim().length<5){setAlert({type:'error',message:'Enter a reason (at least 5 characters).'});return}
    if(!password){setAlert({type:'error',message:'Enter your administrator password.'});return}
    setBusy(true)
    try {
      const response=await postApi(`${api}/code`,{replacementUserId:Number(replacementUserId),reason:reason.trim(),password},{confirmationHandled:'technical'})
      setVerificationId(response.data?.verificationId)
      setPassword('')
      setStep('verify')
      setAlert({type:'success',message:`Code sent to ${response.data?.maskedEmail||'your email'}.`})
    } catch(e){setAlert({type:'error',message:e.message})}
    finally{setBusy(false)}
  }
  const confirm=async()=>{
    if(!/^\d{6}$/.test(code)){setAlert({type:'error',message:'Enter the 6-digit email code.'});return}
    setBusy(true)
    try {
      const response=await postApi(`${api}/confirm`,{replacementUserId:Number(replacementUserId),reason:reason.trim(),verificationId,code},{confirmationHandled:'technical'})
      onSaved?.(response.message||'Manager replaced and team moved.')
      onClose?.()
    } catch(e){setAlert({type:'error',message:e.message})}
    finally{setBusy(false)}
  }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Replace Manager">
    <div className="flex w-full max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2 text-blue-700"><FiRepeat/></span><div><h2 className="text-lg font-bold text-slate-950">Replace &amp; Deactivate Manager</h2><p className="text-sm text-slate-500">{manager.display_name||manager.full_name} · {roles[manager.role]||manager.role}</p></div></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><FiX/></button>
      </div>
      <div className="overflow-y-auto space-y-4 p-5">
        {alert?<StatusAlert type={alert.type} message={alert.message} onClose={()=>setAlert(null)}/>:null}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Current Manager</p><p className="font-bold text-slate-900">{manager.display_name||manager.full_name}</p></div>
        <div><label className="mb-1 block text-sm font-bold text-slate-700">Replacement Manager</label>
          <select value={replacementUserId} onChange={e=>updateCandidate(e.target.value)} disabled={busy||step==='verify'} className={inputClass}>
            <option value="">Choose {roles[manager.role]||'Manager'}</option>
            {(plan?.candidates||[]).map(item=><option key={item.userId} value={item.userId}>{item.name}</option>)}
          </select>
          {!plan?.candidates?.length&&!busy?<p className="mt-2 flex items-center gap-2 text-sm font-semibold text-amber-700"><FiAlertTriangle/> No eligible replacement found in this Network.</p>:null}
          {step==='choose'&&onCreateManager&&manager.role!=='division_manager'?<button type="button" className="mt-2 text-sm font-bold text-blue-700 hover:underline" onClick={onCreateManager}>+ Create a New Manager</button>:null}
          {manager.role==='division_manager'&&!plan?.candidates?.length?<p className="mt-1 text-xs text-slate-600">A new Division Manager requires an administrator-assisted setup before replacement.</p>:null}
        </div>
        {plan?.replacement?<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
          <p className="flex items-center gap-2 font-bold text-blue-950"><FiUsers/> Review Team Changes</p>
          <p className="text-sm text-blue-900"><strong>{plan.directReports.length}</strong> direct report(s) will move to <strong>{plan.replacement.name}</strong>. {plan.totalAffected} total downstream seller(s) are affected.</p>
          <div className="max-h-40 overflow-y-auto rounded-lg bg-white p-2">{plan.directReports.length?plan.directReports.map(person=><div key={person.userId} className="flex justify-between border-b border-slate-100 px-2 py-1.5 text-sm last:border-0"><span>{person.name}</span><span className="text-slate-500">{person.userStatus==='active'?'Active':'Inactive'}</span></div>):<p className="text-sm text-slate-500">No direct reports to move.</p>}</div>
          <p className="flex items-center gap-2 text-xs font-semibold text-blue-900"><FiCheckCircle/> Existing sales and commissions will not change.</p>
        </div>:null}
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><FiAlertTriangle className="mt-0.5 shrink-0"/><p>The current manager will be deactivated after their team moves successfully.</p></div>
        {step==='choose'?<><div><label className="mb-1 block text-sm font-bold text-slate-700">Reason</label><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} maxLength={500} placeholder="Why is this manager being replaced?" className={inputClass}/></div><div><label className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700"><FiKey/> Administrator Password</label><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className={inputClass}/></div></>:<div><label className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700"><FiMail/> Email Verification Code</label><input value={code} inputMode="numeric" maxLength={6} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className={inputClass} placeholder="6-digit code"/></div>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button><button type="button" onClick={step==='choose'?requestCode:confirm} disabled={busy||!plan?.replacement} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><FiShield/>{busy?'Please wait...':step==='choose'?'Send Verification Code':'Confirm Replacement'}</button></div>
    </div>
  </div>
}
export default ReplaceManagerModal
