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
    released: 'bg-violet-50 text-violet-700 ring-violet-100',
  }

  return tones[action] || 'bg-slate-100 text-slate-700 ring-slate-200'
}

const categoryLabels = {
  buyer_payment: 'Buyer Payment',
  seller_commission: 'Seller Commission',
  company_profit: 'Network Company Profit',
}

const PaymentLogs = () => {
  const { projectSlug } = useParams()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    return new URLSearchParams({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
      ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    }).toString()
  }, [search, actionFilter, categoryFilter, dateFrom, dateTo])

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['lot-payment-logs', projectSlug, queryString],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/payment-logs${queryString ? `?${queryString}` : ''}`),
    enabled: Boolean(projectSlug),
    keepPreviousData: true,
  })

  const logs = data?.data || []
  const stats = data?.stats || {}
  const project = data?.project || {}
  const unavailableCategories = data?.unavailableCategories || []
  const canViewCommissionReleases = data?.canViewCommissionReleases !== false
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = logs.length ? (currentPage - 1) * pageSize : 0
  const endIndex = Math.min(startIndex + pageSize, logs.length)
  const paginatedLogs = logs.slice(startIndex, endIndex)

  const resetFilters = () => {
    setSearch('')
    setActionFilter('all')
    setCategoryFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setAlert({ type: 'info', message: 'Audit log filters reset.' })
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
      {!isError && unavailableCategories.length ? <StatusAlert type="warning" message={`Some release history is unavailable: ${unavailableCategories.join(', ')}. Check that the required database migrations were applied.`} /> : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title={`${project.name || 'Lot Project'} Payments Audit / Logs`}
          description="Buyer payment activity and outgoing seller / Network Company Profit releases, recorded from their existing financial ledgers."
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-500">Total Audit Entries</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{isLoading ? '...' : stats.total || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-green-50 p-5 text-green-700 shadow-sm">
          <p className="text-sm font-black text-green-800">Created Logs</p>
          <p className="mt-3 text-2xl font-black">{isLoading ? '...' : Number(stats.created || 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-blue-50 p-5 text-blue-700 shadow-sm">
          <p className="text-sm font-black text-blue-500">Updated Logs</p>
          <p className="mt-3 text-2xl font-black">{isLoading ? '...' : Number(stats.updated || 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-red-50 p-5 text-red-700 shadow-sm">
          <p className="text-sm font-black text-red-500">Deleted Logs</p>
          <p className="mt-3 text-2xl font-black">{isLoading ? '...' : Number(stats.deleted || 0)}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-800 shadow-sm">
          <p className="text-sm font-black">Seller Releases</p>
          <p className="mt-3 text-2xl font-black">{isLoading ? '...' : Number(stats.sellerReleases || 0)}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-800 shadow-sm">
          <p className="text-sm font-black">Company Profit Releases</p>
          <p className="mt-3 text-2xl font-black">{isLoading ? '...' : Number(stats.companyProfitReleases || 0)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_160px_150px_150px_170px_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search unit, buyer, payee, Network, reference, encoded by..."
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
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value)
              setPage(1)
            }}
            aria-label="Filter audit records by category"
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Categories</option>
            <option value="buyer_payment">Buyer Payments</option>
            {canViewCommissionReleases ? <option value="seller_commission">Seller Releases</option> : null}
            {canViewCommissionReleases ? <option value="company_profit">Company Profit Releases</option> : null}
          </select>

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
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            {canViewCommissionReleases ? <option value="released">Released</option> : null}
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
          <h2 className="text-lg font-black text-slate-950">Payment & Commission Release History</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Showing {logs.length ? `${startIndex + 1}-${endIndex}` : '0'} of {logs.length} record(s) (latest 300 matching events).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Action Date', 'Category', 'Project', 'Account', 'Account Status', 'Unit', 'Buyer', 'Payee', 'Amount / Direction', 'Type / Stage', 'Method', 'Reference ID', 'Action', 'Encoded By', 'Description'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading payment logs...</td>
                </tr>
              ) : null}

              {!isLoading && paginatedLogs.map((log) => (
                <tr key={log.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.actionAtText}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ring-1 ${log.category === 'company_profit' ? 'bg-indigo-50 text-indigo-700 ring-indigo-100' : log.category === 'seller_commission' ? 'bg-violet-50 text-violet-700 ring-violet-100' : 'bg-sky-50 text-sky-700 ring-sky-100'}`}>
                      {categoryLabels[log.category] || 'Buyer Payment'}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.project}</td>
                  <td className="px-4 py-4 font-mono font-black text-slate-900">{log.accountReference}</td>
                  <td className="px-4 py-4 font-semibold capitalize text-slate-700">{String(log.accountStatus || '-').replaceAll('_', ' ')}</td>
                  <td className="px-4 py-4 font-black text-blue-700">{log.unit}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{log.buyer}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.payee || '-'}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{money(log.amount)}</p>
                    <p className={`mt-1 text-[10px] font-black uppercase tracking-wide ${log.direction === 'outgoing' ? 'text-violet-700' : log.direction === 'incoming' ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {log.direction === 'outgoing' ? 'Outgoing payout' : 'Buyer payment activity'}
                    </p>
                  </td>
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
                  <td colSpan={15} className="px-4 py-12 text-center">
                    <FiActivity className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">No audit records found</p>
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



