import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import useCurrentUser from '../../../utils/useCurrentUser'
import { ROLE_LABELS, SYSTEM_ADMIN_MANAGEABLE_ROLES, SYSTEM_USER_ROLES } from '../../../config/permissions'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import AdminProjectAccessFields from './AdminProjectAccessFields'
import PermissionMatrix from './PermissionMatrix'
import { DEPARTMENT_PRIORITY_GROUPS, getRoleDepartment } from '../../../utils/permissionMeta'

const initial = { first_name: '', middle_name: '', last_name: '', email: '', contact_no: '', tin_no: '', prc_no: '', address: '', role: 'marketing_staff', status: 'active' }
const steps = ['Personal Information', 'Role & Account Code', 'Permissions', 'Project Access', 'Final Review']
// Super Admin and System Admin are owner-level: full access, all projects.
// Auditor is global (all projects) but uses the normal permission grid.
const FULL_ACCESS_ROLES = ['super_admin', 'system_admin']
const GLOBAL_PROJECT_ROLES = ['super_admin', 'system_admin', 'auditor']
const sameSet = (left = [], right = []) => {
  const rightSet = new Set(right)
  return new Set(left).size === rightSet.size && left.every((key) => rightSet.has(key))
}

const CreateSystemUserModal = ({ onClose, onSaved }) => {
  const { data: me } = useCurrentUser()
  const actorRole = me?.user?.role
  const canCreateSystemUsers = ['super_admin', 'system_admin'].includes(actorRole)
  const [form, setForm] = useState(initial)
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [permissions, setPermissions] = useState([])
  const [customizing, setCustomizing] = useState(false)
  const [step, setStep] = useState(0)
  const [alert, setAlert] = useState(null)

  const allowedRoles = useMemo(() => actorRole === 'super_admin' ? SYSTEM_USER_ROLES : SYSTEM_ADMIN_MANAGEABLE_ROLES, [actorRole])
  const { data: roleData, isLoading: roleDataLoading, error: roleDataError } = useQuery({
    queryKey: ['role-access-defaults'],
    queryFn: () => useFetch('/user/access-control/roles'),
    enabled: canCreateSystemUsers,
  })
  const { data: projectData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => useFetch('/projects/lot-projects/options'),
    enabled: canCreateSystemUsers && !GLOBAL_PROJECT_ROLES.includes(form.role),
  })
  const { data: accountCodePreview, isFetching: previewLoading } = useQuery({
    queryKey: ['system-account-code-preview', form.role],
    queryFn: () => useFetch(`/user/account-code-preview?role=${encodeURIComponent(form.role)}`),
    enabled: canCreateSystemUsers && Boolean(form.role),
  })
  const emailAvailabilityMutation = useMutation({
    mutationFn: (email) => useFetch(`/user/email-availability?email=${encodeURIComponent(email)}`),
  })

  // Every non-owner role (Auditor included) starts from its saved role default.
  // Super Admin and System Admin have full access and no permission grid.
  useEffect(() => {
    setCustomizing(false)
    if (FULL_ACCESS_ROLES.includes(form.role)) {
      setPermissions([])
      return
    }
    setPermissions(roleData?.defaults?.[form.role] || [])
  }, [form.role, roleData])

  // Every permission is adjustable; the role default is the starting point and
  // anything beyond it is flagged as outside the normal role.
  const rolePolicy = roleData?.policies?.[form.role] || null
  const roleDefaults = roleData?.defaults?.[form.role] || []
  const recommendedSet = useMemo(() => new Set(rolePolicy?.recommended || roleDefaults), [rolePolicy, roleDefaults])
  const permissionLabelByKey = useMemo(() => Object.fromEntries((roleData?.catalog || []).flatMap((group) =>
    (group.items || []).map(([label, key]) => [key, `${group.group} → ${label}`])
  )), [roleData])
  // What the account will hold: exactly the selected permissions.
  const effectivePermissions = useMemo(() => {
    if (FULL_ACCESS_ROLES.includes(form.role)) return []
    return [...new Set(permissions)]
  }, [form.role, permissions])
  const usingRoleDefaults = sameSet(effectivePermissions, roleDefaults)
  const permissionCountLabel = `${effectivePermissions.length} permission${effectivePermissions.length === 1 ? '' : 's'}`

  const outsideNormalPermissions = useMemo(() => {
    if (!recommendedSet.size || FULL_ACCESS_ROLES.includes(form.role)) return []
    return effectivePermissions.filter((key) => !recommendedSet.has(key))
  }, [form.role, effectivePermissions, recommendedSet])

  const mutation = useMutation({
    mutationFn: () => useFetchPost('/user/createUser', {
      ...form,
      all_projects_access: GLOBAL_PROJECT_ROLES.includes(form.role) ? true : allProjects,
      project_ids: GLOBAL_PROJECT_ROLES.includes(form.role) ? [] : projectIds,
      ...(!FULL_ACCESS_ROLES.includes(form.role) ? { permissions } : {}),
    }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Creating system account...' }),
    onSuccess: (result) => {
      onSaved?.(`${result.message || 'User created successfully.'}${result.account_code ? ` Account Code: ${result.account_code}` : ''}`)
      onClose?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to create user.' }),
  })

  if (!canCreateSystemUsers) {
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4">
        <div className="mx-auto my-10 max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
          <StatusAlert type="error" message="Only Super Admin or System Admin can create internal system accounts. Only Super Admin can create System Admin accounts." />
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
    if (step === 1 && !FULL_ACCESS_ROLES.includes(form.role) && !roleData?.defaults?.[form.role]) {
      setAlert({ type: 'error', message: roleDataLoading ? 'Role default permissions are still loading. Try again in a moment.' : (roleDataError?.message || `Role default permissions for ${ROLE_LABELS[form.role] || form.role} could not be loaded.`) })
      return false
    }
    if (step === 3 && !GLOBAL_PROJECT_ROLES.includes(form.role) && !allProjects && projectIds.length === 0) {
      setAlert({ type: 'error', message: 'Select All Projects or at least one project.' })
      return false
    }
    return true
  }

  const next = async () => {
    setAlert(null)
    if (!validateStep()) return

    if (step === 0) {
      setAlert({ type: 'loading', message: 'Checking email availability...' })
      try {
        const result = await emailAvailabilityMutation.mutateAsync(form.email.trim())
        if (!result?.available) {
          setAlert({ type: 'error', message: result?.message || 'That email is already assigned to an active account. Use a different email address.' })
          return
        }
      } catch (error) {
        setAlert({ type: 'error', message: error?.message || 'Email availability could not be checked.' })
        return
      }
    }

    setAlert(null)
    setStep((current) => Math.min(steps.length - 1, current + 1))
  }
  const back = () => { setAlert(null); setStep((current) => Math.max(0, current - 1)) }
  const changeRole = (role) => {
    setField('role', role)
    setAllProjects(GLOBAL_PROJECT_ROLES.includes(role))
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
                  {allowedRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}
                </select>
              </label>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-blue-500">Account Code Preview</p>
                <p className="mt-2 font-mono text-2xl font-black text-blue-950">{previewLoading ? 'Generating…' : accountCodePreview?.account_code || 'Generating preview…'}</p>
                <p className="mt-2 text-xs font-semibold text-blue-700">Account codes use only the role abbreviation plus the Users table ID. Example: user ID 2 with the Sales role becomes SS-00002. The preview uses the database's current next user ID; the final code is rebuilt from the actual ID when the account is created.</p>
              </div>
              {FULL_ACCESS_ROLES.includes(form.role) ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{ROLE_LABELS[form.role]} always has Full System Access, All Projects, and every permission.{form.role === 'system_admin' ? ' Only Super Admin can create or manage System Admin accounts.' : ''}</div> : null}
            </section>
          ) : null}

          {step === 2 ? (
            FULL_ACCESS_ROLES.includes(form.role) ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="text-lg font-black">Full System Access</p><p className="mt-1 text-sm font-semibold">{ROLE_LABELS[form.role]} has every permission in the system. There is nothing to choose here.</p></div>
            ) : (
              <section className="grid gap-3">
                <div><h3 className="text-lg font-black">Permissions</h3><p className="text-sm font-semibold text-slate-500">Starts from the {ROLE_LABELS[form.role]} default. Any permission can be added or removed; anything outside the normal role is flagged. Changes apply to this new account only.</p></div>
                {!customizing ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div>
                      <p className="font-black text-blue-950">{usingRoleDefaults ? `Using ${ROLE_LABELS[form.role]} defaults` : `Customized from ${ROLE_LABELS[form.role]} defaults`}</p>
                      <p className="mt-1 text-sm font-semibold text-blue-800">{permissionCountLabel}{outsideNormalPermissions.length ? `, ${outsideNormalPermissions.length} outside the normal role` : ''}.</p>
                    </div>
                    <button type="button" onClick={() => setCustomizing(true)} className="h-10 rounded-xl border border-blue-300 bg-white px-4 text-sm font-black text-blue-700">Customize</button>
                  </div>
                ) : (
                  <PermissionMatrix
                    catalog={roleData?.catalog || []}
                    selected={permissions}
                    onChange={setPermissions}
                    policy={rolePolicy}
                    baseline={roleDefaults}
                    baselineLabel={`${ROLE_LABELS[form.role]} default`}
                    priorityGroups={DEPARTMENT_PRIORITY_GROUPS[getRoleDepartment(form.role)] || []}
                  />
                )}
              </section>
            )
          ) : null}

          {step === 3 ? (
            GLOBAL_PROJECT_ROLES.includes(form.role) ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="text-lg font-black">All Projects</p><p className="mt-1 text-sm font-semibold">Super Admin, System Admin and Auditor always receive All Projects access.</p></div>
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
                {reviewItem('Role', ROLE_LABELS[form.role])}
                {reviewItem('Account Code', accountCodePreview?.account_code || 'Generated at creation')}
                {reviewItem('Permissions', FULL_ACCESS_ROLES.includes(form.role) ? 'Full System Access' : `${permissionCountLabel}${usingRoleDefaults ? ' (role default)' : ' (customized)'}`)}
                {reviewItem('Project Scope', GLOBAL_PROJECT_ROLES.includes(form.role) || allProjects ? 'All Projects' : selectedProjectNames.join(', ') || `${projectIds.length} selected project(s)`)}
              </div>
              {outsideNormalPermissions.length ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="font-black text-amber-950">Additional / Cross-Department Permissions</p>
                <p className="mt-1 text-sm font-semibold text-amber-900">This account has {outsideNormalPermissions.length} permission{outsideNormalPermissions.length === 1 ? '' : 's'} outside the normal {ROLE_LABELS[form.role]} profile. These are allowed, but confirm they are intentional.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">{outsideNormalPermissions.map((key) => <div key={key} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-slate-800">{permissionLabelByKey[key] || key}</div>)}</div>
              </div> : null}
            </section>
          ) : null}

          <div className="flex justify-between gap-3 border-t border-slate-200 pt-4">
            <div>{step > 0 ? <button type="button" onClick={back} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-200 px-5 font-bold">Back</button> : null}</div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-200 px-5 font-bold">Cancel</button>
              {step < steps.length - 1 ? <button type="button" onClick={next} disabled={emailAvailabilityMutation.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">{emailAvailabilityMutation.isPending ? 'Checking Email…' : 'Next'}</button> : <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">Create Account</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateSystemUserModal

