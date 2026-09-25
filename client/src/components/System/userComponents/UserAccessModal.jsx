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

  const { data: roleData } = useQuery({
    queryKey: ['role-access-defaults'],
    queryFn: () => useFetch('/user/access-control/roles'),
  })
  const { data: accessData, isLoading } = useQuery({
    queryKey: ['user-access', user.id],
    queryFn: () => useFetch(`/user/access-control/users/${user.id}`),
  })
  const { data: projectData } = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => useFetch('/projects/lot-projects/options'),
    enabled: user.role !== 'super_admin',
  })

  useEffect(() => {
    if (!accessData?.user) return
    setPermissions(accessData.user.permissions || [])
    setAllProjects(Boolean(accessData.user.all_projects_access))
    setProjectIds((accessData.user.project_ids || []).map(Number))
  }, [accessData])

  const save = useMutation({
    mutationFn: () => useFetchPut(`/user/access-control/users/${user.id}`, {
      permissions,
      all_projects_access: allProjects,
      project_ids: projectIds,
    }, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving account access...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user-access', user.id] })
      onSaved?.(result.message || 'User access updated.')
      onClose?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const resetToRoleDefault = useMutation({
    mutationFn: () => useFetchPost(`/user/access-control/users/${user.id}/apply-role-defaults`, {}, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      setPermissions(result.permissions || [])
      queryClient.invalidateQueries({ queryKey: ['user-access', user.id] })
      setAlert({ type: 'success', message: result.message })
    },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const toggleProject = (id) => setProjectIds((values) => values.includes(id) ? values.filter((value) => value !== id) : [...values, id])
  const locked = Boolean(accessData?.locked || user.role === 'super_admin')

  const confirmReset = () => {
    const approved = window.confirm(
      `Reset ${user.account_code || user.email} permissions to the current ${user.role.replaceAll('_', ' ')} role default?\n\nThis replaces the account's current permission set. Project scope will not change.`
    )
    if (approved) resetToRoleDefault.mutate()
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4">
      <div className="mx-auto my-5 max-w-6xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-xl font-black">User Access</h2>
            <p className="text-sm text-slate-500">{user.account_code || user.email}</p>
          </div>
          <button onClick={onClose} type="button" className="px-3 py-2 font-black">✕</button>
        </div>

        <div className="grid gap-5 p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
          {isLoading ? <StatusAlert type="loading" message="Loading account access..." /> : null}

          {locked ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <p className="text-lg font-black">Full System Access</p>
              <p className="mt-1 text-sm font-semibold">Super Admin permissions cannot be restricted. All Projects and every valid permission are permanently enabled.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-blue-950">Per-account permissions are authoritative</p>
                  <p className="mt-1 text-sm font-semibold text-blue-800">Changing a role template later does not change this account unless you explicitly reset it.</p>
                </div>
                <button
                  type="button"
                  onClick={confirmReset}
                  disabled={resetToRoleDefault.isPending}
                  className="shrink-0 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700 disabled:opacity-50"
                >
                  Reset to Role Default
                </button>
              </div>

              <AdminProjectAccessFields
                projects={projectData?.data || []}
                allProjects={allProjects}
                selectedProjectIds={projectIds}
                onAllProjectsChange={(checked) => { setAllProjects(checked); if (checked) setProjectIds([]) }}
                onProjectToggle={toggleProject}
                canSelectAllProjects
              />
              <PermissionMatrix catalog={roleData?.catalog || []} selected={permissions} onChange={setPermissions} />
            </>
          )}

          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-bold">Close</button>
            {!locked ? (
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending || (!allProjects && projectIds.length === 0)}
                className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50"
              >
                Save Access
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserAccessModal
