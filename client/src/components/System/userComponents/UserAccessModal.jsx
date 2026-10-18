import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost, useFetchPut } from '../../../utils/useFetch'
import AdminProjectAccessFields from './AdminProjectAccessFields'
import PermissionMatrix from './PermissionMatrix'
import { DEPARTMENT_PRIORITY_GROUPS, getRoleDepartment } from '../../../utils/permissionMeta'

const UserAccessModal = ({ user, onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const [permissions, setPermissions] = useState([])
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [alert, setAlert] = useState(null)
  const { data: roleData } = useQuery({ queryKey: ['role-access-defaults'], queryFn: () => useFetch('/user/access-control/roles') })
  const { data: accessData, isLoading } = useQuery({ queryKey: ['user-access', user.id], queryFn: () => useFetch(`/user/access-control/users/${user.id}`) })
  // Super Admin and System Admin are owner-level (full access, all projects).
  const fullAccess = ['super_admin', 'system_admin'].includes(user.role)
  const forcedAllProjects = ['super_admin', 'system_admin', 'auditor'].includes(user.role)
  const { data: projectData } = useQuery({ queryKey: ['lot-project-options'], queryFn: () => useFetch('/projects/lot-projects/options'), enabled: !forcedAllProjects })

  useEffect(() => {
    if (!accessData?.user) return
    setPermissions(accessData.user.permissions || [])
    setAllProjects(Boolean(accessData.user.all_projects_access))
    setProjectIds(accessData.user.project_ids || [])
  }, [accessData])

  const save = useMutation({
    mutationFn: () => useFetchPut(`/user/access-control/users/${user.id}`, { permissions, all_projects_access: forcedAllProjects ? true : allProjects, project_ids: forcedAllProjects ? [] : projectIds }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving user access...' }),
    onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ['user-access', user.id] }); onSaved?.(result.message); onClose?.() },
    onError: (e) => setAlert({ type: 'error', message: e.message }),
  })
  const reset = useMutation({
    mutationFn: () => useFetchPost(`/user/access-control/users/${user.id}/apply-role-defaults`, {}, { confirmationHandled: 'compact' }),
    onSuccess: (result) => { setPermissions(result.permissions || []); setAlert({ type: 'success', message: result.message }) },
    onError: (e) => setAlert({ type: 'error', message: e.message }),
  })

  const locked = Boolean(accessData?.locked)
  const roleLabel = roleData?.roleLabels?.[user.role] || user.role
  const policy = accessData?.policy || roleData?.policies?.[user.role] || null

  return <div className="fixed inset-0 z-[85] overflow-y-auto bg-slate-950/55 p-4"><div className="mx-auto my-6 max-w-6xl rounded-3xl bg-white shadow-2xl">
    <header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-black">User Access — {user.full_name || user.email}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{roleLabel}</p></div><button type="button" onClick={onClose} className="rounded-xl px-3 py-2 font-black text-slate-500">✕</button></header>
    <div className="grid gap-5 p-5">
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading access..." /> : null}
      {locked ? <StatusAlert type="info" message="This account is governed at a higher authority level and cannot be edited by your account." /> : null}
      {!isLoading && accessData?.user ? <>
        {fullAccess ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="text-lg font-black">Full System Access · All Projects</p><p className="mt-1 text-sm font-semibold">{roleLabel} has every permission in the system.{user.role === 'system_admin' ? ' Only Super Admin can change a System Admin account.' : ''}</p></div> : <>
        {forcedAllProjects ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="font-black text-blue-950">All Projects</p><p className="mt-1 text-sm font-semibold text-blue-700">{roleLabel} always has global project scope.</p></div> : <AdminProjectAccessFields allProjects={allProjects} selectedProjectIds={projectIds} onAllProjectsChange={(checked) => { setAllProjects(checked); if (checked) setProjectIds([]) }} onProjectToggle={(id) => setProjectIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} projects={projectData?.data || []} disabled={locked} />}
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-slate-950">Permissions</p><p className="text-sm font-semibold text-slate-500">Every permission can be added or removed. Anything outside the {roleLabel} default is flagged.</p></div>{!locked ? <button type="button" onClick={() => reset.mutate()} disabled={reset.isPending} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">Apply Latest Role Default</button> : null}</div>
        <PermissionMatrix catalog={roleData?.catalog || []} selected={permissions} onChange={setPermissions} policy={policy} baseline={roleData?.defaults?.[user.role] || null} baselineLabel={`${roleLabel} default`} priorityGroups={DEPARTMENT_PRIORITY_GROUPS[getRoleDepartment(user.role)] || []} disabled={locked} />
        </>}
      </> : null}
    </div>
    <footer className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-5 font-black">Close</button>{!locked && !fullAccess ? <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">{save.isPending ? 'Saving...' : 'Save Access'}</button> : null}</footer>
  </div></div>
}
export default UserAccessModal


