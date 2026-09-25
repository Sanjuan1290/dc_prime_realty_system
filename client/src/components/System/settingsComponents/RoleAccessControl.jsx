import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import PermissionMatrix from '../userComponents/PermissionMatrix'
import { useFetch, useFetchPut } from '../../../utils/useFetch'

const labels = {
  admin: 'Admin',
  marketing: 'Marketing',
  sales: 'Sales',
  accounting: 'Accounting',
  operations: 'Operations',
  super_admin: 'Super Admin',
}

const RoleAccessControl = () => {
  const queryClient = useQueryClient()
  const [role, setRole] = useState('admin')
  const [selected, setSelected] = useState([])
  const [alert, setAlert] = useState(null)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['role-access-defaults'],
    queryFn: () => useFetch('/user/access-control/roles'),
  })

  const roles = useMemo(() => [...(data?.roles || []), 'super_admin'], [data])
  const isSuperAdminRole = role === 'super_admin'

  useEffect(() => {
    if (isSuperAdminRole) {
      setSelected([])
      return
    }
    setSelected(data?.defaults?.[role] || [])
  }, [data, role, isSuperAdminRole])

  const save = useMutation({
    mutationFn: () => useFetchPut(`/user/access-control/roles/${role}`, { permissions: selected }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: `Saving ${labels[role]} defaults...` }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result.message })
      queryClient.invalidateQueries({ queryKey: ['role-access-defaults'] })
    },
    onError: (e) => setAlert({ type: 'error', message: e.message }),
  })

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-black text-slate-950">Role & Access Control</h2>
        <p className="mt-1 text-sm text-slate-500">
          Role defaults are templates copied into new accounts. Editing a role default does not silently change existing users.
        </p>
      </div>

      {alert ? <div className="mt-4"><StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /></div> : null}
      {isLoading ? <div className="mt-4"><StatusAlert type="loading" message="Loading role defaults..." /></div> : null}
      {isError ? <div className="mt-4"><StatusAlert type="error" message={error?.message || 'Failed to load role defaults.'} /></div> : null}

      {!isLoading && data ? (
        <>
          <div className="my-5 flex flex-wrap gap-2">
            {roles.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setRole(item); setAlert(null) }}
                className={`rounded-xl px-4 py-2 text-sm font-black ${role === item ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
              >
                {labels[item] || item}
              </button>
            ))}
          </div>

          {isSuperAdminRole ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <p className="text-lg font-black">Full System Access</p>
              <p className="mt-1 text-sm font-semibold">
                Super Admin always has every permission and All Projects access. Permissions cannot be restricted or disabled.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setSelected(data.recommendedDefaults?.[role] || []); setAlert({ type: 'success', message: 'Recommended defaults loaded for review. Click Save to persist them.' }) }}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700"
                >
                  Reset to Recommended Defaults
                </button>
              </div>
              <PermissionMatrix catalog={data.catalog || []} selected={selected} onChange={setSelected} />
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50"
                >
                  Save {labels[role]} Defaults
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </section>
  )
}

export default RoleAccessControl
