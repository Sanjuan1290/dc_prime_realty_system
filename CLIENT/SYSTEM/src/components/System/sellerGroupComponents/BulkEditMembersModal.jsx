import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiArrowLeft, FiArrowRight, FiAlertTriangle, FiCheck, FiCheckCircle, FiSearch, FiUsers, FiX } from 'react-icons/fi'
import { useFetchPost as postApi } from '../../../utils/useFetch'

const roles = { sales_agent: 'Sales Agent', unit_manager: 'Unit Manager', sales_director: 'Sales Director', division_manager: 'Division Manager' }
const steps = ['Select members', 'Choose manager', 'Review changes']
const label = member => [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ').trim() || member.account_code || `#${member.user_id}`
const makeKey = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${Math.floor(Math.random() * 2 ** 48).toString(16).padStart(12, '0')}`
const fieldClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100'

const BulkEditMembersModal = ({ groupId, members = [], onClose, onSaved }) => {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const headingRef = useRef(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [step, setStep] = useState(0)
  const [role, setRole] = useState('sales_agent')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [requestKey] = useState(makeKey)
  const candidateRole = { sales_agent: 'unit_manager', unit_manager: 'sales_director', sales_director: 'division_manager' }[role]
  const eligible = useMemo(() => members.filter(member => member.role === role && !member.is_system_dummy), [members, role])
  const candidates = useMemo(() => members.filter(member => member.role === candidateRole && !member.is_system_dummy && member.user_status === 'active' && member.accredited_seller_status === 'active'), [members, candidateRole])
  const filtered = useMemo(() => eligible.filter(member => `${label(member)} ${member.account_code || ''}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || (statusFilter === 'active' ? member.user_status === 'active' : member.user_status !== 'active'))), [eligible, search, statusFilter])
  const memberById = useMemo(() => new Map(members.map(member => [Number(member.user_id), member])), [members])
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20)
  const chosenManager = memberById.get(Number(target))
  const selectedNames = selected.map(id => memberById.get(id)).filter(Boolean).map(label)
  const canContinue = step === 0 ? selected.length > 0 : step === 1 ? Boolean(target) : reason.trim().length >= 5 && (!preview?.crossBranch || accepted)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    if (step > 0) headingRef.current?.focus()
  }, [step])

  useEffect(() => {
    const handler = event => {
      if (event.key === 'Escape' && !busy) onClose?.()
      if (event.key !== 'Tab') return
      const nodes = dialogRef.current?.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
      if (!nodes?.length) return
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault()
        nodes[nodes.length - 1].focus()
      } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
        event.preventDefault()
        nodes[0].focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy, onClose])

  const close = () => { if (!busy) onClose?.() }
  const previewChanges = async () => {
    if (!selected.length) return setError('Select at least one member to continue.')
    if (!target) return setError('Choose a new manager.')
    setBusy(true)
    setError('')
    try {
      const data = await postApi(`/seller-groups/${groupId}/members/bulk-edit/preview`, { memberUserIds: selected, newManagerUserId: Number(target) }, { confirmationHandled: 'technical' })
      setPreview(data.data)
      setAccepted(false)
      setStep(2)
    } catch (error) {
      setError(error.message || 'We couldn’t prepare the preview. Check your selections and try again.')
    } finally { setBusy(false) }
  }

  const confirm = async () => {
    if (reason.trim().length < 5) return setError('Enter a reason of at least 5 characters.')
    if (preview?.crossBranch && !accepted) return setError('Review the new reporting lines and confirm how future manager commissions may change.')
    setBusy(true)
    setError('')
    try {
      const data = await postApi(`/seller-groups/${groupId}/members/bulk-edit/confirm`, { memberUserIds: selected, newManagerUserId: Number(target), reason: reason.trim(), expectedStateHash: preview.stateHash, expectedHeadUserId: preview.headUserId, confirmCrossBranch: accepted, requestKey }, { confirmationHandled: 'compact' })
      setSuccess(data)
      setStep(3)
      onSaved?.(data.message || 'Members updated successfully.')
    } catch (error) {
      setError(error.message || 'We couldn’t confirm the changes. Check the latest assignments before trying again.')
    } finally { setBusy(false) }
  }

  const back = () => {
    if (step === 0 || step === 3) return close()
    setError('')
    setPreview(null)
    setAccepted(false)
    setStep(step - 1)
  }

  return createPortal(
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/60 p-2 sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="bulk-edit-title" aria-describedby="bulk-edit-description" aria-busy={busy} className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FiUsers className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="bulk-edit-title" className="text-lg font-bold text-slate-950">Bulk Edit Members</h2>
            <p id="bulk-edit-description" className="mt-1 text-sm leading-relaxed text-slate-500">Choose members, assign a new manager, and review their reporting lines for future reservations.</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Close bulk edit" onClick={close} disabled={busy} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"><FiX className="h-5 w-5" /></button>
        </header>

        {step < 3 ? <nav aria-label="Bulk edit progress" className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <ol className="grid grid-cols-3 gap-2 sm:gap-4">{steps.map((name, index) => <li key={name} aria-current={step === index ? 'step' : undefined} className="min-w-0">
            <div className={`mb-2 h-1 rounded-full ${index <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <div className={`flex items-start gap-2 text-xs font-semibold sm:text-sm ${step === index ? 'text-blue-700' : 'text-slate-500'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${index <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{index < step ? <FiCheck /> : index + 1}</span>
              <span>{name}</span>
            </div>
          </li>)}</ol>
        </nav> : null}

        <main className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-bold text-slate-950 outline-none">{step === 0 ? 'Who will move?' : step === 1 ? 'Who will they report to?' : step === 2 ? 'Review the reporting changes' : 'Reporting assignments updated'}</h3>

          {step === 0 ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">Member Role
                <select aria-label="Member Role" className={fieldClass} value={role} onChange={event => { setRole(event.target.value); setSelected([]); setTarget(''); setSearch(''); setPage(1) }}>
                  {Object.entries(roles).filter(([id]) => id !== 'division_manager').map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">Status
                <select aria-label="Status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1) }} className={fieldClass}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-600">Search Members
              <span className="relative mt-1.5 block"><FiSearch className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${fieldClass} mt-0 pl-10`} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search by name or account code" /></span>
            </label>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span role="status" className="text-xs font-bold text-slate-700">{selected.length} of 50 selected</span>
                {selected.length ? <button type="button" onClick={() => setSelected([])} className="text-xs font-semibold text-blue-700 hover:underline">Clear selection</button> : <span className="text-xs text-slate-500">Choose one role per batch</span>}
              </div>
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{filtered.length ? visible.map(member => {
                const checked = selected.includes(Number(member.user_id))
                const manager = memberById.get(Number(member.accredited_seller_reports_under_user_id))
                return <label key={member.user_id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <input type="checkbox" aria-label={`Select ${label(member)}`} className="h-4 w-4 shrink-0 accent-blue-600" checked={checked} disabled={!checked && selected.length >= 50} onChange={event => setSelected(current => event.target.checked ? [...current, Number(member.user_id)] : current.filter(id => id !== Number(member.user_id)))} />
                  <span className="min-w-0 flex-1"><strong className="block break-words font-semibold text-slate-900">{label(member)}</strong><span className="mt-0.5 block text-xs text-slate-500">{[member.account_code, manager ? `Reports to ${label(manager)}` : 'No manager assigned'].filter(Boolean).join(' · ')}</span></span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${member.user_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.user_status === 'active' ? 'Active' : 'Inactive'}</span>
                </label>
              }) : <div className="px-4 py-8 text-center"><FiSearch className="mx-auto mb-2 h-6 w-6 text-slate-300" /><p className="text-sm font-semibold text-slate-700">No matching members</p><p className="mt-1 text-xs text-slate-500">Try another name, role, or status.</p></div>}</div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                <span>{filtered.length ? `${(currentPage - 1) * 20 + 1}–${Math.min(currentPage * 20, filtered.length)} of ${filtered.length} members` : '0 members'}</span>
                <div className="flex items-center gap-2"><button type="button" aria-label="Previous member page" disabled={currentPage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border p-1.5 hover:bg-slate-50 disabled:opacity-40"><FiArrowLeft /></button><span>Page {currentPage} of {totalPages}</span><button type="button" aria-label="Next member page" disabled={currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} className="rounded-lg border p-1.5 hover:bg-slate-50 disabled:opacity-40"><FiArrowRight /></button></div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">Selections stay checked when you search, filter, or change pages.</p>
          </> : null}

          {step === 1 ? <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{selected.length} {roles[role]} {selected.length === 1 ? 'member' : 'members'} selected</p><div className="mt-3 flex flex-wrap gap-2">{selectedNames.slice(0, 6).map((name, index) => <span key={selected[index]} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{name}</span>)}{selectedNames.length > 6 ? <span className="px-2 py-1 text-xs text-slate-500">+{selectedNames.length - 6} more</span> : null}</div></div>
            <label className="block text-sm font-semibold text-slate-700">New Manager<select aria-label="New Manager" className={fieldClass} value={target} onChange={event => setTarget(event.target.value)}><option value="">Choose a {roles[candidateRole]}</option>{candidates.map(member => <option key={member.user_id} value={member.user_id}>{label(member)} ({member.account_code || member.user_id})</option>)}</select></label>
            {chosenManager ? <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><span className="rounded-lg bg-white p-2.5 text-blue-600"><FiUsers /></span><div><p className="text-sm font-bold text-blue-950">{label(chosenManager)}</p><p className="mt-0.5 text-xs text-blue-700">{roles[chosenManager.role]} · Active in this Network</p></div></div> : <p className="text-xs leading-relaxed text-slate-500">Only active {roles[candidateRole]} members in this Network are available.</p>}
            {!candidates.length ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No active {roles[candidateRole]} is available. Add or activate an eligible manager before moving these members.</p> : null}
          </> : null}

          {step === 2 && preview ? <>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Members to move</p><p className="mt-1 text-2xl font-bold text-slate-950">{preview.items.length}</p></div><div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">New manager</p><p className="mt-1 break-words text-base font-bold text-blue-950">{preview.manager.name}</p></div></div>
            <div className="max-h-64 space-y-3 overflow-y-auto" aria-label="Reporting line comparison">{preview.items.map(item => <article key={item.sellerId} className="overflow-hidden rounded-xl border border-slate-200"><h4 className="border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-950">{item.name}</h4><div className="grid gap-3 p-4 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Current reporting line</p><p className="mt-1 break-words text-sm text-slate-600">{item.previousPath?.length ? item.previousPath.join(' → ') : item.previousManagerName || 'No manager assigned'}</p></div><div className="rounded-lg bg-blue-50 p-3 sm:-my-1 sm:-mr-1"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">New reporting line</p><p className="mt-1 break-words text-sm font-semibold text-blue-900">{item.newPath?.length ? item.newPath.join(' → ') : item.newManagerName}</p></div></div></article>)}</div>
            {preview.crossBranch ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5"><FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div id="bulk-reporting-impact"><p className="text-sm font-bold text-amber-950">Future manager commissions may change</p><p className="mt-1 text-sm leading-relaxed text-amber-900">For future reservations by these members, manager commissions will follow the new reporting line shown above. This may change which managers receive those commissions.</p></div></div>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-amber-200 pt-3 text-sm font-semibold text-amber-950"><input type="checkbox" aria-describedby="bulk-reporting-impact" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" /><span>I reviewed the reporting changes and understand their effect on future manager commissions.</span></label>
            </div> : null}
            <label className="block text-sm font-semibold text-slate-700">Reason for Change <span className="text-red-500">*</span><textarea className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={reason} maxLength={500} rows={3} onChange={event => setReason(event.target.value)} placeholder="Explain why these members are moving to the new manager" /><span className="mt-1 flex justify-between text-xs font-normal text-slate-500"><span>At least 5 characters</span><span>{reason.length}/500</span></span></label>
          </> : null}

          {step < 3 ? <div className="flex gap-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><p><strong className="font-semibold text-slate-800">Applies to future reservations.</strong> Existing buyer accounts keep their assigned sellers, commission recipients, rates, and recorded payments.</p></div> : null}
          {step === 3 ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-900"><FiCheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" /><strong className="block text-lg">Members updated successfully</strong><p className="mt-2 text-sm">{success?.data?.changed ?? selected.length} {Number(success?.data?.changed ?? selected.length) === 1 ? 'member now reports' : 'members now report'} to {preview?.manager.name || (chosenManager && label(chosenManager))}.</p>{success?.data?.batchId ? <p className="mt-3 text-xs text-emerald-700">Reference #{success.data.batchId}</p> : null}</div> : null}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <button type="button" onClick={back} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{step > 0 && step < 3 ? <FiArrowLeft /> : null}{step === 3 ? 'Close' : step === 0 ? 'Cancel' : 'Back'}</button>
          {step !== 3 ? <button type="button" onClick={step === 0 ? () => { setError(''); setStep(1) } : step === 1 ? previewChanges : confirm} disabled={busy || !canContinue} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{busy ? 'Processing…' : step === 2 ? 'Confirm Changes' : step === 1 ? 'Review Changes' : 'Choose Manager'}<FiArrowRight /></button> : null}
        </footer>
      </section>
    </div>, document.body
  )
}

export default BulkEditMembersModal
