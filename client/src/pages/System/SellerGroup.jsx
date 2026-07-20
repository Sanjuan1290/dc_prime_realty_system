import { useState } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FaUserPlus } from 'react-icons/fa'
import { FiChevronDown, FiEdit2, FiEye, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ConfirmActionModal from '../../components/Shared/ConfirmActionModal'
import NewGroupModal from '../../components/System/sellerGroupComponents/NewGroupModal'
import EditGroupModal from '../../components/System/sellerGroupComponents/EditGroupModal'
import { useFetch as fetchJson, useFetchPatch as patchJson } from '../../utils/useFetch'

const rateLabel = (rate) => rate.lot_project_location_code || rate.lot_project_name || `Project ${rate.lot_project_id}`

const FixedRateCard = ({ rate }) => (
  <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
    <p className="text-xs font-black text-blue-900">
      {rateLabel(rate)} · Pool {Number(rate.seller_group_pool_rate || 0).toFixed(2)}%
    </p>
    <p className="mt-1 text-[11px] font-semibold text-blue-700">
      BNM {Number(rate.bnm_override_rate || 0).toFixed(2)}% · Broker {Number(rate.broker_override_rate || 0).toFixed(2)}% · Manager {Number(rate.manager_override_rate || 0).toFixed(2)}% · Agent {Number(rate.agent_rate || 0).toFixed(2)}%
    </p>
  </div>
)

const ProjectRatesCell = ({ rates = [], selectedProjectId = 'all' }) => {
  if (!rates.length) return <p className="text-xs font-semibold text-slate-500">No accredited projects</p>

  if (selectedProjectId !== 'all') {
    const selectedRate = rates.find((rate) => Number(rate.lot_project_id) === Number(selectedProjectId))
    return selectedRate
      ? <FixedRateCard rate={selectedRate} />
      : <p className="text-xs font-semibold text-slate-500">Not accredited to this project</p>
  }

  const preview = rates.slice(0, 2)
  const extraCount = Math.max(rates.length - preview.length, 0)

  return (
    <div className="min-w-[260px]">
      <p className="text-xs font-black text-slate-900">{rates.length} accredited project{rates.length === 1 ? '' : 's'}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {preview.map(rateLabel).join(', ')}{extraCount ? ` +${extraCount} more` : ''}
      </p>
      {extraCount ? (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-black text-blue-700 hover:text-blue-800">
            View all projects <FiChevronDown className="transition group-open:rotate-180" />
          </summary>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
            {rates.map((rate) => (
              <p key={rate.lot_project_id} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 odd:bg-white">
                {rateLabel(rate)}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

const SellerGroup = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const isAdmin = location.pathname.startsWith('/admin/')
  const usersPath = isAdmin ? '/admin/users' : '/super_admin/users'
  const groupBasePath = isAdmin ? '/admin/users/seller_group' : '/super_admin/users/seller_group'
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [confirmGroup, setConfirmGroup] = useState(null)
  const [alert, setAlert] = useState(null)
  const [modalNotice, setModalNotice] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const projectFilter = searchParams.get('project') || 'all'

  const queryString = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(projectFilter !== 'all' ? { project: projectFilter } : {}),
  }).toString()

  const groupsQuery = useQuery({
    queryKey: ['seller-groups', queryString],
    queryFn: () => fetchJson(`/seller-groups?${queryString}`),
    keepPreviousData: true,
  })

  const projectOptionsQuery = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => fetchJson('/projects/lot-projects/options'),
  })

  const sellerGroups = groupsQuery.data?.data || []
  const projectOptions = projectOptionsQuery.data?.data || []
  const selectedProject = projectOptions.find((project) => Number(project.lot_project_id) === Number(projectFilter))
  const pagination = groupsQuery.data?.pagination || { page, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
  const meta = groupsQuery.data?.meta || { active: 0, totalMembers: 0, accreditedProjects: 0 }

  const updateProjectFilter = (value) => {
    const nextParams = new URLSearchParams(searchParams)
    if (value === 'all') nextParams.delete('project')
    else nextParams.set('project', value)
    setSearchParams(nextParams, { replace: true })
    setPage(1)
  }

  const groupDetailsUrl = (groupId) => {
    const suffix = projectFilter !== 'all' ? `?project=${encodeURIComponent(projectFilter)}` : ''
    return `${groupBasePath}/${groupId}${suffix}`
  }

  const toggleMutation = useMutation({
    mutationFn: (group) => patchJson(`/seller-groups/toggle-status/${group.seller_group_id}`, {
      status: group.seller_group_status === 'active' ? 'inactive' : 'active',
    }),
    onMutate: (group) => setModalNotice({
      type: 'loading',
      message: `${group.seller_group_status === 'active' ? 'Deactivating' : 'Activating'} seller group...`,
    }),
    onSuccess: (result) => {
      setConfirmGroup(null)
      setModalNotice(null)
      setAlert({ type: 'success', message: result?.message || 'Seller group status updated.' })
      queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-options'] })
    },
    onError: (error) => setModalNotice({ type: 'error', message: error?.message || 'Failed to update Realty.' }),
  })

  const openEdit = (group) => {
    setSelectedGroup(group)
    setShowEditGroupModal(true)
  }

  const handleSaved = (message) => {
    setAlert({ type: 'success', message })
    queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
    queryClient.invalidateQueries({ queryKey: ['seller-group-options'] })
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: ['accredited'] })
  }

  const projectColumnLabel = selectedProject
    ? `${selectedProject.lot_project_location_code || selectedProject.lot_project_name} Fixed Rates`
    : 'Accredited Projects'

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Realties" description="Manage Realty groups, accredited projects, and fixed commission rates by role." icon={FaUserPlus} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <NavLink to={usersPath} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">Back to Users</NavLink>
          <button type="button" onClick={() => setShowNewGroupModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"><FiPlus />New Realty</button>
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {groupsQuery.isLoading ? <StatusAlert type="loading" message="Loading Realties..." /> : null}
      {!groupsQuery.isLoading && groupsQuery.isFetching ? <StatusAlert type="info" message="Refreshing Realties..." /> : null}
      {groupsQuery.isError ? <StatusAlert type="error" message={groupsQuery.error?.message || 'Failed to load Realties.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Realties</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{pagination.total}</h3><p className="mt-2 text-sm text-slate-500">{selectedProject ? `Accredited to ${selectedProject.lot_project_name}` : 'All Realty records'}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Active Realties</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{meta.active}</h3><p className="mt-2 text-sm text-slate-500">Available for assignments</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Members</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{meta.totalMembers}</h3><p className="mt-2 text-sm text-slate-500">Members across groups</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Project Accreditations</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{meta.accreditedProjects}</h3><p className="mt-2 text-sm text-slate-500">Active group-project assignments</p></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-lg font-bold text-slate-950">Realty Records</h2><p className="text-sm text-slate-500">Choose a project to see every accredited Realty and that project’s fixed role rates.</p></div>
          <div className="grid gap-3 md:grid-cols-[minmax(230px,1fr)_minmax(180px,auto)_auto_auto]">
            <label className="relative block"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search group, head, or description..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            <select value={projectFilter} onChange={(event) => updateProjectFilter(event.target.value)} disabled={projectOptionsQuery.isLoading} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"><option value="all">All Projects</option>{projectOptions.map((project) => <option key={project.lot_project_id} value={project.lot_project_id}>{project.lot_project_name}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
            <button type="button" onClick={() => groupsQuery.refetch()} disabled={groupsQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FiRefreshCw className={groupsQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-[1050px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50"><tr>{['Group', 'Head', 'Members', projectColumnLabel, 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {sellerGroups.map((group) => (
                <tr key={group.seller_group_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4"><p className="font-bold text-slate-950">{group.seller_group_name}</p><p className="text-xs text-slate-500">{group.seller_group_description || 'No description'}</p></td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{group.group_head_name || 'No head'}</td>
                  <td className="px-4 py-4 font-bold text-slate-950">{group.member_count} <span className="text-xs font-semibold text-slate-500">({group.active_member_count} active)</span></td>
                  <td className="px-4 py-4"><ProjectRatesCell rates={group.project_rates} selectedProjectId={projectFilter} /></td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${group.seller_group_status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{group.seller_group_status}</span></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => navigate(groupDetailsUrl(group.seller_group_id))} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><FiEye />Open</button><button type="button" onClick={() => openEdit(group)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100"><FiEdit2 />Edit</button><button type="button" onClick={() => { setConfirmGroup(group); setModalNotice(null) }} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${group.seller_group_status === 'active' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}><FiTrash2 />{group.seller_group_status === 'active' ? 'Deactivate' : 'Activate'}</button></div></td>
                </tr>
              ))}
              {!groupsQuery.isLoading && !sellerGroups.length ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">{selectedProject ? `No Realties are accredited to ${selectedProject.lot_project_name}.` : 'No Realties found.'}</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {sellerGroups.map((group) => <article key={group.seller_group_id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{group.seller_group_name}</p><p className="text-xs font-semibold text-slate-500">Head: {group.group_head_name || 'No head'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${group.seller_group_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{group.seller_group_status}</span></div><div className="mt-3"><ProjectRatesCell rates={group.project_rates} selectedProjectId={projectFilter} /></div><p className="mt-3 text-sm font-semibold text-slate-600">{group.member_count} member(s), {group.active_member_count} active</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => navigate(groupDetailsUrl(group.seller_group_id))} className="h-10 rounded-xl bg-blue-600 text-sm font-black text-white">Open Realty</button><button type="button" onClick={() => openEdit(group)} className="h-10 rounded-xl border border-slate-300 text-sm font-black text-slate-700">Edit</button></div></article>)}
          {!groupsQuery.isLoading && !sellerGroups.length ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No Realties found.</p> : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} group(s)</p><div className="flex flex-wrap items-center gap-2"><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option></select><button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Previous</button><button type="button" disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold disabled:opacity-40">Next</button></div></div>
      </section>

      {showNewGroupModal ? <NewGroupModal setShowNewGroupModal={setShowNewGroupModal} onSaved={handleSaved} /> : null}
      {showEditGroupModal && selectedGroup ? <EditGroupModal setShowEditGroupModal={setShowEditGroupModal} selectedGroup={selectedGroup} onSaved={handleSaved} /> : null}

      <ConfirmActionModal
        open={Boolean(confirmGroup)}
        title={`${confirmGroup?.seller_group_status === 'active' ? 'Deactivate' : 'Activate'} Realty?`}
        message={`${confirmGroup?.seller_group_name || 'This group'} will ${confirmGroup?.seller_group_status === 'active' ? 'stop accepting new seller assignments and reservations' : 'be available for new assignments again'}. Existing records will remain available.`}
        confirmLabel={confirmGroup?.seller_group_status === 'active' ? 'Deactivate' : 'Activate'}
        tone={confirmGroup?.seller_group_status === 'active' ? 'danger' : 'primary'}
        isPending={toggleMutation.isPending}
        notice={modalNotice}
        onClose={() => { if (!toggleMutation.isPending) { setConfirmGroup(null); setModalNotice(null) } }}
        onConfirm={() => toggleMutation.mutate(confirmGroup)}
      />
    </main>
  )
}

export default SellerGroup
