import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  FiArrowLeft,
  FiCalendar,
  FiDollarSign,
  FiEdit2,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import MemberRatesModal from '../../components/System/sellerGroupComponents/MemberRatesModal'
import CreateDirectSalesAgentModal from '../../components/System/sellerGroupComponents/CreateDirectSalesAgentModal'
import EditGroupModal from '../../components/System/sellerGroupComponents/EditGroupModal'
import { useFetch as fetchJson, useFetchPatch as patchJson, useFetchPost as postJson } from '../../utils/useFetch'

const roleLabel = (role = '') => ({
  broker_network_manager: 'Broker Network Manager',
  broker: 'Broker',
  manager: 'Manager',
  agent: 'Agent',
}[role] || String(role || 'Seller').replaceAll('_', ' '))

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
}).format(Number(value || 0))

const compactCurrency = (value) => new Intl.NumberFormat('en-PH', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value || 0))

const toDateInput = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getLastTwelveMonthsRange = () => {
  const today = new Date()
  const from = new Date(today.getFullYear(), today.getMonth() - 11, 1)
  return { from: toDateInput(from), to: toDateInput(today) }
}

const getPresetRange = (preset) => {
  const today = new Date()
  if (preset === '30_days') {
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    return { from: toDateInput(from), to: toDateInput(today) }
  }
  if (preset === 'this_year') {
    return { from: `${today.getFullYear()}-01-01`, to: toDateInput(today) }
  }
  return getLastTwelveMonthsRange()
}

