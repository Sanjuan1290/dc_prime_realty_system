import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDollarSign, FiEye, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReviewReturnLink from '../../components/Shared/ReviewReturnLink'
import { dismissReviewRecordQuery } from '../../utils/reviewRecordNavigation'
import ReleaseDetailsModal from '../../components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal'
import { groupCommissionRecords, includeCompanyProfitInCommissionGroups } from '../../utils/commissionRecords'
import { useFetch as fetchJson, useFetchPatch as patchJson } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'
import { hasPermission, PERMISSIONS } from '../../config/permissions'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

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
      <p className="mt-3 text-2xl font-black">{isMoney && value !== '—' ? money(value) : value}</p>
    </div>
  )
}

const getEligibleReleaseAmount = (record = {}) => {
  const milestones = Array.isArray(record.releaseMilestones) ? record.releaseMilestones : []
  return milestones
    .filter((stage) => ['eligible', 'earned on cancellation'].includes(String(stage.status || '').toLowerCase()))
    .reduce((sum, stage) => sum + Number(stage.netAmount ?? stage.net_release_amount ?? stage.grossAmount ?? 0), 0)
}

const completedMilestoneNames = ['1st release', '2nd release', '3rd release', '4th release', 'retention']

const isCommissionCompleted = (record = {}) => {
  const milestones = Array.isArray(record.releaseMilestones) ? record.releaseMilestones : []
  const releasedMilestones = milestones.filter(
    (stage) => String(stage.status || '').trim().toLowerCase() === 'released'
  )
  const releasedStageNames = new Set(
    releasedMilestones.map((stage) => String(stage.stage || '').trim().toLowerCase())
  )

  if (completedMilestoneNames.every((stageName) => releasedStageNames.has(stageName))) return true

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
  if (['eligible', 'earned on cancellation'].includes(status)) return 'eligible'
  if (status === 'cancelled') return 'other'
  return 'not_eligible'
}

const matchesGroupFilters = (group, commissionTypeFilter, eligibilityFilter) => {
  const sellers = Array.isArray(group.sellers) ? group.sellers : []
  const matchesType = commissionTypeFilter === 'all'
    || sellers.some((seller) => String(seller.commissionType || '').toLowerCase() === commissionTypeFilter)
  const matchesEligibility = eligibilityFilter === 'all'
    || sellers.some((seller) => getEligibilityKey(seller) === eligibilityFilter)
    || (eligibilityFilter === 'eligible' && Number(group.companyProfitEligibleToRelease || 0) > 0)

  return matchesType && matchesEligibility
}

