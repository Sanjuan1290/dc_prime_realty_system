import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowLeft,
  FiCalendar,
  FiDollarSign,
  FiEdit2,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import MemberRatesModal from '../../components/System/sellerGroupComponents/MemberRatesModal'
import EditGroupModal from '../../components/System/sellerGroupComponents/EditGroupModal'
import CreateUserModal from '../../components/System/userComponents/CreateUserModal'
import { useFetch as fetchJson, useFetchPatch as patchJson } from '../../utils/useFetch'

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

const RateBadge = ({ rate, role }) => (
  <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
    {role === 'agent' ? 'Sales' : 'Override'}: {Number(rate || 0).toFixed(2)}%
  </span>
)

const RatesCell = ({ rates = [], role = '' }) => (
  <div className="flex max-w-md flex-wrap gap-2">
    {rates.length ? rates.map((rate) => <RateBadge key={rate} rate={rate} role={role} />) : <span className="text-sm font-semibold text-slate-400">—</span>}
  </div>
)

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
  const [memberPage, setMemberPage] = useState(1)
  const [memberLimit, setMemberLimit] = useState(10)
  const [rateEditor, setRateEditor] = useState(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
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
  const analytics = analyticsQuery.data?.data || null
  const analyticsSummary = analytics?.summary || {}

  const realMembers = useMemo(() => members.filter((member) => !member.is_system_dummy), [members])
  const memberById = useMemo(() => new Map(members.map((member) => [Number(member.accredited_seller_id), member])), [members])
  const getMemberContext = (member) => {
    const isGroupHead = Number(member.user_id) === Number(group.headUserId)
    const parent = member.parent_accredited_seller_id
      ? memberById.get(Number(member.parent_accredited_seller_id))
      : !isGroupHead
        ? realMembers.find((candidate) => Number(candidate.user_id) === Number(group.headUserId))
        : null
    return {
      isGroupHead,
      parent,
    }
  }

  const memberRatesById = useMemo(() => {
    const rateMap = new Map()
    const addRate = (memberId, rate) => {
      const numericRate = Number(rate || 0)
      if (!memberId || numericRate <= 0) return
      const current = rateMap.get(Number(memberId)) || []
      const normalized = Number(numericRate.toFixed(2))
      if (!current.includes(normalized)) current.push(normalized)
      rateMap.set(Number(memberId), current.sort((left, right) => right - left))
    }

    realMembers.forEach((member) => {
      if (member.role === 'agent') {
        if (member.direct_rate_status === 'active') addRate(member.accredited_seller_id, member.direct_rate)
        return
      }
      if (member.project_rate_status === 'active') addRate(member.accredited_seller_id, member.project_rate)
    })

    return rateMap
  }, [realMembers])

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
      ].some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  // getMemberContext is derived entirely from these memoized collections.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realMembers, memberSearch, memberById, group.headUserId])

  const memberTotalPages = Math.max(Math.ceil(filteredMembers.length / memberLimit), 1)
  const currentMemberPage = Math.min(memberPage, memberTotalPages)
  const paginatedMembers = useMemo(() => {
    const start = (currentMemberPage - 1) * memberLimit
    return filteredMembers.slice(start, start + memberLimit)
  }, [filteredMembers, memberLimit, currentMemberPage])
  const allocationPaths = configuration?.validation?.paths || []
  const incompleteAllocationPaths = allocationPaths.filter((path) => (
    Number(path.poolRate || 0) > 0
    && Math.abs(Number(path.allocatedRate || 0) - Number(path.poolRate || 0)) > 0.0001
  ))


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
        <div className="grid gap-2 sm:grid-cols-2 xl:flex">
          <NavLink to={groupsPath} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft />Back to Seller Groups</NavLink>
          <button type="button" onClick={() => { projectOptionsQuery.refetch(); configurationQuery.refetch(); analyticsQuery.refetch() }} disabled={projectOptionsQuery.isFetching || configurationQuery.isFetching || analyticsQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FiRefreshCw className={projectOptionsQuery.isFetching || configurationQuery.isFetching || analyticsQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={() => setShowCreateUser(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100"><FiUserPlus />Add User</button>
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
                setMemberPage(1)
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
              {analyticsQuery.isLoading ? <StatusAlert type="loading" message="Loading group sales and commission totals..." /> : null}
              {!analyticsQuery.isLoading && analyticsQuery.isFetching ? <StatusAlert type="info" message="Refreshing totals for the selected date range..." /> : null}
              {analyticsQuery.isError ? <StatusAlert type="error" message={analyticsQuery.error?.message || 'Failed to load group analytics.'} /> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-lg font-black text-slate-950">Member Rates</h2><p className="text-sm font-semibold text-slate-500">Each complete sales path must total the {Number(configuration.poolRate || 0).toFixed(2)}% group pool for {project.name}.</p></div>
              <label className="relative block w-full lg:max-w-md"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setMemberPage(1) }} placeholder="Search seller, role, or reporting parent..." className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
            </div>

            {allocationPaths.length ? (
              <div className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-sm font-black ${incompleteAllocationPaths.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                {incompleteAllocationPaths.length
                  ? `${incompleteAllocationPaths.length} of ${allocationPaths.length} commission path(s) do not total the ${Number(configuration.poolRate || 0).toFixed(2)}% group pool.`
                  : `All ${allocationPaths.length} commission path(s) total the ${Number(configuration.poolRate || 0).toFixed(2)}% group pool.`}
              </div>
            ) : null}

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1080px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50"><tr>{['Seller', 'Role', 'Reports Under', 'Rates', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedMembers.map((member) => {
                    const context = getMemberContext(member)
                    return (
                      <tr key={member.accredited_seller_id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-4"><p className="font-black text-slate-950">{member.display_name}</p></td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{roleLabel(member.role)}</td>
                        <td className="px-4 py-4"><p className="font-semibold text-slate-700">{context.parent?.display_name || (context.isGroupHead ? 'Developer' : 'Not assigned')}</p><p className="text-xs text-slate-500">{context.isGroupHead ? 'Top of hierarchy' : 'Direct parent'}</p></td>
                        <td className="px-4 py-4"><RatesCell rates={memberRatesById.get(Number(member.accredited_seller_id)) || []} role={member.role} /></td>
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
              {paginatedMembers.map((member) => {
                const context = getMemberContext(member)
                return (
                  <article key={member.accredited_seller_id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{member.display_name}</p><p className="text-xs font-semibold text-slate-500">{roleLabel(member.role)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${member.accredited_seller_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.accredited_seller_status}</span></div>
                    <p className="mt-3 text-xs font-bold text-slate-500">Reports under</p><p className="font-semibold text-slate-800">{context.parent?.display_name || (context.isGroupHead ? 'Developer' : 'Not assigned')}</p>
                    <div className="mt-3"><RatesCell rates={memberRatesById.get(Number(member.accredited_seller_id)) || []} role={member.role} /></div>
                    <button type="button" onClick={() => openRateEditor(member)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white"><FiEdit2 />Edit Rate</button>
                  </article>
                )
              })}
              {!filteredMembers.length ? <p className="py-8 text-center text-sm font-semibold text-slate-500">No members match your search.</p> : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-500">Page {currentMemberPage} of {memberTotalPages} · {filteredMembers.length} member(s)</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={memberLimit} onChange={(event) => { setMemberLimit(Number(event.target.value)); setMemberPage(1) }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
                  <option value={10}>10 rows</option>
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                </select>
                <button type="button" disabled={currentMemberPage <= 1} onClick={() => setMemberPage(Math.max(currentMemberPage - 1, 1))} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Previous</button>
                <button type="button" disabled={currentMemberPage >= memberTotalPages} onClick={() => setMemberPage(Math.min(currentMemberPage + 1, memberTotalPages))} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Next</button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {rateEditor ? (
        <MemberRatesModal
          key={`${rateEditor.member.accredited_seller_id}-${selectedProjectId}`}
          member={rateEditor.member}
          project={project}
          isPending={memberRatesMutation.isPending}
          notice={modalNotice}
          onClose={() => { if (!memberRatesMutation.isPending) { setRateEditor(null); setModalNotice(null) } }}
          onSubmit={(payload) => memberRatesMutation.mutate({ memberId: rateEditor.member.accredited_seller_id, payload })}
        />
      ) : null}

      {showCreateUser ? (
        <CreateUserModal
          setShowCreateUser={setShowCreateUser}
          allowedRoles={['broker_network_manager', 'broker', 'manager', 'agent']}
          actorRole={isAdmin ? 'admin' : 'super_admin'}
          initialSellerGroupId={String(group.id || groupId)}
          lockSellerGroup
          title={`Add User to ${pageTitle}`}
          onSaved={(message) => {
            setAlert({ type: 'success', message })
            refreshConnectedQueries()
          }}
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


