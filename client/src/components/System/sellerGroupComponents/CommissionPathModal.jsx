import { useMemo, useState } from 'react'
import { FiGitBranch, FiLoader, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'

const roleLabel = (role = '') => ({
  broker_network_manager: 'Broker Network Manager',
  broker: 'Broker',
  manager: 'Manager',
  agent: 'Agent',
}[role] || String(role || 'Seller').replaceAll('_', ' '))

const normalizeRate = (value) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const RateRow = ({ label, helper, value, status, onRateChange, onStatusChange, disabled }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-black text-slate-800">{label}</span>
        <div className="relative">
          <input
            type="number"
            min="0"
            max="15"
            step="0.01"
            value={value}
            onChange={(event) => onRateChange(event.target.value)}
            disabled={disabled}
            placeholder="0.00"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 pr-10 text-sm font-black outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">%</span>
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
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

const CommissionPathModal = ({
  path,
  project,
  poolRate = 0,
  isPending = false,
  notice = null,
  onSubmit,
  onClose,
}) => {
  const initialRows = useMemo(() => (path?.chain || []).map((row, index) => ({
    key: row.type === 'direct'
      ? `direct-${row.sellerId}`
      : `${row.childSellerId}-${row.sellerId}`,
    type: row.type,
    sellerId: Number(row.sellerId),
    sellerName: row.sellerName,
    role: row.role,
    childSellerId: row.childSellerId ? Number(row.childSellerId) : null,
    childSellerName: row.childSellerName || (index > 0 ? path.chain[index - 1]?.sellerName : ''),
    rate: String(Number(row.rate || 0)),
    status: row.status || (Number(row.rate || 0) > 0 ? 'active' : 'inactive'),
  })), [path])

  const [rows, setRows] = useState(initialRows)
  const [localError, setLocalError] = useState('')

  if (!path) return null

  const activeTotal = rows.reduce((sum, row) => (
    row.status === 'active' ? sum + normalizeRate(row.rate) : sum
  ), 0)
  const normalizedPool = Number(poolRate || path.poolRate || 0)
  const remaining = Math.max(normalizedPool - activeTotal, 0)
  const over = Math.max(activeTotal - normalizedPool, 0)
  const isComplete = normalizedPool > 0 && Math.abs(activeTotal - normalizedPool) <= 0.0001

  const updateRow = (key, changes) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...changes } : row))
    setLocalError('')
  }

  const submit = (event) => {
    event.preventDefault()
    for (const row of rows) {
      const rate = normalizeRate(row.rate)
      if (rate < 0 || rate > 15) {
        setLocalError(`${row.sellerName}'s rate must be between 0% and 15%.`)
        return
      }
      if (row.status === 'active' && rate <= 0) {
        setLocalError(`An active rate for ${row.sellerName} must be greater than 0%.`)
        return
      }
    }
    if (over > 0.0001) {
      setLocalError(`The path exceeds the ${normalizedPool.toFixed(2)}% pool by ${over.toFixed(2)}%.`)
      return
    }

    const direct = rows.find((row) => row.type === 'direct')
    onSubmit?.({
      directRate: normalizeRate(direct?.rate),
      directStatus: direct?.status || 'inactive',
      overrides: rows
        .filter((row) => row.type === 'override')
        .map((row) => ({
          childId: row.childSellerId,
          parentId: row.sellerId,
          overrideRate: normalizeRate(row.rate),
          status: row.status,
        })),
    })
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" aria-busy={isPending}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiGitBranch /></span>
            <div>
              <h2 className="text-lg font-black text-slate-950">Edit Commission Path</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{path.agentName} · {project?.name || 'Selected project'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close commission path editor"><FiX /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          <div className="grid gap-4">
            {notice ? <StatusAlert type={notice.type} title={notice.title} message={notice.message} /> : null}
            {localError ? <StatusAlert type="error" message={localError} onClose={() => setLocalError('')} /> : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Project Pool</p><p className="mt-1 text-xl font-black text-slate-950">{normalizedPool.toFixed(2)}%</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Allocated</p><p className="mt-1 text-xl font-black text-slate-950">{activeTotal.toFixed(2)}%</p></div>
              <div className={`rounded-2xl border p-4 ${over > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}><p className="text-xs font-black uppercase text-slate-500">Remaining</p><p className={`mt-1 text-xl font-black ${over > 0 ? 'text-red-700' : 'text-slate-950'}`}>{over > 0 ? `-${over.toFixed(2)}%` : `${remaining.toFixed(2)}%`}</p></div>
              <div className={`rounded-2xl border p-4 ${isComplete ? 'border-emerald-200 bg-emerald-50' : over > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><p className="text-xs font-black uppercase text-slate-500">Path Status</p><p className={`mt-1 text-lg font-black ${isComplete ? 'text-emerald-700' : over > 0 ? 'text-red-700' : 'text-amber-700'}`}>{isComplete ? 'Complete' : over > 0 ? 'Over Allocated' : 'Incomplete'}</p></div>
            </div>

            <StatusAlert
              type={isComplete ? 'success' : over > 0 ? 'error' : 'warning'}
              message={isComplete
                ? 'This path exactly matches the project pool and can be used for new reservations.'
                : over > 0
                  ? 'Lower one or more rates before saving.'
                  : 'You may save this path, but the agent cannot be used for a reservation until the full pool is allocated.'}
            />

            {rows.map((row) => (
              <RateRow
                key={row.key}
                label={row.type === 'direct'
                  ? `${row.sellerName} · Sales Commission`
                  : `${row.sellerName} · Override from ${row.childSellerName}`}
                helper={row.type === 'direct'
                  ? `${roleLabel(row.role)} receives this rate when assigned as the selling agent.`
                  : `This rate only applies to the ${row.childSellerName} → ${row.sellerName} relationship.`}
                value={row.rate}
                status={row.status}
                onRateChange={(rate) => updateRow(row.key, { rate })}
                onStatusChange={(status) => updateRow(row.key, { status })}
                disabled={isPending}
              />
            ))}
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isPending || over > 0.0001} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isPending ? <FiLoader className="animate-spin" /> : <FiSave />}
            {isPending ? 'Saving Path...' : 'Save Commission Path'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default CommissionPathModal