const Commission = () => {
  const { projectSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const reviewView = searchParams.get('reviewView') === '1'
  const reviewId = Number(searchParams.get('reviewId') || 0)
  const dismissedReviewId = Number(searchParams.get('reviewReturnId') || 0)
  const reviewCommissionId = Number(searchParams.get('commissionId') || 0)
  const reviewEntityType = searchParams.get('reviewEntityType') || ''
  const { data: currentUserData } = useCurrentUser()
  const user = currentUserData?.user
  const canRelease = hasPermission(user, PERMISSIONS.LOT_COMMISSIONS_RELEASE)
  const canHold = hasPermission(user, PERMISSIONS.LOT_COMMISSIONS_HOLD)
  const canUnhold = hasPermission(user, PERMISSIONS.LOT_COMMISSIONS_UNHOLD)
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [commissionTypeFilter, setCommissionTypeFilter] = useState('all')
  const [eligibilityFilter, setEligibilityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [alert, setAlert] = useState(null)
  const [modalNotice, setModalNotice] = useState(null)

  const queryString = useMemo(() => new URLSearchParams({
    ...(search.trim() ? { search: search.trim() } : {}),
  }).toString(), [search])

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['lot-commissions', projectSlug, queryString],
    queryFn: () => fetchJson(`/projects/lot-projects/${projectSlug}/commissions${queryString ? `?${queryString}` : ''}`),
    enabled: Boolean(projectSlug),
    keepPreviousData: true,
  })

  // Existing protected Company Profit ledger; same query key as Commission Details.
  const {
    data: profitData, isLoading: isProfitLoading, isFetching: isProfitFetching,
    isError: isProfitError, error: profitError, refetch: refetchProfit,
  } = useQuery({
    queryKey: ['network-company-profit', projectSlug],
    queryFn: () => fetchJson(`/projects/lot-projects/${projectSlug}/network-company-profit`),
    enabled: Boolean(projectSlug),
  })

  const updateCommissionMutation = useMutation({
    mutationFn: ({ commissionId, payload }) => {
      const action = String(payload?.action || '')
      const commissionForReview = (selected?.sellers || []).find((seller) => Number(seller.commissionId || seller.id) === Number(commissionId)) || {}
      const releaseForReview = (commissionForReview.releaseMilestones || []).find((stage) => Number(stage.releaseId) === Number(payload?.releaseId)) || {}

      if (['hold_stage', 'unhold_stage', 'set_agent_receipt_status'].includes(action)) {
        return patchJson(
          `/projects/lot-projects/${projectSlug}/commissions/${commissionId}`,
          payload,
          { confirmationHandled: 'compact' }
        )
      }

      const releaseMode = String(payload?.releaseMode || 'live').toLowerCase()
      const releaseDate = releaseMode === 'historical'
        ? payload?.actualReleaseDate || '-'
        : payload?.actualReleaseDate
          || commissionForReview.releaseDateInfo?.todayDateISO
          || releaseForReview.actualReleaseDate
          || releaseForReview.scheduledReleaseDate
          || commissionForReview.releaseDateInfo?.nextReleaseDateISO
          || '-'

      return patchJson(
        `/projects/lot-projects/${projectSlug}/commissions/${commissionId}`,
        payload,
        {
          doubleCheck: {
            type: 'commission-release',
            summary: `${selected?.unit || '-'} · ${commissionForReview.seller || 'Seller'} · ${releaseForReview.stage || 'Selected release'}`,
            data: {
              commissionBeneficiary: {
                project: project?.name || project?.lot_project_name || projectSlug,
                unit: selected?.unit || '-',
                buyer: selected?.client || '-',
                beneficiary: commissionForReview.seller || '-',
                role: commissionForReview.role || '-',
                group: commissionForReview.sellerGroup || '-',
                commissionBase: Number(commissionForReview.commissionBase || 0),
                commissionRate: Number(commissionForReview.rate || 0),
                grossCommission: Number(commissionForReview.grossCommission || 0),
                previouslyReleased: Number(commissionForReview.released || 0),
                remainingBeforeRelease: Number(commissionForReview.netRemaining || 0),
              },
              selectedRelease: {
                releaseStage: releaseForReview.stage || '-',
                triggerPercent: Number(releaseForReview.triggerPercent || 0),
                releasePercent: Number(releaseForReview.releasePercent || 0),
                grossReleaseAmount: Number(releaseForReview.grossAmount || 0),
                deductionAmount: Number(releaseForReview.deductionAmount || 0),
                netReleaseAmount: Number(releaseForReview.netAmount || 0),
                currentStatus: releaseForReview.status || '-',
                releaseMode,
                actualReleaseDate: releaseDate,
                releaseDate,
                historicalNote: releaseMode === 'historical' ? String(payload?.historicalNote || '').trim() : '',
              },
            },
          },
        }
      )
    },
    onMutate: ({ payload }) => {
      const action = String(payload?.action || '')
      const isRelease = action === 'release_stage'
      const isReceiptStatus = action === 'set_agent_receipt_status'
      const notice = isRelease
        ? { type: 'loading', title: 'Final review', message: 'Preparing commission release review...' }
        : isReceiptStatus
          ? { type: 'loading', title: 'Updating receipt status', message: 'Updating External Realty agent receipt status...' }
          : { type: 'loading', title: 'Updating', message: 'Updating commission status...' }
      if (selected) setModalNotice(notice)
      else setAlert(notice)
    },
    onSuccess: (result) => {
      const updatedCommission = result?.data || {}
      const updatedCommissionId = Number(updatedCommission.commissionId || updatedCommission.id || 0)
      const notice = {
        type: 'success',
        title: 'Commission updated',
        message: result?.message || 'Commission updated successfully.',
      }

      if (selected) setModalNotice(notice)
      else setAlert(notice)

      queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['network-company-profit', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-payment-logs', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })

      // Keep the open account modal in sync while the background query reloads.
      setSelected((current) => {
        if (!current || !updatedCommissionId) return current
        const nextSellers = (current.sellers || []).map((seller) => (
          Number(seller.commissionId || seller.id) === updatedCommissionId
            ? { ...seller, ...updatedCommission }
            : seller
        ))
        return includeCompanyProfitInCommissionGroups(groupCommissionRecords(nextSellers), profitData?.data)[0] || current
      })
    },
    onError: (mutationError) => {
      const reviewCancelled = Number(mutationError?.status || 0) === 499
        || String(mutationError?.code || '').toUpperCase() === 'REVIEW_CANCELLED'
        || /review cancelled/i.test(String(mutationError?.message || ''))
      const notice = reviewCancelled
        ? {
            type: 'info',
            title: 'Final review closed',
            message: 'You can continue reviewing the commission. Nothing was released.',
          }
        : {
            type: 'error',
            title: 'Commission error',
            message: mutationError?.message || 'Failed to update commission.',
          }
      if (selected) setModalNotice(notice)
      else setAlert(notice)
    },
  })

  const records = useMemo(() => data?.data || [], [data?.data])
  const project = data?.project || {}
  const groupedRecords = useMemo(
    () => includeCompanyProfitInCommissionGroups(groupCommissionRecords(records), profitData?.data),
    [records, profitData?.data]
  )
  const totalsLoading = isLoading || isProfitLoading
  const totalsError = isError || isProfitError
  // A bulk release updates several commission rows at once. Refresh the open
  // buyer-account details from the canonical query result, not a stale copy.
  useEffect(() => {
    setSelected(current => {
      if (!current) return current
      return groupedRecords.find(group => group.id === current.id) || current
    })
  }, [groupedRecords])
  const reviewedGroup = reviewView && reviewEntityType === 'lot_project_commission' && reviewCommissionId
    ? groupedRecords.find((group) => group.sellers.some((seller) => Number(seller.commissionId || seller.id) === reviewCommissionId)) : null
  useEffect(() => {
    if (reviewView && reviewedGroup) setSelected(reviewedGroup)
  }, [reviewView, reviewedGroup])
  const returnToReview = () => navigate(`/portal/${user?.role || 'super_admin'}/review-center/reviews/${reviewId}`)

  const filteredRecords = useMemo(
    () => (totalsError ? [] : groupedRecords.filter((group) => matchesGroupFilters(group, commissionTypeFilter, eligibilityFilter))),
    [groupedRecords, commissionTypeFilter, eligibilityFilter, totalsError]
  )

  const displayStats = useMemo(
    () => filteredRecords.reduce(
      (summary, item) => {
        summary.total += 1
        summary.gross += Number(item.grossCommission || 0)
        summary.released += Number(item.released || 0)
        summary.eligible += Number(item.eligibleToRelease || 0)
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
    setCommissionTypeFilter('all')
    setEligibilityFilter('all')
    setPage(1)
    setAlert({ type: 'info', message: 'Commission filters reset.' })
  }

  const refreshRecords = () => {
    setAlert({ type: 'info', message: 'Refreshing commission records...' })
    refetch()
    refetchProfit()
  }

  const handleCommissionAction = (commission, payload) => {
    updateCommissionMutation.mutate({
      commissionId: commission.id || commission.commissionId,
      payload,
    })
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {totalsLoading ? <StatusAlert type="loading" message="Loading seller commissions and Company Profit..." /> : null}
      {!totalsLoading && (isFetching || isProfitFetching) ? <StatusAlert type="info" message="Refreshing commissions and Company Profit..." /> : null}
      {totalsError ? <StatusAlert type="error" message={profitError?.message || error?.message || 'Could not load both seller commissions and Company Profit. Combined totals are unavailable.'} /> : null}

      <ReviewReturnLink role={user?.role} reviewId={dismissedReviewId || (reviewView ? reviewId : 0)} />
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title={`${project.name || 'Lot Project'} Commissions`}
          description="One record per unit and buyer. Commission Base uses lot area × selected price per SQM before sale discount and LMF."
          icon={FiDollarSign}
        />

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

      <p className="-mb-4 text-xs font-semibold text-slate-500">
        Totals include seller commissions and separately tracked Network Company Profit. Seller recipients are counted separately; Company Profit is not a seller.
      </p>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Commission Accounts" value={totalsLoading || totalsError ? '—' : displayStats.total || 0} isMoney={false} />
        <StatCard label="Gross Commission" value={totalsLoading || totalsError ? '—' : displayStats.gross || 0} tone="blue" />
        <StatCard label="Eligible to Release" value={totalsLoading || totalsError ? '—' : displayStats.eligible || 0} tone="indigo" />
        <StatCard label="Released" value={totalsLoading || totalsError ? '—' : displayStats.released || 0} tone="emerald" />
        <StatCard label="Net Remaining" value={totalsLoading || totalsError ? '—' : displayStats.remaining || 0} tone="amber" />
      </section>

      {!totalsLoading && !totalsError ? (
        <p className="-mb-3 text-xs font-semibold text-slate-600">
          Gross breakdown: Seller commissions {money(filteredRecords.reduce((sum, item) => sum + item.sellerGrossCommission, 0))}
          {' · '} Company Profit {money(filteredRecords.reduce((sum, item) => sum + item.companyProfitGross, 0))}
        </p>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search unit, client, seller, Network, role, or type..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <select
            value={commissionTypeFilter}
            onChange={(event) => {
              setCommissionTypeFilter(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            aria-label="Filter accounts by commission type"
          >
            <option value="all">All Commission Types</option>
            <option value="direct">Contains Direct</option>
            <option value="override">Contains Override</option>
          </select>

          <select
            value={eligibilityFilter}
            onChange={(event) => {
              setEligibilityFilter(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            aria-label="Filter accounts by seller eligibility"
          >
            <option value="all">All Eligibility</option>
            <option value="eligible">Has Eligible Release</option>
            <option value="completed">Has Completed Seller</option>
            <option value="not_eligible">Has Not Eligible Seller</option>
          </select>

          <button type="button" onClick={resetFilters} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
            Reset Filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-lg font-black text-slate-950">Commission Records</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">One row per unit and buyer. Total Gross, Released and Net Remaining include Company Profit; Details keep the seller and Company Profit records separate.</p>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-[1080px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Unit', 'Client', 'Sellers', 'Network Name', 'Commission Base (Before Discount)', 'Total Gross (incl. Profit)', 'Released', 'Net Remaining', 'Payment %', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {totalsLoading ? <tr><td colSpan={10} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading commission accounts...</td></tr> : null}

              {!totalsLoading && !totalsError && paginatedRecords.map((record) => (
                <tr key={record.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-blue-700">{record.unit}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{record.client}</td>
                  <td className="px-4 py-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                      <FiUsers className="h-3.5 w-3.5" />
                      {record.sellerCount} seller{record.sellerCount === 1 ? '' : 's'}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{record.sellerGroupLabel}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{money(record.commissionBase)}</td>
                  <td className="px-4 py-4 font-black text-slate-950">
                    {money(record.grossCommission)}
                    {record.hasCompanyProfit ? <p className="mt-1 text-[10px] font-semibold text-slate-500">Includes {money(record.companyProfitGross)} Company Profit</p> : null}
                  </td>
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

              {!totalsLoading && !totalsError && !filteredRecords.length ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <FiDollarSign className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">No commission records found</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Try changing your search or filters.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {totalsLoading ? <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading commission accounts...</p> : null}
          {!totalsLoading && !totalsError && paginatedRecords.map((record) => (
            <article key={record.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-blue-700">{record.unit}</p>
                  <p className="mt-1 text-base font-black text-slate-950">{record.client}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{record.sellerCount} seller{record.sellerCount === 1 ? '' : 's'} · {record.sellerGroupLabel}{record.hasCompanyProfit ? ' · + Company Profit' : ''}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{Number(record.paymentPercent || 0).toFixed(2)}%</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Commission Base (Before Discount)</p><p className="mt-1 text-sm font-black text-slate-900">{money(record.commissionBase)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Total Gross</p><p className="mt-1 text-sm font-black text-slate-900">{money(record.grossCommission)}</p>{record.hasCompanyProfit ? <p className="mt-1 text-[10px] text-slate-500">Includes {money(record.companyProfitGross)} Company Profit</p> : null}</div>
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-600">Released</p><p className="mt-1 text-sm font-black text-emerald-700">{money(record.released)}</p></div>
                <div className="rounded-xl bg-blue-50 p-3"><p className="text-[10px] font-black uppercase text-blue-600">Net Remaining</p><p className="mt-1 text-sm font-black text-blue-700">{money(record.netRemaining)}</p></div>
              </div>

              <button type="button" onClick={() => { setSelected(record); setModalNotice(null) }} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50">
                <FiEye className="h-4 w-4" />
                View Company & Seller Commissions
              </button>
            </article>
          ))}
          {!isLoading && !filteredRecords.length ? <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-semibold text-slate-500">No commission records match the current filters.</p> : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing {filteredRecords.length ? `${startIndex + 1}-${endIndex}` : '0'} of {filteredRecords.length} accounts
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none"
              aria-label="Commission accounts per page"
            >
              {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={currentPage <= 1} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700">Page {currentPage} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={currentPage >= totalPages} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>

      {reviewView && !totalsLoading && !totalsError && !reviewedGroup ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">The exact commission was not found. <button type="button" className="ml-2 underline" onClick={returnToReview}>Back to Review</button></div> : null}
      {selected ? (
        <ReleaseDetailsModal
          commissionGroup={selected}
          projectSlug={projectSlug}
          isSaving={updateCommissionMutation.isPending}
          onClose={() => {
            setSelected(null)
            setModalNotice(null)
            if (reviewView) setSearchParams(dismissReviewRecordQuery(searchParams), { replace: true })
          }}
          onAction={handleCommissionAction}
          canRelease={!reviewView && canRelease}
          canViewSigned={hasPermission(user, PERMISSIONS.SYSTEM_ACCREDITED_VIEW)}
          canUploadSigned={!reviewView && hasPermission(user, PERMISSIONS.SYSTEM_ACCREDITED_UPLOAD_PROOF)}
          canHold={!reviewView && canHold}
          canUnhold={!reviewView && canUnhold}
          serverNotice={modalNotice}
          onClearServerNotice={() => setModalNotice(null)}
        />
      ) : null}
    </main>
  )
}

export default Commission







