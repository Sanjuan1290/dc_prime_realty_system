import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import useCurrentUser from '../../../utils/useCurrentUser'
import { CONFIGURABLE_SYSTEM_ROLES } from '../../../config/permissions'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import AdminProjectAccessFields from './AdminProjectAccessFields'
import PermissionMatrix from './PermissionMatrix'

const roleLabels = { super_admin: 'Super Admin', admin: 'Admin', marketing: 'Marketing', sales: 'Sales', accounting: 'Accounting', operations: 'Operations' }
const initial = { first_name: '', middle_name: '', last_name: '', email: '', contact_no: '', tin_no: '', prc_no: '', address: '', role: 'marketing', status: 'active' }

const CreateSystemUserModal = ({ onClose, onSaved }) => {
  const { data: me } = useCurrentUser()
  const isSuperAdmin = me?.user?.role === 'super_admin'
  const [form, setForm] = useState(initial)
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [permissions, setPermissions] = useState([])
  const [alert, setAlert] = useState(null)

  const { data: roleData } = useQuery({
    queryKey: ['role-access-defaults'],
    queryFn: () => useFetch('/user/access-control/roles'),
    enabled: isSuperAdmin,
  })
  const { data: projectData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => useFetch('/projects/lot-projects/options'),
    enabled: form.role !== 'super_admin',
  })
  const allowedRoles = useMemo(() => isSuperAdmin ? ['super_admin', ...CONFIGURABLE_SYSTEM_ROLES] : CONFIGURABLE_SYSTEM_ROLES, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin || form.role === 'super_admin') return
    setPermissions(roleData?.defaults?.[form.role] || [])
  }, [form.role, isSuperAdmin, roleData])

  const mutation = useMutation({
    mutationFn: () => useFetchPost('/user/createUser', {
      ...form,
      all_projects_access: form.role === 'super_admin' ? true : allProjects,
      project_ids: form.role === 'super_admin' ? [] : projectIds,
      ...(isSuperAdmin && form.role !== 'super_admin' ? { permissions } : {}),
    }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Creating system account...' }),
    onSuccess: (result) => {
      onSaved?.(`${result.message || 'User created successfully.'}${result.account_code ? ` Account Code: ${result.account_code}` : ''}`)
      onClose?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to create user.' }),
  })

  const submit = (event) => {
    event.preventDefault()
    if (form.role !== 'super_admin' && !allProjects && projectIds.length === 0) {
      setAlert({ type: 'error', message: 'Select All Projects or at least one project.' })
      return
    }
    mutation.mutate()
  }

  const toggleProject = (id) => setProjectIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  const input = (name, label, required = false, type = 'text') => (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">{label}{required ? ' *' : ''}<input type={type} required={required} value={form[name]} onChange={(e) => setForm((v) => ({ ...v, [name]: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-300" /></label>
  )

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4">
      <div className="mx-auto my-6 max-w-5xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-xl font-black">Create System User</h2><p className="text-sm text-slate-500">Role defaults become this account's starting permissions.</p></div><button type="button" onClick={onClose} className="rounded-xl px-3 py-2 font-black text-slate-500">✕</button></div>
        <form onSubmit={submit} className="grid gap-5 p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
          <div className="grid gap-4 md:grid-cols-2">{input('first_name','First Name',true)}{input('last_name','Last Name',true)}{input('middle_name','Middle Name')}{input('email','Email',true,'email')}{input('contact_no','Contact No.')}{input('tin_no','TIN')}{input('prc_no','PRC No.')}{input('address','Address')}</div>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">Role *<select value={form.role} onChange={(e) => { setForm((v) => ({ ...v, role: e.target.value })); setAllProjects(e.target.value === 'super_admin'); setProjectIds([]) }} className="h-11 rounded-xl border border-slate-200 px-3">{allowedRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          {form.role === 'super_admin' ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Super Admin is always Full System Access, All Projects, and every permission. It cannot be restricted.</div> : (
            <AdminProjectAccessFields projects={projectData?.data || []} allProjects={allProjects} selectedProjectIds={projectIds} onAllProjectsChange={(checked) => { setAllProjects(checked); if (checked) setProjectIds([]) }} onProjectToggle={toggleProject} canSelectAllProjects={Boolean(me?.user?.role === 'super_admin' || me?.user?.all_projects_access)} isLoading={projectsLoading} error={projectsError?.message || ''} />
          )}
          {isSuperAdmin && form.role !== 'super_admin' && roleData?.catalog ? <section><h3 className="mb-3 text-lg font-black">Account Permissions</h3><PermissionMatrix catalog={roleData.catalog} selected={permissions} onChange={setPermissions} /></section> : null}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-5 font-bold">Cancel</button><button type="submit" disabled={mutation.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">Create Account</button></div>
        </form>
      </div>
    </div>
  )
}

export default CreateSystemUserModal
