import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import PermissionMatrix from '../userComponents/PermissionMatrix'
import { useFetch, useFetchPut } from '../../../utils/useFetch'
import { cleanPermissionLabel, DEPARTMENT_PRIORITY_GROUPS, getRoleDepartment } from '../../../utils/permissionMeta'

const groups = [
  ['SYSTEM', ['system_admin']],
  ['AUDIT', ['auditor']],
  ['MARKETING', ['marketing_staff', 'marketing_head']],
  ['SALES', ['sales_staff', 'sales_head']],
  ['ACCOUNTING', ['accounting_staff', 'accounting_head']],
  ['OPERATIONS', ['operations_staff', 'operations_head']],
  ['OWNER', ['super_admin']],
]

const sameSet = (left = [], right = []) => left.length === right.length && left.every((key) => right.includes(key))

// Effective permissions of a role: its saved (or in-progress) defaults plus
// whatever its policy makes Required or Inherited, limited to its ceiling.
const effectiveFor = (role, data, overrideSelected = null) => {
  const policy = data?.policies?.[role] || {}
  const ceiling = policy.ceiling ? new Set(policy.ceiling) : null
  const keys = new Set([...(overrideSelected ?? data?.defaults?.[role] ?? []), ...(policy.required || []), ...(policy.inherited || [])])
  return new Set([...keys].filter((key) => !ceiling || ceiling.has(key)))
}

// Plan item 33: Staff vs Head side by side for one department.
const StaffHeadComparison = ({ data, department, editingRole, selected, roleLabels }) => {
  const staffRole = `${department}_staff`
  const headRole = `${department}_head`
  const staff = effectiveFor(staffRole, data, editingRole === staffRole ? selected : null)
  const head = effectiveFor(headRole, data, editingRole === headRole ? selected : null)
  const rows = (data?.catalog || []).flatMap((group) => (group.items || [])
    .filter(([, key]) => staff.has(key) || head.has(key))
    .map(([label, key]) => ({ group: group.group, label: cleanPermissionLabel(label), key, staff: staff.has(key), head: head.has(key) })))
  const differences = rows.filter((row) => row.staff !== row.head)
  return <div className="rounded-2xl border border-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
      <p className="font-black text-slate-900">{roleLabels[staffRole] || staffRole} compared with {roleLabels[headRole] || headRole}</p>
      <p className="text-sm font-semibold text-slate-500">{differences.length} difference{differences.length === 1 ? '' : 's'} out of {rows.length} granted permissions</p>
    </div>
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="sticky top-0 bg-white text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-2">Permission</th><th className="px-4 py-2 text-center">{roleLabels[staffRole] || 'Staff'}</th><th className="px-4 py-2 text-center">{roleLabels[headRole] || 'Head'}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.key} className={`border-t border-slate-100 ${row.staff !== row.head ? 'bg-amber-50' : ''}`}>
          <td className="px-4 py-2"><span className="font-semibold text-slate-800">{row.label}</span><span className="ml-2 text-xs font-semibold text-slate-400">{row.group}</span></td>
          <td className="px-4 py-2 text-center font-black">{row.staff ? <span className="text-emerald-700">Yes</span> : <span className="text-slate-300">No</span>}</td>
          <td className="px-4 py-2 text-center font-black">{row.head ? <span className="text-emerald-700">Yes</span> : <span className="text-slate-300">No</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}

