import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit3, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import ConfirmActionModal from '../../Shared/ConfirmActionModal'
import ProjectAccreditationFields from './ProjectAccreditationFields'
import { BrokerNameWarning } from './BrokerNameWarning'
import { getDuplicateBrokerMatches, useBrokerNameMatches } from './useBrokerNameMatches'
import { getCompanyProfitError, getMaxCompanyProfitPercent } from '../../../utils/companyProfitPolicy'
import { getSellerRoleLabel } from '../../../config/sellerRoles'
import {useFetch as fetchJson, useFetchPut as putJson, getDoubleCheckNotice} from '../../../utils/useFetch'

const normalizeRates = (rates = [], groupType = 'in_house') => rates.map((rate) => ({
  lot_project_id: Number(rate.lot_project_id),
  seller_group_pool_rate: Number(rate.seller_group_pool_rate || 0),
  company_profit_rate: groupType === 'external' ? 0 : Number(rate.company_profit_rate || 0),
  division_manager_rate: groupType === 'external' ? 0 : Number(rate.division_manager_rate || 0),
  sales_director_rate: groupType === 'external' ? 0 : Number(rate.sales_director_rate || 0),
  unit_manager_rate: groupType === 'external' ? 0 : Number(rate.unit_manager_rate || 0),
  sales_agent_rate: groupType === 'external' ? 0 : Number(rate.sales_agent_rate || 0),
  commission_structure_type: groupType,
}))

const validateProjectRates = (projectRates, groupType, poolSharesData = {}) => {
  if (!projectRates.length) return 'Select at least one accredited project.'
  const maxPercentOfPool = getMaxCompanyProfitPercent(poolSharesData)
  for (const rate of projectRates) {
    const pool = Number(rate.seller_group_pool_rate)
    if (!Number.isFinite(pool) || pool < 6 || pool > 15) return 'Each selected project Pool Rate must be between 6% and 15%.'
    if (groupType === 'external') continue
    const companyProfitError = getCompanyProfitError(rate, { maxPercentOfPool, shares: poolSharesData })
    if (companyProfitError) return companyProfitError
  }
  return ''
}

