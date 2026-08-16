import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import ConfirmActionModal from '../../Shared/ConfirmActionModal'
import ProjectAccreditationFields from './ProjectAccreditationFields'
import { getSellerRoleLabel } from '../../../config/sellerRoles'
import {useFetch as fetchJson, useFetchPost as postJson, getDoubleCheckNotice} from '../../../utils/useFetch'

const validateProjectRates = (projectRates, groupHeadRole, groupType) => {
  if (!projectRates.length) return 'Select at least one accredited project.'

  for (const rate of projectRates) {
    const pool = Number(rate.seller_group_pool_rate)
    if (!Number.isFinite(pool) || pool < 6 || pool > 15) {
      return 'Each selected project Pool Rate must be between 6% and 15%.'
    }
    if (groupType === 'external') continue

    const positionRates = [
      Number(rate.division_manager_rate || 0),
      Number(rate.sales_director_rate || 0),
      Number(rate.unit_manager_rate || 0),
      Number(rate.sales_agent_rate || 0),
    ]
    if (positionRates.some((value) => !Number.isFinite(value) || value < 0 || value > 15)) {
      return 'In-house position rates must be between 0% and 15%.'
    }
    if (positionRates[1] <= 0) return 'Sales Director Rate must be greater than 0%.'
    if (positionRates[2] <= 0) return 'Unit Manager Rate must be greater than 0%.'
    if (positionRates[3] <= 0) return 'Sales Agent Rate must be greater than 0%.'
    if (groupHeadRole === 'sales_director' && positionRates[0] !== 0) {
      return 'Division Manager Rate must be 0% when the Group Head is a Sales Director.'
    }
    if (groupHeadRole !== 'sales_director' && positionRates[0] <= 0) {
      return 'Division Manager Rate must be greater than 0%.'
    }
    const allocated = Number(positionRates.reduce((sum, value) => sum + value, 0).toFixed(2))
    if (Math.abs(allocated - pool) > 0.001) {
      return `The in-house position rates must total the ${pool.toFixed(2)}% Pool Rate.`
    }
  }

  return ''
}

const InputField = ({ label, required = false, ...props }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-700">{label}{required ? <span className="text-red-500"> *</span> : null}</span>
    <input {...props} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
  </label>
)

