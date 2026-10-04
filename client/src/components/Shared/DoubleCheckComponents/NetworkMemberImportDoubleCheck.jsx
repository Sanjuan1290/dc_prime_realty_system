import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'

const NetworkMemberImportDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const fields = [
    { label: 'In-House Network', value: data.network },
    { label: 'Filename', value: data.filename },
    { label: 'Members to Import', value: data.rowCount, tone: 'important' },
    { label: 'Create', value: data.createCount },
    { label: 'Update', value: data.updateCount },
    { label: 'Transfer', value: data.transferCount },
    { label: 'Default Status', value: 'Active' },
  ]

  const steps = [{
    key: 'review',
    title: 'Network Member Import',
    content: (
      <DoubleCheckSection
        title="Network Member Import"
        helper="Verify the Network and validated member counts. The server revalidates every Excel row and hierarchy relationship before any account is saved."
        tone="blue"
      >
        <DoubleCheckFields fields={fields} />
      </DoubleCheckSection>
    ),
  }]

  return (
    <DoubleCheckShell
      title={request.title || 'Review Network Member Import'}
      description={request.description || 'No partial import is allowed. If any row becomes invalid before saving, the entire import is rolled back.'}
      confirmLabel={request.confirmLabel || 'Confirm Member Import'}
      summary={data.network || data.filename}
      steps={steps}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export default NetworkMemberImportDoubleCheck
