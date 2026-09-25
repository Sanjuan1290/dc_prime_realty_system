import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, pick } from './core/doubleCheckFormatters'

const AuditArchiveDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const steps = [{ key: 'archive', title: 'Archive Request', content: <DoubleCheckSection title="Archive Request" helper="Verify the archive scope after password and email-code verification." tone="amber"><DoubleCheckFields fields={[
    { label: 'Eligible Records', value: pick(data, 'eligibleCount') },
    { label: 'Retention Period (Days)', value: pick(data, 'retentionDays') },
    { label: 'Cutoff', value: pick(data, 'cutoffAt'), formatter: formatDate },
    { label: 'Verification Email', value: pick(data, 'maskedEmail'), wide: true },
  ]} /></DoubleCheckSection> }]
  return <DoubleCheckShell title={request.title || 'Review Audit Log Archive'} description={request.description || 'Verify the archive scope before moving eligible records to protected archive tables.'} confirmLabel={request.confirmLabel || 'Confirm & Archive Logs'} summary={`${pick(data, 'eligibleCount') || 0} records`} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default AuditArchiveDoubleCheck

