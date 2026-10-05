import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import PermissionMatrix from '../userComponents/PermissionMatrix'
import { useFetch, useFetchPut } from '../../../utils/useFetch'

const groups = [
  ['SYSTEM', ['system_admin']],
  ['AUDIT', ['auditor']],
  ['MARKETING', ['marketing_staff', 'marketing_head']],
  ['SALES', ['sales_staff', 'sales_head']],
  ['ACCOUNTING', ['accounting_staff', 'accounting_head']],
  ['OPERATIONS', ['operations_staff', 'operations_head']],
  ['OWNER', ['super_admin']],
]

const RoleAccessControl = () => {
  const queryClient = useQueryClient()
  const [role, setRole] = useState('accounting_staff')
  const [selected, setSelected] = useState([])
  const [alert, setAlert] = useState(null)
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['role-access-defaults'], queryFn: () => useFetch('/user/access-control/roles') })
  const roleLabels = data?.roleLabels || {}
  const available = useMemo(() => new Set([...(data?.roles || []), 'super_admin']), [data])
  const policy = data?.policies?.[role] || null
  const editable = (data?.editableRoles || []).includes(role)

  useEffect(() => {
    if (!data) return
    if (!available.has(role)) setRole(data.roles?.[0] || 'super_admin')
  }, [data, role, available])
  useEffect(() => setSelected(data?.defaults?.[role] || []), [data, role])

  const save = useMutation({
    mutationFn: () => useFetchPut(`/user/access-control/roles/${role}`, { permissions: selected }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: `Saving ${roleLabels[role] || role} defaults...` }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result.message }); queryClient.invalidateQueries({ queryKey: ['role-access-defaults'] }) },
    onError: (e) => setAlert({ type: 'error', message: e.message }),
  })

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="border-b border-slate-200 pb-5"><h2 className="text-xl font-black text-slate-950">Role & Access Control</h2><p className="mt-1 text-sm text-slate-500">Staff permissions, Head inheritance, Auditor read-only policy, and System Admin governance are enforced by the server.</p></div>
    {alert ? <div className="mt-4"><StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /></div> : null}
    {isLoading ? <div className="mt-4"><StatusAlert type="loading" message="Loading role defaults..." /></div> : null}
    {isError ? <div className="mt-4"><StatusAlert type="error" message={error?.message || 'Failed to load role defaults.'} /></div> : null}
    {!isLoading && data ? <div className="mt-5 grid gap-5">
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{groups.map(([group, roles]) => {
        const visible = roles.filter((item) => available.has(item))
        if (!visible.length) return null
        return <div key={group} className="rounded-2xl border border-slate-200 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-400">{group}</p><div className="flex flex-wrap gap-2">{visible.map((item) => <button key={item} type="button" onClick={() => { setRole(item); setAlert(null) }} className={`rounded-xl px-3 py-2 text-xs font-black ${role === item ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'}`}>{roleLabels[item] || item}</button>)}</div></div>
      })}</div>

      {role === 'super_admin' ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="text-lg font-black">Owner / Emergency Full Access</p><p className="mt-1 text-sm font-semibold">Super Admin remains the break-glass fallback. Its permissions and project scope cannot be restricted.</p></div> : <>
        {role === 'system_admin' ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800"><span className="font-black text-blue-950">System Admin · Governed Administration</span> Core administration, Review Center, and audit-approved correction permissions are Required. Super Admin may adjust additional allowed permissions within the System Admin ceiling. System Admin cannot expand its own governance level.</div> : role === 'auditor' ? <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800"><span className="font-black text-violet-950">Auditor · Governed Global Read-Only</span> Global read access and audit workflow actions are Required. Operational write permissions remain Not Allowed. Only Super Admin may adjust the limited export/print permissions allowed for Auditor.</div> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600"><span className="font-black text-slate-900">{roleLabels[role] || role}</span>{policy?.parentRole ? <> inherits operational access from <span className="font-black text-blue-700">{roleLabels[policy.parentRole] || policy.parentRole}</span>.</> : null} {editable ? 'Permissions may be adjusted below.' : 'This governance role is view-only here.'}</div>}
        {editable ? <div className="flex justify-end"><button type="button" onClick={() => setSelected(data.recommendedDefaults?.[role] || [])} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">Load Recommended Defaults</button></div> : null}
        <PermissionMatrix catalog={data.catalog || []} selected={selected} onChange={setSelected} policy={policy} disabled={!editable} />
        {editable ? <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-5"><p className="text-sm font-semibold text-slate-500">Existing users keep their current direct permissions until Apply Latest Role Default is used on that account.</p><button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">{save.isPending ? 'Saving...' : 'Save Role Defaults'}</button></div> : null}
      </>}
    </div> : null}
  </section>
}
export default RoleAccessControl
