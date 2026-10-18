import { useEffect, useState } from 'react'
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiKey, FiLock, FiRefreshCw, FiUserCheck, FiX } from 'react-icons/fi'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const field = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const formatRole = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

export default function ChangeAssignedSellerModal({ listing, accountId, actorRole, onClose, onLoadOptions, onPreview, onRequest, onConfirm }) {
  const [options, setOptions] = useState(null)
  const [sellerId, setSellerId] = useState('')
  const [preview, setPreview] = useState(null)
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [verificationId, setVerificationId] = useState(0)
  const [approvalRequestId, setApprovalRequestId] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('select')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const owner = ['super_admin', 'system_admin'].includes(actorRole)
  const isStaff = actorRole === 'accounting_staff'
  useEffect(() => {
    let active = true
    onLoadOptions({ accountId }).then(result => { if (active) setOptions(result.data) })
      .catch(e => { if (active) setError(e?.message || 'Could not load available sellers.') })
    return () => { active = false }
  }, [accountId])
  const submit = async (action) => {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e?.message || 'Something went wrong. Try again.') } finally { setBusy(false) }
  }
  const showPreview = () => submit(async () => {
    const result = await onPreview({ accountId, newSellerId: Number(sellerId) })
    setPreview(result.data); setStage('review')
  })
  const requestAuthorization = () => submit(async () => {
    if (reason.trim().length < 10) { setError('Enter a reason of at least 10 characters.'); return }
    if (owner && !password) { setError('Enter your account password.'); return }
    const result = await onRequest({ accountId, newSellerId: Number(sellerId), fingerprint: preview.fingerprint, reason: reason.trim(),
      password: owner ? password : undefined })
    setPassword('')
    if (result.data?.verificationId) setVerificationId(result.data.verificationId)
    if (result.data?.approvalRequestId) setApprovalRequestId(String(result.data.approvalRequestId))
    setStage('verify')
  })
  const save = () => submit(async () => {
    if (owner && (!verificationId || !/^\d{6}$/.test(code))) { setError('Enter the 6-digit verification code.'); return }
    if (isStaff && !Number(approvalRequestId)) { setError('Enter an approved request number.'); return }
    await onConfirm({ accountId, newSellerId: Number(sellerId), fingerprint: preview.fingerprint, reason: reason.trim(),
      verificationId: owner ? verificationId : undefined, code: owner ? code : undefined,
      approvalRequestId: isStaff ? Number(approvalRequestId) : undefined })
    onClose()
  })
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Change Assigned Seller">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><FiUserCheck className="text-blue-600"/> Change Assigned Seller</h2>
            <p className="text-xs text-slate-500">Unit {listing?.unit_id || '-'} · Buyer Account {options?.accountId || accountId}</p></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><FiX/></button>
        </header>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          {error ? <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><FiAlertTriangle className="mt-0.5 shrink-0"/>{error}</div> : null}
          {stage === 'select' ? <>
            <div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">Current Seller</span><p className="font-bold text-slate-900">{options?.oldSellerName || listing?.seller || '-'}</p></div>
            <label className="block space-y-1"><span className="text-sm font-bold">New Seller</span>
              <select className={field} value={sellerId} onChange={e=>setSellerId(e.target.value)} disabled={!options || busy}>
                <option value="">Choose Sales Agent or External Network</option>
                {(options?.candidates || []).map(s=><option key={s.id} value={s.id}>{s.name} · {s.network} ({formatRole(s.role)})</option>)}
              </select>
            </label>
            <p className="flex items-start gap-2 text-xs text-slate-500"><FiLock className="mt-0.5 shrink-0"/> Only eligible unpaid buyer accounts can change sellers. The new seller's full setup is checked before continuing.</p>
          </> : null}
          {stage !== 'select' && preview ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              {[{title:'Before',rows:preview.previous},{title:'After',rows:preview.next}].map(group=><section key={group.title} className="rounded-xl border border-slate-200 p-3">
                <h3 className="mb-2 flex items-center gap-2 font-black text-slate-900">{group.title==='After'?<FiCheckCircle className="text-emerald-600"/>:null}{group.title}</h3>
                {(group.rows||[]).map((row,index)=><div key={`${row.commissionId||row.accreditedSellerId}-${index}`} className="border-t border-slate-100 py-2 text-xs">
                  <p className="font-bold text-slate-900">{formatRole(row.role)} — {row.sellerName}</p>
                  <p className="text-slate-600">{Number(row.rate).toFixed(4)}% · {money(row.grossCommission)}</p>
                </div>)}
              </section>)}
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <span className="font-bold">Network Company Profit:</span> Before {Number(preview.oldCompanyProfitRate || 0).toFixed(4)}% → After {Number(preview.companyProfitRate || 0).toFixed(4)}%
            </div>
            <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><FiAlertTriangle className="mt-0.5 shrink-0"/> This changes the assigned seller and future unpaid commission recipients. Previous buyer information and financial history stay unchanged.</p>
            {stage === 'review' ? <label className="block space-y-1"><span className="text-sm font-bold">Reason for Change</span>
              <textarea className={field} rows={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why the assigned seller needs to be changed" />
            </label> : null}
            {stage === 'review' && owner ? <label className="block space-y-1"><span className="text-sm font-bold">Account Password</span>
              <input type="password" autoComplete="current-password" className={field} value={password} onChange={e=>setPassword(e.target.value)} />
            </label> : null}
            {stage === 'verify' ? <>
              {owner ? <label className="block space-y-1"><span className="flex items-center gap-2 text-sm font-bold"><FiKey/> Email Verification Code</span>
                <input className={field} inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="6-digit code" />
              </label> : null}
              {isStaff ? <label className="block space-y-1"><span className="text-sm font-bold">Approval Request ID</span>
                <input className={field} inputMode="numeric" value={approvalRequestId} onChange={e=>setApprovalRequestId(e.target.value.replace(/\D/g,''))} />
                <p className="text-xs text-amber-700">Wait until the Accounting Head approves this request in Review Center, then select Confirm.</p>
              </label> : null}
              {!owner && !isStaff ? <p className="text-sm text-emerald-700">Accounting Head approval is ready.</p> : null}
            </> : null}
          </> : null}
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" onClick={stage==='select'?onClose:()=>{setStage('select');setPreview(null);setVerificationId(0);setCode('')}} disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold"><FiArrowLeft/> {stage==='select'?'Cancel':'Back'}</button>
          <button type="button" onClick={stage==='select'?showPreview:stage==='review'?requestAuthorization:save} disabled={busy||(stage==='select'&&!sellerId)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {busy?<FiRefreshCw className="animate-spin"/>:<FiCheckCircle/>}
            {stage==='select'?'Review Changes':stage==='review'?(owner?'Send Verification Code':isStaff?'Request Approval':'Continue'):'Confirm Seller Change'}
          </button>
        </footer>
      </div>
    </div>
  )
}
