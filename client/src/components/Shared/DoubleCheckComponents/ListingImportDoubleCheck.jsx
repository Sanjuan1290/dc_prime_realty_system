import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'

const ListingImportDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const isReversal = request.type === 'listing-import-reversal' || request.variant === 'reversal'
  const fields = isReversal
    ? [
        { label: 'Import Batch', value: data.batchReference },
        { label: 'Filename', value: data.filename },
        { label: 'Mode', value: String(data.mode || '').replaceAll('_', ' ') },
        { label: 'Listings Selected', value: data.listingCount },
        { label: 'Reason', value: data.reason, wide: true, tone: 'important' },
      ]
    : [
        { label: 'Project', value: data.project },
        { label: 'Filename', value: data.filename },
        { label: 'Listings to Import', value: data.rowCount, tone: 'important' },
        { label: 'Initial Status', value: data.status },
        { label: 'Document Requirements', value: data.documents },
      ]

  const steps = [{
    key: 'review',
    title: isReversal ? 'Import Reversal' : 'Listing Import',
    content: (
      <DoubleCheckSection
        title={isReversal ? 'Import Reversal' : 'Listing Import'}
        helper={isReversal
          ? 'Verify the exact batch and reason. Protected buyer/account history will never be removed by this action.'
          : 'Verify the project, file, row count, and automatic defaults before creating inventory.'}
        tone={isReversal ? 'red' : 'blue'}
      >
        <DoubleCheckFields fields={fields} />
      </DoubleCheckSection>
    ),
  }]

  return (
    <DoubleCheckShell
      title={request.title || (isReversal ? 'Review Import Reversal' : 'Review Listing Import')}
      description={request.description || (isReversal ? 'This is a destructive inventory correction and will be fully audited.' : 'The server validates the complete file again before any listing is created.')}
      confirmLabel={request.confirmLabel || (isReversal ? 'Confirm Reversal' : 'Confirm Import')}
      summary={data.batchReference || data.filename || data.project}
      steps={steps}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export default ListingImportDoubleCheck

