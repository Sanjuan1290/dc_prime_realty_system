import { FiFilter, FiRefreshCw, FiSearch } from 'react-icons/fi'

const actionOptions = [
  { label: 'All Actions', value: 'all' },
  { label: 'Create', value: 'create' },
  { label: 'Update', value: 'update' },
  { label: 'Delete', value: 'delete' },
  { label: 'Send', value: 'send' },
  { label: 'Approve', value: 'approve' },
  { label: 'Release', value: 'release' },
  { label: 'System', value: 'system' },
]

const AuditLogFilters = ({
  search,
  setSearch,
  action,
  setAction,
  module,
  setModule,
  modules = [],
  from,
  setFrom,
  to,
  setTo,
  onReset,
  onRefresh,
  isFetching,
}) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_150px_150px_auto_auto]">
        <label className="relative">
          <FiSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, module, user, entity, or description..."
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          />
        </label>

        <label className="relative">
          <FiFilter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <select
          value={module}
          onChange={(event) => setModule(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
        >
          <option value="all">All Modules</option>
          {modules.map((item) => (
            <option key={item.module} value={item.module}>{item.module}</option>
          ))}
        </select>

        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-label="From date"
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
        />

        <input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          aria-label="To date"
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
        />

        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </section>
  )
}

export default AuditLogFilters