const Field = ({ label, required = false, ...props }) => (
  <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">{label}{required ? <span className="text-red-500"> *</span> : null}</span><input {...props} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
)

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup, onSaved, groupType: propGroupType, workflowReviewId = null, workflowAuditCaseId = null }) => {
  const queryClient = useQueryClient()
  const groupType = propGroupType || selectedGroup?.seller_group_type || 'in_house'
  const isExternal = groupType === 'external'
  const groupLabel = isExternal ? 'External Network' : 'In-House Network'
  const [notice, setNotice] = useState(null)
  const [projectPendingRemoval, setProjectPendingRemoval] = useState(null)
  const [serverBrokerMatches, setServerBrokerMatches] = useState(null)
  const originalBrokerName = selectedGroup?.broker_name || selectedGroup?.brokerName || ''
  const [form, setForm] = useState({
    confirm_duplicate_broker: false,
    seller_group_type: groupType,
    seller_group_name: selectedGroup?.seller_group_name || '',
    broker_name: selectedGroup?.broker_name || selectedGroup?.brokerName || '',
    broker_license_number: selectedGroup?.broker_license_number || selectedGroup?.brokerLicenseNumber || '',
    realty_name: selectedGroup?.realty_name || selectedGroup?.realtyName || '',
    broker_prc_number: selectedGroup?.broker_prc_number || selectedGroup?.brokerPrcNumber || '',
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
  const poolSharesQuery = useQuery({ queryKey: ['network-pool-shares'], queryFn: () => fetchJson('/seller-groups/pool-shares') })
  const parentSellers = parentsQuery.data?.data || []
  const eligibleGroupHeads = parentSellers.filter((seller) => seller.role === 'division_manager' && (!seller.seller_group_id || Number(seller.seller_group_id) === Number(selectedGroup?.seller_group_id)))
  const selectedHead = eligibleGroupHeads.find((seller) => String(seller.user_id) === String(form.seller_group_head_user_id))
  const groupHeadRole = selectedHead?.role || selectedGroup?.seller_group_head_role || 'division_manager'
  const projects = projectsQuery.data?.data || []
  const poolShares = poolSharesQuery.data?.data || { division_manager: 14.18, sales_director: 15.82, unit_manager: 20, sales_agent: 50 }
  const brokerCheck = useBrokerNameMatches(form.broker_name, { excludeGroupId: selectedGroup?.seller_group_id, originalBrokerName })
  const brokerMatches = brokerCheck.matches.length ? brokerCheck.matches : (serverBrokerMatches || [])

  const mutation = useMutation({
    mutationFn: () => putJson(`/seller-groups/edit/${selectedGroup.seller_group_id}`, { ...form, ...(workflowReviewId ? { reviewId: workflowReviewId } : {}), ...(workflowAuditCaseId ? { auditCaseId: workflowAuditCaseId } : {}) }, {
      doubleCheck: {
        type: 'seller-group',
        mode: 'edit',
        data: {
          ...form,
          duplicate_broker_matches: brokerMatches,
          seller_group_head_name: selectedHead?.full_name || '',
          seller_group_head_role: groupHeadRole,
          pool_shares: poolShares,
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
      const warnings = Array.isArray(data?.warnings) ? data.warnings : []
      onSaved?.(
        warnings.length
          ? `${data?.message || `${groupLabel} updated successfully.`} Same broker name as another Network; you confirmed this is a different broker.`
          : (data?.message || `${groupLabel} updated successfully.`),
        warnings.length ? 'warning' : 'success'
      )
    },
    onError: (error) => {
      const duplicates = getDuplicateBrokerMatches(error)
      if (duplicates) {
        setServerBrokerMatches(duplicates)
        setForm((current) => ({ ...current, confirm_duplicate_broker: false }))
        setNotice({ type: 'warning', message: 'This broker name is already used by another Network. Check the warning under Broker Name, then confirm before saving.' })
        return
      }
      setNotice(getDoubleCheckNotice(error, `Failed to update ${groupLabel}.`))
    },
  })

  const updateForm = (field, value) => {
    setNotice(null)
    if (field === 'broker_name') setServerBrokerMatches(null)
    setForm((current) => ({ ...current, [field]: value, ...(field === 'broker_name' ? { confirm_duplicate_broker: false } : {}) }))
  }
  const updateExternal = (field, value) => { setNotice(null); setForm((current) => ({ ...current, external_account: { ...current.external_account, [field]: value } })) }

  const submit = (event) => {
    event.preventDefault()
    if (!form.seller_group_name.trim()) return setNotice({ type: 'error', message: 'Network Name is required.' })
    if (!form.broker_name.trim() || !form.broker_license_number.trim() || !form.realty_name.trim() || !form.broker_prc_number.trim()) return setNotice({ type: 'error', message: 'Broker Name, Broker License Number, Realty Name, and PRC Number are required.' })
    if (brokerMatches.length && !form.confirm_duplicate_broker) return setNotice({ type: 'warning', message: 'This broker name is already used by another Network. Confirm it is a different broker before saving.' })
    if (isExternal && (!form.external_account.first_name.trim() || !form.external_account.last_name.trim() || !form.external_account.email.trim())) return setNotice({ type: 'error', message: 'Representative first name, last name, and email are required.' })
    const projectError = validateProjectRates(form.project_rates, groupType, poolShares)
    if (projectError) return setNotice({ type: 'error', message: projectError })
    mutation.mutate()
  }

  const isLoadingOptions = projectsQuery.isLoading || poolSharesQuery.isLoading || (!isExternal && parentsQuery.isLoading)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiEdit3 /></span><div><h2 className="text-xl font-black text-slate-950">Edit {groupLabel}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{isExternal ? 'Update the partner account and overall project Pool Rates.' : 'Update the internal hierarchy and Pool Rate, Company Profit, and calculated role allocation.'}</p></div></div><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><FiX /></button></header>

        <div className="overflow-y-auto p-5"><div className="grid gap-5">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}
          <section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-950">Network Information</h3><div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field autoFocus label="Network Name" required value={form.seller_group_name} onChange={(event) => updateForm('seller_group_name', event.target.value)} disabled={mutation.isPending} /><Field label="Broker Name" required value={form.broker_name} onChange={(event) => updateForm('broker_name', event.target.value)} disabled={mutation.isPending} /><Field label="Broker License Number" required value={form.broker_license_number} onChange={(event) => updateForm('broker_license_number', event.target.value)} disabled={mutation.isPending} /><Field label="Realty Name" required value={form.realty_name} onChange={(event) => updateForm('realty_name', event.target.value)} disabled={mutation.isPending} /><BrokerNameWarning brokerName={form.broker_name} matches={brokerMatches} confirmed={form.confirm_duplicate_broker} onConfirmChange={(value) => { setNotice(null); setForm((current) => ({ ...current, confirm_duplicate_broker: value })) }} disabled={mutation.isPending} /><Field label="PRC Number" required value={form.broker_prc_number} onChange={(event) => updateForm('broker_prc_number', event.target.value)} disabled={mutation.isPending} />
            {!isExternal ? <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Internal Hierarchy Head</span><select value={form.seller_group_head_user_id} onChange={(event) => {
              const nextHeadId = event.target.value
              setForm((current) => ({ ...current, seller_group_head_user_id: nextHeadId }))
            }} disabled={mutation.isPending || parentsQuery.isLoading} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"><option value="">No hierarchy head assigned</option>{eligibleGroupHeads.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} · {getSellerRoleLabel(seller.role)}</option>)}</select></label> : <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"><p className="text-xs font-black text-blue-900">Account Type</p><p className="mt-1 text-sm font-black text-blue-700">External Network</p><p className="mt-1 text-xs font-semibold text-blue-700">The Network type cannot be changed after creation.</p></div>}
          </div><label className="mt-4 flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Description</span><textarea rows={3} value={form.seller_group_description} onChange={(event) => updateForm('seller_group_description', event.target.value)} disabled={mutation.isPending} className="resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold" /></label><label className="mt-4 flex max-w-xs flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Network Status</span><select value={form.seller_group_status} onChange={(event) => updateForm('seller_group_status', event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"><option value="active">Active</option><option value="inactive">Inactive</option></select></label></section>

          {isExternal ? <section className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black text-slate-950">External Network Representative</h3><p className="mt-1 text-xs font-semibold text-slate-500">Used for commissions, release records, receipts, and proof of income.</p><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="First Name" required value={form.external_account.first_name} onChange={(event) => updateExternal('first_name', event.target.value)} /><Field label="Middle Name" value={form.external_account.middle_name} onChange={(event) => updateExternal('middle_name', event.target.value)} /><Field label="Last Name" required value={form.external_account.last_name} onChange={(event) => updateExternal('last_name', event.target.value)} /><Field type="email" label="Email" required value={form.external_account.email} onChange={(event) => updateExternal('email', event.target.value)} /><Field label="Contact Number" value={form.external_account.contact_no} onChange={(event) => updateExternal('contact_no', event.target.value)} /><Field label="TIN No." value={form.external_account.tin_no} onChange={(event) => updateExternal('tin_no', event.target.value)} /><Field label="PRC No." value={form.external_account.prc_no} onChange={(event) => updateExternal('prc_no', event.target.value)} /><label className="flex flex-col gap-1.5 md:col-span-2"><span className="text-xs font-black text-slate-700">Address</span><input value={form.external_account.address} onChange={(event) => updateExternal('address', event.target.value)} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold" /></label></div></section> : null}

          <ProjectAccreditationFields projects={projects} projectRates={form.project_rates} onChange={(rates) => updateForm('project_rates', rates)} groupType={groupType} poolShares={poolShares} disabled={mutation.isPending || isLoadingOptions} onRequestRemove={setProjectPendingRemoval} />
        </div></div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button type="submit" disabled={mutation.isPending || isLoadingOptions} className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-black text-white disabled:opacity-60">{mutation.isPending ? 'Opening Review...' : 'Proceed to Final Review'}</button></footer>
      </form>
      <ConfirmActionModal open={Boolean(projectPendingRemoval)} title="Remove Project Accreditation?" message={`${projectPendingRemoval?.lot_project_name || 'This project'} will no longer accept new sales for this Network. Historical commission records remain.`} confirmLabel="Remove Project" tone="danger" onClose={() => setProjectPendingRemoval(null)} onConfirm={() => { const id = Number(projectPendingRemoval?.lot_project_id); updateForm('project_rates', form.project_rates.filter((rate) => Number(rate.lot_project_id) !== id)); setProjectPendingRemoval(null) }} />
    </div>
  )
}

export default EditGroupModal

