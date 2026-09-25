import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import { CONFIGURABLE_SYSTEM_ROLES } from '../../../config/permissions'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import AdminProjectAccessFields from './AdminProjectAccessFields'
import PermissionMatrix from './PermissionMatrix'

const labels = {
  admin: 'Admin',
  marketing: 'Marketing',
  sales: 'Sales',
  accounting: 'Accounting',
  operations: 'Operations',
}

const ChangePositionModal = ({ user, onClose, onSaved }) => {
  const choices = CONFIGURABLE_SYSTEM_ROLES.filter((candidate) => candidate !== user.role)
  const [role, setRole] = useState(choices[0] || 'marketing')
  const [allProjects, setAllProjects] = useState(false)
  const [projectIds, setProjectIds] = useState([])
  const [permissions, setPermissions] = useState([])
  const [reason, setReason] = useState('')
  const [alert, setAlert] = useState(null)

  const { data: roleData } = useQuery({
    queryKey: ['role-access-defaults'],
    queryFn: () => useFetch('/user/access-control/roles'),
  })
  const { data: projectData } = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => useFetch('/projects/lot-projects/options'),
  })
  const {
    data: previewData,
    isFetching: previewLoading,
    isError: previewFailed,
  } = useQuery({
    queryKey: ['change-position-preview', user.id, role],
    queryFn: () => useFetch(`/user/change-position/${user.id}/preview?role=${encodeURIComponent(role)}`),
    enabled: Boolean(user?.id && role),
  })

  useEffect(() => {
    setPermissions(roleData?.defaults?.[role] || [])
  }, [role, roleData])

  const mutation = useMutation({
    mutationFn: () => useFetchPost(
      `/user/change-position/${user.id}`,
      {
        new_role: role,
        all_projects_access: allProjects,
        project_ids: projectIds,
        permissions,
        reason,
      },
      { confirmationHandled: 'compact' }
    ),
    onMutate: () => setAlert({ type: 'loading', message: 'Creating the replacement account and permanently retiring the old account...' }),
    onSuccess: (result) => {
      onSaved?.(result.message || 'Position changed successfully.')
      onClose?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const toggleProject = (id) => setProjectIds((current) => (
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
  ))

  const submit = (event) => {
    event.preventDefault()
    if (!reason.trim()) {
      setAlert({ type: 'error', message: 'Enter the reason for the position change.' })
      return
    }
    if (!allProjects && !projectIds.length) {
      setAlert({ type: 'error', message: 'Select All Projects or at least one project.' })
      return
    }
    if (!previewData?.replacement?.account_code) {
      setAlert({ type: 'error', message: 'The replacement account preview is not ready. Refresh the preview and try again.' })
      return
    }
    mutation.mutate()
  }

  const replacement = previewData?.replacement

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4">
      <div className="mx-auto my-5 max-w-6xl rounded-3xl bg-white shadow-2xl">
        <div className="border-b p-5">
          <h2 className="text-xl font-black">Change Position / Create New Account</h2>
          <p className="mt-1 text-sm text-slate-500">Current: {user.account_code || user.email} · {user.role.replaceAll('_', ' ')}</p>
        </div>

        <form onSubmit={submit} className="grid gap-5 p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            This is a permanent account transition. The current account is retained for history and can never be reactivated. The replacement account and old-account deactivation are committed together in one database transaction.
          </div>

          <label className="grid gap-1.5 text-sm font-bold">
            New Position
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value)
                setAllProjects(false)
                setProjectIds([])
              }}
              className="h-11 rounded-xl border px-3"
            >
              {choices.map((candidate) => <option key={candidate} value={candidate}>{labels[candidate]}</option>)}
            </select>
          </label>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Replacement Account Preview</p>
            {previewLoading ? <p className="mt-2 text-sm font-semibold text-blue-900">Calculating the next person + role sequence…</p> : null}
            {previewFailed ? <p className="mt-2 text-sm font-semibold text-red-700">Unable to load the replacement account preview.</p> : null}
            {replacement ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div><p className="text-xs font-bold text-slate-500">Account Code</p><p className="font-mono text-lg font-black text-blue-950">{replacement.account_code}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Role Sequence</p><p className="text-lg font-black text-blue-950">{replacement.role_sequence}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Login Email</p><p className="break-all text-sm font-black text-blue-950">{replacement.email}</p></div>
              </div>
            ) : null}
          </section>

          <label className="grid gap-1.5 text-sm font-bold">
            Reason *
            <textarea
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="rounded-xl border p-3"
              placeholder="Reason for position change"
            />
          </label>

          <AdminProjectAccessFields
            projects={projectData?.data || []}
            allProjects={allProjects}
            selectedProjectIds={projectIds}
            onAllProjectsChange={(checked) => {
              setAllProjects(checked)
              if (checked) setProjectIds([])
            }}
            onProjectToggle={toggleProject}
          />

          <section>
            <h3 className="mb-3 text-lg font-black">New Account Permissions</h3>
            <PermissionMatrix catalog={roleData?.catalog || []} selected={permissions} onChange={setPermissions} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black">Final Review</h3>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <p><span className="font-bold text-slate-500">Retire:</span> {user.account_code || user.email}</p>
              <p><span className="font-bold text-slate-500">Create:</span> {replacement?.account_code || 'Preview pending'}</p>
              <p><span className="font-bold text-slate-500">New role:</span> {labels[role]}</p>
              <p><span className="font-bold text-slate-500">Project scope:</span> {allProjects ? 'All Projects' : `${projectIds.length} selected project(s)`}</p>
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-bold">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isPending || previewLoading || !replacement?.account_code}
              className="h-11 rounded-xl bg-violet-600 px-5 font-black text-white disabled:opacity-50"
            >
              Confirm Position Change
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChangePositionModal
