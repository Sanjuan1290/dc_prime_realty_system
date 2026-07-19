import { useEffect, useRef, useState } from 'react'
import { FiLoader, FiUserPlus, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'

/**
 * Creates a non-login agent owned by a manager, broker, or BNM. The owner and
 * generated agent name are read-only because the API controls those mappings.
 */
const CreateDirectSalesAgentModal = ({
  owner,
  project,
  isPending = false,
  notice = null,
  onSubmit,
  onClose,
}) => {
  const [directRate, setDirectRate] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [])

  const submit = (event) => {
    event.preventDefault()
    const rate = Number(directRate)
    if (!Number.isFinite(rate) || rate <= 0 || rate > 15) {
      setError('Direct commission rate must be greater than 0% and no higher than 15%.')
      return
    }
    setError('')
    onSubmit?.({ directRate: rate })
  }

  const ownerName = owner?.display_name || owner?.full_name || 'Selected seller'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} aria-busy={isPending} className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiUserPlus /></span>
            <div><h2 className="text-lg font-black text-slate-950">Create Direct-Sales Agent</h2><p className="mt-1 text-sm font-semibold text-slate-500">Creates a system agent without login access.</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-4">
            {notice ? <StatusAlert type={notice.type} title={notice.title} message={notice.message} /> : null}
            {error ? <StatusAlert type="error" message={error} onClose={() => setError('')} /> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Owner</p><p className="mt-1 font-black text-slate-950">{ownerName}</p><p className="mt-1 text-xs font-semibold capitalize text-slate-500">{String(owner?.role || '').replaceAll('_', ' ')}</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Generated Agent Name</p><p className="mt-1 font-black text-slate-950">{ownerName} — Direct Sales Agent</p><p className="mt-1 text-xs font-semibold text-slate-500">No login access</p></div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Project</p><p className="mt-1 font-black text-blue-950">{project?.name || 'Selected project'}</p></div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Project Direct Rate <span className="text-red-500">*</span></span>
              <div className="relative">
                <input ref={inputRef} type="number" min="0.01" max="15" step="0.01" value={directRate} onChange={(event) => { setDirectRate(event.target.value); setError('') }} placeholder="Enter direct commission rate" disabled={isPending} className="h-11 w-full rounded-xl border border-slate-300 px-4 pr-10 text-sm font-black outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">%</span>
              </div>
              <p className="text-xs font-semibold text-slate-500">The system agent will report under {ownerName}. Parent overrides still apply.</p>
            </label>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300">
            {isPending ? <FiLoader className="animate-spin" /> : <FiUserPlus />}
            {isPending ? 'Creating...' : 'Create Direct-Sales Agent'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default CreateDirectSalesAgentModal

