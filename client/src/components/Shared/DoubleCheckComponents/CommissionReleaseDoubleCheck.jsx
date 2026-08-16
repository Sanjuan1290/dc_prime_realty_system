import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, percent, pick, roleLabel, titleCase } from './core/doubleCheckFormatters'

const CommissionReleaseDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const beneficiary = data.commissionBeneficiary || data.beneficiary || {}
  const release = data.selectedRelease || data.release || {}
  const steps = [
    { key: 'beneficiary', title: 'Commission & Beneficiary', content: <DoubleCheckSection title="Commission & Beneficiary" helper="Verify the property, beneficiary, commission base, and remaining balance." tone="violet"><DoubleCheckFields fields={[
      { label: 'Project', value: pick(beneficiary, 'project') },
      { label: 'Unit', value: pick(beneficiary, 'unit') },
      { label: 'Buyer', value: pick(beneficiary, 'buyer'), wide: true },
      { label: 'Beneficiary', value: pick(beneficiary, 'beneficiary', 'seller'), wide: true },
      { label: 'Role', value: pick(beneficiary, 'role'), formatter: roleLabel },
      { label: 'Group', value: pick(beneficiary, 'group') },
      { label: 'Commission Base', value: pick(beneficiary, 'commissionBase'), formatter: money, tone: 'financial' },
      { label: 'Commission Rate', value: pick(beneficiary, 'commissionRate'), formatter: percent, tone: 'financial' },
      { label: 'Gross Commission', value: pick(beneficiary, 'grossCommission'), formatter: money, tone: 'financial' },
      { label: 'Previously Released', value: pick(beneficiary, 'previouslyReleased'), formatter: money, tone: 'financial' },
      { label: 'Remaining Before Release', value: pick(beneficiary, 'remainingBeforeRelease'), formatter: money, tone: 'financial' },
    ]} /></DoubleCheckSection> },
    { key: 'release', title: 'Selected Release', content: <DoubleCheckSection title="Selected Release" helper="Only the milestone you selected is shown here." tone="emerald"><DoubleCheckFields fields={[
      { label: 'Release Stage', value: pick(release, 'releaseStage', 'stage'), formatter: titleCase },
      { label: 'Trigger Percentage', value: pick(release, 'triggerPercent'), formatter: percent, tone: 'financial' },
      { label: 'Release Percentage', value: pick(release, 'releasePercent'), formatter: percent, tone: 'financial' },
      { label: 'Gross Release Amount', value: pick(release, 'grossReleaseAmount', 'grossAmount'), formatter: money, tone: 'financial' },
      { label: 'Deduction', value: pick(release, 'deductionAmount', 'deduction'), formatter: money, tone: 'financial' },
      { label: 'Net Amount to Release', value: pick(release, 'netReleaseAmount', 'netAmount'), formatter: money, tone: 'financial' },
      { label: 'Status', value: pick(release, 'status'), formatter: titleCase },
      { label: 'Release Date', value: pick(release, 'releaseDate'), formatter: formatDate },
    ]} /></DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || 'Review Commission Release'} description={request.description || 'Verify the beneficiary and selected release before posting it.'} confirmLabel={request.confirmLabel || 'Confirm & Release Commission'} summary={request.summary || [pick(beneficiary, 'unit'), pick(beneficiary, 'beneficiary'), pick(release, 'releaseStage')].filter(Boolean).join(' · ')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default CommissionReleaseDoubleCheck
