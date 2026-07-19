import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiLoader, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import ProjectAccreditationFields from './ProjectAccreditationFields'
import { useFetch as fetchJson, useFetchPost as postJson } from '../../../utils/useFetch'

const validateProjectRates = (projectRates) => {
  if (!projectRates.length) return 'Select at least one accredited project.'
  const invalidRate = projectRates.find((rate) => {
    const value = Number(rate.seller_group_pool_rate)
    return !Number.isFinite(value) || value < 6 || value > 15
  })
  return invalidRate ? 'Each selected project pool rate must be between 6% and 15%.' : ''
}

const NewGroupModal = ({ setShowNewGroupModal, onSaved }) => {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    seller_group_name: '',
    seller_group_head_user_id: '',
    seller_group_description: '',
    seller_group_status: 'active',
    project_rates: [],
  })

  const parentsQuery = useQuery({
    queryKey: ['parent-sellers'],
    queryFn: () => fetchJson('/accredited/parents'),
  })
  const projectsQuery = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => fetchJson('/projects/lot-projects/options'),
  })

  const parentSellers = parentsQuery.data?.data || []
  const eligibleGroupHeads = parentSellers.filter(
    (seller) => ['broker_network_manager', 'broker'].includes(seller.role) && !seller.seller_group_id
  )
  const projects = projectsQuery.data?.data || []

  const mutation = useMutation({
    mutationFn: () => postJson('/seller-groups/create', form),
    onMutate: () => setNotice({ type: 'loading', message: 'Creating seller group and project accreditations...' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-options'] })
      setShowNewGroupModal(false)
      onSaved?.(data?.message || 'Seller group created successfully.')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to create seller group.' }),
  })

  const updateForm = (field, value) => {
    setNotice(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.seller_group_name.trim()) {
      setNotice({ type: 'error', message: 'Seller group name is required.' })
      return
    }
    const projectError = validateProjectRates(form.project_rates)
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
              <h2 className="text-xl font-black text-slate-950">New Seller Group</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Create the group and choose the projects it is accredited to sell.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowNewGroupModal(false)} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close new seller group modal"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-5">
            {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}
            {isLoadingOptions ? <StatusAlert type="loading" message="Loading group heads and active projects..." /> : null}
            {hasOptionError ? <StatusAlert type="error" message={parentsQuery.error?.message || projectsQuery.error?.message || 'Failed to load seller group options.'} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-black text-slate-700">Group Name <span className="text-red-500">*</span></span>
                <input autoFocus value={form.seller_group_name} onChange={(event) => updateForm('seller_group_name', event.target.value)} placeholder="Example: North Star Group" disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-black text-slate-700">Group Head</span>
                <select value={form.seller_group_head_user_id} onChange={(event) => updateForm('seller_group_head_user_id', event.target.value)} disabled={mutation.isPending || parentsQuery.isLoading} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100">
                  <option value="">No head assigned</option>
                  {eligibleGroupHeads.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} · {String(seller.role || '').replaceAll('_', ' ')}</option>)}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Description</span>
              <textarea rows={3} value={form.seller_group_description} onChange={(event) => updateForm('seller_group_description', event.target.value)} placeholder="Describe the group, territory, or internal team..." disabled={mutation.isPending} className="resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
            </label>

            <label className="flex flex-col gap-1.5 md:max-w-xs">
              <span className="text-xs font-black text-slate-700">Group Status</span>
              <select value={form.seller_group_status} onChange={(event) => updateForm('seller_group_status', event.target.value)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <ProjectAccreditationFields
              projects={projects}
              projectRates={form.project_rates}
              onChange={(value) => updateForm('project_rates', value)}
              disabled={mutation.isPending || projectsQuery.isLoading}
            />
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowNewGroupModal(false)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending || isLoadingOptions || hasOptionError} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300">
            {mutation.isPending ? <FiLoader className="animate-spin" /> : null}
            {mutation.isPending ? 'Creating...' : 'Create Group'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default NewGroupModal

