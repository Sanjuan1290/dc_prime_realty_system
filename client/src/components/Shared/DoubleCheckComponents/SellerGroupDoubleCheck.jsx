import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { percent, pick, roleLabel, statusLabel, titleCase } from './core/doubleCheckFormatters'

const SellerGroupDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const type = pick(data, 'seller_group_type') || 'in_house'
  const external = String(type) === 'external'
  const rates = Array.isArray(data.project_rates) ? data.project_rates : []
  const representative = data.external_account || {}
  const steps = [
    { key: 'info', title: 'Group Information', content: <DoubleCheckSection title="Group Information" helper="Verify the group identity, hierarchy, description, and status." tone="blue"><DoubleCheckFields fields={[
      { label: 'Group Name', value: pick(data, 'seller_group_name'), wide: true },
      { label: 'Group Type', value: type, formatter: titleCase },
      { label: 'Group Head', value: pick(data, 'seller_group_head_name') || request.meta?.groupHeadName || (external ? 'Not applicable' : 'No head assigned') },
      { label: 'Group Head Role', value: pick(data, 'seller_group_head_role') || request.meta?.groupHeadRole, formatter: roleLabel },
      { label: 'Description', value: pick(data, 'seller_group_description'), wide: true },
      { label: 'Status', value: pick(data, 'seller_group_status'), formatter: statusLabel },
    ]} /></DoubleCheckSection> },
    { key: 'rates', title: 'Project Rates', content: <DoubleCheckSection title="Project Rates" helper="Verify only the selected projects and rates that will be saved for this group." tone="amber" badge={`${rates.length} project${rates.length === 1 ? '' : 's'}`}>{rates.length ? <div className="space-y-3">{rates.map((rate, index) => <DoubleCheckListCard key={`${pick(rate, 'lot_project_id') || index}`} title={pick(rate, 'projectName', 'project_name', 'lot_project_name', 'reviewTitle') || `Project ${index + 1}`} index={index} total={rates.length} fields={[
      { label: 'Pool Rate', value: pick(rate, 'seller_group_pool_rate'), formatter: percent, tone: 'financial' },
      ...(!external ? [
        { label: 'Division Manager Rate', value: pick(rate, 'division_manager_rate'), formatter: percent, tone: 'financial' },
        { label: 'Sales Director Rate', value: pick(rate, 'sales_director_rate'), formatter: percent, tone: 'financial' },
        { label: 'Unit Manager Rate', value: pick(rate, 'unit_manager_rate'), formatter: percent, tone: 'financial' },
        { label: 'Sales Agent Rate', value: pick(rate, 'sales_agent_rate'), formatter: percent, tone: 'financial' },
      ] : []),
    ]} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No project accreditation is selected.</p>}</DoubleCheckSection> },
    { key: 'external', title: 'External Representative', hidden: !external, content: <DoubleCheckSection title="External Group Representative" helper="Verify the representative used for commission releases, receipts, and proof of income." tone="violet"><DoubleCheckFields fields={[
      { label: 'First Name', value: pick(representative, 'first_name') },
      { label: 'Middle Name', value: pick(representative, 'middle_name') },
      { label: 'Last Name', value: pick(representative, 'last_name') },
      { label: 'Email', value: pick(representative, 'email') },
      { label: 'Contact Number', value: pick(representative, 'contact_no') },
      { label: 'TIN No.', value: pick(representative, 'tin_no') },
      { label: 'PRC No.', value: pick(representative, 'prc_no') },
      { label: 'Address', value: pick(representative, 'address'), wide: true },
    ]} /></DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || (request.mode === 'edit' ? 'Review Group Changes' : 'Review New Group')} description={request.description || 'Verify group information and selected project rates before saving.'} confirmLabel={request.confirmLabel || (request.mode === 'edit' ? 'Confirm & Save Group' : 'Confirm & Add Group')} summary={pick(data, 'seller_group_name')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default SellerGroupDoubleCheck
