import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDollarSign, FiEye, FiRefreshCw, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReleaseDetailsModal from '../../components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal'
import { useFetch, useFetchPatch } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const pageSizeOptions = [10, 25, 50]

const StatCard = ({ label, value, tone = 'slate', isMoney = true }) => {
  const styles = {
    slate: 'bg-white text-slate-950',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${styles[tone]}`}>
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black">{isMoney ? money(value) : value}</p>
    </div>
  )
}

const getEligibleReleaseAmount = (record = {}) => {
  const milestones = Array.isArray(record.releaseMilestones) ? record.releaseMilestones : []
  return milestones
    .filter((stage) => String(stage.status || '').toLowerCase() === 'eligible')
    .reduce((sum, stage) => sum + Number(stage.netAmount ?? stage.net_release_amount ?? stage.grossAmount ?? 0), 0)
}

const completedMilestoneNames = [
  '1st release',
  '2nd release',
  '3rd release',
  '4th release',
  'retention',
]

const isCommissionCompleted = (record = {}) => {
  const milestones = Array.isArray(record.releaseMilestones) ? record.releaseMilestones : []
  const releasedMilestones = milestones.filter(
    (stage) => String(stage.status || '').trim().toLowerCase() === 'released'
  )
  const releasedStageNames = new Set(
    releasedMilestones.map((stage) => String(stage.stage || '').trim().toLowerCase())
  )

  if (completedMilestoneNames.every((stageName) => releasedStageNames.has(stageName))) {
    return true
  }

  const releasedPercent = releasedMilestones.reduce(
    (sum, stage) => sum + Number(stage.releasePercent ?? stage.release_percent ?? 0),
    0
  )

  if (milestones.length >= completedMilestoneNames.length && releasedPercent >= 99.999) {
    return milestones.every(
      (stage) => String(stage.status || '').trim().toLowerCase() === 'released'
    )
  }

  const status = String(record.statusLabel || record.status || '').trim().toLowerCase()
  return status === 'released' || status === 'completed'
}

const getEligibilityKey = (record = {}) => {
  if (isCommissionCompleted(record)) return 'completed'
  if (getEligibleReleaseAmount(record) > 0) return 'eligible'

  const status = String(record.statusLabel || record.status || '').toLowerCase()
  if (status === 'eligible') return 'eligible'
  if (status === 'cancelled') return 'other'

  return 'not_eligible'
}

const Commission = () => {
  const { projectSlug } = useParams()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [saleTypeFilter, setSaleTypeFilter] = useState('all')
  const [eligibilityFilter, setEligibilityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [alert, setAlert] = useState(null)
  const [modalNotice, setModalNotice] = useState(null)

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
      const notice = { type: 'loading', title: 'Saving', message: actionLabel }
      if (selected) setModalNotice(notice)
      else setAlert(notice)
    },
    onSuccess: (result) => {
      const notice = { type: 'success', title: 'Commission updated', message: result?.message || 'Commission updated successfully.' }
      if (selected) setModalNotice(notice)
      else setAlert(notice)
      queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
      setSelected((current) => current ? { ...current, ...(result?.data || {}) } : current)
    },
    onError: (mutationError) => {
      const notice = { type: 'error', title: 'Commission error', message: mutationError?.message || 'Failed to update commission.' }
      if (selected) setModalNotice(notice)
      else setAlert(notice)
    },
  })

  const records = data?.data || []
  const project = data?.project || {}
  const filteredRecords = useMemo(() => {
    if (eligibilityFilter === 'all') return records
    return records.filter((record) => getEligibilityKey(record) === eligibilityFilter)
  }, [records, eligibilityFilter])

  const displayStats = useMemo(
    () => filteredRecords.reduce(
      (summary, item) => {
        summary.total += 1
        summary.gross += Number(item.grossCommission || 0)
        summary.released += Number(item.released || 0)
        summary.eligible += Number(item.eligibleToRelease ?? getEligibleReleaseAmount(item))
        summary.remaining += Number(item.netRemaining || 0)
        return summary
      },
      { total: 0, gross: 0, released: 0, eligible: 0, remaining: 0 }
    ),
    [filteredRecords]
  )

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = filteredRecords.length ? (currentPage - 1) * pageSize : 0
  const endIndex = Math.min(startIndex + pageSize, filteredRecords.length)
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex)

  const resetFilters = () => {
    setSearch('')
    setSaleTypeFilter('all')
    setEligibilityFilter('all')
    setPage(1)
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Commission Records" value={isLoading ? '...' : displayStats.total || 0} isMoney={false} />
        <StatCard label="Gross Commission" value={displayStats.gross || 0} tone="blue" />
        <StatCard label="Eligible to Release" value={displayStats.eligible || 0} tone="indigo" />
        <StatCard label="Released" value={displayStats.released || 0} tone="emerald" />
        <StatCard label="Net Remaining" value={displayStats.remaining || 0} tone="amber" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search client, unit, seller, role..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <select
            value={saleTypeFilter}
            onChange={(event) => {
              setSaleTypeFilter(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Sale Types</option>
            <option value="Distributed">Distributed</option>
            <option value="Direct">Direct</option>
          </select>

          <select
            value={eligibilityFilter}
            onChange={(event) => {
              setEligibilityFilter(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Eligibility</option>
            <option value="eligible">Eligible</option>
            <option value="completed">Completed</option>
            <option value="not_eligible">Not Eligible</option>
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

              {!isLoading && paginatedRecords.map((record) => (
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
                    <button type="button" onClick={() => { setSelected(record); setModalNotice(null) }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]">
                      <FiEye className="h-3.5 w-3.5" />
                      Details
                    </button>
                  </td>
                </tr>
              ))}

              {!isLoading && !filteredRecords.length ? (
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
          <p className="text-sm font-semibold text-slate-600">
            Showing {filteredRecords.length ? `${startIndex + 1}-${endIndex}` : '0'} of {filteredRecords.length} records
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

      {selected ? (
        <ReleaseDetailsModal
          commission={selected}
          isSaving={updateCommissionMutation.isPending}
          onClose={() => {
            setSelected(null)
            setModalNotice(null)
          }}
          onAction={handleCommissionAction}
          serverNotice={modalNotice}
          onClearServerNotice={() => setModalNotice(null)}
        />
      ) : null}
    </main>
  )
}

export default Commission
