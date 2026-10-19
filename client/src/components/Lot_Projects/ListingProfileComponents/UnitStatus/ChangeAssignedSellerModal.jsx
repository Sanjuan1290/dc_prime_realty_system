import { useEffect, useRef, useState } from 'react'
import {
  FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheckCircle, FiChevronDown,
  FiEye, FiEyeOff, FiKey, FiLock, FiRefreshCw, FiSearch, FiUserCheck, FiX,
} from 'react-icons/fi'
import SellerChangeHierarchy from './SellerChangeHierarchy'
import { summarizeSellerChangeRows } from './sellerChangePresentation'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const field = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100'
const formatRole = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const stepTitles = ['Select Seller', 'Review Changes', 'Authorization']

export default function ChangeAssignedSellerModal({ listing, accountId, actorRole, onClose, onLoadOptions, onPreview, onRequest, onConfirm }) {
  const [options, setOptions] = useState(null)
  const [search, setSearch] = useState('')
  const [searchBusy, setSearchBusy] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedSeller, setSelectedSeller] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [verificationId, setVerificationId] = useState(0)
  const [approvalRequestId, setApprovalRequestId] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('select')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pickerRef = useRef(null)
  const searchRef = useRef(null)
  const loadOptionsRef = useRef(onLoadOptions)
  const previewSequence = useRef(0)
  const owner = ['super_admin', 'system_admin'].includes(actorRole)
  const isStaff = actorRole === 'accounting_staff'
  useEffect(() => { loadOptionsRef.current = onLoadOptions }, [onLoadOptions])

  useEffect(() => {
    let active = true
    const timeout = setTimeout(() => {
      loadOptionsRef.current({ accountId, query: search }).then((result) => {
        if (active) { setOptions(result.data); setSearchBusy(false); setError('') }
      }).catch((exception) => {
        if (active) { setSearchBusy(false); setError(exception?.message || 'Could not load eligible sellers.') }
      })
    }, search.trim() ? 250 : 0)
    return () => { active = false; clearTimeout(timeout) }
  }, [accountId, search])

  useEffect(() => {
    if (pickerOpen) searchRef.current?.focus()
  }, [pickerOpen])
  useEffect(() => {
    if (!pickerOpen) return undefined
    const closeOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) setPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [pickerOpen])
  useEffect(() => () => { previewSequence.current += 1 }, [])

  const submit = async (action) => {
    setBusy(true); setError('')
    try { await action() } catch (exception) { setError(exception?.message || 'Something went wrong. Try again.') } finally { setBusy(false) }
  }

  const chooseSeller = async (seller) => {
    if (busy) return
    previewSequence.current += 1
    const requestId = previewSequence.current
    setPickerOpen(false)
    setSearchBusy(true)
    setSearch('')
    setSelectedSeller(seller)
    setPreview(null)
    setPreviewError('')
    setPreviewBusy(true)
    setError('')
    setReason('')
    setPassword('')
    setStage('select')
    try {
      // Authoritative commission preview comes from the existing server endpoint.
      const result = await onPreview({ accountId, newSellerId: Number(seller.id) })
      if (requestId === previewSequence.current) setPreview(result.data)
    } catch (exception) {
      if (requestId === previewSequence.current) setPreviewError(exception?.message || 'The proposed hierarchy could not be calculated.')
    } finally {
      if (requestId === previewSequence.current) setPreviewBusy(false)
    }
  }

  const showPreview = () => {
    if (!preview || !selectedSeller || previewBusy || Number(preview.newSellerId) !== Number(selectedSeller.id)) return
    setStage('review'); setError('')
  }
  const requestAuthorization = () => submit(async () => {
    if (!preview || Number(preview.newSellerId) !== Number(selectedSeller?.id)) { setError('The selected seller preview is no longer valid. Select a seller again.'); return }
    if (reason.trim().length < 10) { setError('Enter a reason of at least 10 characters.'); return }
    if (owner && !password) { setError('Enter your account password.'); return }
    const result = await onRequest({ accountId, newSellerId: Number(selectedSeller.id), fingerprint: preview.fingerprint, reason: reason.trim(), password: owner ? password : undefined })
    setPassword('')
    if (result.data?.verificationId) setVerificationId(result.data.verificationId)
    if (result.data?.approvalRequestId) setApprovalRequestId(String(result.data.approvalRequestId))
    setStage('verify')
  })
  const save = () => submit(async () => {
    if (owner && (!verificationId || !/^\d{6}$/.test(code))) { setError('Enter the 6-digit verification code.'); return }
    if (isStaff && !Number(approvalRequestId)) { setError('Enter an approved request number.'); return }
    await onConfirm({ accountId, newSellerId: Number(selectedSeller.id), fingerprint: preview.fingerprint, reason: reason.trim(),
      verificationId: owner ? verificationId : undefined, code: owner ? code : undefined,
      approvalRequestId: isStaff ? Number(approvalRequestId) : undefined })
    onClose()
  })
  const back = () => {
    setError('')
    if (stage === 'verify') { setStage('review'); setCode(''); setVerificationId(0); setApprovalRequestId('') }
    else if (stage === 'review') setStage('select')
    else onClose()
  }
  const candidates = options?.candidates || []
  const before = preview?.previous || []
  const after = preview?.next || []
  const beforeSummary = summarizeSellerChangeRows(before)
  const afterSummary = summarizeSellerChangeRows(after)
  const totalsSame = Math.abs(beforeSummary.allocatedRate - afterSummary.allocatedRate) < 0.00005
    && Math.abs(beforeSummary.gross - afterSummary.gross) < 0.005
    && Math.abs(Number(preview?.oldCompanyProfitRate || 0) - Number(preview?.companyProfitRate || 0)) < 0.00005

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-label="Change Assigned Seller">
      <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[94dvh] sm:rounded-3xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiUserCheck aria-hidden="true" size={18} /></span>
            <div><h2 className="text-base font-black text-slate-950 sm:text-lg">Change Assigned Seller</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">Unit {listing?.unit_id || '-'} · Buyer Account {options?.accountId || accountId}</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close change seller dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>
        <nav aria-label="Seller change progress" className="grid shrink-0 grid-cols-3 gap-1 border-b border-slate-100 px-3 py-3 sm:gap-3 sm:px-6">
          {stepTitles.map((name,index) => {
            const current = { select: 0, review: 1, verify: 2 }[stage]
            return <div key={name} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-black sm:text-xs ${index === current ? 'bg-blue-50 text-blue-800' : index < current ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${index === current ? 'bg-blue-600 text-white' : index < current ? 'bg-emerald-100' : 'bg-slate-100'}`}>{index < current ? <FiCheckCircle /> : index + 1}</span>
              <span>{name}</span>
            </div>
          })}
        </nav>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
          {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"><FiAlertTriangle className="mt-0.5 shrink-0"/>{error}</div> : null}
          {stage === 'select' ? <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"><p className="text-[11px] font-black uppercase text-slate-500">Current Assigned Seller</p><p className="mt-1 text-sm font-black text-slate-950">{options?.oldSellerName || listing?.seller || '-'}</p></div>
            <section className="space-y-2">
              <label id="new-seller-label" className="block text-sm font-black text-slate-900">New Seller <span className="text-red-600">*</span></label>
              <div ref={pickerRef} className="relative">
                <button type="button" disabled={busy} onClick={() => { setPickerOpen(!pickerOpen); setActiveIndex(0) }}
                  aria-expanded={pickerOpen} aria-controls="seller-search-options" aria-labelledby="new-seller-label"
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 outline-none transition hover:border-blue-300 focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50">
                  <span className="min-w-0 truncate">{selectedSeller ? `${selectedSeller.name} · ${selectedSeller.network} (${formatRole(selectedSeller.role)})` : 'Search Sales Agents or External Networks...'}</span><FiChevronDown className="shrink-0 text-slate-500" />
                </button>
                {pickerOpen ? <div id="seller-search-options" className="mt-2 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-lg">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-3"><FiSearch className="shrink-0 text-slate-400" />
                    <input ref={searchRef} type="search" role="combobox" aria-autocomplete="list" aria-expanded={pickerOpen} aria-controls="seller-candidate-list" aria-activedescendant={candidates[activeIndex] ? `seller-option-${candidates[activeIndex].id}` : undefined}
                      value={search} onChange={(e) => { setSearchBusy(true); setSearch(e.target.value); setActiveIndex(0) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') { e.preventDefault(); setPickerOpen(false) }
                        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.max(0, Math.min(i + 1, candidates.length - 1))) }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
                        if (e.key === 'Enter' && candidates[activeIndex] && !searchBusy) { e.preventDefault(); chooseSeller(candidates[activeIndex]) }
                      }}
                      className="h-12 w-full bg-transparent text-sm outline-none" placeholder="Name, Network, role, or Seller ID" aria-label="Search eligible sellers" />
                    {searchBusy ? <FiRefreshCw className="animate-spin text-blue-600" aria-label="Searching"/> : null}
                  </div>
                  <div id="seller-candidate-list" role="listbox" aria-label="Eligible sellers" className="max-h-56 overflow-y-auto p-1.5">
                    {searchBusy ? <p role="status" className="p-3 text-sm text-slate-500">Finding eligible sellers...</p>
                      : candidates.length ? candidates.map((seller,index) => <button role="option" aria-selected={Number(selectedSeller?.id) === Number(seller.id)}
                        key={seller.id} id={`seller-option-${seller.id}`} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => chooseSeller(seller)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50 ${index===activeIndex?'bg-blue-50/70':''}`}>
                        <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{seller.name || seller.network || `Seller #${seller.id}`}</span>
                          <span className="block truncate text-xs text-slate-500">{seller.network} · {formatRole(seller.role)} · #{seller.id}</span></span>
                        {Number(selectedSeller?.id) === Number(seller.id) ? <FiCheckCircle className="shrink-0 text-emerald-600" aria-hidden="true"/> : null}
                      </button>) : <p role="status" className="px-3 py-5 text-center text-sm text-slate-500">No eligible sellers match this search.</p>}
                    {!searchBusy && options?.hasMore ? <p className="border-t border-slate-100 px-3 py-2 text-xs text-amber-700">Showing the first 100 matches. Refine the search to find others.</p> : null}
                  </div>
                </div> : null}
              </div>
              <p className="flex items-start gap-2 text-xs text-slate-500"><FiLock className="mt-0.5 shrink-0"/> Only eligible untouched buyer accounts can change sellers. Server checks the full hierarchy before proceeding.</p>
            </section>
            {selectedSeller ? <>
              {previewBusy ? <div role="status" className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800"><FiRefreshCw className="animate-spin"/> Calculating {selectedSeller.name}'s current commission hierarchy...</div> : null}
              {previewError ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"><FiAlertTriangle className="mt-0.5 shrink-0"/> {previewError} Choose another seller or reselect this seller to retry.</div> : null}
              {!previewBusy && preview && Number(preview.newSellerId)===Number(selectedSeller.id) ? <SellerChangeHierarchy rows={preview.next || []} title="Proposed Commission Hierarchy" subtitle={`${selectedSeller.network} · ${formatRole(selectedSeller.role)} · Based on saved reservation pricing`} proposal showReportsUnder /> : null}
            </> : null}
          </> : null}
          {stage !== 'select' && preview ? <>
            <div className="grid gap-3 lg:grid-cols-2">
              <SellerChangeHierarchy rows={before} comparison={after} title="Before" subtitle="Current saved recipients and commission rates" highlightChanges showSummary={false} />
              <SellerChangeHierarchy rows={after} comparison={before} title="After" subtitle="Proposed recipients and commission rates — not yet saved" highlightChanges showSummary={false} proposal />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-500">Recipient rate · Before → After</p><p className="mt-1 font-black tabular-nums text-slate-900">{beforeSummary.allocatedRate.toFixed(4)}% <FiArrowRight className="inline text-slate-400"/> {afterSummary.allocatedRate.toFixed(4)}%</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-500">Commissions · Before → After</p><p className="mt-1 text-xs font-black tabular-nums text-slate-900 sm:text-sm">{money(beforeSummary.gross)} <FiArrowRight className="inline text-slate-400"/> {money(afterSummary.gross)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-500">Company profit · Before → After</p><p className="mt-1 font-black tabular-nums text-slate-900">{Number(preview.oldCompanyProfitRate || 0).toFixed(4)}% <FiArrowRight className="inline text-slate-400"/> {Number(preview.companyProfitRate || 0).toFixed(4)}%</p></div>
            </div>
            {totalsSame ? <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><FiCheckCircle/> No commission total or company profit rate changes; recipient assignments may differ.</p> : null}
            <p className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-900"><FiAlertTriangle className="mt-0.5 shrink-0"/> This intentionally changes the assigned seller and unpaid commission recipients on this eligible account only. Prior buyer information and protected financial history remain unchanged.</p>
            {stage === 'review' ? <section className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="text-sm font-black text-slate-900">Reason and authorization</h3>
              <label className="block space-y-1.5"><span className="text-sm font-bold text-slate-800">Reason for Change <span className="text-red-600">*</span></span>
                <textarea className={field} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why the assigned seller needs to be changed (at least 10 characters)." />
                <span className="block text-right text-[11px] text-slate-500">{reason.trim().length}/500 characters</span>
              </label>
              {owner ? <label className="block space-y-1.5"><span className="text-sm font-bold text-slate-800">Account Password <span className="text-red-600">*</span></span>
                <span className="relative block"><input type={showPassword?'text':'password'} autoComplete="current-password" className={`${field} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={() => setShowPassword((show)=>!show)} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center text-slate-500">{showPassword?<FiEyeOff/>:<FiEye/>}</button></span>
              </label> : null}
            </section> : null}
            {stage === 'verify' ? <section className="space-y-3 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="text-sm font-black text-slate-900">Final authorization</h3>
              {owner ? <label className="block space-y-1.5"><span className="flex items-center gap-2 text-sm font-bold text-slate-800"><FiKey/> Email Verification Code</span>
                <input className={field} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" />
              </label> : null}
              {isStaff ? <label className="block space-y-1.5"><span className="text-sm font-bold text-slate-800">Approval Request ID</span>
                <input className={field} inputMode="numeric" value={approvalRequestId} onChange={(e)=>setApprovalRequestId(e.target.value.replace(/\D/g,''))}/>
                <span className="block text-xs font-semibold text-amber-700">Wait until the Accounting Head approves this exact request in Review Center.</span>
              </label> : null}
              {!owner && !isStaff ? <p className="text-sm font-bold text-emerald-700"><FiCheckCircle className="mr-1 inline"/> Accounting Head approval is ready.</p> : null}
            </section> : null}
          </> : null}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 sm:py-4">
          <span className="hidden text-xs font-semibold text-slate-500 sm:block">{stage === 'select' ? 'Preview only · no changes saved' : stage === 'review' ? 'Approval required before saving' : 'Confirm the exact reviewed change'}</span>
          <div className="flex w-full gap-2 sm:w-auto sm:ml-auto">
            <button type="button" onClick={back} disabled={busy} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:flex-none"><FiArrowLeft/> {stage === 'select' ? 'Cancel' : 'Back'}</button>
            <button type="button" onClick={stage === 'select' ? showPreview : stage === 'review' ? requestAuthorization : save}
              disabled={busy || (stage === 'select' && (!preview || previewBusy || Number(preview.newSellerId) !== Number(selectedSeller?.id))) || (stage === 'review' && (reason.trim().length < 10 || (owner && !password)))}
              className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:flex-none sm:px-5">
              {busy ? <FiRefreshCw className="animate-spin"/> : <FiCheckCircle/>}
              {stage === 'select' ? 'Review Changes' : stage === 'review' ? owner ? 'Send Verification Code' : isStaff ? 'Request Approval' : 'Continue' : 'Confirm Seller Change'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
