import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit3, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import ConfirmActionModal from '../../Shared/ConfirmActionModal'
import ProjectAccreditationFields from './ProjectAccreditationFields'
import { getSellerRoleLabel } from '../../../config/sellerRoles'
import {useFetch as fetchJson, useFetchPut as putJson, getDoubleCheckNotice} from '../../../utils/useFetch'

const normalizeRates = (rates = [], groupType = 'in_house') => rates.map((rate) => ({
  lot_project_id: Number(rate.lot_project_id),
  seller_group_pool_rate: Number(rate.seller_group_pool_rate || 0),
  division_manager_rate: groupType === 'external' ? 0 : Number(rate.division_manager_rate || 0),
  sales_director_rate: groupType === 'external' ? 0 : Number(rate.sales_director_rate || 0),
  unit_manager_rate: groupType === 'external' ? 0 : Number(rate.unit_manager_rate || 0),
  sales_agent_rate: groupType === 'external' ? 0 : Number(rate.sales_agent_rate || 0),
  commission_structure_type: groupType,
}))

const validateProjectRates = (projectRates, groupHeadRole, groupType) => {
  if (!projectRates.length) return 'Select at least one accredited project.'
  for (const rate of projectRates) {
    const pool = Number(rate.seller_group_pool_rate)
    if (!Number.isFinite(pool) || pool < 6 || pool > 15) return 'Each selected project Pool Rate must be between 6% and 15%.'
    if (groupType === 'external') continue
    const positionRates = [Number(rate.division_manager_rate || 0), Number(rate.sales_director_rate || 0), Number(rate.unit_manager_rate || 0), Number(rate.sales_agent_rate || 0)]
    if (positionRates[1] <= 0 || positionRates[2] <= 0 || positionRates[3] <= 0) return 'Sales Director, Unit Manager, and Sales Agent rates must be greater than 0%.'
    if (groupHeadRole === 'sales_director' && positionRates[0] !== 0) return 'Division Manager Rate must be 0% when the Group Head is a Sales Director.'
    if (groupHeadRole !== 'sales_director' && positionRates[0] <= 0) return 'Division Manager Rate must be greater than 0%.'
    if (Math.abs(positionRates.reduce((sum, value) => sum + value, 0) - pool) > 0.001) return `The in-house position rates must total the ${pool.toFixed(2)}% Pool Rate.`
  }
  return ''
}

