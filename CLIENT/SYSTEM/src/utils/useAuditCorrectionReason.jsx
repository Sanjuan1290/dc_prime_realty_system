import {useEffect,useRef,useState} from 'react'
import {ReviewDialog} from '../components/Shared/ReviewDetailsDialogs'

// Collect missing case evidence before the existing Final Review and save flow.
// This does not grant correction authority; the server validates the exact case.
export default function useAuditCorrectionReason(auditCaseId){
  const pending=useRef(null)
  const [request,setRequest]=useState(null),[reason,setReason]=useState('')
  const cancelled=()=>Object.assign(new Error('Correction cancelled. No changes were saved.'),{code:'REVIEW_CANCELLED',status:499})
  useEffect(()=>()=>{pending.current?.reject(cancelled());pending.current=null},[])
  const close=()=>{pending.current?.reject(cancelled());pending.current=null;setRequest(null)}
  const requireReason=payload=>{
    const text=String(payload.reason||payload.correctionReason||payload.correctionSummary||payload.adjustmentReason||'').trim()
    if(!Number(auditCaseId)||Number(payload.auditCaseId||payload.audit_case_id)!==Number(auditCaseId)||(text.length>=5&&text.length<=1000))return Promise.resolve(payload)
    return new Promise((resolve,reject)=>{pending.current={resolve,reject,payload};setReason(text);setRequest({auditCaseId})})
  }
  const confirm=()=>{
    const text=reason.trim(),active=pending.current
    if(!active||text.length<5||text.length>1000)return
    pending.current=null;setRequest(null);active.resolve({...active.payload,reason:text})
  }
  const dialog=request?<ReviewDialog title="Correction Reason" onClose={close}>
    <p className="mb-4 text-sm text-slate-600">Describe the correction for this Audit Case. Your reason will be saved in its review history.</p>
    <label className="grid gap-2 text-sm font-semibold">Correction Reason<textarea autoFocus rows={4} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)} className="rounded-xl border border-slate-300 p-3"/></label>
    <footer className="mt-4 flex justify-end gap-2"><button type="button" onClick={close} className="rounded-lg border px-4 py-2">Cancel</button><button type="button" onClick={confirm} disabled={reason.trim().length<5} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Continue to Review</button></footer>
  </ReviewDialog>:null
  return {requireReason,correctionReasonDialog:dialog}
}
