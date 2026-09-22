import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import { CONFIGURABLE_SYSTEM_ROLES } from '../../../config/permissions'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import AdminProjectAccessFields from './AdminProjectAccessFields'
import PermissionMatrix from './PermissionMatrix'

const labels = { admin: 'Admin', marketing: 'Marketing', sales: 'Sales', accounting: 'Accounting', operations: 'Operations' }
const ChangePositionModal = ({ user, onClose, onSaved }) => {
  const choices = CONFIGURABLE_SYSTEM_ROLES.filter((r) => r !== user.role)
  const [role, setRole] = useState(choices[0] || 'marketing')
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [permissions, setPermissions] = useState([])
  const [reason, setReason] = useState('')
  const [alert, setAlert] = useState(null)
  const { data: roleData } = useQuery({ queryKey: ['role-access-defaults'], queryFn: () => useFetch('/user/access-control/roles') })
  const { data: projectData } = useQuery({ queryKey: ['lot-project-options'], queryFn: () => useFetch('/projects/lot-projects/options') })
  useEffect(() => { setPermissions(roleData?.defaults?.[role] || []) }, [role, roleData])
  const mutation = useMutation({ mutationFn: () => useFetchPost(`/user/change-position/${user.id}`, { new_role: role, all_projects_access: allProjects, project_ids: projectIds, permissions, reason }, { confirmationHandled: 'compact' }), onMutate: () => setAlert({ type: 'loading', message: 'Changing position and creating the replacement account...' }), onSuccess: (r) => { onSaved?.(r.message || 'Position changed successfully.'); onClose?.() }, onError: (e) => setAlert({ type: 'error', message: e.message }) })
  const toggleProject = (id) => setProjectIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])
  const submit = (e) => { e.preventDefault(); if (!allProjects && !projectIds.length) return setAlert({ type: 'error', message: 'Select All Projects or at least one project.' }); mutation.mutate() }
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4"><div className="mx-auto my-5 max-w-6xl rounded-3xl bg-white shadow-2xl"><div className="border-b p-5"><h2 className="text-xl font-black">Change Position / Create New Account</h2><p className="mt-1 text-sm text-slate-500">Current: {user.account_code || user.email} · {user.role.replaceAll('_',' ')}</p></div><form onSubmit={submit} className="grid gap-5 p-5">{alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">This is atomic: the current account is permanently deactivated only if the replacement account, permissions, and project scope are all created successfully. The old account can never be reactivated.</div><label className="grid gap-1.5 text-sm font-bold">New Position<select value={role} onChange={(e) => { setRole(e.target.value); setAllProjects(false); setProjectIds([]) }} className="h-11 rounded-xl border px-3">{choices.map((r) => <option key={r} value={r}>{labels[r]}</option>)}</select></label><label className="grid gap-1.5 text-sm font-bold">Reason *<textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-xl border p-3" placeholder="Reason for position change" /></label><AdminProjectAccessFields projects={projectData?.data || []} allProjects={allProjects} selectedProjectIds={projectIds} onAllProjectsChange={(checked) => { setAllProjects(checked); if (checked) setProjectIds([]) }} onProjectToggle={toggleProject} /><section><h3 className="mb-3 text-lg font-black">New Account Permissions</h3><PermissionMatrix catalog={roleData?.catalog || []} selected={permissions} onChange={setPermissions} /></section><div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-bold">Cancel</button><button type="submit" disabled={mutation.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">Deactivate Old & Create New</button></div></form></div></div>
}
export default ChangePositionModal
