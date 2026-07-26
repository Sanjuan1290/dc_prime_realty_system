import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiDollarSign, FiEdit2, FiRefreshCw, FiSearch, FiShoppingBag, FiTrendingUp, FiUserPlus, FiUsers } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import EditGroupModal from '../../components/System/sellerGroupComponents/EditGroupModal'
import CreateUserModal from '../../components/System/userComponents/CreateUserModal'
import EditUserModal from '../../components/System/userComponents/EditUserModal'
import { getSellerRoleLabel } from '../../config/sellerRoles'
import { useFetch as fetchJson } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value || 0))
const toDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const defaultRange = () => ({ from: toDateInput(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)), to: toDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)) })

const SummaryCard = ({ icon: Icon, label, value, helper }) => <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon /></span></div></article>
const RateCard = ({ label, value, helper }) => <article className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-800"><p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-2xl font-black">{Number(value || 0).toFixed(2)}%</p><p className="mt-1 text-xs font-semibold opacity-75">{helper}</p></article>

const SellerGroupDetails = ({ expectedGroupType }) => {
  const { groupId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const isAdmin = location.pathname.startsWith('/admin/')
  const rootPath = isAdmin ? '/admin' : '/super_admin'
  const [alert, setAlert] = useState(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [range, setRange] = useState(defaultRange)
  const selectedProjectId = Number(searchParams.get('project') || 0)

  const projectOptionsQuery = useQuery({ queryKey: ['seller-group-project-options', Number(groupId)], queryFn: () => fetchJson(`/seller-groups/${groupId}/projects`), enabled: Boolean(groupId) })
  const accreditedProjects = useMemo(() => projectOptionsQuery.data?.data || [], [projectOptionsQuery.data])
  const groupOption = projectOptionsQuery.data?.group || {}
  const groupType = groupOption.type || expectedGroupType || 'in_house'
  const isExternal = groupType === 'external'
  const groupsPath = `${rootPath}/users/groups/${isExternal ? 'external' : 'in-house'}`

  useEffect(() => {
    if (!accreditedProjects.length) return
    if (!accreditedProjects.some((project) => Number(project.lot_project_id) === selectedProjectId)) {
      setSearchParams({ project: String(accreditedProjects[0].lot_project_id) }, { replace: true })
    }
  }, [accreditedProjects, selectedProjectId, setSearchParams])

  const configurationQuery = useQuery({ queryKey: ['seller-group-project-configuration', Number(groupId), selectedProjectId], queryFn: () => fetchJson(`/seller-groups/${groupId}/projects/${selectedProjectId}`), enabled: Boolean(groupId && selectedProjectId), placeholderData: (previous) => previous })
  const analyticsQuery = useQuery({ queryKey: ['seller-group-project-analytics', Number(groupId), selectedProjectId, range.from, range.to], queryFn: () => fetchJson(`/seller-groups/${groupId}/projects/${selectedProjectId}/analytics?${new URLSearchParams(range)}`), enabled: Boolean(groupId && selectedProjectId && range.from && range.to), placeholderData: (previous) => previous })

  const configuration = configurationQuery.data?.data || null
  const group = configuration?.group || { id: Number(groupId), name: groupOption.name || 'Group', type: groupType, status: groupOption.status, projectRates: accreditedProjects }
  const project = configuration?.project || accreditedProjects.find((item) => Number(item.lot_project_id) === selectedProjectId) || {}
  const fixedRates = configuration?.fixedRates || {}
  const members = useMemo(() => (configuration?.members || []).filter((member) => !member.is_system_dummy), [configuration])
  const analytics = analyticsQuery.data?.data?.summary || {}
  const filteredMembers = useMemo(() => { const key = memberSearch.trim().toLowerCase(); return key ? members.filter((member) => `${member.display_name} ${member.full_name} ${member.role} ${member.reports_under_name}`.toLowerCase().includes(key)) : members }, [members, memberSearch])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-options', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-configuration', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-group-project-analytics', Number(groupId)] })
    queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
    queryClient.invalidateQueries({ queryKey: ['reservation-agents'] })
    queryClient.invalidateQueries({ queryKey: ['commission-preview'] })
  }

  const selectedGroupForEdit = {
    seller_group_id: group.id || Number(groupId),
    seller_group_type: group.type || groupType,
    seller_group_name: group.name || groupOption.name,
    seller_group_head_user_id: group.headUserId,
    seller_group_head_role: group.headRole,
    seller_group_description: group.description,
    seller_group_status: group.status || groupOption.status,
    seller_group_external_account_user_id: group.externalAccountUserId,
    external_account_user_id: group.externalAccountUserId,
    external_account_first_name: group.externalAccount?.firstName,
    external_account_middle_name: group.externalAccount?.middleName,
    external_account_last_name: group.externalAccount?.lastName,
    external_account_email: group.externalAccount?.email,
    external_account_contact_no: group.externalAccount?.contactNo,
    external_account_tin_no: group.externalAccount?.tinNo,
    external_account_prc_no: group.externalAccount?.prcNo,
    external_account_address: group.externalAccount?.address,
    project_rates: group.projectRates || accreditedProjects,
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-start gap-3"><NavLink to={groupsPath} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"><FiArrowLeft /></NavLink><PageHeader title={group.name || groupOption.name || (isExternal ? 'External Group' : 'In-House Group')} description={isExternal ? 'External partner account, project Pool Rates, sales, commissions, and releases.' : 'Internal hierarchy, fixed position rates, sales, commissions, and releases.'} icon={FiUsers} /></div><div className="flex flex-wrap gap-2"><button type="button" onClick={refresh} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"><FiRefreshCw />Refresh</button>{!isExternal ? <button type="button" onClick={() => setShowCreateUser(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700"><FiUserPlus />Add Member</button> : null}<button type="button" onClick={() => setShowEditGroupModal(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white"><FiEdit2 />Edit Group</button></div></div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      {projectOptionsQuery.isLoading || configurationQuery.isLoading ? <StatusAlert type="loading" message="Loading group details..." /> : null}
      {projectOptionsQuery.isError || configurationQuery.isError ? <StatusAlert type="error" message={projectOptionsQuery.error?.message || configurationQuery.error?.message || 'Failed to load group details.'} /> : null}
      {expectedGroupType && groupOption.type && expectedGroupType !== groupOption.type ? <StatusAlert type="error" message="This group was opened from the wrong group section." /> : null}

      {configuration ? <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs font-black uppercase text-slate-400">Group Type</p><p className="mt-1 font-black text-slate-950">{isExternal ? 'External Group' : 'In-House Group'}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Status</p><p className="mt-1 font-black capitalize text-slate-950">{group.status}</p></div><div><p className="text-xs font-black uppercase text-slate-400">{isExternal ? 'Representative' : 'Group Head'}</p><p className="mt-1 font-black text-slate-950">{isExternal ? group.externalAccount?.fullName || '-' : group.headName || 'No head assigned'}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Accredited Projects</p><p className="mt-1 font-black text-slate-950">{accreditedProjects.length}</p></div></div>{isExternal ? <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800"><p>{group.externalAccount?.email || '-'}</p><p>{group.externalAccount?.contactNo || '-'}</p><p>{group.externalAccount?.address || '-'}</p></div> : null}</section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-black text-slate-950">Project Commission Structure</h2><p className="text-sm font-semibold text-slate-500">{isExternal ? 'The full Pool Rate is paid to the External Group.' : 'The fixed position rates must equal the project Pool Rate.'}</p></div><select value={selectedProjectId || ''} onChange={(event) => setSearchParams({ project: event.target.value }, { replace: true })} className="h-11 min-w-[240px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-black"><option value="" disabled>Select project</option>{accreditedProjects.map((item) => <option key={item.lot_project_id} value={item.lot_project_id}>{item.lot_project_name}</option>)}</select></div><div className={`grid gap-4 p-4 ${isExternal ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-5'}`}><RateCard label="Pool Rate" value={fixedRates.poolRate} helper={project.lot_project_name || 'Selected project'} />{isExternal ? <RateCard label="External Group Rate" value={fixedRates.poolRate} helper="Full commission assigned to this group" /> : <><RateCard label="Division Manager Rate" value={fixedRates.divisionManagerRate} helper="Top in-house position" /><RateCard label="Sales Director Rate" value={fixedRates.salesDirectorRate} helper="Fixed override" /><RateCard label="Unit Manager Rate" value={fixedRates.unitManagerRate} helper="Fixed override" /><RateCard label="Sales Agent Rate" value={fixedRates.salesAgentRate} helper="Direct sales rate" /></>}</div></section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-black text-slate-950">Performance</h2><p className="text-sm font-semibold text-slate-500">Released commissions are grouped by actual release date.</p></div><div className="grid grid-cols-2 gap-2"><label className="grid gap-1"><span className="text-xs font-black text-slate-500">From</span><input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-black" /></label><label className="grid gap-1"><span className="text-xs font-black text-slate-500">To</span><input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-black" /></label></div></div><div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-6"><SummaryCard icon={FiUsers} label={isExternal ? 'Group Accounts' : 'Active Members'} value={isExternal ? 1 : configuration.summary?.activeMembers || 0} helper={isExternal ? 'One account' : 'Active in-house sellers'} /><SummaryCard icon={FiShoppingBag} label="Sales" value={analytics.salesCount || 0} helper="Reserved accounts" /><SummaryCard icon={FiDollarSign} label="Sales Value" value={money(analytics.salesAmount)} helper="Total contract price" /><SummaryCard icon={FiTrendingUp} label="Gross Commission" value={money(analytics.grossCommission)} helper="Accumulated commission" /><SummaryCard icon={FiDollarSign} label="Released" value={money(analytics.releasedCommission)} helper="Commission already paid" /><SummaryCard icon={FiDollarSign} label="Remaining" value={money(analytics.remainingCommission)} helper="Commission not yet released" /></div>{analyticsQuery.isLoading ? <div className="p-4"><StatusAlert type="loading" message="Loading performance..." /></div> : null}</section>

        {isExternal ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">External Group Account</h2><p className="mt-1 text-sm font-semibold text-slate-500">This single account receives all commissions for the group.</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs font-black text-slate-400">Name</p><p className="font-black">{group.externalAccount?.fullName || '-'}</p></div><div><p className="text-xs font-black text-slate-400">Email</p><p className="font-black">{group.externalAccount?.email || '-'}</p></div><div><p className="text-xs font-black text-slate-400">TIN</p><p className="font-black">{group.externalAccount?.tinNo || '-'}</p></div><div><p className="text-xs font-black text-slate-400">Login</p><p className="font-black">{group.externalAccount?.canLogin ? 'Enabled' : 'Disabled'}</p></div></div></section> : <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-black text-slate-950">In-House Members</h2><p className="text-sm font-semibold text-slate-500">Each member inherits the fixed project rate for their position.</p></div><label className="relative block w-full lg:max-w-md"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search member, role, or parent..." className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm font-semibold" /></label></div><div className="overflow-x-auto"><table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{['Seller', 'Position', 'Reports Under', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredMembers.map((member) => <tr key={member.accredited_seller_id}><td className="px-4 py-4 font-black">{member.display_name}</td><td className="px-4 py-4 font-semibold">{getSellerRoleLabel(member.role)}</td><td className="px-4 py-4 font-semibold">{member.reports_under_name || (Number(member.user_id) === Number(group.headUserId) ? 'Developer' : 'Not assigned')}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black capitalize text-emerald-700">{member.accredited_seller_status}</span></td><td className="px-4 py-4"><button type="button" onClick={() => setSelectedMember({ ...member, id: Number(member.user_id), status: member.user_status || member.accredited_seller_status, seller_group_id: Number(group.id || groupId), reports_under_user_id: member.accredited_seller_reports_under_user_id || '' })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black"><FiEdit2 />Edit User</button></td></tr>)}{!filteredMembers.length ? <tr><td colSpan={5} className="px-4 py-10 text-center font-semibold text-slate-500">No members found.</td></tr> : null}</tbody></table></div></section>}
      </> : null}

      {showCreateUser ? <CreateUserModal setShowCreateUser={setShowCreateUser} allowedRoles={['division_manager', 'sales_director', 'unit_manager', 'sales_agent']} actorRole={isAdmin ? 'admin' : 'super_admin'} initialSellerGroupId={String(group.id || groupId)} lockSellerGroup title={`Add User to ${group.name}`} onSaved={(message) => { setAlert({ type: 'success', message }); refresh() }} /> : null}
      {selectedMember ? <EditUserModal key={selectedMember.id} setShowEditUser={(open) => { if (!open) setSelectedMember(null) }} selectedUser={selectedMember} allowedRoles={['division_manager', 'sales_director', 'unit_manager', 'sales_agent']} actorRole={isAdmin ? 'admin' : 'super_admin'} initialSellerGroupId={String(group.id || groupId)} lockSellerGroup onSaved={(message) => { setSelectedMember(null); setAlert({ type: 'success', message }); refresh() }} /> : null}
      {showEditGroupModal ? <EditGroupModal setShowEditGroupModal={setShowEditGroupModal} selectedGroup={selectedGroupForEdit} groupType={groupType} onSaved={(message) => { setAlert({ type: 'success', message }); refresh() }} /> : null}
    </main>
  )
}

export default SellerGroupDetails

