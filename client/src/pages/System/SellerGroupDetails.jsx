import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowLeft,
  FiEdit2,
  FiPercent,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ConfirmActionModal from '../../components/Shared/ConfirmActionModal'
import CommissionRateModal from '../../components/System/sellerGroupComponents/CommissionRateModal'
import CreateDirectSalesAgentModal from '../../components/System/sellerGroupComponents/CreateDirectSalesAgentModal'
import EditGroupModal from '../../components/System/sellerGroupComponents/EditGroupModal'
import { useFetch, useFetchPatch, useFetchPost } from '../../utils/useFetch'

const roleLabel = (role = '') => ({
  broker_network_manager: 'Broker Network Manager',
  broker: 'Broker',
  manager: 'Manager',
  agent: 'Agent',
}[role] || String(role || 'Seller').replaceAll('_', ' '))

const RateBadge = ({ type, rate, status = 'active' }) => (
  <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-black ring-1 ${
    status === 'active'
      ? type === 'direct'
        ? 'bg-blue-50 text-blue-700 ring-blue-100'
        : 'bg-violet-50 text-violet-700 ring-violet-100'
      : 'bg-slate-100 text-slate-500 ring-slate-200'
  }`}>
    {type === 'direct' ? 'Direct' : 'Override'}: {Number(rate || 0).toFixed(2)}%
  </span>
)

const SummaryCard = ({ label, value, helper, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-white text-slate-950',
    blue: 'bg-blue-50 text-blue-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-800',
  }
  return (
    <div className={`rounded-2xl border border-slate-200 p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
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
  const [alert, setAlert] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [rateModal, setRateModal] = useState(null)
  const [dummyOwner, setDummyOwner] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [modalNotice, setModalNotice] = useState(null)

  const projectsQuery = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => useFetch('/projects/lot-projects/options'),
  })
  const projects = useMemo(() => projectsQuery.data?.data || [], [projectsQuery.data])
  const selectedProjectId = Number(searchParams.get('project') || 0)

  // Keep project selection in the URL so refresh and browser navigation preserve it.
  useEffect(() => {
    if (!projects.length) return
    const exists = projects.some((project) => Number(project.lot_project_id || project.id) === selectedProjectId)
    if (!exists) {
      const firstProjectId = Number(projects[0].lot_project_id || projects[0].id)
      setSearchParams({ project: String(firstProjectId) }, { replace: true })
    }
  }, [projects, selectedProjectId, setSearchParams])

  const configurationQuery = useQuery({
    queryKey: ['seller-group-project-configuration', Number(groupId), selectedProjectId],
    queryFn: () => useFetch(`/seller-groups/${groupId}/projects/${selectedProjectId}`),
    enabled: Boolean(groupId && selectedProjectId),
    keepPreviousData: true,
  })

  const configuration = configurationQuery.data?.data || null
  const group = configuration?.group || {}
  const project = configuration?.project || {}
  const members = useMemo(() => configuration?.members || [], [configuration])
  const overrides = useMemo(() => configuration?.overrides || [], [configuration])
  const validation = configuration?.validation || { paths: [], errorCount: 0 }
  const summary = configuration?.summary || {}

  const memberById = useMemo(
    () => new Map(members.map((member) => [Number(member.accredited_seller_id), member])),
    [members]
  )
  const overrideByRelationship = useMemo(
    () => new Map(overrides.map((item) => [
      `${Number(item.child_accredited_seller_id)}:${Number(item.parent_accredited_seller_id)}`,
      item,
    ])),
    [overrides]
  )
  const dummyOwnerIds = useMemo(
    () => new Set(members.filter((member) => member.is_system_dummy).map((member) => Number(member.dummy_owner_accredited_seller_id))),
    [members]
  )
  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase()
    if (!keyword) return members
    return members.filter((member) => [
      member.display_name,
      member.full_name,
      member.owner_name,
      member.reports_under_name,
      member.role,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)))
  }, [members, memberSearch])

  const refreshConnectedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-configuration', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
    queryClient.invalidateQueries({ queryKey: ['reservation-agents'] })
    queryClient.invalidateQueries({ queryKey: ['commission-preview'] })
  }

  const poolMutation = useMutation({
    mutationFn: ({ rate, status }) => useFetchPatch(`/seller-groups/${groupId}/projects/${selectedProjectId}/pool`, { poolRate: rate, status }),
    onMutate: () => setModalNotice({ type: 'loading', message: 'Saving project commission pool...' }),
    onSuccess: (result) => {
      setRateModal(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Project commission pool saved.' })
      refreshConnectedQueries()
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to save project commission pool.' }),
  })

  const directRateMutation = useMutation({
    mutationFn: ({ agentId, rate, status }) => useFetchPatch(`/seller-groups/${groupId}/projects/${selectedProjectId}/agents/${agentId}/direct-rate`, { directRate: rate, status }),
    onMutate: ({ status }) => setModalNotice({ type: 'loading', message: status === 'inactive' ? 'Removing agent direct rate...' : 'Saving agent direct rate...' }),
    onSuccess: (result) => {
      setRateModal(null)
      setConfirmAction(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Agent direct rate saved.' })
      refreshConnectedQueries()
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to save agent direct rate.' }),
  })

  const overrideMutation = useMutation({
    mutationFn: ({ childId, parentId, rate, status }) => useFetchPatch(`/seller-groups/${groupId}/projects/${selectedProjectId}/children/${childId}/override`, { parentId, overrideRate: rate, status }),
    onMutate: ({ status }) => setModalNotice({ type: 'loading', message: status === 'inactive' ? 'Removing hierarchy override...' : 'Saving hierarchy override...' }),
    onSuccess: (result) => {
      setRateModal(null)
      setConfirmAction(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Hierarchy override saved.' })
      refreshConnectedQueries()
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to save hierarchy override.' }),
  })

  const createDummyMutation = useMutation({
    mutationFn: ({ ownerId, directRate }) => useFetchPost(`/seller-groups/${groupId}/direct-sales-agents/${ownerId}`, { projectId: selectedProjectId, directRate }),
    onMutate: () => setModalNotice({ type: 'loading', message: 'Creating direct-sales agent...' }),
    onSuccess: (result) => {
      setDummyOwner(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Direct-sales agent created.' })
      refreshConnectedQueries()
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to create direct-sales agent.' }),
  })

  const dummyStatusMutation = useMutation({
    mutationFn: ({ dummyId, status }) => useFetchPatch(`/seller-groups/${groupId}/direct-sales-agents/${dummyId}/status`, { status }),
    onMutate: ({ status }) => setModalNotice({ type: 'loading', message: `${status === 'active' ? 'Activating' : 'Deactivating'} direct-sales agent...` }),
    onSuccess: (result) => {
      setConfirmAction(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Direct-sales agent status updated.' })
      refreshConnectedQueries()
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to update direct-sales agent.' }),
  })

  const openDirectRate = (member) => {
    setModalNotice(null)
    setRateModal({
      kind: 'direct',
      member,
      initialRate: member.direct_rate || 0,
      initialStatus: member.direct_rate_status || 'inactive',
    })
  }

  const openOverride = (child) => {
    const parent = child.parent_accredited_seller_id
      ? memberById.get(Number(child.parent_accredited_seller_id))
      : members.find((member) => Number(member.user_id) === Number(group.headUserId))
    if (!parent) {
      setAlert({ type: 'warning', message: `${child.display_name} has no parent seller. Set the reporting hierarchy first.` })
      return
    }
    const saved = overrideByRelationship.get(
      `${Number(child.accredited_seller_id)}:${Number(parent.accredited_seller_id)}`
    )
    setModalNotice(null)
    setRateModal({
      kind: 'override',
      child,
      parent,
      initialRate: saved?.override_rate || 0,
      initialStatus: saved?.override_rate_status || 'inactive',
    })
  }

  const isAnyMutationPending = poolMutation.isPending || directRateMutation.isPending || overrideMutation.isPending || createDummyMutation.isPending || dummyStatusMutation.isPending

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title={group.name || 'Seller Group'}
          description="Manage project commission pools, agent direct rates, relationship overrides, and direct-sales agents."
          icon={FiUsers}
        />
        <div className="grid gap-2 sm:grid-cols-3 xl:flex">
          <NavLink to={groupsPath} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft />Back to Seller Groups</NavLink>
          <button type="button" onClick={() => configurationQuery.refetch()} disabled={configurationQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FiRefreshCw className={configurationQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={() => setShowEditGroupModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"><FiEdit2 />Edit Group</button>
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} title={alert.title} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {projectsQuery.isLoading ? <StatusAlert type="loading" message="Loading active projects..." /> : null}
      {configurationQuery.isLoading ? <StatusAlert type="loading" message="Loading seller group and project rates..." /> : null}
      {!configurationQuery.isLoading && configurationQuery.isFetching ? <StatusAlert type="info" message={`Refreshing ${project.name || 'project'} commission configuration...`} /> : null}
      {configurationQuery.isError ? <StatusAlert type="error" message={configurationQuery.error?.message || 'Failed to load seller group configuration.'} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Group Head</p>
            <p className="mt-1 text-lg font-black text-slate-950">{group.headName || 'No group head assigned'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{group.description || 'No group description.'}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-slate-700">Project <span className="text-red-500">*</span></span>
            <select
              value={selectedProjectId || ''}
              onChange={(event) => {
                setSearchParams({ project: event.target.value })
                setMemberSearch('')
                setRateModal(null)
                setAlert({ type: 'info', message: 'Loading selected project rates...' })
              }}
              disabled={projectsQuery.isLoading || !projects.length}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
            >
              {!projects.length ? <option value="">No active lot projects</option> : null}
              {projects.map((item) => <option key={item.lot_project_id || item.id} value={item.lot_project_id || item.id}>{item.lot_project_name || item.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      {configuration ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Group Commission Pool" value={`${Number(configuration.poolRate || 0).toFixed(2)}%`} helper={project.name || 'Selected project'} tone="blue" />
            <SummaryCard label="Active Members" value={summary.activeMembers || 0} helper="Real and system sellers" />
            <SummaryCard label="Active Sales Agents" value={summary.activeAgents || 0} helper="Available after direct-rate setup" tone="emerald" />
            <SummaryCard label="Direct-Sales Agents" value={summary.directSalesAgents || 0} helper="Non-login system agents" tone="amber" />
            <SummaryCard label="Paths With Errors" value={summary.invalidPaths || 0} helper="Must be fixed before reservation" tone={summary.invalidPaths ? 'red' : 'emerald'} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-black text-slate-950">Project Commission Pool</h2><p className="text-sm font-semibold text-slate-500">Maximum total direct and override allocation for {project.name}.</p></div>
              <button type="button" onClick={() => { setModalNotice(null); setRateModal({ kind: 'pool', initialRate: configuration.poolRate, initialStatus: configuration.poolRateStatus }) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100"><FiPercent />Edit Pool</button>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {validation.paths.length ? validation.paths.map((path) => (
                <div key={path.agentId} className={`rounded-xl border p-4 ${path.hasErrors ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{path.agentName}</p><p className="text-xs font-semibold text-slate-500">{path.chain.length} commission recipient(s)</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${path.hasErrors ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{path.hasErrors ? 'Needs setup' : 'Valid'}</span></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs font-bold text-slate-500">Allocated</p><p className="font-black text-slate-950">{path.allocatedRate.toFixed(2)}%</p></div><div><p className="text-xs font-bold text-slate-500">Unallocated</p><p className="font-black text-slate-950">{path.unallocatedRate.toFixed(2)}%</p></div></div>
                  {path.errors.map((message) => <p key={message} className="mt-2 text-xs font-bold text-red-700">{message}</p>)}
                </div>
              )) : <p className="text-sm font-semibold text-slate-500">No active agent paths are configured for this project.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-lg font-black text-slate-950">Hierarchy, Direct Rates, and Overrides</h2><p className="text-sm font-semibold text-slate-500">Agents receive direct rates. Managers, brokers, and BNM receive relationship overrides.</p></div>
              <label className="relative block w-full lg:max-w-md"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search member, owner, role, or reports under..." className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1320px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Seller', 'Role', 'Reports Under', 'Direct Rate', 'Parent Override', 'Status', 'Actions'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((member) => {
                    const isGroupHead = Number(member.user_id) === Number(group.headUserId)
                    const parent = member.parent_accredited_seller_id
                      ? memberById.get(Number(member.parent_accredited_seller_id))
                      : !isGroupHead
                        ? members.find((candidate) => Number(candidate.user_id) === Number(group.headUserId))
                        : null
                    const savedOverride = parent
                      ? overrideByRelationship.get(`${Number(member.accredited_seller_id)}:${Number(parent.accredited_seller_id)}`)
                      : null
                    const canCreateDummy = member.role !== 'agent'
                      && !member.is_system_dummy
                      && !dummyOwnerIds.has(Number(member.accredited_seller_id))

                    return (
                      <tr key={member.accredited_seller_id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <p className="font-black text-slate-950">{member.display_name}</p>
                          {member.is_system_dummy ? <p className="mt-1 text-xs font-bold text-blue-600">System agent · Owner: {member.owner_name}</p> : null}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{member.is_system_dummy ? 'System Agent' : roleLabel(member.role)}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-700">{parent?.display_name || member.reports_under_name || (isGroupHead ? 'Developer' : group.headName || 'Not assigned')}</p>
                          <p className="text-xs text-slate-500">{isGroupHead ? 'Top of seller hierarchy' : parent ? 'Direct parent relationship' : 'Reporting parent required'}</p>
                        </td>
                        <td className="px-4 py-4">
                          {member.role === 'agent'
                            ? <RateBadge type="direct" rate={member.direct_rate} status={member.direct_rate_status || 'inactive'} />
                            : <span className="text-xs font-bold text-slate-400">Agents only</span>}
                        </td>
                        <td className="px-4 py-4">
                          {isGroupHead
                            ? <span className="text-xs font-bold text-slate-400">No parent override</span>
                            : savedOverride
                              ? <div><RateBadge type="override" rate={savedOverride.override_rate} status={savedOverride.override_rate_status} /><p className="mt-1 text-[11px] font-semibold text-slate-500">Paid to {parent?.display_name || savedOverride.parent_name}</p></div>
                              : <div><span className="text-xs font-bold text-amber-700">Not configured</span><p className="mt-1 text-[11px] font-semibold text-slate-500">Paid to {parent?.display_name || 'direct parent'}</p></div>}
                        </td>
                        <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${member.accredited_seller_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.accredited_seller_status}</span></td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {member.role === 'agent' ? <button type="button" onClick={() => openDirectRate(member)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiEdit2 />Direct Rate</button> : null}
                            {member.role === 'agent' && member.direct_rate_status === 'active' ? <button type="button" onClick={() => { setModalNotice(null); setConfirmAction({ type: 'remove-direct', member }) }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100"><FiTrash2 />Remove Direct</button> : null}
                            {!isGroupHead ? <button type="button" onClick={() => openOverride(member)} disabled={!parent} className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"><FiEdit2 />Parent Override</button> : null}
                            {!isGroupHead && savedOverride?.override_rate_status === 'active' ? <button type="button" onClick={() => { setModalNotice(null); setConfirmAction({ type: 'remove-override', member, parent, override: savedOverride }) }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100"><FiTrash2 />Remove Override</button> : null}
                            {canCreateDummy ? <button type="button" onClick={() => { setModalNotice(null); setDummyOwner(member) }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiUserPlus />Create Sales Agent</button> : null}
                            {member.is_system_dummy ? <button type="button" onClick={() => { setModalNotice(null); setConfirmAction({ type: 'dummy-status', member, status: member.accredited_seller_status === 'active' ? 'inactive' : 'active' }) }} className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-100">{member.accredited_seller_status === 'active' ? 'Deactivate' : 'Activate'}</button> : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!filteredMembers.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No members match your search.</td></tr> : null}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {filteredMembers.map((member) => {
                const isGroupHead = Number(member.user_id) === Number(group.headUserId)
                const parent = member.parent_accredited_seller_id
                  ? memberById.get(Number(member.parent_accredited_seller_id))
                  : !isGroupHead
                    ? members.find((candidate) => Number(candidate.user_id) === Number(group.headUserId))
                    : null
                const savedOverride = parent
                  ? overrideByRelationship.get(`${Number(member.accredited_seller_id)}:${Number(parent.accredited_seller_id)}`)
                  : null
                const canCreateDummy = member.role !== 'agent'
                  && !member.is_system_dummy
                  && !dummyOwnerIds.has(Number(member.accredited_seller_id))

                return (
                  <article key={member.accredited_seller_id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-black text-slate-950">{member.display_name}</p><p className="text-xs font-semibold text-slate-500">{member.is_system_dummy ? `System Agent · Owner: ${member.owner_name}` : roleLabel(member.role)}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${member.accredited_seller_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{member.accredited_seller_status}</span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-slate-500">Reports under</p>
                    <p className="font-semibold text-slate-800">{parent?.display_name || member.reports_under_name || (isGroupHead ? 'Developer' : group.headName || 'Not assigned')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {member.role === 'agent' ? <RateBadge type="direct" rate={member.direct_rate} status={member.direct_rate_status || 'inactive'} /> : null}
                      {!isGroupHead && savedOverride ? <RateBadge type="override" rate={savedOverride.override_rate} status={savedOverride.override_rate_status} /> : null}
                      {!isGroupHead && !savedOverride ? <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">Parent override not configured</span> : null}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {member.role === 'agent' ? <button type="button" onClick={() => openDirectRate(member)} className="h-10 rounded-xl border border-blue-200 bg-blue-50 text-sm font-black text-blue-700">Edit Direct Rate</button> : null}
                      {!isGroupHead ? <button type="button" onClick={() => openOverride(member)} disabled={!parent} className="h-10 rounded-xl border border-violet-200 bg-violet-50 text-sm font-black text-violet-700 disabled:opacity-40">Edit Parent Override</button> : null}
                      {!isGroupHead && savedOverride?.override_rate_status === 'active' ? <button type="button" onClick={() => { setModalNotice(null); setConfirmAction({ type: 'remove-override', member, parent, override: savedOverride }) }} className="h-10 rounded-xl border border-red-200 bg-red-50 text-sm font-black text-red-700">Remove Override</button> : null}
                      {canCreateDummy ? <button type="button" onClick={() => { setModalNotice(null); setDummyOwner(member) }} className="h-10 rounded-xl bg-blue-600 text-sm font-black text-white">Create Direct-Sales Agent</button> : null}
                      {member.is_system_dummy ? <button type="button" onClick={() => { setModalNotice(null); setConfirmAction({ type: 'dummy-status', member, status: member.accredited_seller_status === 'active' ? 'inactive' : 'active' }) }} className="h-10 rounded-xl border border-slate-300 bg-white text-sm font-black text-slate-700">{member.accredited_seller_status === 'active' ? 'Deactivate' : 'Activate'}</button> : null}
                    </div>
                  </article>
                )
              })}
              {!filteredMembers.length ? <p className="py-8 text-center text-sm font-semibold text-slate-500">No members match your search.</p> : null}
            </div>
          </section>
        </>
      ) : null}

      <CommissionRateModal
        open={Boolean(rateModal)}
        kind={rateModal?.kind}
        projectName={project.name}
        sellerName={rateModal?.member?.display_name}
        parentName={rateModal?.parent?.display_name}
        childName={rateModal?.child?.display_name}
        initialRate={rateModal?.initialRate}
        isPending={isAnyMutationPending}
        notice={modalNotice}
        onClose={() => { if (!isAnyMutationPending) { setRateModal(null); setModalNotice(null) } }}
        onSubmit={({ rate, status }) => {
          if (rateModal?.kind === 'pool') poolMutation.mutate({ rate, status: 'active' })
          if (rateModal?.kind === 'direct') directRateMutation.mutate({ agentId: rateModal.member.accredited_seller_id, rate, status })
          if (rateModal?.kind === 'override') overrideMutation.mutate({ childId: rateModal.child.accredited_seller_id, parentId: rateModal.parent.accredited_seller_id, rate, status })
        }}
      />

      <CreateDirectSalesAgentModal
        open={Boolean(dummyOwner)}
        owner={dummyOwner}
        project={project}
        isPending={createDummyMutation.isPending}
        notice={modalNotice}
        onClose={() => { if (!createDummyMutation.isPending) { setDummyOwner(null); setModalNotice(null) } }}
        onSubmit={({ directRate }) => createDummyMutation.mutate({ ownerId: dummyOwner.accredited_seller_id, directRate })}
      />


      {showEditGroupModal && configuration ? (
        <EditGroupModal
          setShowEditGroupModal={setShowEditGroupModal}
          selectedGroup={{
            seller_group_id: group.id,
            seller_group_name: group.name,
            seller_group_head_user_id: group.headUserId,
            seller_group_description: group.description,
            seller_group_status: group.status,
          }}
          onSaved={(message) => {
            setAlert({ type: 'success', message })
            refreshConnectedQueries()
          }}
        />
      ) : null}

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'remove-direct' ? 'Remove Direct Rate?' : confirmAction?.type === 'remove-override' ? 'Remove Parent Override?' : `${confirmAction?.status === 'active' ? 'Activate' : 'Deactivate'} Direct-Sales Agent?`}
        message={confirmAction?.type === 'remove-direct'
          ? `${confirmAction?.member?.display_name} will no longer appear in the ${project.name} reservation agent selector. Existing commission records will not change.`
          : confirmAction?.type === 'remove-override'
            ? `${confirmAction?.parent?.display_name || 'The parent seller'} will stop receiving an override from ${confirmAction?.member?.display_name} for ${project.name}. Existing commission records will not change.`
            : `${confirmAction?.member?.display_name} will ${confirmAction?.status === 'active' ? 'be available' : 'no longer be selectable'} for new reservations. Existing records will remain available.`}
        confirmLabel={confirmAction?.type === 'remove-direct' ? 'Remove Rate' : confirmAction?.type === 'remove-override' ? 'Remove Override' : confirmAction?.status === 'active' ? 'Activate' : 'Deactivate'}
        tone={confirmAction?.type === 'remove-direct' || confirmAction?.type === 'remove-override' || confirmAction?.status === 'inactive' ? 'danger' : 'primary'}
        isPending={directRateMutation.isPending || overrideMutation.isPending || dummyStatusMutation.isPending}
        notice={modalNotice}
        onClose={() => { if (!isAnyMutationPending) { setConfirmAction(null); setModalNotice(null) } }}
        onConfirm={() => {
          if (confirmAction?.type === 'remove-direct') directRateMutation.mutate({ agentId: confirmAction.member.accredited_seller_id, rate: Number(confirmAction.member.direct_rate || 0), status: 'inactive' })
          if (confirmAction?.type === 'remove-override') overrideMutation.mutate({ childId: confirmAction.member.accredited_seller_id, parentId: confirmAction.parent.accredited_seller_id, rate: Number(confirmAction.override?.override_rate || 0), status: 'inactive' })
          if (confirmAction?.type === 'dummy-status') dummyStatusMutation.mutate({ dummyId: confirmAction.member.accredited_seller_id, status: confirmAction.status })
        }}
      />
    </main>
  )
}

export default SellerGroupDetails