const Field = ({ label, required = false, ...props }) => (
  <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">{label}{required ? <span className="text-red-500"> *</span> : null}</span><input {...props} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
)

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup, onSaved, groupType: propGroupType }) => {
  const queryClient = useQueryClient()
  const groupType = propGroupType || selectedGroup?.seller_group_type || 'in_house'
  const isExternal = groupType === 'external'
  const groupLabel = isExternal ? 'External Group' : 'In-House Group'
  const [notice, setNotice] = useState(null)
  const [projectPendingRemoval, setProjectPendingRemoval] = useState(null)
  const [form, setForm] = useState({
    seller_group_type: groupType,
    seller_group_name: selectedGroup?.seller_group_name || '',
    seller_group_head_user_id: selectedGroup?.seller_group_head_user_id || '',
    seller_group_description: selectedGroup?.seller_group_description || '',
    seller_group_status: selectedGroup?.seller_group_status || 'active',
    project_rates: normalizeRates(selectedGroup?.project_rates || [], groupType),
    external_account: {
      user_id:
        selectedGroup?.external_account?.user_id ||
        selectedGroup?.external_account_user_id ||
        selectedGroup?.seller_group_external_account_user_id ||
        '',
      first_name:
        selectedGroup?.external_account?.first_name ||
        selectedGroup?.external_account_first_name ||
        selectedGroup?.external_first_name ||
        '',
      middle_name:
        selectedGroup?.external_account?.middle_name ||
        selectedGroup?.external_account_middle_name ||
        selectedGroup?.external_middle_name ||
        '',
      last_name:
        selectedGroup?.external_account?.last_name ||
        selectedGroup?.external_account_last_name ||
        selectedGroup?.external_last_name ||
        '',
      email:
        selectedGroup?.external_account?.email ||
        selectedGroup?.external_account_email ||
        '',
      contact_no:
        selectedGroup?.external_account?.contact_no ||
        selectedGroup?.external_account_contact_no ||
        '',
      tin_no:
        selectedGroup?.external_account?.tin_no ||
        selectedGroup?.external_account_tin_no ||
        '',
      prc_no:
        selectedGroup?.external_account?.prc_no ||
        selectedGroup?.external_account_prc_no ||
        '',
      address:
        selectedGroup?.external_account?.address ||
        selectedGroup?.external_account_address ||
        '',
    },
  })

  const parentsQuery = useQuery({ queryKey: ['parent-sellers'], queryFn: () => fetchJson('/accredited/parents'), enabled: !isExternal })
  const projectsQuery = useQuery({ queryKey: ['lot-project-options'], queryFn: () => fetchJson('/projects/lot-projects/options') })
  const parentSellers = parentsQuery.data?.data || []
  const eligibleGroupHeads = parentSellers.filter((seller) => ['division_manager', 'sales_director'].includes(seller.role) && (!seller.seller_group_id || Number(seller.seller_group_id) === Number(selectedGroup?.seller_group_id)))
  const selectedHead = eligibleGroupHeads.find((seller) => String(seller.user_id) === String(form.seller_group_head_user_id))
  const groupHeadRole = selectedHead?.role || selectedGroup?.seller_group_head_role || 'division_manager'
  const projects = projectsQuery.data?.data || []

  const mutation = useMutation({
    mutationFn: () => putJson(`/seller-groups/edit/${selectedGroup.seller_group_id}`, form, {
      doubleCheck: {
        type: 'seller-group',
        mode: 'edit',
        data: {
          ...form,
          seller_group_head_name: selectedHead?.full_name || '',
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
      queryClient.invalidateQueries({ queryKey: ['seller-group', String(selectedGroup.seller_group_id)] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['accredited'] })
      setShowEditGroupModal(false)
      onSaved?.(data?.message || `${groupLabel} updated successfully.`)
    },
    onError: (error) => setNotice(getDoubleCheckNotice(error, `Failed to update ${groupLabel}.`)),
  })

  const updateForm = (field, value) => { setNotice(null); setForm((current) => ({ ...current, [field]: value })) }
  const updateExternal = (field, value) => { setNotice(null); setForm((current) => ({ ...current, external_account: { ...current.external_account, [field]: value } })) }

  const submit = (event) => {
    event.preventDefault()
    if (!form.seller_group_name.trim()) return setNotice({ type: 'error', message: 'Group Name is required.' })
    if (isExternal && (!form.external_account.first_name.trim() || !form.external_account.last_name.trim() || !form.external_account.email.trim())) return setNotice({ type: 'error', message: 'Representative first name, last name, and email are required.' })
    const projectError = validateProjectRates(form.project_rates, groupHeadRole, groupType)
    if (projectError) return setNotice({ type: 'error', message: projectError })
    mutation.mutate()
  }

  const isLoadingOptions = projectsQuery.isLoading || (!isExternal && parentsQuery.isLoading)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiEdit3 /></span><div><h2 className="text-xl font-black text-slate-950">Edit {groupLabel}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{isExternal ? 'Update the partner account and overall project Pool Rates.' : 'Update the internal hierarchy and fixed rates by position.'}</p></div></div><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><FiX /></button></header>

        <div className="overflow-y-auto p-5"><div className="grid gap-5">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}
          <section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-950">Group Information</h3><div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field autoFocus label="Group Name" required value={form.seller_group_name} onChange={(event) => updateForm('seller_group_name', event.target.value)} disabled={mutation.isPending} />
            {!isExternal ? <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Group Head</span><select value={form.seller_group_head_user_id} onChange={(event) => {
              const nextHeadId = event.target.value
              const nextHead = eligibleGroupHeads.find((seller) => String(seller.user_id) === String(nextHeadId))
              const nextRole = nextHead?.role || 'division_manager'
              setForm((current) => ({ ...current, seller_group_head_user_id: nextHeadId, project_rates: current.project_rates.map((rate) => {
                const divisionManagerRate = nextRole === 'sales_director' ? 0 : Number(rate.division_manager_rate || 1)
                const pool = Number(rate.seller_group_pool_rate || 0)
                const salesDirectorRate = Number(rate.sales_director_rate || 0)
                const unitManagerRate = Number(rate.unit_manager_rate || 0)
                return { ...rate, division_manager_rate: divisionManagerRate, sales_agent_rate: Math.max(pool - divisionManagerRate - salesDirectorRate - unitManagerRate, 0).toFixed(2) }
              }) }))
            }} disabled={mutation.isPending || parentsQuery.isLoading} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"><option value="">No head assigned</option>{eligibleGroupHeads.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} · {getSellerRoleLabel(seller.role)}</option>)}</select></label> : <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"><p className="text-xs font-black text-blue-900">Account Type</p><p className="mt-1 text-sm font-black text-blue-700">External Group</p><p className="mt-1 text-xs font-semibold text-blue-700">The group type cannot be changed after creation.</p></div>}
          </div><label className="mt-4 flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Description</span><textarea rows={3} value={form.seller_group_description} onChange={(event) => updateForm('seller_group_description', event.target.value)} disabled={mutation.isPending} className="resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold" /></label><label className="mt-4 flex max-w-xs flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Group Status</span><select value={form.seller_group_status} onChange={(event) => updateForm('seller_group_status', event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"><option value="active">Active</option><option value="inactive">Inactive</option></select></label></section>

          {isExternal ? <section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-950">External Group Representative</h3><p className="mt-1 text-xs font-semibold text-slate-500">Used for commissions, release records, receipts, and proof of income.</p><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="First Name" required value={form.external_account.first_name} onChange={(event) => updateExternal('first_name', event.target.value)} /><Field label="Middle Name" value={form.external_account.middle_name} onChange={(event) => updateExternal('middle_name', event.target.value)} /><Field label="Last Name" required value={form.external_account.last_name} onChange={(event) => updateExternal('last_name', event.target.value)} /><Field type="email" label="Email" required value={form.external_account.email} onChange={(event) => updateExternal('email', event.target.value)} /><Field label="Contact Number" value={form.external_account.contact_no} onChange={(event) => updateExternal('contact_no', event.target.value)} /><Field label="TIN No." value={form.external_account.tin_no} onChange={(event) => updateExternal('tin_no', event.target.value)} /><Field label="PRC No." value={form.external_account.prc_no} onChange={(event) => updateExternal('prc_no', event.target.value)} /><label className="flex flex-col gap-1.5 md:col-span-2"><span className="text-xs font-black text-slate-700">Address</span><input value={form.external_account.address} onChange={(event) => updateExternal('address', event.target.value)} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold" /></label></div></section> : null}

          <ProjectAccreditationFields projects={projects} projectRates={form.project_rates} onChange={(rates) => updateForm('project_rates', rates)} groupHeadRole={groupHeadRole} groupType={groupType} disabled={mutation.isPending || isLoadingOptions} onRequestRemove={setProjectPendingRemoval} />
        </div></div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button type="submit" disabled={mutation.isPending || isLoadingOptions} className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-black text-white disabled:opacity-60">{mutation.isPending ? 'Opening Review...' : 'Proceed to Final Review'}</button></footer>
      </form>
      <ConfirmActionModal open={Boolean(projectPendingRemoval)} title="Remove Project Accreditation?" message={`${projectPendingRemoval?.lot_project_name || 'This project'} will no longer accept new sales for this group. Historical commission records remain.`} confirmLabel="Remove Project" tone="danger" onClose={() => setProjectPendingRemoval(null)} onConfirm={() => { const id = Number(projectPendingRemoval?.lot_project_id); updateForm('project_rates', form.project_rates.filter((rate) => Number(rate.lot_project_id) !== id)); setProjectPendingRemoval(null) }} />
    </div>
  )
}

export default EditGroupModal
