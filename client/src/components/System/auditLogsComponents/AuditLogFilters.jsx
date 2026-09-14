import { FiFilter, FiRefreshCw, FiSearch } from 'react-icons/fi'

const actionOptions = [
  { label: 'All Actions', value: 'all' },
  { label: 'Create', value: 'create' },
  { label: 'Update', value: 'update' },
  { label: 'Delete', value: 'delete' },
  { label: 'Send', value: 'send' },
  { label: 'Approve', value: 'approve' },
  { label: 'Reject / Resubmission', value: 'reject' },
  { label: 'Release', value: 'release' },
  { label: 'Import', value: 'import' },
  { label: 'Export', value: 'export' },
  { label: 'Correction', value: 'correct' },
  { label: 'System', value: 'system' },
]

const dateRangeOptions = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Month', value: 'this_month' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Custom', value: 'custom' },
]

const AuditLogFilters = ({
  search,
  setSearch,
  action,
  setAction,
  module,
  setModule,
  modules = [],
  dateRange,
  setDateRange,
  from,
  setFrom,
  to,
  setTo,
  onReset,
  onRefresh,
  isFetching,
}) => {
  const isCustomRange = dateRange === 'custom'
  const gridColumns = isCustomRange
    ? 'xl:grid-cols-[minmax(260px,1fr)_170px_170px_160px_150px_150px_auto_auto]'
    : 'xl:grid-cols-[minmax(300px,1fr)_180px_180px_180px_auto_auto]'

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`grid items-end gap-3 ${gridColumns}`}>
        <label className="relative">
          <FiSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, module, user, entity, description, or reason..."
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
          aria-label="Audit module"
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
        >
          <option value="all">All Modules</option>
          {modules.map((item) => (
            <option key={item.module} value={item.module}>{item.module}</option>
          ))}
        </select>

        <label className="grid gap-1">
          <span className="px-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Date Range</span>
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            aria-label="Audit date range"
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {isCustomRange ? (
          <label className="grid gap-1">
            <span className="px-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">From Date</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="From date"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>
        ) : null}

        {isCustomRange ? (
          <label className="grid gap-1">
            <span className="px-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">To Date</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              aria-label="To date"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>
        ) : null}

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

