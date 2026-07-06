import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDollarSign, FiEye, FiRefreshCw, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReleaseDetailsModal from '../../components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal'
import { useFetch, useFetchPatch } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const StatCard = ({ label, value, tone = 'slate', isMoney = true }) => {
  const styles = {
    slate: 'bg-white text-slate-950',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${styles[tone]}`}>
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black">{isMoney ? money(value) : value}</p>
    </div>
  )
}

const Commission = () => {
  const { projectSlug } = useParams()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [saleTypeFilter, setSaleTypeFilter] = useState('all')
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    return new URLSearchParams({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(saleTypeFilter !== 'all' ? { saleType: saleTypeFilter.toLowerCase() } : {}),
    }).toString()
  }, [search, saleTypeFilter])

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['lot-commissions', projectSlug, queryString],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/commissions${queryString ? `?${queryString}` : ''}`),
    enabled: Boolean(projectSlug),
    keepPreviousData: true,
  })

  const updateCommissionMutation = useMutation({
    mutationFn: ({ commissionId, payload }) => useFetchPatch(`/projects/lot-projects/${projectSlug}/commissions/${commissionId}`, payload),
    onMutate: ({ payload }) => {
      const actionLabel = String(payload?.action || '').includes('release') ? 'Saving commission release...' : 'Updating commission status...'
      setAlert({ type: 'loading', message: actionLabel })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Commission updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
      setSelected((current) => current ? { ...current, ...(result?.data || {}) } : current)
    },
    onError: (mutationError) => {
      setAlert({ type: 'error', message: mutationError?.message || 'Failed to update commission.' })
    },
  })

  const records = data?.data || []
  const stats = data?.stats || {}
  const project = data?.project || {}

  const resetFilters = () => {
    setSearch('')
    setSaleTypeFilter('all')
    setAlert({ type: 'info', message: 'Commission filters reset.' })
  }

  const refreshRecords = () => {
    setAlert({ type: 'info', message: 'Refreshing commission records...' })
    refetch()
  }

  const handleCommissionAction = (commission, payload) => {
    updateCommissionMutation.mutate({ commissionId: commission.id || commission.commissionId, payload })
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading commission records..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing commission records..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load commissions.'} /> : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title={`${project.name || 'Lot Project'} Commissions`} description="Database-connected commission records generated per unit and seller hierarchy." icon={FiDollarSign} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={refreshRecords} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]">
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]">
            <FiRefreshCw className="h-4 w-4" />
            Reset View
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Commission Records" value={isLoading ? '...' : stats.total || 0} isMoney={false} />
        <StatCard label="Gross Commission" value={stats.gross || 0} tone="blue" />
        <StatCard label="Released" value={stats.released || 0} tone="emerald" />
        <StatCard label="Net Remaining" value={stats.remaining || 0} tone="amber" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, unit, seller, role..." className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>


          <select value={saleTypeFilter} onChange={(event) => setSaleTypeFilter(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
            <option value="all">All Sale Types</option>
            <option value="Distributed">Distributed</option>
            <option value="Direct">Direct</option>
          </select>

          <button type="button" onClick={resetFilters} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Reset Filters</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-lg font-black text-slate-950">Commission Records</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">One unit can appear multiple times because every qualified seller receives a separate commission line.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1420px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Unit', 'Client', 'Main Seller', 'Commission Seller', 'Role', 'Level', 'Sale Type', 'Commission Base', 'Rate', 'Gross', 'Released', 'Net Remaining', 'Payment %', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isLoading ? <tr><td colSpan={14} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading commissions...</td></tr> : null}

              {!isLoading && records.map((record) => (
                <tr key={record.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-blue-700">{record.unit}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{record.client}</td>
                  <td className="px-4 py-4 font-black text-slate-800">{record.mainSeller || '-'}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{record.seller}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{record.role}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{record.hierarchyLevel}</span></td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{record.saleType}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{money(record.commissionBase)}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{record.rate}%</td>
                  <td className="px-4 py-4 font-black text-slate-950">{money(record.grossCommission)}</td>
                  <td className="px-4 py-4 font-semibold text-emerald-700">{money(record.released)}</td>
                  <td className="px-4 py-4 font-black text-blue-700">{money(record.netRemaining)}</td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{Number(record.paymentPercent || 0).toFixed(2)}%</td>
                  <td className="px-4 py-4">
                    <button type="button" onClick={() => { setSelected(record); setAlert({ type: 'info', message: `Opening commission details for ${record.seller} - ${record.unit}.` }) }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]">
                      <FiEye className="h-3.5 w-3.5" />
                      Details
                    </button>
                  </td>
                </tr>
              ))}

              {!isLoading && !records.length ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center">
                    <FiDollarSign className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">No commission records found</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Try changing your search or filters.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">Showing {records.length ? `1-${records.length}` : '0'} of {records.length} records</p>
        </div>
      </section>

      {selected ? (
        <ReleaseDetailsModal
          commission={selected}
          isSaving={updateCommissionMutation.isPending}
          onClose={() => setSelected(null)}
          onAction={handleCommissionAction}
        />
      ) : null}
    </main>
  )
}

export default Commission