const NewGroupModal = ({ setShowNewGroupModal, onSaved, groupType = 'in_house' }) => {
  const queryClient = useQueryClient()
  const isExternal = groupType === 'external'
  const groupLabel = isExternal ? 'External Group' : 'In-House Group'
  const [notice, setNotice] = useState(null)
  const [projectPendingRemoval, setProjectPendingRemoval] = useState(null)
  const [form, setForm] = useState({
    seller_group_type: groupType,
    seller_group_name: '',
    seller_group_head_user_id: '',
    seller_group_description: '',
    seller_group_status: 'active',
    project_rates: [],
    external_account: {
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      contact_no: '',
      tin_no: '',
      prc_no: '',
      address: '',
    },
  })

  const parentsQuery = useQuery({
    queryKey: ['parent-sellers'],
    queryFn: () => fetchJson('/accredited/parents'),
    enabled: !isExternal,
  })
  const projectsQuery = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => fetchJson('/projects/lot-projects/options'),
  })

  const parentSellers = parentsQuery.data?.data || []
  const eligibleGroupHeads = parentSellers.filter(
    (seller) => ['division_manager', 'sales_director'].includes(seller.role) && !seller.seller_group_id
  )
  const projects = projectsQuery.data?.data || []
  const selectedGroupHead = eligibleGroupHeads.find(
    (seller) => String(seller.user_id) === String(form.seller_group_head_user_id)
  )
  const groupHeadRole = selectedGroupHead?.role || 'division_manager'

  const mutation = useMutation({
    mutationFn: () => postJson('/seller-groups/create', form, {
      doubleCheck: {
        type: 'seller-group',
        mode: 'create',
        data: {
          ...form,
          seller_group_head_name: selectedGroupHead?.full_name || '',
          seller_group_head_role: groupHeadRole,
          project_rates: (form.project_rates || []).map((rate) => ({
            ...rate,
            projectName: projects.find((project) => Number(project.lot_project_id || project.id) === Number(rate.lot_project_id || rate.project_id))?.lot_project_name
              || projects.find((project) => Number(project.lot_project_id || project.id) === Number(rate.lot_project_id || rate.project_id))?.name
              || `Project ${rate.lot_project_id || rate.project_id || ''}`,
          })),
        },
      },
    }),
    onMutate: () => setNotice({ type: 'loading', message: `Preparing ${groupLabel} review...` }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-options'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['accredited'] })
      setShowNewGroupModal(false)
      onSaved?.(data?.message || `${groupLabel} created successfully.`)
    },
    onError: (error) => setNotice(getDoubleCheckNotice(error, `Failed to create ${groupLabel}.`)),
  })

  const updateForm = (field, value) => {
    setNotice(null)
    setForm((current) => ({ ...current, [field]: value }))
  }
  const updateExternalAccount = (field, value) => {
    setNotice(null)
    setForm((current) => ({
      ...current,
      external_account: { ...current.external_account, [field]: value },
    }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.seller_group_name.trim()) {
      setNotice({ type: 'error', message: 'Group Name is required.' })
      return
    }
    if (isExternal) {
      const account = form.external_account
      if (!account.first_name.trim() || !account.last_name.trim() || !account.email.trim()) {
        setNotice({ type: 'error', message: 'Representative first name, last name, and email are required.' })
        return
      }
    }
    const projectError = validateProjectRates(form.project_rates, groupHeadRole, groupType)
    if (projectError) {
      setNotice({ type: 'error', message: projectError })
      return
    }
    mutation.mutate()
  }

  const isLoadingOptions = projectsQuery.isLoading || (!isExternal && parentsQuery.isLoading)
  const hasOptionError = projectsQuery.isError || (!isExternal && parentsQuery.isError)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} aria-busy={mutation.isPending} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiUsers /></span>
            <div>
              <h2 className="text-xl font-black text-slate-950">Add {groupLabel}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{isExternal ? 'Create one partner-group account and assign its overall Pool Rate per project.' : 'Create the internal group, select its projects, and assign fixed rates by position.'}</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowNewGroupModal(false)} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close group modal"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-5">
            {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}
            {isLoadingOptions ? <StatusAlert type="loading" message="Loading group options and active projects..." /> : null}
            {hasOptionError ? <StatusAlert type="error" message={parentsQuery.error?.message || projectsQuery.error?.message || 'Failed to load group options.'} /> : null}

            <section className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-black text-slate-950">Group Information</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InputField autoFocus label="Group Name" required value={form.seller_group_name} onChange={(event) => updateForm('seller_group_name', event.target.value)} placeholder={isExternal ? 'Example: ABC Realty' : 'Example: North Star Team'} disabled={mutation.isPending} />
                {!isExternal ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-black text-slate-700">Group Head</span>
                    <select value={form.seller_group_head_user_id} onChange={(event) => {
                      const nextHeadId = event.target.value
                      const nextHead = eligibleGroupHeads.find((seller) => String(seller.user_id) === String(nextHeadId))
                      const nextRole = nextHead?.role || 'division_manager'
                      setNotice(null)
                      setForm((current) => ({
                        ...current,
                        seller_group_head_user_id: nextHeadId,
                        project_rates: current.project_rates.map((rate) => {
                          const divisionManagerRate = nextRole === 'sales_director' ? 0 : Number(rate.division_manager_rate || 1)
                          const salesDirectorRate = Number(rate.sales_director_rate || 0)
                          const unitManagerRate = Number(rate.unit_manager_rate || 0)
                          const pool = Number(rate.seller_group_pool_rate || 0)
                          return {
                            ...rate,
                            division_manager_rate: divisionManagerRate,
                            sales_agent_rate: Math.max(pool - divisionManagerRate - salesDirectorRate - unitManagerRate, 0).toFixed(2),
                          }
                        }),
                      }))
                    }} disabled={mutation.isPending || parentsQuery.isLoading} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100">
                      <option value="">No head assigned</option>
                      {eligibleGroupHeads.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} · {getSellerRoleLabel(seller.role)}</option>)}
                    </select>
                  </label>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-black text-blue-900">Account Type</p>
                    <p className="mt-1 text-sm font-black text-blue-700">External Group</p>
                    <p className="mt-1 text-xs font-semibold text-blue-700">One account receives the full project Pool Rate.</p>
                  </div>
                )}
              </div>

              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs font-black text-slate-700">Description</span>
                <textarea rows={3} value={form.seller_group_description} onChange={(event) => updateForm('seller_group_description', event.target.value)} placeholder="Describe the group, territory, or agreement..." disabled={mutation.isPending} className="resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
              </label>

              <label className="mt-4 flex max-w-xs flex-col gap-1.5">
                <span className="text-xs font-black text-slate-700">Group Status</span>
                <select value={form.seller_group_status} onChange={(event) => updateForm('seller_group_status', event.target.value)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"><option value="active">Active</option><option value="inactive">Inactive</option></select>
              </label>
            </section>

            {isExternal ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-black text-slate-950">External Group Representative</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">This person identifies the External Group in commissions, receipts, and proof-of-income records. Login is disabled until an external portal is added.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <InputField label="First Name" required value={form.external_account.first_name} onChange={(event) => updateExternalAccount('first_name', event.target.value)} disabled={mutation.isPending} />
                  <InputField label="Middle Name" value={form.external_account.middle_name} onChange={(event) => updateExternalAccount('middle_name', event.target.value)} disabled={mutation.isPending} />
                  <InputField label="Last Name" required value={form.external_account.last_name} onChange={(event) => updateExternalAccount('last_name', event.target.value)} disabled={mutation.isPending} />
                  <InputField type="email" label="Email" required value={form.external_account.email} onChange={(event) => updateExternalAccount('email', event.target.value)} disabled={mutation.isPending} />
                  <InputField label="Contact Number" value={form.external_account.contact_no} onChange={(event) => updateExternalAccount('contact_no', event.target.value)} disabled={mutation.isPending} />
                  <InputField label="TIN No." value={form.external_account.tin_no} onChange={(event) => updateExternalAccount('tin_no', event.target.value)} disabled={mutation.isPending} />
                  <InputField label="PRC No." value={form.external_account.prc_no} onChange={(event) => updateExternalAccount('prc_no', event.target.value)} disabled={mutation.isPending} />
                  <label className="flex flex-col gap-1.5 md:col-span-2"><span className="text-xs font-black text-slate-700">Address</span><input value={form.external_account.address} onChange={(event) => updateExternalAccount('address', event.target.value)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
                </div>
              </section>
            ) : null}

            <ProjectAccreditationFields projects={projects} projectRates={form.project_rates} onChange={(projectRates) => updateForm('project_rates', projectRates)} groupHeadRole={groupHeadRole} groupType={groupType} disabled={mutation.isPending || projectsQuery.isLoading} onRequestRemove={(project) => setProjectPendingRemoval(project)} />
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowNewGroupModal(false)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending || isLoadingOptions} className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{mutation.isPending ? 'Opening Review...' : 'Proceed to Final Review'}</button>
        </footer>
      </form>

      <ConfirmActionModal open={Boolean(projectPendingRemoval)} title="Remove Project Accreditation?" message={`${projectPendingRemoval?.lot_project_name || 'This project'} will be removed from the group. Existing historical commission records are not changed.`} confirmLabel="Remove Project" tone="danger" onClose={() => setProjectPendingRemoval(null)} onConfirm={() => { const projectId = Number(projectPendingRemoval?.lot_project_id); updateForm('project_rates', form.project_rates.filter((rate) => Number(rate.lot_project_id) !== projectId)); setProjectPendingRemoval(null) }} />
    </div>
  )
}

export default NewGroupModal
