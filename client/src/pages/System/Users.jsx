import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FaUserPlus } from 'react-icons/fa'
import { FiEdit2, FiKey, FiLock, FiPlus, FiRefreshCw, FiSearch, FiShield, FiShuffle, FiUserCheck, FiUsers } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import useCurrentUser from '../../utils/useCurrentUser'
import { formatDateTime } from '../../utils/formatDateTime'
import { useFetch as fetchApi } from '../../utils/useFetch'
import { PERMISSIONS, hasPermission, SYSTEM_USER_ROLES } from '../../config/permissions'
import CreateSystemUserModal from '../../components/System/userComponents/CreateSystemUserModal'
import EditSystemUserModal from '../../components/System/userComponents/EditSystemUserModal'
import UserAccessModal from '../../components/System/userComponents/UserAccessModal'
import ChangePositionModal from '../../components/System/userComponents/ChangePositionModal'
import DeactivateSystemUserModal from '../../components/System/userComponents/DeactivateSystemUserModal'

const roleLabels = { super_admin: 'Super Admin', admin: 'Admin', marketing: 'Marketing', sales: 'Sales', accounting: 'Accounting', operations: 'Operations' }

const Users = () => {
  const { data: currentUserData } = useCurrentUser()
  const actor = currentUserData?.user || {}
  const isSuperAdmin = actor.role === 'super_admin'
  const canCreate = hasPermission(actor, PERMISSIONS.SYSTEM_USERS_CREATE)
  const canEdit = hasPermission(actor, PERMISSIONS.SYSTEM_USERS_EDIT)
  const canDeactivate = hasPermission(actor, PERMISSIONS.SYSTEM_USERS_DEACTIVATE)
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [alert, setAlert] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const queryString = new URLSearchParams({ page: String(page), limit: String(limit), ...(search.trim() ? { search: search.trim() } : {}), ...(roleFilter !== 'all' ? { role: roleFilter } : {}), ...(statusFilter !== 'all' ? { status: statusFilter } : {}) }).toString()
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({ queryKey: ['users', queryString], queryFn: () => fetchApi(`/user/getUsers?${queryString}`), keepPreviousData: true })
  const users = data?.data || []
  const summary = data?.summary || { total: 0, active: 0, inactive: 0, mustChangePassword: 0 }
  const pagination = data?.pagination || { page, limit, total: 0, totalPages: 1, hasNext: false, hasPrev: false }

  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['users'] }); queryClient.invalidateQueries({ queryKey: ['currentUser'] }) }
  const saved = (message) => { setAlert({ type: 'success', message }); refresh() }


  const open = (type, user = null) => { setSelectedUser(user); setModal(type) }
  const close = () => { setModal(null); setSelectedUser(null) }
  const stats = [
    ['Total System Users', summary.total, FiUsers], ['Active', summary.active, FiUserCheck], ['Permanently Deactivated', summary.inactive, FiShield], ['Password Change Required', summary.mustChangePassword, FiKey],
  ]

  return <main className="flex flex-col gap-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><PageHeader title="System Users" description="Super Admin, Admin, Marketing, Sales, Accounting, and Operations accounts. Accredited sellers are managed separately." icon={FaUserPlus} /><div className="flex gap-2"><button type="button" onClick={() => refetch()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold"><FiRefreshCw className={isFetching ? 'animate-spin' : ''} />Refresh</button>{isSuperAdmin && canCreate ? <button type="button" onClick={() => open('create')} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 font-black text-white"><FiPlus />Create System User</button> : null}</div></div>
    {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
    {isLoading ? <StatusAlert type="loading" message="Loading system users..." /> : null}{isError ? <StatusAlert type="error" message={error?.message || 'Failed to load users.'} /> : null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label,value,Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon /></span></div></div>)}</section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_auto_auto]"><label className="relative"><FiSearch className="absolute left-3 top-3.5 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search name, email, account code..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3" /></label><select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }} className="h-11 rounded-xl border px-3"><option value="all">All Roles</option>{SYSTEM_USER_ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="h-11 rounded-xl border px-3"><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Deactivated</option></select></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Project Scope</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{!users.length && !isLoading ? <tr><td colSpan="6" className="p-10 text-center text-slate-500">No system users found.</td></tr> : users.map((user) => <tr key={user.id} className="align-top"><td className="px-4 py-4"><p className="font-black text-slate-900">{user.full_name}</p><p className="mt-1 font-mono text-xs font-bold text-blue-700">{user.account_code || 'Legacy account'}</p><p className="mt-1 text-xs text-slate-500">{user.email}</p></td><td className="px-4 py-4 font-bold">{roleLabels[user.role] || user.role}</td><td className="px-4 py-4"><span className="font-semibold">{user.role === 'super_admin' || user.all_projects_access ? 'All Projects' : (user.admin_projects || []).map((p) => p.name).join(', ') || 'No Projects'}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{user.status === 'active' ? 'Active' : 'Deactivated'}</span>{user.deactivated_at ? <p className="mt-2 text-xs text-slate-500">{formatDateTime(user.deactivated_at)}</p> : null}</td><td className="px-4 py-4 text-xs text-slate-500">{formatDateTime(user.created_at)}</td><td className="px-4 py-4"><div className="flex min-w-[260px] flex-wrap justify-end gap-2">{canEdit && user.status === 'active' && user.role !== 'super_admin' ? <button onClick={() => open('edit',user)} className="rounded-lg border px-3 py-2 font-bold"><FiEdit2 className="inline" /> Edit</button> : null}{isSuperAdmin && user.status === 'active' ? <button onClick={() => open('access',user)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-bold text-blue-700"><FiLock className="inline" /> Access</button> : null}{isSuperAdmin && user.status === 'active' && !['super_admin'].includes(user.role) ? <button onClick={() => open('position',user)} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 font-bold text-violet-700"><FiShuffle className="inline" /> Change Position</button> : null}{canDeactivate && user.status === 'active' && user.id !== actor.id ? <button onClick={() => open('deactivate', user)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-bold text-red-700"><FiShield className="inline" /> Deactivate</button> : null}</div></td></tr>)}</tbody></table></div>
      <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between"><p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</p><div className="flex gap-2"><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} className="h-10 rounded-xl border px-3"><option>10</option><option>25</option><option>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((p) => Math.max(1,p-1))} className="h-10 rounded-xl border px-4 font-bold disabled:opacity-40">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((p) => p+1)} className="h-10 rounded-xl border px-4 font-bold disabled:opacity-40">Next</button></div></div>
    </section>
    {modal === 'create' ? <CreateSystemUserModal onClose={close} onSaved={saved} /> : null}
    {modal === 'edit' && selectedUser ? <EditSystemUserModal user={selectedUser} onClose={close} onSaved={saved} /> : null}
    {modal === 'access' && selectedUser ? <UserAccessModal user={selectedUser} onClose={close} onSaved={saved} /> : null}
    {modal === 'position' && selectedUser ? <ChangePositionModal user={selectedUser} onClose={close} onSaved={saved} /> : null}
    {modal === 'deactivate' && selectedUser ? <DeactivateSystemUserModal user={selectedUser} onClose={close} onSaved={saved} /> : null}
  </main>
}
export default Users

