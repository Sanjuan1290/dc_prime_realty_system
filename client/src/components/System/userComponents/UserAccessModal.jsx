import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost, useFetchPut } from '../../../utils/useFetch'
import AdminProjectAccessFields from './AdminProjectAccessFields'
import PermissionMatrix from './PermissionMatrix'

const UserAccessModal = ({ user, onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const [permissions, setPermissions] = useState([])
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [alert, setAlert] = useState(null)
  const { data: roleData } = useQuery({ queryKey: ['role-access-defaults'], queryFn: () => useFetch('/user/access-control/roles') })
  const { data: accessData, isLoading } = useQuery({ queryKey: ['user-access', user.id], queryFn: () => useFetch(`/user/access-control/users/${user.id}`) })
  const { data: projectData } = useQuery({ queryKey: ['lot-project-options'], queryFn: () => useFetch('/projects/lot-projects/options'), enabled: user.role !== 'super_admin' })
  useEffect(() => { if (accessData?.user) { setPermissions(accessData.user.permissions || []); setAllProjects(Boolean(accessData.user.all_projects_access)); setProjectIds((accessData.user.project_ids || []).map(Number)) } }, [accessData])
  const save = useMutation({ mutationFn: () => useFetchPut(`/user/access-control/users/${user.id}`, { permissions, all_projects_access: allProjects, project_ids: projectIds }, { confirmationHandled: 'compact' }), onMutate: () => setAlert({ type: 'loading', message: 'Saving account access...' }), onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['users'] }); onSaved?.(r.message || 'User access updated.'); onClose?.() }, onError: (e) => setAlert({ type: 'error', message: e.message }) })
  const applyDefaults = useMutation({ mutationFn: () => useFetchPost(`/user/access-control/users/${user.id}/apply-role-defaults`, {}, { confirmationHandled: 'compact' }), onSuccess: (r) => { setPermissions(r.permissions || []); setAlert({ type: 'success', message: r.message }) }, onError: (e) => setAlert({ type: 'error', message: e.message }) })
  const toggleProject = (id) => setProjectIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])
  const locked = Boolean(accessData?.locked || user.role === 'super_admin')
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4"><div className="mx-auto my-5 max-w-6xl rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-black">User Access</h2><p className="text-sm text-slate-500">{user.account_code || user.email}</p></div><button onClick={onClose} type="button" className="px-3 py-2 font-black">✕</button></div><div className="grid gap-5 p-5">{alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}{isLoading ? <StatusAlert type="loading" message="Loading account access..." /> : null}{locked ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">Super Admin permissions cannot be restricted. Full System Access and All Projects are permanently enabled.</div> : <><div className="flex justify-end"><button type="button" onClick={() => applyDefaults.mutate()} disabled={applyDefaults.isPending} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">Apply Current {user.role.replaceAll('_',' ')} Defaults</button></div><AdminProjectAccessFields projects={projectData?.data || []} allProjects={allProjects} selectedProjectIds={projectIds} onAllProjectsChange={(checked) => { setAllProjects(checked); if (checked) setProjectIds([]) }} onProjectToggle={toggleProject} /><PermissionMatrix catalog={roleData?.catalog || []} selected={permissions} onChange={setPermissions} /></>}<div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-bold">Close</button>{!locked ? <button type="button" onClick={() => save.mutate()} disabled={save.isPending || (!allProjects && projectIds.length === 0)} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">Save Access</button> : null}</div></div></div></div>
}
export default UserAccessModal
