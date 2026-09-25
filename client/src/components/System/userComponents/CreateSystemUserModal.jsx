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
const steps = ['Personal Information', 'Role & Account Code', 'Permissions', 'Project Access', 'Final Review']

const CreateSystemUserModal = ({ onClose, onSaved }) => {
  const { data: me } = useCurrentUser()
  const isSuperAdmin = me?.user?.role === 'super_admin'
  const [form, setForm] = useState(initial)
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [permissions, setPermissions] = useState([])
  const [step, setStep] = useState(0)
  const [alert, setAlert] = useState(null)

  const allowedRoles = useMemo(() => ['super_admin', ...CONFIGURABLE_SYSTEM_ROLES], [])
  const { data: roleData } = useQuery({
    queryKey: ['role-access-defaults'],
    queryFn: () => useFetch('/user/access-control/roles'),
    enabled: isSuperAdmin,
  })
  const { data: projectData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => useFetch('/projects/lot-projects/options'),
    enabled: isSuperAdmin && form.role !== 'super_admin',
  })
  const { data: accountCodePreview, isFetching: previewLoading } = useQuery({
    queryKey: ['system-account-code-preview', form.last_name, form.role],
    queryFn: () => useFetch(`/user/account-code-preview?last_name=${encodeURIComponent(form.last_name.trim())}&role=${encodeURIComponent(form.role)}`),
    enabled: isSuperAdmin && Boolean(form.last_name.trim()) && Boolean(form.role),
  })

  useEffect(() => {
    if (form.role === 'super_admin') {
      setPermissions([])
      return
    }
    setPermissions(roleData?.defaults?.[form.role] || [])
  }, [form.role, roleData])

  const mutation = useMutation({
    mutationFn: () => useFetchPost('/user/createUser', {
      ...form,
      all_projects_access: form.role === 'super_admin' ? true : allProjects,
      project_ids: form.role === 'super_admin' ? [] : projectIds,
      ...(form.role !== 'super_admin' ? { permissions } : {}),
    }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Creating system account...' }),
    onSuccess: (result) => {
      onSaved?.(`${result.message || 'User created successfully.'}${result.account_code ? ` Account Code: ${result.account_code}` : ''}`)
      onClose?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to create user.' }),
  })

  if (!isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4">
        <div className="mx-auto my-10 max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
          <StatusAlert type="error" message="Only Super Admin can create internal system accounts because permissions and project scope are assigned during creation." />
          <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-bold">Close</button></div>
        </div>
      </div>
    )
  }

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  const toggleProject = (id) => setProjectIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  const selectedProjectNames = (projectData?.data || [])
    .filter((project) => projectIds.includes(Number(project.id || project.value || project.lot_project_id)))
    .map((project) => project.name || project.label || project.lot_project_name)
    .filter(Boolean)

  const input = (name, label, required = false, type = 'text') => (
    <label className="grid gap-1.5 text-sm font-bold text-slate-700">
      {label}{required ? ' *' : ''}
      <input type={type} required={required} value={form[name]} onChange={(e) => setField(name, e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-300" />
    </label>
  )

  const validateStep = () => {
    if (step === 0 && (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim())) {
      setAlert({ type: 'error', message: 'First name, last name, and email are required.' })
      return false
    }
    if (step === 3 && form.role !== 'super_admin' && !allProjects && projectIds.length === 0) {
      setAlert({ type: 'error', message: 'Select All Projects or at least one project.' })
      return false
    }
    return true
  }

  const next = () => {
    setAlert(null)
    if (!validateStep()) return
    setStep((current) => Math.min(steps.length - 1, current + 1))
  }
  const back = () => { setAlert(null); setStep((current) => Math.max(0, current - 1)) }
  const changeRole = (role) => {
    setField('role', role)
    setAllProjects(role === 'super_admin')
    setProjectIds([])
  }

  const reviewItem = (label, value) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value || '—'}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4">
      <div className="mx-auto my-6 max-w-6xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><h2 className="text-xl font-black">Create System User</h2><p className="text-sm text-slate-500">Create the account from role defaults, then customize its authoritative permissions and project scope.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 font-black text-slate-500">✕</button>
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <div className="grid gap-2 md:grid-cols-5">
            {steps.map((label, index) => (
              <div key={label} className={`rounded-xl border px-3 py-2 text-xs font-black ${index === step ? 'border-blue-300 bg-blue-50 text-blue-700' : index < step ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
                <span className="mr-1">{index + 1}.</span>{label}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}

          {step === 0 ? (
            <section className="grid gap-4 md:grid-cols-2">
              {input('first_name', 'First Name', true)}
              {input('last_name', 'Last Name', true)}
              {input('middle_name', 'Middle Name')}
              {input('email', 'Email', true, 'email')}
              {input('contact_no', 'Contact No.')}
              {input('tin_no', 'TIN')}
              {input('prc_no', 'PRC No.')}
              {input('address', 'Address')}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="grid gap-5">
              <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                Role *
                <select value={form.role} onChange={(e) => changeRole(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3">
                  {allowedRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </select>
              </label>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-blue-500">Account Code Preview</p>
                <p className="mt-2 font-mono text-2xl font-black text-blue-950">{previewLoading ? 'Generating…' : accountCodePreview?.account_code || 'Enter a last name to preview'}</p>
                <p className="mt-2 text-xs font-semibold text-blue-700">The final code is reserved when the account is created. A collision suffix may change if another matching account is created first.</p>
              </div>
              {form.role === 'super_admin' ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Super Admin is always Full System Access, All Projects, and every valid permission. It cannot be restricted.</div> : null}
            </section>
          ) : null}

          {step === 2 ? (
            form.role === 'super_admin' ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="text-lg font-black">Full System Access</p><p className="mt-1 text-sm font-semibold">Permission customization is skipped for Super Admin.</p></div>
            ) : (
              <section className="grid gap-3">
                <div><h3 className="text-lg font-black">Customize Permissions</h3><p className="text-sm font-semibold text-slate-500">Loaded from the current {roleLabels[form.role]} role default. Changes here apply only to this new account.</p></div>
                <PermissionMatrix catalog={roleData?.catalog || []} selected={permissions} onChange={setPermissions} />
              </section>
            )
          ) : null}

          {step === 3 ? (
            form.role === 'super_admin' ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="text-lg font-black">All Projects</p><p className="mt-1 text-sm font-semibold">Project-scope selection is skipped for Super Admin.</p></div>
            ) : (
              <AdminProjectAccessFields projects={projectData?.data || []} allProjects={allProjects} selectedProjectIds={projectIds} onAllProjectsChange={(checked) => { setAllProjects(checked); if (checked) setProjectIds([]) }} onProjectToggle={toggleProject} canSelectAllProjects isLoading={projectsLoading} error={projectsError?.message || ''} />
            )
          ) : null}

          {step === 4 ? (
            <section className="grid gap-5">
              <div><h3 className="text-lg font-black">Final Review</h3><p className="text-sm font-semibold text-slate-500">Review the permanent role/account identity and starting access before creating the account.</p></div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {reviewItem('Name', [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' '))}
                {reviewItem('Email', form.email)}
                {reviewItem('Role', roleLabels[form.role])}
                {reviewItem('Account Code', accountCodePreview?.account_code || 'Generated at creation')}
                {reviewItem('Permissions', form.role === 'super_admin' ? 'Full System Access' : `${permissions.length} permissions`)}
                {reviewItem('Project Scope', form.role === 'super_admin' || allProjects ? 'All Projects' : selectedProjectNames.join(', ') || `${projectIds.length} selected project(s)`)}
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Role and account code become immutable account identity. A later position change creates a new historical account instead of rewriting this one.</div>
            </section>
          ) : null}

          <div className="flex justify-between gap-3 border-t border-slate-200 pt-4">
            <div>{step > 0 ? <button type="button" onClick={back} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-200 px-5 font-bold">Back</button> : null}</div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-200 px-5 font-bold">Cancel</button>
              {step < steps.length - 1 ? <button type="button" onClick={next} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white">Next</button> : <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">Create Account</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateSystemUserModal
