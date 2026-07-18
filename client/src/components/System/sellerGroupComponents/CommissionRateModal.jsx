import { useEffect, useRef, useState } from 'react'
import { FiLoader, FiPercent, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'

const titles = {
  pool: 'Edit Project Commission Pool',
  direct: 'Edit Agent Direct Rate',
  override: 'Edit Hierarchy Override',
}

const labels = {
  pool: 'Group Commission Pool',
  direct: 'Direct Commission Rate',
  override: 'Override Rate',
}

/**
 * One rate modal is used for pool, direct, and override changes so validation,
 * labels, pending states, and error display remain consistent.
 */
const CommissionRateModal = ({
  open,
  kind,
  projectName,
  sellerName,
  parentName,
  childName,
  initialRate = 0,
  isPending = false,
  notice = null,
  onSubmit,
  onClose,
}) => {
  const [rate, setRate] = useState('')
  const [localError, setLocalError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setRate(String(initialRate ?? ''))
    setLocalError('')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, initialRate, kind])

  if (!open) return null

  const submit = (event) => {
    event.preventDefault()
    const numericRate = Number(rate)
    const minimum = kind === 'pool' ? 6 : 0
    if (!Number.isFinite(numericRate) || numericRate < minimum || numericRate > 15) {
      setLocalError(`${labels[kind]} must be between ${minimum}% and 15%.`)
      return
    }
    setLocalError('')
    onSubmit?.({ rate: numericRate, status: 'active' })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form
        onSubmit={submit}
        aria-busy={isPending}
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FiPercent className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">{titles[kind]}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{projectName || 'Selected project'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50" aria-label="Close rate modal"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-4">
            {notice ? <StatusAlert type={notice.type} title={notice.title} message={notice.message} /> : null}
            {localError ? <StatusAlert type="error" message={localError} onClose={() => setLocalError('')} /> : null}

            {kind === 'direct' ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Sales Agent</p>
                <p className="mt-1 font-black text-slate-950">{sellerName}</p>
              </div>
            ) : null}

            {kind === 'override' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Parent Seller</p><p className="mt-1 font-black text-slate-950">{parentName}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Child Seller</p><p className="mt-1 font-black text-slate-950">{childName}</p></div>
              </div>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">{labels[kind]} <span className="text-red-500">*</span></span>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="number"
                  min={kind === 'pool' ? 6 : 0}
                  max="15"
                  step="0.01"
                  value={rate}
                  onChange={(event) => { setRate(event.target.value); setLocalError('') }}
                  placeholder={kind === 'override' ? 'Enter override rate' : kind === 'direct' ? 'Enter direct commission rate' : 'Enter group commission pool'}
                  disabled={isPending}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm font-black text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">%</span>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                {kind === 'pool'
                  ? 'The pool must cover every direct rate and parent override in this group.'
                  : kind === 'override'
                    ? 'The parent receives this rate when the selected child is in the sale hierarchy.'
                    : 'Only agents can receive a direct commission rate.'}
              </p>
            </label>

          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isPending ? <FiLoader className="animate-spin" /> : null}
            {isPending ? 'Saving...' : 'Save Rate'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default CommissionRateModal