const formatPeriodLabel = (period = '') => {
  const parts = String(period).split('-').map(Number)
  if (parts.length < 2 || !parts[0] || !parts[1]) return period
  const date = new Date(parts[0], parts[1] - 1, parts[2] || 1)
  return date.toLocaleDateString('en-PH', parts[2]
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', year: '2-digit' })
}

const SummaryCard = ({ icon: Icon, label, value, helper }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon /></span>
    </div>
  </article>
)

const RateBadge = ({ label, rate, status = 'inactive', tone = 'blue' }) => {
  const active = status === 'active'
  const toneClass = tone === 'violet'
    ? 'bg-violet-50 text-violet-700 ring-violet-100'
    : 'bg-blue-50 text-blue-700 ring-blue-100'
  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-black ring-1 ${active ? toneClass : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
      {label}: {active ? `${Number(rate || 0).toFixed(2)}%` : 'Inactive'}
    </span>
  )
}

const RatesCell = ({ member, directSeller, parent, savedOverride, isGroupHead }) => (
  <div className="flex max-w-md flex-wrap gap-2">
    {member.role === 'agent' ? (
      <RateBadge label="Direct" rate={member.direct_rate} status={member.direct_rate_status} />
    ) : directSeller ? (
      <RateBadge label="Direct-sales agent" rate={directSeller.direct_rate} status={directSeller.direct_rate_status} />
    ) : (
      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">Direct sales: Not enabled</span>
    )}
    {!isGroupHead ? (
      savedOverride ? (
        <RateBadge label={`Parent gets`} rate={savedOverride.override_rate} status={savedOverride.override_rate_status} tone="violet" />
      ) : (
        <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">Parent override: Not set</span>
      )
    ) : null}
    {!isGroupHead && parent ? <span className="w-full text-[11px] font-semibold text-slate-500">Paid to {parent.display_name}</span> : null}
  </div>
)

const AnalyticsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
      <p className="font-black text-slate-950">{formatPeriodLabel(label)}</p>
      <div className="mt-2 grid gap-1.5">
        {payload.map((item) => (
          <p key={item.dataKey} className="font-semibold text-slate-600">
            {item.name}: <span className="font-black text-slate-950">{item.dataKey === 'salesCount' ? Number(item.value || 0) : formatCurrency(item.value)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

const SellerGroupDetails = () => {
  const { groupId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const isAdmin = location.pathname.startsWith('/admin/')
  const groupsPath = isAdmin ? '/admin/users/seller_group' : '/super_admin/users/seller_group'

  const initialRange = useMemo(() => getLastTwelveMonthsRange(), [])
  const [alert, setAlert] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [rateEditor, setRateEditor] = useState(null)
  const [dummyOwner, setDummyOwner] = useState(null)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [modalNotice, setModalNotice] = useState(null)
  const [draftRange, setDraftRange] = useState(initialRange)
  const [appliedRange, setAppliedRange] = useState(initialRange)

  const selectedProjectId = Number(searchParams.get('project') || 0)

  const projectOptionsQuery = useQuery({
    queryKey: ['seller-group-project-options', Number(groupId)],
    queryFn: () => fetchJson(`/seller-groups/${groupId}/projects`),
    enabled: Boolean(groupId),
  })
  const accreditedProjects = useMemo(() => projectOptionsQuery.data?.data || [], [projectOptionsQuery.data])
  const groupOption = projectOptionsQuery.data?.group || {}

  // The URL can only point to a project currently accredited to this group.
  useEffect(() => {
    if (!accreditedProjects.length) return
    const exists = accreditedProjects.some((project) => Number(project.lot_project_id) === selectedProjectId)
    if (!exists) {
      setSearchParams({ project: String(accreditedProjects[0].lot_project_id) }, { replace: true })
    }
  }, [accreditedProjects, selectedProjectId, setSearchParams])

  const configurationQuery = useQuery({
    queryKey: ['seller-group-project-configuration', Number(groupId), selectedProjectId],
    queryFn: () => fetchJson(`/seller-groups/${groupId}/projects/${selectedProjectId}`),
    enabled: Boolean(groupId && selectedProjectId),
    placeholderData: (previousData) => previousData,
  })

  const analyticsQueryString = new URLSearchParams(appliedRange).toString()
  const analyticsQuery = useQuery({
    queryKey: ['seller-group-project-analytics', Number(groupId), selectedProjectId, appliedRange.from, appliedRange.to],
    queryFn: () => fetchJson(`/seller-groups/${groupId}/projects/${selectedProjectId}/analytics?${analyticsQueryString}`),
    enabled: Boolean(groupId && selectedProjectId && appliedRange.from && appliedRange.to),
    placeholderData: (previousData) => previousData,
  })

  const configuration = configurationQuery.data?.data || null
  const group = configuration?.group || {
    id: Number(groupId),
    name: groupOption.name || 'Seller Group',
    status: groupOption.status,
    projectRates: accreditedProjects,
  }
  const project = configuration?.project || accreditedProjects.find((item) => Number(item.lot_project_id) === selectedProjectId) || {}
  const members = useMemo(() => configuration?.members || [], [configuration])
  const overrides = useMemo(() => configuration?.overrides || [], [configuration])
  const analytics = analyticsQuery.data?.data || null
  const analyticsSummary = analytics?.summary || {}
  const timeline = useMemo(() => (analytics?.timeline || []).map((row) => ({
    ...row,
    label: formatPeriodLabel(row.period),
  })), [analytics])

  const realMembers = useMemo(() => members.filter((member) => !member.is_system_dummy), [members])
  const memberById = useMemo(() => new Map(members.map((member) => [Number(member.accredited_seller_id), member])), [members])
  const dummyByOwner = useMemo(() => new Map(
    members
      .filter((member) => member.is_system_dummy && member.dummy_owner_accredited_seller_id)
      .map((member) => [Number(member.dummy_owner_accredited_seller_id), member])
  ), [members])
  const overrideByRelationship = useMemo(() => new Map(overrides.map((item) => [
    `${Number(item.child_accredited_seller_id)}:${Number(item.parent_accredited_seller_id)}`,
    item,
  ])), [overrides])

  const getMemberContext = (member) => {
    const isGroupHead = Number(member.user_id) === Number(group.headUserId)
    const parent = member.parent_accredited_seller_id
      ? memberById.get(Number(member.parent_accredited_seller_id))
      : !isGroupHead
        ? realMembers.find((candidate) => Number(candidate.user_id) === Number(group.headUserId))
        : null
    const savedOverride = parent
      ? overrideByRelationship.get(`${Number(member.accredited_seller_id)}:${Number(parent.accredited_seller_id)}`)
      : null
    return {
      isGroupHead,
      parent,
      savedOverride,
      directSeller: member.role === 'agent' ? member : dummyByOwner.get(Number(member.accredited_seller_id)) || null,
    }
  }

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase()
    if (!keyword) return realMembers
    return realMembers.filter((member) => {
      const context = getMemberContext(member)
      return [
        member.display_name,
        member.full_name,
        member.role,
        context.parent?.display_name,
        context.directSeller?.display_name,
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  // getMemberContext is derived entirely from these memoized collections.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realMembers, memberSearch, memberById, dummyByOwner, overrideByRelationship, group.headUserId])

  const refreshConnectedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-options', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-configuration', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-analytics', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
    queryClient.invalidateQueries({ queryKey: ['reservation-agents'] })
    queryClient.invalidateQueries({ queryKey: ['commission-preview'] })
  }

  const memberRatesMutation = useMutation({
    mutationFn: ({ memberId, payload }) => patchJson(`/seller-groups/${groupId}/projects/${selectedProjectId}/members/${memberId}/rates`, payload),
    onMutate: () => setModalNotice({ type: 'loading', message: 'Saving seller rates...' }),
    onSuccess: (result) => {
      setRateEditor(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Seller rates saved.' })
      refreshConnectedQueries()
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to save seller rates.' }),
  })

  const createDummyMutation = useMutation({
    mutationFn: ({ ownerId, directRate }) => postJson(`/seller-groups/${groupId}/direct-sales-agents/${ownerId}`, { projectId: selectedProjectId, directRate }),
    onMutate: () => setModalNotice({ type: 'loading', message: 'Creating direct-sales agent...' }),
    onSuccess: (result) => {
      setDummyOwner(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Direct-sales agent created.' })
      refreshConnectedQueries()
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to create direct-sales agent.' }),
  })

  const applyRange = () => {
    if (!draftRange.from || !draftRange.to) {
      setAlert({ type: 'error', message: 'Select both From Date and To Date.' })
      return
    }
    if (draftRange.from > draftRange.to) {
      setAlert({ type: 'error', message: 'From Date cannot be after To Date.' })
      return
    }
    setAlert(null)
    setAppliedRange(draftRange)
  }

  const setPreset = (preset) => {
    const range = getPresetRange(preset)
    setDraftRange(range)
    setAppliedRange(range)
    setAlert(null)
  }

  const openRateEditor = (member) => {
    setModalNotice(null)
    setRateEditor({ member, ...getMemberContext(member) })
  }

  const isInitialLoading = projectOptionsQuery.isLoading || (selectedProjectId && configurationQuery.isLoading)
  const pageTitle = group.name || groupOption.name || 'Seller Group'

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title={pageTitle}
          description="Manage accredited projects, member rates, and project sales performance."
          icon={FiUsers}
        />
        <div className="grid gap-2 sm:grid-cols-3 xl:flex">
          <NavLink to={groupsPath} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft />Back to Seller Groups</NavLink>
          <button type="button" onClick={() => { projectOptionsQuery.refetch(); configurationQuery.refetch(); analyticsQuery.refetch() }} disabled={projectOptionsQuery.isFetching || configurationQuery.isFetching || analyticsQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FiRefreshCw className={projectOptionsQuery.isFetching || configurationQuery.isFetching || analyticsQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={() => setShowEditGroupModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"><FiEdit2 />Edit Group</button>
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} title={alert.title} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isInitialLoading ? <StatusAlert type="loading" message="Loading seller group and accredited projects..." /> : null}
      {projectOptionsQuery.isError ? <StatusAlert type="error" message={projectOptionsQuery.error?.message || 'Failed to load accredited projects.'} /> : null}
      {configurationQuery.isError ? <StatusAlert type="error" message={configurationQuery.error?.message || 'Failed to load seller group rates.'} /> : null}
      {!configurationQuery.isLoading && configurationQuery.isFetching ? <StatusAlert type="info" message={`Refreshing ${project.name || 'selected project'} rates...`} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Group Head</p>
            <p className="mt-1 text-lg font-black text-slate-950">{group.headName || 'No group head assigned'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{group.description || 'No group description.'}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-slate-700">Accredited Project <span className="text-red-500">*</span></span>
            <select
              value={selectedProjectId || ''}
              onChange={(event) => {
                setSearchParams({ project: event.target.value })
                setMemberSearch('')
                setRateEditor(null)
                setAlert(null)
              }}
              disabled={projectOptionsQuery.isLoading || !accreditedProjects.length}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
            >
              {!accreditedProjects.length ? <option value="">No accredited projects</option> : null}
              {accreditedProjects.map((item) => <option key={item.lot_project_id} value={item.lot_project_id}>{item.lot_project_name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {!projectOptionsQuery.isLoading && !accreditedProjects.length ? (
        <StatusAlert type="warning" title="No accredited projects" message="Edit this seller group and select at least one project before setting rates or viewing sales performance." />
      ) : null}

      {configuration ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Sales and Commission Performance</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Live totals for {project.name} based on reservation dates within the selected range.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[150px_150px_auto_auto]">
                <label className="flex flex-col gap-1"><span className="text-[11px] font-black uppercase text-slate-500">From Date</span><input type="date" value={draftRange.from} onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
                <label className="flex flex-col gap-1"><span className="text-[11px] font-black uppercase text-slate-500">To Date</span><input type="date" value={draftRange.to} onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
                <button type="button" onClick={applyRange} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700"><FiCalendar />Apply Range</button>
                <select aria-label="Date range preset" defaultValue="last_12_months" onChange={(event) => setPreset(event.target.value)} className="mt-auto h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"><option value="30_days">Last 30 Days</option><option value="this_year">This Year</option><option value="last_12_months">Last 12 Months</option></select>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-6">
              <SummaryCard icon={FiUsers} label="Active Members" value={configuration.summary?.activeMembers || 0} helper="Real seller accounts" />
              <SummaryCard icon={FiShoppingBag} label="Sales" value={analyticsSummary.salesCount || 0} helper="Reserved accounts" />
              <SummaryCard icon={FiDollarSign} label="Sales Value" value={formatCurrency(analyticsSummary.salesAmount)} helper="Total contract price" />
              <SummaryCard icon={FiTrendingUp} label="Gross Commission" value={formatCurrency(analyticsSummary.grossCommission)} helper="Accumulated commission" />
              <SummaryCard icon={FiDollarSign} label="Released" value={formatCurrency(analyticsSummary.releasedCommission)} helper="Commission already paid" />
              <SummaryCard icon={FiDollarSign} label="Remaining" value={formatCurrency(analyticsSummary.remainingCommission)} helper="Commission not yet released" />
            </div>

            <div className="px-4 pb-4">
              {analyticsQuery.isLoading ? <StatusAlert type="loading" message="Loading group sales and commission analytics..." /> : null}
              {!analyticsQuery.isLoading && analyticsQuery.isFetching ? <StatusAlert type="info" message="Refreshing analytics for the selected date range..." /> : null}
              {analyticsQuery.isError ? <StatusAlert type="error" message={analyticsQuery.error?.message || 'Failed to load group analytics.'} /> : null}

              {!analyticsQuery.isLoading && !analyticsQuery.isError ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-4"><h3 className="font-black text-slate-950">Sales and Commission Trend</h3><p className="text-xs font-semibold text-slate-500">Sales value, group commission, released commission, and sales count.</p></div>
                    {timeline.length ? (
                      <div className="h-[340px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={timeline} margin={{ top: 10, right: 12, left: 8, bottom: 10 }} accessibilityLayer>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" tickFormatter={formatPeriodLabel} minTickGap={24} />
                            <YAxis yAxisId="money" tickFormatter={compactCurrency} width={72} />
                            <YAxis yAxisId="count" orientation="right" allowDecimals={false} width={42} />
                            <Tooltip content={<AnalyticsTooltip />} />
                            <Legend />
                            <Bar yAxisId="money" dataKey="salesAmount" name="Sales Value" fill="#2563eb" radius={[5, 5, 0, 0]} />
                            <Line yAxisId="money" type="monotone" dataKey="grossCommission" name="Gross Commission" stroke="#7c3aed" strokeWidth={3} dot={false} />
                            <Line yAxisId="money" type="monotone" dataKey="releasedCommission" name="Released Commission" stroke="#059669" strokeWidth={3} dot={false} />
                            <Line yAxisId="count" type="monotone" dataKey="salesCount" name="Sales Count" stroke="#ea580c" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center text-sm font-semibold text-slate-500">No sales or commission records fall within this date range.</p>}
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div><h3 className="font-black text-slate-950">Sales by Agent</h3><p className="text-xs font-semibold text-slate-500">Top sellers for the selected project and range.</p></div>
                    <div className="mt-4 grid gap-3">
                      {(analytics?.sellers || []).map((seller, index) => (
                        <div key={`${seller.sellerId}-${seller.sellerName}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-blue-700">#{index + 1}</p><p className="font-black text-slate-950">{seller.sellerName}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">{seller.salesCount} sale{seller.salesCount === 1 ? '' : 's'}</span></div>
                          <p className="mt-2 text-sm font-black text-slate-800">{formatCurrency(seller.salesAmount)}</p>
                        </div>
                      ))}
                      {!(analytics?.sellers || []).length ? <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-semibold text-slate-500">No agent sales found.</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-lg font-black text-slate-950">Member Rates</h2><p className="text-sm font-semibold text-slate-500">Review and edit the saved rate setup for {project.name}.</p></div>
              <label className="relative block w-full lg:max-w-md"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search seller, role, parent, or direct-sales agent..." className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1080px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50"><tr>{['Seller', 'Role', 'Reports Under', 'Rates', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((member) => {
                    const context = getMemberContext(member)
                    return (
                      <tr key={member.accredited_seller_id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-4"><p className="font-black text-slate-950">{member.display_name}</p>{context.directSeller && member.role !== 'agent' ? <p className="mt-1 text-xs font-semibold text-blue-600">System direct-sales agent connected</p> : null}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{roleLabel(member.role)}</td>
                        <td className="px-4 py-4"><p className="font-semibold text-slate-700">{context.parent?.display_name || (context.isGroupHead ? 'Developer' : 'Not assigned')}</p><p className="text-xs text-slate-500">{context.isGroupHead ? 'Top of hierarchy' : 'Direct parent'}</p></td>
                        <td className="px-4 py-4"><RatesCell member={member} {...context} /></td>
                        <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${member.accredited_seller_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.accredited_seller_status}</span></td>
                        <td className="px-4 py-4"><button type="button" onClick={() => openRateEditor(member)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiEdit2 />Edit Rate</button></td>
                      </tr>
                    )
                  })}
                  {!filteredMembers.length ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No members match your search.</td></tr> : null}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {filteredMembers.map((member) => {
                const context = getMemberContext(member)
                return (
                  <article key={member.accredited_seller_id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{member.display_name}</p><p className="text-xs font-semibold text-slate-500">{roleLabel(member.role)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${member.accredited_seller_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.accredited_seller_status}</span></div>
                    <p className="mt-3 text-xs font-bold text-slate-500">Reports under</p><p className="font-semibold text-slate-800">{context.parent?.display_name || (context.isGroupHead ? 'Developer' : 'Not assigned')}</p>
                    <div className="mt-3"><RatesCell member={member} {...context} /></div>
                    <button type="button" onClick={() => openRateEditor(member)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white"><FiEdit2 />Edit Rate</button>
                  </article>
                )
              })}
              {!filteredMembers.length ? <p className="py-8 text-center text-sm font-semibold text-slate-500">No members match your search.</p> : null}
            </div>
          </section>
        </>
      ) : null}

      {rateEditor ? (
        <MemberRatesModal
          key={`${rateEditor.member.accredited_seller_id}-${selectedProjectId}`}
          member={rateEditor.member}
          parent={rateEditor.parent}
          directSeller={rateEditor.directSeller}
          savedOverride={rateEditor.savedOverride}
          project={project}
          isGroupHead={rateEditor.isGroupHead}
          isPending={memberRatesMutation.isPending}
          notice={modalNotice}
          onClose={() => { if (!memberRatesMutation.isPending) { setRateEditor(null); setModalNotice(null) } }}
          onCreateDirectSalesAgent={() => {
            const owner = rateEditor.member
            setRateEditor(null)
            setModalNotice(null)
            setDummyOwner(owner)
          }}
          onSubmit={(payload) => memberRatesMutation.mutate({ memberId: rateEditor.member.accredited_seller_id, payload })}
        />
      ) : null}

      {dummyOwner ? (
        <CreateDirectSalesAgentModal
          key={`${dummyOwner.accredited_seller_id}-${selectedProjectId}`}
          owner={dummyOwner}
          project={project}
          isPending={createDummyMutation.isPending}
          notice={modalNotice}
          onClose={() => { if (!createDummyMutation.isPending) { setDummyOwner(null); setModalNotice(null) } }}
          onSubmit={({ directRate }) => createDummyMutation.mutate({ ownerId: dummyOwner.accredited_seller_id, directRate })}
        />
      ) : null}

      {showEditGroupModal ? (
        <EditGroupModal
          setShowEditGroupModal={setShowEditGroupModal}
          selectedGroup={{
            seller_group_id: group.id || Number(groupId),
            seller_group_name: group.name || groupOption.name,
            seller_group_head_user_id: group.headUserId,
            seller_group_description: group.description,
            seller_group_status: group.status || groupOption.status,
            project_rates: group.projectRates || accreditedProjects,
          }}
          onSaved={(message) => {
            setAlert({ type: 'success', message })
            refreshConnectedQueries()
          }}
        />
      ) : null}
    </main>
  )
}

export default SellerGroupDetails
