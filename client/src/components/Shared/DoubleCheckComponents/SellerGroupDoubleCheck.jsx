import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { percent, pick, roleLabel, statusLabel, titleCase } from './core/doubleCheckFormatters'

const DEFAULT_POOL_SHARES = Object.freeze({
  division_manager: 14.18,
  sales_director: 15.82,
  unit_manager: 20,
  sales_agent: 50,
})

const round4 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000
const ratePercent = (value) => `${Number(value || 0).toFixed(4)}%`
const sharePercent = (value) => `${Number(value || 0).toFixed(2)}%`

const getShares = (data = {}) => {
  const raw = data.pool_shares || data.poolShares || {}
  return {
    division_manager: Number(raw.division_manager ?? DEFAULT_POOL_SHARES.division_manager),
    sales_director: Number(raw.sales_director ?? DEFAULT_POOL_SHARES.sales_director),
    unit_manager: Number(raw.unit_manager ?? DEFAULT_POOL_SHARES.unit_manager),
    sales_agent: Number(raw.sales_agent ?? DEFAULT_POOL_SHARES.sales_agent),
  }
}

const calculateAllocation = (rate = {}, shares = DEFAULT_POOL_SHARES) => {
  const pool = Number(pick(rate, 'seller_group_pool_rate') || 0)
  const companyProfit = Number(pick(rate, 'company_profit_rate') || 0)
  const distributable = round4(Math.max(pool - companyProfit, 0))
  const dm = round4(distributable * shares.division_manager / 100)
  const sd = round4(distributable * shares.sales_director / 100)
  const um = round4(distributable * shares.unit_manager / 100)
  const sa = round4(distributable - dm - sd - um)
  return { pool, companyProfit, distributable, dm, sd, um, sa }
}

const SellerGroupDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const type = pick(data, 'seller_group_type') || 'in_house'
  const external = String(type) === 'external'
  const rates = Array.isArray(data.project_rates) ? data.project_rates : []
  const representative = data.external_account || {}
  const shares = getShares(data)
  const duplicateBrokers = Array.isArray(data.duplicate_broker_matches) ? data.duplicate_broker_matches : []

  const steps = [
    {
      key: 'info',
      title: 'Network Information',
      content: <DoubleCheckSection title="Network Information" helper="Verify the Network identity, broker details, hierarchy, description, and status." tone="blue">{duplicateBrokers.length ? <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"><p className="font-black">Same broker name as {duplicateBrokers.map((match) => match.seller_group_name).join(', ')}</p><p className="mt-1">You confirmed this is a different broker. Go back if that is not right.</p></div> : null}<DoubleCheckFields fields={[
        { label: 'Network Name', value: pick(data, 'seller_group_name'), wide: true },
        { label: 'Network Type', value: type, formatter: titleCase },
        { label: 'Broker Name', value: pick(data, 'broker_name') },
        { label: 'Broker License Number', value: pick(data, 'broker_license_number') },
        { label: 'Realty Name', value: pick(data, 'realty_name') },
        { label: 'PRC Number', value: pick(data, 'broker_prc_number') },
        { label: 'Internal Hierarchy Head', value: pick(data, 'seller_group_head_name') || request.meta?.groupHeadName || (external ? 'Not applicable' : 'No hierarchy head assigned') },
        { label: 'Hierarchy Head Role', value: pick(data, 'seller_group_head_role') || request.meta?.groupHeadRole, formatter: roleLabel },
        { label: 'Description', value: pick(data, 'seller_group_description'), wide: true },
        { label: 'Status', value: pick(data, 'seller_group_status'), formatter: statusLabel },
      ]} /></DoubleCheckSection>,
    },
    {
      key: 'rates',
      title: 'Project Allocation',
      content: <DoubleCheckSection title="Project Commission Allocation" helper={external ? 'Verify the selected projects and full Pool Rates.' : 'Verify Pool Rate, Company Profit, and the calculated role allocation.'} tone="amber" badge={`${rates.length} project${rates.length === 1 ? '' : 's'}`}>
        {rates.length ? <div className="space-y-3">{rates.map((rate, index) => {
          const allocation = calculateAllocation(rate, shares)
          return <DoubleCheckListCard key={`${pick(rate, 'lot_project_id') || index}`} title={pick(rate, 'projectName', 'project_name', 'lot_project_name', 'reviewTitle') || `Project ${index + 1}`} index={index} total={rates.length} fields={[
            { label: 'Pool Rate', value: pick(rate, 'seller_group_pool_rate'), formatter: percent, tone: 'financial' },
            ...(!external ? [
              { label: 'Company Profit (CP)', value: allocation.companyProfit, formatter: ratePercent, tone: 'financial' },
              { label: 'Distributable Pool', value: allocation.distributable, formatter: ratePercent, tone: 'financial' },
              { label: `Division Manager (${sharePercent(shares.division_manager)} of pool)`, value: allocation.dm, formatter: ratePercent, tone: 'financial' },
              { label: `Sales Director (${sharePercent(shares.sales_director)} of pool)`, value: allocation.sd, formatter: ratePercent, tone: 'financial' },
              { label: `Unit Manager (${sharePercent(shares.unit_manager)} of pool)`, value: allocation.um, formatter: ratePercent, tone: 'financial' },
              { label: `Sales Agent (${sharePercent(shares.sales_agent)} of pool)`, value: allocation.sa, formatter: ratePercent, tone: 'financial' },
            ] : []),
          ]} />
        })}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No project accreditation is selected.</p>}
      </DoubleCheckSection>,
    },
    {
      key: 'external',
      title: 'External Representative',
      hidden: !external,
      content: <DoubleCheckSection title="External Network Representative" helper="Verify the representative used for commission releases, receipts, and proof of income." tone="violet"><DoubleCheckFields fields={[
        { label: 'First Name', value: pick(representative, 'first_name') },
        { label: 'Middle Name', value: pick(representative, 'middle_name') },
        { label: 'Last Name', value: pick(representative, 'last_name') },
        { label: 'Email', value: pick(representative, 'email') },
        { label: 'Contact Number', value: pick(representative, 'contact_no') },
        { label: 'TIN No.', value: pick(representative, 'tin_no') },
        { label: 'PRC No.', value: pick(representative, 'prc_no') },
        { label: 'Address', value: pick(representative, 'address'), wide: true },
      ]} /></DoubleCheckSection>,
    },
  ]

  return <DoubleCheckShell title={request.title || (request.mode === 'edit' ? 'Review Network Changes' : 'Review New Network')} description={request.description || 'Verify Network information and selected project allocation before saving.'} confirmLabel={request.confirmLabel || (request.mode === 'edit' ? 'Confirm & Save Network' : 'Confirm & Add Network')} summary={pick(data, 'seller_group_name')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default SellerGroupDoubleCheck

