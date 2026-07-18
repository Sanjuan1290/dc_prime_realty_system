import { useEffect, useRef, useState } from 'react'
import { FiEdit2, FiLoader, FiPercent, FiUserPlus, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'

const roleLabel = (role = '') => ({
  broker_network_manager: 'Broker Network Manager',
  broker: 'Broker',
  manager: 'Manager',
  agent: 'Agent',
}[role] || String(role || 'Seller').replaceAll('_', ' '))

const RateInput = ({ label, value, onChange, status, onStatusChange, disabled, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-black text-slate-700">{label} <span className="text-red-500">*</span></span>
        <div className="relative">
          <input
            type="number"
            min="0"
            max="15"
            step="0.01"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
            disabled={disabled}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm font-black outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">%</span>
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-black text-slate-700">Rate Status</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          disabled={disabled}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
    </div>
    <p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p>
  </div>
)

/**
 * One editor handles every rate connected to one member for the selected
 * project. The parent remounts this component when the member changes, so the
 * initial values always come from the latest API response without an effect
 * that overwrites user input while the form is open.
 */
const MemberRatesModal = ({
  member,
  parent,
  directSeller,
  savedOverride,
  project,
  isGroupHead = false,
  isPending = false,
  notice = null,
  onSubmit,
  onCreateDirectSalesAgent,
  onClose,
}) => {
  const memberDirectSeller = member?.role === 'agent' ? member : directSeller
  const [directRate, setDirectRate] = useState(() => String(memberDirectSeller?.direct_rate ?? 0))
  const [directStatus, setDirectStatus] = useState(() => memberDirectSeller?.direct_rate_status || 'inactive')
  const [overrideRate, setOverrideRate] = useState(() => String(savedOverride?.override_rate ?? 0))
  const [overrideStatus, setOverrideStatus] = useState(() => savedOverride?.override_rate_status || 'inactive')
  const [localError, setLocalError] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [])

  if (!member) return null

  const submit = (event) => {
    event.preventDefault()
    const payload = {}

    if (memberDirectSeller) {
      const numericDirect = Number(directRate)
      if (!Number.isFinite(numericDirect) || numericDirect < 0 || numericDirect > 15) {
        setLocalError('Direct commission rate must be between 0% and 15%.')
        return
      }
      if (directStatus === 'active' && numericDirect <= 0) {
        setLocalError('An active direct commission rate must be greater than 0%.')
        return
      }
      payload.directRate = numericDirect
      payload.directStatus = directStatus
    }

    if (!isGroupHead) {
      const numericOverride = Number(overrideRate)
      if (!Number.isFinite(numericOverride) || numericOverride < 0 || numericOverride > 15) {
        setLocalError('Parent override rate must be between 0% and 15%.')
        return
      }
      if (overrideStatus === 'active' && numericOverride <= 0) {
        setLocalError('An active parent override rate must be greater than 0%.')
        return
      }
      payload.overrideRate = numericOverride
      payload.overrideStatus = overrideStatus
    }

    setLocalError('')
    onSubmit?.(payload)
  }

  const memberName = member.display_name || member.full_name

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} aria-busy={isPending} className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiPercent /></span>
            <div>
              <h2 className="text-lg font-black text-slate-950">Edit Rates</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{memberName} · {project?.name || 'Selected project'}</p>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close rate editor"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-4">
            {notice ? <StatusAlert type={notice.type} title={notice.title} message={notice.message} /> : null}
            {localError ? <StatusAlert type="error" message={localError} onClose={() => setLocalError('')} /> : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Seller</p>
              <p className="mt-1 font-black text-slate-950">{memberName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{roleLabel(member.role)}</p>
            </div>

            {memberDirectSeller ? (
              <RateInput
                label={member.role === 'agent' ? 'Direct Commission Rate' : 'Direct-Sales Agent Rate'}
                value={directRate}
                onChange={(value) => { setDirectRate(value); setLocalError('') }}
                status={directStatus}
                onStatusChange={(value) => { setDirectStatus(value); setLocalError('') }}
                disabled={isPending}
                helper={member.role === 'agent'
                  ? 'This is the commission paid directly to the assigned sales agent.'
                  : `This rate belongs to ${memberName}’s non-login system agent for this project.`}
              />
            ) : member.role !== 'agent' ? (
              <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-blue-950">No direct-sales agent for this seller</p>
                    <p className="mt-1 text-xs font-semibold text-blue-800">Create a non-login system agent only when this manager, broker, or BNM makes direct sales.</p>
                  </div>
                  <button type="button" onClick={onCreateDirectSalesAgent} disabled={isPending} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300"><FiUserPlus />Create Sales Agent</button>
                </div>
              </div>
            ) : null}

            {!isGroupHead ? (
              <RateInput
                label="Parent Override Rate"
                value={overrideRate}
                onChange={(value) => { setOverrideRate(value); setLocalError('') }}
                status={overrideStatus}
                onStatusChange={(value) => { setOverrideStatus(value); setLocalError('') }}
                disabled={isPending}
                helper={`Paid to ${parent?.display_name || parent?.full_name || 'the direct parent'} when this member is part of the sales hierarchy.`}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">The group head reports to the developer, so no parent override is configured on this row.</div>
            )}
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isPending || (!memberDirectSeller && isGroupHead)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300">
            {isPending ? <FiLoader className="animate-spin" /> : <FiEdit2 />}
            {isPending ? 'Saving...' : 'Save Rates'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default MemberRatesModal
