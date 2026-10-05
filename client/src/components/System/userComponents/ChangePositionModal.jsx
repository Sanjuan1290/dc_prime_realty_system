import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import useCurrentUser from '../../../utils/useCurrentUser'
import StatusAlert from '../../Shared/StatusAlert'
import { ROLE_LABELS, SYSTEM_ADMIN_MANAGEABLE_ROLES, SYSTEM_USER_ROLES } from '../../../config/permissions'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import AdminProjectAccessFields from './AdminProjectAccessFields'

const ChangePositionModal = ({ user, onClose, onSaved }) => {
  const { data: me } = useCurrentUser()
  const actor = me?.user || {}
  const choices = useMemo(() => actor.role === 'super_admin'
    ? SYSTEM_USER_ROLES.filter((role) => !['super_admin'].includes(role))
    : SYSTEM_ADMIN_MANAGEABLE_ROLES, [actor.role])
  const firstChoice = choices.find((role) => role !== user.role) || choices[0] || ''
  const [role, setRole] = useState(firstChoice)
  const [reason, setReason] = useState('')
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [alert, setAlert] = useState(null)
  const forcedAll = role === 'auditor'
  const { data: projectData } = useQuery({ queryKey: ['lot-project-options'], queryFn: () => useFetch('/projects/lot-projects/options'), enabled: !forcedAll })
  const { data: preview } = useQuery({ queryKey: ['position-preview', user.id, role], queryFn: () => useFetch(`/user/${user.id}/change-position/preview?role=${encodeURIComponent(role)}`), enabled: Boolean(role && role !== user.role) })
  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/user/${user.id}/change-position`, { new_role: role, reason, all_projects_access: forcedAll ? true : allProjects, project_ids: forcedAll ? [] : projectIds }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Changing system role...' }),
    onSuccess: (result) => { onSaved?.(result.message); onClose?.() },
    onError: (e) => setAlert({ type: 'error', message: e.message }),
  })
  const submit = () => {
    if (reason.trim().length < 5) return setAlert({ type: 'error', message: 'Enter a clear reason for the role change.' })
    if (!forcedAll && !allProjects && !projectIds.length) return setAlert({ type: 'error', message: 'Select All Projects or at least one project.' })
    mutation.mutate()
  }
  return <div className="fixed inset-0 z-[85] overflow-y-auto bg-slate-950/55 p-4"><div className="mx-auto my-8 max-w-3xl rounded-3xl bg-white shadow-2xl">
    <header className="border-b border-slate-200 p-5"><h2 className="text-xl font-black">Change System Role</h2><p className="mt-1 text-sm font-semibold text-slate-500">Promote, demote, or transfer the same account. User ID, login, password, employee link, and account code are preserved.</p></header>
    <div className="grid gap-5 p-5">{alert ? <StatusAlert type={alert.type} message={alert.message} /> : null}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><div><p className="text-xs font-black uppercase text-slate-400">Current</p><p className="font-black">{ROLE_LABELS[user.role] || user.role}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Account retained</p><p className="font-mono font-black text-blue-700">{preview?.replacement?.account_code || user.account_code}</p></div></div>
      <label className="grid gap-1.5 text-sm font-black text-slate-700">New Role<select value={role} onChange={(e) => { setRole(e.target.value); setAllProjects(false); setProjectIds([]) }} className="h-11 rounded-xl border border-slate-200 px-3">{choices.filter((item) => item !== user.role).map((item) => <option key={item} value={item}>{ROLE_LABELS[item] || item}</option>)}</select></label>
      {forcedAll ? <StatusAlert type="info" message={`${ROLE_LABELS[role] || role} always has All Projects access.`} /> : <AdminProjectAccessFields allProjects={allProjects} setAllProjects={setAllProjects} projectIds={projectIds} setProjectIds={setProjectIds} projects={projectData?.data || []} />}
      <label className="grid gap-1.5 text-sm font-black text-slate-700">Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="3" className="rounded-xl border border-slate-200 p-3" placeholder="Example: Promoted to Accounting Head" /></label>
      <StatusAlert type="info" message="Open review work should be reassigned before demoting a Head. Existing sessions are invalidated after the change." />
    </div>
    <footer className="flex justify-end gap-2 border-t p-5"><button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-black">Cancel</button><button type="button" onClick={submit} disabled={mutation.isPending || !role} className="h-11 rounded-xl bg-violet-700 px-5 font-black text-white disabled:opacity-50">Confirm Role Change</button></footer>
  </div></div>
}
export default ChangePositionModal
