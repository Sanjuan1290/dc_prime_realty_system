import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiActivity, FiRefreshCw, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

const pageSizeOptions = [10, 25, 50]

const actionTone = (action = '') => {
  const tones = {
    created: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    updated: 'bg-blue-50 text-blue-700 ring-blue-100',
    deleted: 'bg-red-50 text-red-700 ring-red-100',
  }

  return tones[action] || 'bg-slate-100 text-slate-700 ring-slate-200'
}

const PaymentLogs = () => {
  const { projectSlug } = useParams()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    return new URLSearchParams({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }).toString()
  }, [search, actionFilter, dateFrom, dateTo])

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['lot-payment-logs', projectSlug, queryString],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/payment-logs${queryString ? `?${queryString}` : ''}`),
    enabled: Boolean(projectSlug),
    keepPreviousData: true,
  })

  const logs = data?.data || []
  const stats = data?.stats || {}
  const project = data?.project || {}
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = logs.length ? (currentPage - 1) * pageSize : 0
  const endIndex = Math.min(startIndex + pageSize, logs.length)
  const paginatedLogs = logs.slice(startIndex, endIndex)

  const resetFilters = () => {
    setSearch('')
    setActionFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setAlert({ type: 'info', message: 'Payment log filters reset.' })
  }

  const refreshLogs = () => {
    setAlert({ type: 'info', message: 'Refreshing payment logs...' })
    refetch()
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading payment audit logs..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing payment audit logs..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load payment logs.'} /> : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title={`${project.name || 'Lot Project'} Payments Audit / Logs`}
          description="Database-connected payment action history for created, updated, and deleted payment records."
          icon={FiActivity}
        />

        <button
          type="button"
          onClick={refreshLogs}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-500">Total Log Entries</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{isLoading ? '...' : stats.total || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-blue-50 p-5 text-blue-700 shadow-sm">
          <p className="text-sm font-black text-slate-500">Logged Payment Amount</p>
          <p className="mt-3 text-2xl font-black">{isLoading ? '...' : money(stats.amount || 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-amber-50 p-5 text-amber-700 shadow-sm">
          <p className="text-sm font-black text-slate-500">Deleted Logs</p>
          <p className="mt-3 text-2xl font-black">{isLoading ? '...' : Number(stats.deleted || 0)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_170px_170px_220px_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search unit, buyer, reference, encoded by..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <label className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wide text-slate-400">
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
              }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-16 pr-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              aria-label="Filter payment logs from date"
            />
          </label>

          <label className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wide text-slate-400">
              To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              aria-label="Filter payment logs to date"
            />
          </label>

          <select
            value={actionFilter}
            onChange={(event) => {
              setActionFilter(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-lg font-black text-slate-950">Payment Logs</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Showing {logs.length ? `${startIndex + 1}-${endIndex}` : '0'} of {logs.length} database record(s).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Action Date', 'Project', 'Unit', 'Buyer', 'Amount', 'Type', 'Method', 'Reference ID', 'Action', 'Encoded By', 'Description'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading payment logs...</td>
                </tr>
              ) : null}

              {!isLoading && paginatedLogs.map((log) => (
                <tr key={log.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.actionAtText}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.project}</td>
                  <td className="px-4 py-4 font-black text-blue-700">{log.unit}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{log.buyer}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{money(log.amount)}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.paymentType}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.paymentMethod}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.referenceId}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${actionTone(log.action)}`}>{log.actionLabel}</span></td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.encodedBy}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{log.actionDescription}</td>
                </tr>
              ))}

              {!isLoading && !logs.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <FiActivity className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">No payment logs found</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Try changing your search or filters.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing {logs.length ? `${startIndex + 1}-${endIndex}` : '0'} of {logs.length} records
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none"
            >
              {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={currentPage <= 1}
              className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default PaymentLogs
