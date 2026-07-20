import { useEffect, useRef, useState } from 'react'
import { FiEdit2, FiLoader, FiPercent, FiX } from 'react-icons/fi'
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

const MemberRatesModal = ({
  member,
  project,
  isPending = false,
  notice = null,
  onSubmit,
  onClose,
}) => {
  const isAgent = member?.role === 'agent'
  const initialRate = isAgent
    ? (member?.direct_rate ?? member?.project_rate ?? 0)
    : (member?.project_rate ?? 0)
  const initialStatus = isAgent
    ? (member?.direct_rate_status || member?.project_rate_status || 'inactive')
    : (member?.project_rate_status || 'inactive')

  const [rate, setRate] = useState(() => String(initialRate))
  const [rateStatus, setRateStatus] = useState(() => initialStatus)
  const [localError, setLocalError] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [])

  if (!member) return null

  const rateLabel = isAgent ? 'Sales Commission Rate' : 'Override Commission Rate'
  const helper = isAgent
    ? 'Paid directly to this agent when they are assigned to a reservation.'
    : `Paid to ${member.display_name || member.full_name || 'this seller'} when they appear above another seller in the commission hierarchy.`

  const submit = (event) => {
    event.preventDefault()
    const numericRate = Number(rate)

    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 15) {
      setLocalError(`${rateLabel} must be between 0% and 15%.`)
      return
    }
    if (rateStatus === 'active' && numericRate <= 0) {
      setLocalError(`An active ${rateLabel.toLowerCase()} must be greater than 0%.`)
      return
    }

    setLocalError('')
    onSubmit?.({ rate: numericRate, rateStatus })
  }

  const memberName = member.display_name || member.full_name

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} aria-busy={isPending} className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiPercent /></span>
            <div>
              <h2 className="text-lg font-black text-slate-950">Edit Rate</h2>
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

            <RateInput
              label={rateLabel}
              value={rate}
              onChange={(value) => { setRate(value); setLocalError('') }}
              status={rateStatus}
              onStatusChange={(value) => { setRateStatus(value); setLocalError('') }}
              disabled={isPending}
              helper={helper}
            />
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300">
            {isPending ? <FiLoader className="animate-spin" /> : <FiEdit2 />}
            {isPending ? 'Saving...' : 'Save Rate'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default MemberRatesModal