const RoleAccessControl = () => {
  const queryClient = useQueryClient()
  const [role, setRole] = useState('accounting_staff')
  const [selected, setSelected] = useState([])
  const [alert, setAlert] = useState(null)
  const [pendingRole, setPendingRole] = useState(null)
  const [view, setView] = useState('edit')
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['role-access-defaults'], queryFn: () => useFetch('/user/access-control/roles') })
  const roleLabels = data?.roleLabels || {}
  const available = useMemo(() => new Set([...(data?.roles || []), 'super_admin']), [data])
  const policy = data?.policies?.[role] || null
  const editable = (data?.editableRoles || []).includes(role)
  const savedDefaults = useMemo(() => data?.defaults?.[role] || [], [data, role])
  const isDirty = editable && !sameSet(selected, savedDefaults)
  const department = getRoleDepartment(role)
  const hasDepartmentPair = ['marketing', 'sales', 'accounting', 'operations'].includes(department)
  const effectiveCount = role === 'super_admin' ? null : effectiveFor(role, data, selected).size

  useEffect(() => {
    if (!data) return
    if (!available.has(role)) setRole(data.roles?.[0] || 'super_admin')
  }, [data, role, available])
  useEffect(() => setSelected(savedDefaults), [savedDefaults])

  // Plan item 34: never lose unsaved changes by switching roles.
  const requestRole = (nextRole) => {
    if (nextRole === role) return
    if (isDirty) { setPendingRole(nextRole); return }
    setRole(nextRole); setAlert(null)
    if (!['marketing', 'sales', 'accounting', 'operations'].includes(getRoleDepartment(nextRole))) setView('edit')
  }
  const discardAndSwitch = () => {
    setSelected(savedDefaults)
    const nextRole = pendingRole
    setPendingRole(null)
    if (nextRole) { setRole(nextRole); setAlert(null) }
  }

  const save = useMutation({
    mutationFn: () => useFetchPut(`/user/access-control/roles/${role}`, { permissions: selected }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: `Saving ${roleLabels[role] || role} defaults...` }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result.message }); queryClient.invalidateQueries({ queryKey: ['role-access-defaults'] }) },
    onError: (e) => setAlert({ type: 'error', message: e.message }),
  })

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 pb-0 shadow-sm">
    {/* The page card above already carries the "Role & Access Control" title (plan item 31). */}
    <p className="text-sm font-semibold text-slate-500">Staff permissions, Head inheritance, Auditor read-only policy, and System Admin governance are enforced by the server.</p>
    {alert ? <div className="mt-4"><StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /></div> : null}
    {isLoading ? <div className="mt-4"><StatusAlert type="loading" message="Loading role defaults..." /></div> : null}
    {isError ? <div className="mt-4"><StatusAlert type="error" message={error?.message || 'Failed to load role defaults.'} /></div> : null}
    {!isLoading && data ? <div className="mt-5 grid gap-5 pb-5">
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{groups.map(([group, roles]) => {
        const visible = roles.filter((item) => available.has(item))
        if (!visible.length) return null
        return <div key={group} className="rounded-2xl border border-slate-200 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-400">{group}</p><div className="flex flex-wrap gap-2">{visible.map((item) => <button key={item} type="button" onClick={() => requestRole(item)} aria-pressed={role === item} className={`rounded-xl px-3 py-2 text-xs font-black ${role === item ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'}`}>{roleLabels[item] || item}{role === item && isDirty ? ' •' : ''}</button>)}</div></div>
      })}</div>

      {pendingRole ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        <span>You have unsaved changes to {roleLabels[role] || role}. Discard them and open {roleLabels[pendingRole] || pendingRole}?</span>
        <span className="flex gap-2"><button type="button" onClick={() => setPendingRole(null)} className="h-10 rounded-xl border border-amber-300 bg-white px-4 font-black">Keep editing</button><button type="button" onClick={discardAndSwitch} className="h-10 rounded-xl bg-amber-600 px-4 font-black text-white">Discard and switch</button></span>
      </div> : null}

      {role === 'super_admin' ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="text-lg font-black">Owner / Emergency Full Access</p><p className="mt-1 text-sm font-semibold">Super Admin remains the break-glass fallback. Its permissions and project scope cannot be restricted.</p></div> : <>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{editable ? 'Editing' : 'Viewing'}</p>
            <h3 className="text-xl font-black text-slate-950">{roleLabels[role] || role} <span className="text-base font-bold text-slate-500">({effectiveCount} permission{effectiveCount === 1 ? '' : 's'})</span></h3>
            {policy?.parentRole ? <p className="mt-1 text-sm font-semibold text-blue-700">Inherits everything from {roleLabels[policy.parentRole] || policy.parentRole}.</p> : null}
          </div>
          {hasDepartmentPair ? <div className="flex rounded-xl border border-slate-300 bg-white p-1 text-xs font-black" role="group" aria-label="View">
            {[['edit', 'Permissions'], ['compare', 'Compare Staff vs Head']].map(([value, label]) => <button key={value} type="button" onClick={() => setView(value)} className={`rounded-lg px-3 py-1.5 ${view === value ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{label}</button>)}
          </div> : null}
        </div>

        {role === 'system_admin' ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800"><span className="font-black text-blue-950">System Admin · Governed Administration</span> Core administration, Review Center, and audit-approved correction permissions are Required. Super Admin may adjust additional allowed permissions within the System Admin ceiling. System Admin cannot expand its own governance level.</div> : role === 'auditor' ? <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800"><span className="font-black text-violet-950">Auditor · Governed Global Read-Only</span> Global read access and audit workflow actions are Required. Operational write permissions remain Not Allowed. Only Super Admin may adjust the limited export/print permissions allowed for Auditor.</div> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600"><span className="font-black text-slate-900">{roleLabels[role] || role}</span>{policy?.parentRole ? <> inherits operational access from <span className="font-black text-blue-700">{roleLabels[policy.parentRole] || policy.parentRole}</span>.</> : null} {editable ? 'Permissions may be adjusted below.' : 'This governance role is view-only here.'}</div>}

        {view === 'compare' && hasDepartmentPair ? <StaffHeadComparison data={data} department={department} editingRole={role} selected={selected} roleLabels={roleLabels} /> : <>
          {editable ? <div className="flex justify-end"><button type="button" onClick={() => setSelected(data.recommendedDefaults?.[role] || [])} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">Load Recommended Defaults</button></div> : null}
          <PermissionMatrix
            catalog={data.catalog || []}
            selected={selected}
            onChange={setSelected}
            policy={policy}
            disabled={!editable}
            baseline={editable ? savedDefaults : null}
            baselineLabel="saved default"
            priorityGroups={DEPARTMENT_PRIORITY_GROUPS[department] || []}
          />
        </>}
      </>}
    </div> : null}

    {data && editable && role !== 'super_admin' ? <div className={`sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-4 rounded-b-3xl border-t px-5 py-4 ${isDirty ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-sm font-semibold text-slate-600">{isDirty ? <span className="font-black text-amber-900">Unsaved changes to {roleLabels[role] || role}. </span> : null}Existing users keep their current direct permissions until Apply Latest Role Default is used on that account.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setSelected(savedDefaults)} disabled={!isDirty || save.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 font-black text-slate-700 disabled:opacity-40">Discard</button>
        <button type="button" onClick={() => save.mutate()} disabled={!isDirty || save.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">{save.isPending ? 'Saving...' : 'Save Role Defaults'}</button>
      </div>
    </div> : null}
  </section>
}
export default RoleAccessControl
