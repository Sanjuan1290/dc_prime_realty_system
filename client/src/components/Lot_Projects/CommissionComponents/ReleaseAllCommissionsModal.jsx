import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useFetchPost } from '../../../utils/useFetch'
import ReleaseReceiptFields, { emptyReleaseReceipt, validateReleaseReceipt } from './ReleaseReceiptFields'

const money = (value) => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value||0))
const keyOf = (row) => row.type === 'company' ? 'company' : `seller:${row.commissionId}`
const METHODS = [ ['bank_transfer','Bank Transfer'],['cash','Cash'],['check','Check'],['other','Other'] ]

export const getReleaseAllRecipients = (profit, sellers, stageName) => [
  { key:'company', type:'company', name:profit.payee, role:'Company Profit',
    stage:(profit.stages||[]).find(s=>s.stage===stageName), profitId:profit.id },
  ...sellers.map(s=>({key:`seller:${s.commissionId||s.id}`,type:'seller',name:s.seller,
    role:s.role, commissionId:s.commissionId||s.id,
    stage:(s.releaseMilestones||[]).find(m=>m.stage===stageName)})),
]
export const releaseAllBlockedReason = (rows, releaseDay) => {
  if (!releaseDay) return 'Wait until the next scheduled commission release date.'
  if (rows.some(r=>!r.stage)) return 'At least one recipient has no matching milestone.'
  const bad=rows.find(r=>r.stage?.status !== 'Released' &&
    !(r.type==='company' ? r.stage?.canRelease : r.stage?.status==='Eligible'))
  if (bad) return `${bad.name}: milestone is not eligible or is on hold.`
  return ''
}
export default function ReleaseAllCommissionsModal({ profit, sellers, stage, projectSlug, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const recipients = useMemo(()=>getReleaseAllRecipients(profit,sellers,stage.stage),[profit,sellers,stage.stage])
  const pending = recipients.filter(r=>r.stage?.status!=='Released')
  const [forms,setForms] = useState(()=>Object.fromEntries(pending.map(r=>[r.key,{paymentMethod:'bank_transfer',receiptDetails:emptyReleaseReceipt()}])))
  const [selected,setSelected] = useState(pending[0]?.key || '')
  const [confirmed,setConfirmed] = useState(false)
  const [error,setError] = useState('')
  const blocked = releaseAllBlockedReason(recipients, profit.releaseDateInfo?.isReleaseDate)
  const update = (key, change) => setForms(current=>({...current,[key]:{...current[key],...change}}))
  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/projects/lot-projects/${projectSlug}/network-company-profit/${profit.id}/release-all`,{
      stage:stage.stage,confirmReleaseAll:true,
      recipients:recipients.map(row=>({type:row.type,commissionId:row.commissionId,
        paymentMethod:forms[row.key]?.paymentMethod,
        paymentReference:forms[row.key]?.receiptDetails?.referenceNumber?.trim(),
        receiptDetails:forms[row.key]?.receiptDetails})),
    },{confirmationHandled:'compact'}),
    onSuccess:async result=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:['network-company-profit',projectSlug]}),
        queryClient.invalidateQueries({queryKey:['lot-commissions',projectSlug]}),
        queryClient.invalidateQueries({queryKey:['lot-payment-logs',projectSlug]}),
      ])
      onSuccess?.(result)
      onClose()
    },
    onError:err=>setError(err?.message||'No commissions were released.'),
  })
  const submit=()=>{
    setError('')
    if (blocked) return setError(blocked)
    if (!pending.length) return setError('All recipients were already released.')
    if (!confirmed) return setError('Confirm that all payout details were reviewed.')
    for(const r of pending){
      const problem = validateReleaseReceipt(forms[r.key]?.receiptDetails)
      if(problem){ setSelected(r.key); return setError(`${r.name}: ${problem}`) }
    }
    mutation.mutate()
  }
  const chosen = pending.find(r=>r.key===selected) || pending[0]
  const currentForm=chosen && forms[chosen.key]
  return <div role="dialog" aria-modal="true" aria-label="Review all commission releases" className="fixed inset-0 z-[96] overflow-y-auto bg-slate-950/65 p-3 sm:p-6">
    <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-2xl">
      <header className="border-b px-5 py-4"><h3 className="text-lg font-black">Release All — {stage.stage}</h3><p className="text-xs text-slate-500">{profit.unit} · {profit.network} · {recipients.length} recipients · one database transaction</p></header>
      <div className="max-h-[73vh] space-y-4 overflow-y-auto p-5">
        {blocked ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{blocked}</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
        <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Recipient</th><th className="p-2 text-right">Gross</th><th className="p-2 text-right">Deductions</th><th className="p-2 text-right">Net</th><th className="p-2 text-left">Status</th></tr></thead><tbody>{recipients.map(r=><tr key={r.key} className="border-t"><td className="p-2 font-semibold">{r.name}<p className="text-xs text-slate-500">{r.role}</p></td><td className="p-2 text-right">{money(r.stage?.grossAmount ?? r.stage?.amount)}</td><td className="p-2 text-right">{money(r.stage?.deductionAmount)}</td><td className="p-2 text-right font-bold">{money(r.stage?.netAmount ?? r.stage?.amount)}</td><td className="p-2">{r.stage?.status==='Released'?'Already Released':r.stage?.displayStatus||(r.type==='company' && r.stage?.canRelease ? 'Eligible' : r.stage?.status)||'Missing'}</td></tr>)}</tbody></table></div>
        <p className="text-xs font-semibold text-slate-600">Each payee needs their own receipt details. Saved stages are skipped and cannot be paid twice.</p>
        {pending.length ? <>
          <nav className="flex flex-wrap gap-2">{pending.map(r=><button type="button" key={r.key} onClick={()=>{setSelected(r.key);setError('')}} className={`rounded-lg border px-3 py-2 text-xs font-bold ${selected===r.key?'border-blue-600 bg-blue-50 text-blue-800':'border-slate-200'}`}>{r.role}</button>)}</nav>
          {chosen && currentForm ? <div><p className="font-bold">{chosen.name} · {chosen.role}</p><label className="mt-3 block text-xs font-bold">Payment Method<select className="mt-1 block w-full rounded-lg border p-2" value={currentForm.paymentMethod} onChange={e=>update(chosen.key,{paymentMethod:e.target.value})}>{METHODS.map(([val,name])=><option key={val} value={val}>{name}</option>)}</select></label><ReleaseReceiptFields value={currentForm.receiptDetails} onChange={receiptDetails=>update(chosen.key,{receiptDetails})}/></div>:null}
          <button type="button" onClick={()=>setForms(current=>Object.fromEntries(Object.entries(current).map(([k,f])=>[k,{...f,receiptDetails:{...f.receiptDetails,receiptDate:current[selected]?.receiptDetails?.receiptDate||f.receiptDetails.receiptDate,witnessName:current[selected]?.receiptDetails?.witnessName||''}}])))} className="rounded-lg border px-3 py-2 text-xs font-bold">Copy receipt date and witness to all pending</button>
          <label className="flex items-start gap-2 text-xs font-semibold"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>I reviewed every recipient, net amount, payment reference and receipt detail. Record all releases for this milestone.</label>
        </>:null}
      </div>
      <footer className="flex justify-end gap-2 border-t p-4"><button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-lg border px-4 py-2 text-sm font-bold">Cancel</button><button type="button" onClick={submit} disabled={mutation.isPending || Boolean(blocked) || !pending.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{mutation.isPending?'Recording releases...':`Release ${pending.length} Pending Recipient(s)`}</button></footer>
    </div>
  </div>
}
