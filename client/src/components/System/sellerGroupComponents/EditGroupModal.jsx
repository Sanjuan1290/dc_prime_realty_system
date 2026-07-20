import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiLoader, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import ConfirmActionModal from '../../Shared/ConfirmActionModal'
import ProjectAccreditationFields from './ProjectAccreditationFields'
import { useFetch as fetchJson, useFetchPut as putJson } from '../../../utils/useFetch'

const normalizeInitialProjectRates = (rates = []) => rates
  .filter((rate) => (rate.seller_group_lot_project_rate_status || 'active') === 'active')
  .map((rate) => ({
    lot_project_id: Number(rate.lot_project_id),
    seller_group_pool_rate: Number(rate.seller_group_pool_rate || 8),
    bnm_override_rate: Number(rate.bnm_override_rate || 0),
    broker_override_rate: Number(rate.broker_override_rate || 0),
    manager_override_rate: Number(rate.manager_override_rate || 0),
    agent_rate: Number(rate.agent_rate || 0),
  }))

const validateProjectRates = (projectRates, groupHeadRole = 'broker_network_manager') => {
  if (!projectRates.length) return 'Select at least one accredited project.'

  for (const rate of projectRates) {
    const pool = Number(rate.seller_group_pool_rate)
    const bnm = Number(rate.bnm_override_rate || 0)
    const broker = Number(rate.broker_override_rate || 0)
    const manager = Number(rate.manager_override_rate || 0)
    const agent = Number(rate.agent_rate || 0)
    const values = [pool, bnm, broker, manager, agent]
    if (values.some((value) => !Number.isFinite(value))) return 'Every project rate must be a valid number.'
    if (pool < 6 || pool > 15) return 'Each selected project pool rate must be between 6% and 15%.'
    if ([bnm, broker, manager, agent].some((value) => value < 0 || value > 15)) return 'Role rates must be between 0% and 15%.'
    if (broker <= 0) return 'Broker override rate must be greater than 0%.'
    if (manager <= 0) return 'Manager override rate must be greater than 0%.'
    if (agent <= 0) return 'Agent sales rate must be greater than 0%.'
    if (groupHeadRole === 'broker' && bnm !== 0) return 'BNM override must be 0% when the Realty head is a Broker.'
    if (groupHeadRole !== 'broker' && bnm <= 0) return 'BNM override rate must be greater than 0%.'
    const allocated = Number((bnm + broker + manager + agent).toFixed(2))
    if (Math.abs(allocated - pool) > 0.001) return `The fixed role rates must total the ${pool.toFixed(2)}% project pool exactly.`
  }

  return ''
}

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup, onSaved }) => {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(null)
  const [projectPendingRemoval, setProjectPendingRemoval] = useState(null)
  const [form, setForm] = useState(() => ({
    seller_group_name: selectedGroup?.seller_group_name || '',
    seller_group_head_user_id: selectedGroup?.seller_group_head_user_id ? String(selectedGroup.seller_group_head_user_id) : '',
    seller_group_description: selectedGroup?.seller_group_description || '',
    seller_group_status: selectedGroup?.seller_group_status || 'active',
    project_rates: normalizeInitialProjectRates(selectedGroup?.project_rates || []),
  }))

  const parentsQuery = useQuery({
    queryKey: ['parent-sellers'],
    queryFn: () => fetchJson('/accredited/parents'),
  })
  const projectsQuery = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => fetchJson('/projects/lot-projects/options'),
  })

  const parentSellers = parentsQuery.data?.data || []
  const eligibleGroupHeads = parentSellers.filter((seller) => (
    ['broker_network_manager', 'broker'].includes(seller.role)
    && (!seller.seller_group_id || Number(seller.seller_group_id) === Number(selectedGroup?.seller_group_id))
  ))
  const projects = projectsQuery.data?.data || []
  const selectedGroupHead = eligibleGroupHeads.find(
    (seller) => String(seller.user_id) === String(form.seller_group_head_user_id)
  )
  const groupHeadRole = selectedGroupHead?.role || 'broker_network_manager'

  const mutation = useMutation({
    mutationFn: () => putJson(`/seller-groups/edit/${selectedGroup.seller_group_id}`, form),
    onMutate: () => setNotice({ type: 'loading', message: 'Saving Realty and fixed project commission rates...' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-options'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-project-options', Number(selectedGroup.seller_group_id)] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-project-configuration', Number(selectedGroup.seller_group_id)] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-project-analytics', Number(selectedGroup.seller_group_id)] })
      setShowEditGroupModal(false)
      onSaved?.(data?.message || 'Seller group updated successfully.')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save Realty.' }),
  })

  const update = (field, value) => {
    setNotice(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.seller_group_name.trim()) {
      setNotice({ type: 'error', message: 'Realty name is required.' })
      return
    }
    const projectError = validateProjectRates(form.project_rates, groupHeadRole)
    if (projectError) {
      setNotice({ type: 'error', message: projectError })
      return
    }
    mutation.mutate()
  }

  const isLoadingOptions = parentsQuery.isLoading || projectsQuery.isLoading
  const hasOptionError = parentsQuery.isError || projectsQuery.isError

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} aria-busy={mutation.isPending} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiUsers /></span>
            <div>
              <h2 className="text-xl font-black text-slate-950">Edit Realty</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Update the Realty, accredited projects, and fixed role rates for each project.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close edit Realty modal"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-5">
            {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}
            {isLoadingOptions ? <StatusAlert type="loading" message="Loading group heads and active projects..." /> : null}
            {hasOptionError ? <StatusAlert type="error" message={parentsQuery.error?.message || projectsQuery.error?.message || 'Failed to load Realty options.'} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-black text-slate-700">Realty Name <span className="text-red-500">*</span></span>
                <input autoFocus value={form.seller_group_name} onChange={(event) => update('seller_group_name', event.target.value)} placeholder="Enter Realty name" disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-black text-slate-700">Realty Head</span>
                <select value={form.seller_group_head_user_id} onChange={(event) => {
                  const nextHeadId = event.target.value
                  const nextHead = eligibleGroupHeads.find((seller) => String(seller.user_id) === String(nextHeadId))
                  const nextRole = nextHead?.role || 'broker_network_manager'
                  setNotice(null)
                  setForm((current) => ({
                    ...current,
                    seller_group_head_user_id: nextHeadId,
                    project_rates: current.project_rates.map((rate) => {
                      const bnm = nextRole === 'broker' ? 0 : Number(rate.bnm_override_rate || 1)
                      const broker = Number(rate.broker_override_rate || 0)
                      const manager = Number(rate.manager_override_rate || 0)
                      const pool = Number(rate.seller_group_pool_rate || 0)
                      return {
                        ...rate,
                        bnm_override_rate: bnm,
                        agent_rate: Math.max(pool - bnm - broker - manager, 0).toFixed(2),
                      }
                    }),
                  }))
                }} disabled={mutation.isPending || parentsQuery.isLoading} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100">
                  <option value="">No head assigned</option>
                  {eligibleGroupHeads.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} · {String(seller.role || '').replaceAll('_', ' ')}</option>)}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Description</span>
              <textarea rows={3} value={form.seller_group_description} onChange={(event) => update('seller_group_description', event.target.value)} placeholder="Describe the Realty..." disabled={mutation.isPending} className="resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
            </label>

            <label className="flex flex-col gap-1.5 md:max-w-xs">
              <span className="text-xs font-black text-slate-700">Group Status</span>
              <select value={form.seller_group_status} onChange={(event) => update('seller_group_status', event.target.value)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <ProjectAccreditationFields
              projects={projects}
              projectRates={form.project_rates}
              onChange={(value) => update('project_rates', value)}
              groupHeadRole={groupHeadRole}
              onRequestRemove={setProjectPendingRemoval}
              disabled={mutation.isPending || projectsQuery.isLoading}
            />
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending || isLoadingOptions || hasOptionError} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300">
            {mutation.isPending ? <FiLoader className="animate-spin" /> : null}
            {mutation.isPending ? 'Saving...' : 'Save Group'}
          </button>
        </footer>
      </form>

      <ConfirmActionModal
        open={Boolean(projectPendingRemoval)}
        title="Remove Project Accreditation?"
        message={`${selectedGroup?.seller_group_name || 'This Realty'} will no longer be available for new sales in ${projectPendingRemoval?.lot_project_name || projectPendingRemoval?.label || 'this project'}. Existing reservations and commission records will remain available.`}
        confirmLabel="Remove Project"
        onClose={() => setProjectPendingRemoval(null)}
        onConfirm={() => {
          const projectId = Number(projectPendingRemoval?.lot_project_id || projectPendingRemoval?.id)
          update('project_rates', form.project_rates.filter((rate) => Number(rate.lot_project_id) !== projectId))
          setProjectPendingRemoval(null)
          setNotice({ type: 'warning', message: 'Project marked for removal. Save the group to apply this change.' })
        }}
      />
    </div>
  )
}

export default EditGroupModal
