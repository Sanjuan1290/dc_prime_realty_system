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
    { label: 'Existing Seller Updates', value: data.existingUpdateCount || 0, tone: data.existingUpdateCount ? 'important' : undefined },
    { label: 'Transfer', value: data.transferCount },
    { label: 'Default Status', value: 'Active' },
  ]

  const existingUpdateMembers = Array.isArray(data.existingUpdateMembers) ? data.existingUpdateMembers : []
  const existingUpdateCount = Number(data.existingUpdateCount || existingUpdateMembers.length || 0)

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

  if (existingUpdateCount > 0) {
    steps.push({
      key: 'existing-seller-updates',
      title: 'Existing Seller Updates',
      content: (
        <DoubleCheckSection
          title="Existing Seller Records Will Be Updated"
          helper="This is not a duplicate create. The rows below target sellers that already exist in this Network. Confirming will overwrite their name and reporting relationship with the Excel values, update non-blank Contact Number/TIN/PRC fields, and keep them Active."
          tone="red"
        >
          <div className="grid gap-2">
            {existingUpdateMembers.map((member) => (
              <div key={`${member.row}-${member.email}`} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                <p className="font-black">Row {member.row}: {member.name}</p>
                <p className="mt-0.5 break-all text-xs font-semibold">{member.email}</p>
              </div>
            ))}
            {!existingUpdateMembers.length ? <p className="text-sm font-bold text-rose-800">{existingUpdateCount} existing seller record{existingUpdateCount === 1 ? '' : 's'} will be updated.</p> : null}
          </div>
        </DoubleCheckSection>
      ),
    })
  }

  return (
    <DoubleCheckShell
      title={request.title || 'Review Network Member Import'}
      description={request.description || (existingUpdateCount > 0 ? 'Review the existing seller updates carefully. No partial import is allowed; if any row becomes invalid before saving, the entire import is rolled back.' : 'No partial import is allowed. If any row becomes invalid before saving, the entire import is rolled back.')}
      confirmLabel={request.confirmLabel || 'Confirm Member Import'}
      summary={data.network || data.filename}
      steps={steps}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export default NetworkMemberImportDoubleCheck

