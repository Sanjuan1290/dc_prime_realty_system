import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowLeft,
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
import EditGroupModal from '../../components/System/sellerGroupComponents/EditGroupModal'
import CreateUserModal from '../../components/System/userComponents/CreateUserModal'
import { useFetch as fetchJson } from '../../utils/useFetch'

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

const dateRangeOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '2_months', label: '2 Months' },
  { value: '3_months', label: '3 Months' },
  { value: '6_months', label: '6 Months' },
  { value: '12_months', label: '12 Months' },
  { value: 'custom', label: 'Custom' },
]

const toDateInput = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const resolvePresetDateRange = (range, today = new Date()) => {
  let from
  let to

  if (range === 'last_month') {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    to = new Date(today.getFullYear(), today.getMonth(), 0)
  } else {
    const monthCount = Number.parseInt(String(range).match(/^(\d+)_months$/)?.[1] || '1', 10)
    from = new Date(today.getFullYear(), today.getMonth() - Math.max(monthCount - 1, 0), 1)
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  }

  return { from: toDateInput(from), to: toDateInput(to) }
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

const RateCard = ({ label, value, helper, tone = 'blue' }) => {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
    violet: 'border-violet-100 bg-violet-50 text-violet-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
  }
  return (
    <article className={`rounded-2xl border p-4 ${tones[tone] || tones.blue}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{Number(value || 0).toFixed(2)}%</p>
      <p className="mt-1 text-xs font-semibold opacity-75">{helper}</p>
    </article>
  )
}

const SellerGroupDetails = () => {
  const { groupId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const isAdmin = location.pathname.startsWith('/admin/')
  const groupsPath = isAdmin ? '/admin/users/seller_group' : '/super_admin/users/seller_group'

  const initialRange = useMemo(() => resolvePresetDateRange('3_months'), [])
  const [dateRange, setDateRange] = useState('3_months')
  const [alert, setAlert] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberPage, setMemberPage] = useState(1)
  const [memberLimit, setMemberLimit] = useState(10)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
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

  useEffect(() => {
    if (!accreditedProjects.length) return
    const exists = accreditedProjects.some((project) => Number(project.lot_project_id) === selectedProjectId)
    if (!exists) setSearchParams({ project: String(accreditedProjects[0].lot_project_id) }, { replace: true })
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
    name: groupOption.name || 'Realty',
    status: groupOption.status,
    projectRates: accreditedProjects,
  }
  const project = configuration?.project || accreditedProjects.find((item) => Number(item.lot_project_id) === selectedProjectId) || {}
  const fixedRates = configuration?.fixedRates || {}
  const members = useMemo(() => (configuration?.members || []).filter((member) => !member.is_system_dummy), [configuration])
  const analyticsSummary = analyticsQuery.data?.data?.summary || {}
  const memberById = useMemo(() => new Map(members.map((member) => [Number(member.accredited_seller_id), member])), [members])

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase()
    if (!keyword) return members
    return members.filter((member) => {
      const parent = member.parent_accredited_seller_id ? memberById.get(Number(member.parent_accredited_seller_id)) : null
      return [member.display_name, member.full_name, member.role, parent?.display_name, member.reports_under_name]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [members, memberSearch, memberById])

  const memberTotalPages = Math.max(Math.ceil(filteredMembers.length / memberLimit), 1)
  const currentMemberPage = Math.min(memberPage, memberTotalPages)
  const paginatedMembers = useMemo(() => {
    const start = (currentMemberPage - 1) * memberLimit
    return filteredMembers.slice(start, start + memberLimit)
  }, [filteredMembers, memberLimit, currentMemberPage])

  const refreshConnectedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-options', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-configuration', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-analytics', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
    queryClient.invalidateQueries({ queryKey: ['reservation-agents'] })
    queryClient.invalidateQueries({ queryKey: ['commission-preview'] })
  }

  const handleRangeChange = (value) => {
    setDateRange(value)
    setAlert(null)

    if (value !== 'custom') {
      const nextRange = resolvePresetDateRange(value)
      setDraftRange(nextRange)
      setAppliedRange(nextRange)
    }
  }

  const updateCustomDate = (key, value) => {
    const nextRange = { ...draftRange, [key]: value }
    setDraftRange(nextRange)

    if (dateRange !== 'custom') return
    if (!nextRange.from || !nextRange.to) return

    if (nextRange.from > nextRange.to) {
      setAlert({ type: 'error', message: 'From Date cannot be after To Date.' })
      return
    }

    setAlert(null)
    setAppliedRange(nextRange)
  }

  const isInitialLoading = projectOptionsQuery.isLoading || (selectedProjectId && configurationQuery.isLoading)
  const pageTitle = group.name || groupOption.name || 'Realty'

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title={pageTitle}
          description="Realty project rates are fixed by role and apply to every seller in this group."
          icon={FiUsers}
        />
        <div className="grid gap-2 sm:grid-cols-2 xl:flex">
          <NavLink to={groupsPath} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft />Back to Realties</NavLink>
          <button type="button" onClick={() => { projectOptionsQuery.refetch(); configurationQuery.refetch(); analyticsQuery.refetch() }} disabled={projectOptionsQuery.isFetching || configurationQuery.isFetching || analyticsQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FiRefreshCw className={projectOptionsQuery.isFetching || configurationQuery.isFetching || analyticsQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={() => setShowCreateUser(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100"><FiUserPlus />Add User</button>
          <button type="button" onClick={() => setShowEditGroupModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"><FiEdit2 />Edit Realty & Rates</button>
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      {isInitialLoading ? <StatusAlert type="loading" message="Loading Realty and fixed project rates..." /> : null}
      {projectOptionsQuery.isError ? <StatusAlert type="error" message={projectOptionsQuery.error?.message || 'Failed to load accredited projects.'} /> : null}
      {configurationQuery.isError ? <StatusAlert type="error" message={configurationQuery.error?.message || 'Failed to load fixed group rates.'} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Realty Head</p>
            <p className="mt-1 text-lg font-black text-slate-950">{group.headName || 'No group head assigned'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{group.description || 'No group description.'}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-slate-700">Accredited Project <span className="text-red-500">*</span></span>
            <select
              value={selectedProjectId || ''}
              onChange={(event) => { setSearchParams({ project: event.target.value }); setMemberSearch(''); setMemberPage(1); setAlert(null) }}
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
        <StatusAlert type="warning" title="No accredited projects" message="Edit this Realty and select at least one project with a complete fixed commission structure." />
      ) : null}

      {configuration ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Fixed Project Commission Structure</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">These rates apply to all BNM, Broker, Manager, and Agent accounts in this Realty for {project.name}.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Allocated {Number(fixedRates.allocatedRate || 0).toFixed(2)}% of {Number(fixedRates.poolRate || 0).toFixed(2)}%</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <RateCard label="Project Pool" value={fixedRates.poolRate} helper="Maximum commission pool" tone="slate" />
              <RateCard label="BNM Override" value={fixedRates.bnmOverrideRate} helper="Fixed for every BNM" tone="violet" />
              <RateCard label="Broker Override" value={fixedRates.brokerOverrideRate} helper="Fixed for every Broker" tone="amber" />
              <RateCard label="Manager Override" value={fixedRates.managerOverrideRate} helper="Fixed for every Manager" tone="blue" />
              <RateCard label="Agent Sales Rate" value={fixedRates.agentRate} helper="Fixed for every Agent" tone="emerald" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Sales and Commission Performance</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Preset ranges cover complete calendar months. Custom lets you choose exact start and end dates.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Range</span>
                  <select value={dateRange} onChange={(event) => handleRangeChange(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
                    {dateRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">From date</span>
                  <input type="date" value={draftRange.from} onChange={(event) => updateCustomDate('from', event.target.value)} disabled={dateRange !== 'custom'} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">To date</span>
                  <input type="date" value={draftRange.to} onChange={(event) => updateCustomDate('to', event.target.value)} disabled={dateRange !== 'custom'} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" />
                </label>
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
              <div><h2 className="text-lg font-black text-slate-950">Realty Members</h2><p className="text-sm font-semibold text-slate-500">Rates are not repeated per seller because every member inherits the fixed rate for their role.</p></div>
              <label className="relative block w-full lg:max-w-md"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setMemberPage(1) }} placeholder="Search seller, role, or reporting parent..." className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50"><tr>{['Seller', 'Role', 'Reports Under', 'Status'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedMembers.map((member) => {
                    const isHead = Number(member.user_id) === Number(group.headUserId)
                    const parent = member.parent_accredited_seller_id ? memberById.get(Number(member.parent_accredited_seller_id)) : null
                    return (
                      <tr key={member.accredited_seller_id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-black text-slate-950">{member.display_name}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{roleLabel(member.role)}</td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{isHead ? 'Developer' : parent?.display_name || member.reports_under_name || 'Not assigned'}</td>
                        <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${member.accredited_seller_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.accredited_seller_status}</span></td>
                      </tr>
                    )
                  })}
                  {!filteredMembers.length ? <tr><td colSpan={4} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No members match your search.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {paginatedMembers.map((member) => {
                const isHead = Number(member.user_id) === Number(group.headUserId)
                const parent = member.parent_accredited_seller_id ? memberById.get(Number(member.parent_accredited_seller_id)) : null
                return (
                  <article key={member.accredited_seller_id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{member.display_name}</p><p className="text-xs font-semibold text-slate-500">{roleLabel(member.role)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${member.accredited_seller_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.accredited_seller_status}</span></div>
                    <p className="mt-3 text-xs font-bold text-slate-500">Reports under</p><p className="font-semibold text-slate-800">{isHead ? 'Developer' : parent?.display_name || member.reports_under_name || 'Not assigned'}</p>
                  </article>
                )
              })}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-500">Page {currentMemberPage} of {memberTotalPages} · {filteredMembers.length} member(s)</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={memberLimit} onChange={(event) => { setMemberLimit(Number(event.target.value)); setMemberPage(1) }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option></select>
                <button type="button" disabled={currentMemberPage <= 1} onClick={() => setMemberPage(Math.max(currentMemberPage - 1, 1))} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Previous</button>
                <button type="button" disabled={currentMemberPage >= memberTotalPages} onClick={() => setMemberPage(Math.min(currentMemberPage + 1, memberTotalPages))} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Next</button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {showCreateUser ? (
        <CreateUserModal
          setShowCreateUser={setShowCreateUser}
          allowedRoles={['broker_network_manager', 'broker', 'manager', 'agent']}
          actorRole={isAdmin ? 'admin' : 'super_admin'}
          initialSellerGroupId={String(group.id || groupId)}
          lockSellerGroup
          title={`Add User to ${pageTitle}`}
          onSaved={(message) => { setAlert({ type: 'success', message }); refreshConnectedQueries() }}
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
          onSaved={(message) => { setAlert({ type: 'success', message }); refreshConnectedQueries() }}
        />
      ) : null}
    </main>
  )
}

export default SellerGroupDetails
