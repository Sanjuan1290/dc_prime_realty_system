import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import PermissionMatrix from '../userComponents/PermissionMatrix'
import { useFetch, useFetchPut } from '../../../utils/useFetch'

const labels = { admin: 'Admin', marketing: 'Marketing', sales: 'Sales', accounting: 'Accounting', operations: 'Operations' }

const RoleAccessControl = () => {
  const queryClient = useQueryClient()
  const [role, setRole] = useState('admin')
  const [selected, setSelected] = useState([])
  const [alert, setAlert] = useState(null)
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['role-access-defaults'], queryFn: () => useFetch('/user/access-control/roles') })
  useEffect(() => { setSelected(data?.defaults?.[role] || []) }, [data, role])
  const save = useMutation({
    mutationFn: () => useFetchPut(`/user/access-control/roles/${role}`, { permissions: selected }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: `Saving ${labels[role]} defaults...` }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result.message }); queryClient.invalidateQueries({ queryKey: ['role-access-defaults'] }) },
    onError: (e) => setAlert({ type: 'error', message: e.message }),
  })

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-xl font-black text-slate-950">Role & Access Control</h2><p className="mt-1 text-sm text-slate-500">These defaults are copied into new accounts. Editing a role default does not silently change existing users.</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Super Admin · Full System Access · All Projects · Locked</div></div>
    {alert ? <div className="mt-4"><StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /></div> : null}
    {isLoading ? <div className="mt-4"><StatusAlert type="loading" message="Loading role defaults..." /></div> : null}{isError ? <div className="mt-4"><StatusAlert type="error" message={error?.message || 'Failed to load role defaults.'} /></div> : null}
    {!isLoading && data ? <><div className="my-5 flex flex-wrap gap-2">{(data.roles || []).map((r) => <button key={r} type="button" onClick={() => setRole(r)} className={`rounded-xl px-4 py-2 text-sm font-black ${role === r ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{labels[r] || r}</button>)}</div><PermissionMatrix catalog={data.catalog || []} selected={selected} onChange={setSelected} /><div className="mt-5 flex justify-end"><button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">Save {labels[role]} Defaults</button></div></> : null}
  </section>
}
export default RoleAccessControl
