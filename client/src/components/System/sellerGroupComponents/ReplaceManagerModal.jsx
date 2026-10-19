import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiAlertTriangle, FiCheck, FiCheckCircle, FiChevronRight, FiMail, FiSearch, FiShield, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch as fetchApi, useFetchPost as postApi } from '../../../utils/useFetch'

const roles = { division_manager: 'Division Manager', sales_director: 'Sales Director', unit_manager: 'Unit Manager' }
const childRoles = { division_manager: 'Sales Directors', sales_director: 'Unit Managers', unit_manager: 'Sales Agents' }
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
const managerLabel = person => `${person?.name || 'Unknown manager'}${person?.accountCode ? ` (${person.accountCode})` : ''}`

// A replacement moves the old manager's DIRECT reports. It does not exchange teams.
const ReplaceManagerModal = ({ groupId, manager, onClose, onSaved }) => {
  const [replacementUserId, setReplacementUserId] = useState('')
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [code, setCode] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [alert, setAlert] = useState(null)
  const [step, setStep] = useState('choose')
  const [confirmTeamMerge, setConfirmTeamMerge] = useState(false)
  const searchRef = useRef(null)
  const dialogRef = useRef(null)
  const requiresEmail = manager.role === 'division_manager' && Boolean(plan?.replacesNetworkHead)
  const api = `/seller-groups/${groupId}/managers/${manager.user_id}/replace`
  const outgoingName = manager.display_name || manager.full_name || 'the current manager'

  useEffect(() => {
    let alive = true
    setLoadingPlan(true)
    setPlan(null)
    fetchApi(`${api}/preview${replacementUserId ? `?replacementUserId=${encodeURIComponent(replacementUserId)}` : ''}`)
      .then(response => { if (alive) { setPlan(response.data); setAlert(null) } })
      .catch(error => { if (alive) { setPlan(null); setAlert({ type: 'error', message: error.message || 'Unable to load eligible managers. Please try again.' }) } })
      .finally(() => { if (alive) setLoadingPlan(false) })
    return () => { alive = false }
  }, [api, replacementUserId])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    searchRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose?.() }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])
        .filter(element => element.getClientRects().length)
      if (!controls.length) return
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus() }
      if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  const candidates = plan?.candidates || []
  const filteredCandidates = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return candidates.filter(person => !term || `${person.name} ${person.accountCode || ''}`.toLocaleLowerCase().includes(term))
  }, [candidates, search])
  const shownCandidates = filteredCandidates.slice(0, 8)
  const currentSelection = candidates.find(person => String(person.userId) === replacementUserId)
  const incoming = plan?.directReports || []
  const existing = plan?.existingDirectReports || []
  const title = roles[manager.role] || 'Manager'

  const updateCandidate = value => {
    setReplacementUserId(String(value))
    setVerificationId(null)
    setCode('')
    setStep('choose')
    setConfirmTeamMerge(false)
    setAlert(null)
  }

  const requestCode = async () => {
    if (!plan?.replacement) return setAlert({ type: 'error', message: 'Select a replacement manager first.' })
    if (reason.trim().length < 5) return setAlert({ type: 'error', message: 'Please explain the reason for this replacement (at least 5 characters).' })
    if (plan.mergeRequired && !confirmTeamMerge) return setAlert({ type: 'error', message: 'Review both teams and confirm that they will be combined.' })
    setBusy(true)
    setAlert(null)
    try {
      const response = await postApi(`${api}/code`, { replacementUserId: Number(replacementUserId), reason: reason.trim() }, { confirmationHandled: 'technical' })
      setVerificationId(response.data?.verificationId)
      setStep('verify')
      setAlert({ type: 'success', message: `We sent a verification code to ${response.data?.maskedEmail || 'your registered email address'}.` })
    } catch (error) { setAlert({ type: 'error', message: error.message || 'We could not send your code. Try again.' }) }
    finally { setBusy(false) }
  }

  const confirm = async () => {
    if (!plan?.replacement) return setAlert({ type: 'error', message: 'Select a replacement manager first.' })
    if (reason.trim().length < 5) return setAlert({ type: 'error', message: 'Please explain the reason for this replacement (at least 5 characters).' })
    if (plan.mergeRequired && !confirmTeamMerge) return setAlert({ type: 'error', message: 'Review both teams and confirm that they will be combined.' })
    if (requiresEmail && (!verificationId || !/^\d{6}$/.test(code))) return setAlert({ type: 'error', message: 'Enter the 6-digit verification code from your email.' })
    setBusy(true)
    setAlert(null)
    try {
      const response = await postApi(`${api}/confirm`, {
        replacementUserId: Number(replacementUserId), reason: reason.trim(),
        expectedStateHash: plan.stateHash, expectedHeadUserId: plan.currentHeadUserId,
        confirmReplacement: true, confirmTeamMerge,
        ...(requiresEmail ? { verificationId, code } : {}),
      }, { confirmationHandled: 'compact' })
      onSaved?.(response.message || `${incoming.length} team member(s) transferred successfully.`)
      onClose?.()
    } catch (error) {
      setAlert({ type: 'error', message: error.message || 'The replacement could not be confirmed. Please check the latest team assignments.' })
      // A rejected stale preview must be refreshed; never resubmit a stale hash.
      if (Number(error.status) === 409 && /team assignments changed/i.test(String(error.message || ''))) {
        updateCandidate('')
        setAlert({ type: 'error', message: 'Team assignments changed since your preview. Select the replacement again and review the latest team before saving.' })
      }
    } finally { setBusy(false) }
  }

  const canContinue = !busy && !loadingPlan && Boolean(plan?.replacement) && reason.trim().length >= 5 && (!plan?.mergeRequired || confirmTeamMerge)

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="replace-manager-title" className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="replace-manager-title" className="text-lg font-bold text-slate-950">Replace Manager</h2>
            <p className="mt-1 text-sm text-slate-600">Replace <strong>{outgoingName}</strong> ({title}) and move their team to another manager.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close manager replacement" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>
        <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}

          <section aria-labelledby="choose-manager-heading" className="space-y-2">
            <h3 id="choose-manager-heading" className="text-sm font-bold text-slate-900">1. Choose the new {title}</h3>
            <label htmlFor="replacement-search" className="block text-sm font-semibold text-slate-700">Search replacement managers</label>
            <div className="relative">
              <FiSearch aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input ref={searchRef} id="replacement-search" type="search" autoComplete="off" value={search} onChange={event => setSearch(event.target.value)} disabled={busy || step === 'verify'} placeholder="Enter a name or account code" className={`${inputClass} pl-10`} />
            </div>
            {loadingPlan ? <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Checking eligible managers…</p> : plan ? <>
              <div role="group" aria-label="Eligible replacement managers" className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1">
                {shownCandidates.map(person => {
                  const selected = replacementUserId === String(person.userId)
                  return <button key={person.userId} type="button" disabled={busy || step === 'verify'} onClick={() => updateCandidate(person.userId)} aria-pressed={selected} className={`flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left text-sm hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-60 ${selected ? 'bg-blue-50 text-blue-900' : 'text-slate-800'}`}>
                    <span><strong className="block">{person.name}</strong>{person.accountCode ? <span className="text-xs text-slate-500">{person.accountCode}</span> : null}</span>
                    {selected ? <span className="flex items-center gap-1 text-xs font-bold text-blue-700"><FiCheck /> Selected</span> : <FiChevronRight className="shrink-0 text-slate-400" />}
                  </button>
                })}
                {!shownCandidates.length ? <p className="p-3 text-sm text-slate-600">{candidates.length ? 'No managers match your search. Try another name or account code.' : 'No eligible replacement managers are available in this Network.'}</p> : null}
              </div>
              {filteredCandidates.length > 8 ? <p className="text-xs text-slate-600">Showing 8 of {filteredCandidates.length} matching managers. Keep typing to narrow your search.</p> : <p className="text-xs text-slate-600">{filteredCandidates.length} {filteredCandidates.length === 1 ? 'eligible manager' : 'eligible managers'} matching your search.</p>}
              {currentSelection ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900"><strong>Selected:</strong> {managerLabel(currentSelection)}</p> : null}
            </> : null}
          </section>

          {plan?.replacement ? <section aria-labelledby="team-review-heading" className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 id="team-review-heading" className="flex items-center gap-2 text-sm font-bold text-blue-950"><FiUsers /> 2. Review the team after replacement</h3>
            <p className="text-sm text-blue-950"><strong>{plan.replacement.name}</strong> will take over the team currently reporting to <strong>{plan.outgoing.name}</strong>.</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-3"><strong className="text-xl text-slate-950">{incoming.length}</strong><p className="text-xs text-slate-600">Moving in</p></div>
              <div className="rounded-xl bg-white p-3"><strong className="text-xl text-slate-950">{existing.length}</strong><p className="text-xs text-slate-600">Already on team</p></div>
              <div className="rounded-xl border border-blue-200 bg-white p-3"><strong className="text-xl text-blue-900">{plan.finalDirectReportCount}</strong><p className="text-xs text-slate-600">Team after</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-blue-100 bg-white p-3">
                <p className="mb-1 text-sm font-bold text-slate-900">Moving from {plan.outgoing.name}</p>
                <p className="mb-2 text-xs text-slate-600">{incoming.length} {childRoles[manager.role] || 'members'} will report to {plan.replacement.name}.</p>
                <ul className="max-h-28 space-y-1 overflow-y-auto text-sm text-slate-800">{incoming.map(person => <li key={person.userId} className="flex justify-between gap-2"><span>{person.name}</span>{person.userStatus !== 'active' ? <span className="text-xs text-amber-700">Inactive</span> : null}</li>)}{!incoming.length ? <li className="text-slate-500">No direct team members to move.</li> : null}</ul>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white p-3">
                <p className="mb-1 text-sm font-bold text-slate-900">Already reporting to {plan.replacement.name}</p>
                <p className="mb-2 text-xs text-slate-600">These members will stay with their current manager.</p>
                <ul className="max-h-28 space-y-1 overflow-y-auto text-sm text-slate-800">{existing.map(person => <li key={person.userId}>{person.name}</li>)}{!existing.length ? <li className="text-slate-500">No existing direct team members.</li> : null}</ul>
              </div>
            </div>
            {plan.totalAffected > incoming.length ? <p className="text-xs text-blue-950">This move also affects {plan.totalAffected - incoming.length} indirect team members further down the reporting structure. They keep their immediate managers.</p> : null}
            {plan.replacesNetworkHead ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><FiAlertTriangle className="mr-1 inline" /> This replacement also changes the designated Network Head.</p> : null}
            {plan.mergeRequired ? <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" checked={confirmTeamMerge} onChange={event => setConfirmTeamMerge(event.target.checked)} disabled={busy || step === 'verify'} className="mt-1" /><span><strong>Confirm combining these teams.</strong> {incoming.length} member(s) will join the {existing.length} existing member(s). No one will be swapped or removed from {plan.replacement.name}'s team.</span></label> : null}
            <p className="flex items-center gap-2 text-xs font-medium text-blue-900"><FiCheckCircle /> Existing and ongoing buyer accounts keep their assigned sellers, saved commission allocations and payment history. This replacement changes the hierarchy for future reservations only.</p>
          </section> : <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Select a new manager above to preview exactly who will move and who will stay.</p>}

          {plan?.replacement ? <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><FiAlertTriangle className="mt-0.5 shrink-0" /><p><strong>{plan.outgoing.name} will be deactivated</strong> after the team is transferred. {plan.replacement.name} will remain active.{requiresEmail ? ' Changing the Network Head requires an email verification code.' : ''}</p></div> : null}

          {step === 'choose' ? <div><label htmlFor="replacement-reason" className="mb-1 block text-sm font-bold text-slate-700">3. Reason for replacement *</label><textarea id="replacement-reason" value={reason} onChange={event => setReason(event.target.value)} rows={2} maxLength={500} placeholder="Explain why this manager is being replaced (at least 5 characters)" className={inputClass} /><p className="mt-1 text-xs text-slate-500">This reason will be included in the replacement history.</p></div> : <div><label htmlFor="replacement-email-code" className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700"><FiMail /> Email Verification Code</label><input id="replacement-email-code" value={code} inputMode="numeric" maxLength={6} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="Enter the 6-digit code" /><p className="mt-1 text-xs text-slate-600">Confirm the Network Head change with the code sent to your email.</p></div>}
        </main>
        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={requiresEmail && step === 'choose' ? requestCode : confirm} disabled={!canContinue || (requiresEmail && step === 'verify' && (!verificationId || !/^\d{6}$/.test(code)))} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><FiShield />{busy ? 'Saving…' : requiresEmail && step === 'choose' ? 'Send Verification Code' : plan?.mergeRequired ? 'Confirm Replacement & Merge' : 'Confirm Replacement'}</button>
        </footer>
      </section>
    </div>, document.body
  )
}

export default ReplaceManagerModal

