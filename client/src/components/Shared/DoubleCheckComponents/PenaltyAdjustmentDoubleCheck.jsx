import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, pick, titleCase } from './core/doubleCheckFormatters'

const PenaltyAdjustmentDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const row = data.soaRow || {}
  const actionData = data.waiver || data.extension || data.correction || data.reduction || data.restore || data.adjustment || data
  const steps = [
    { key: 'installment', title: 'SOA Installment', content: <DoubleCheckSection title="SOA Installment" helper="Verify the installment affected by this adjustment." tone="blue"><DoubleCheckFields fields={[
      { label: 'Description', value: pick(row, 'description') },
      { label: 'Due Date', value: pick(row, 'dueDate', 'due_date'), formatter: formatDate },
      { label: 'Monthly Due', value: pick(row, 'monthlyDue', 'monthly_due'), formatter: money, tone: 'financial' },
      { label: 'Current Penalty', value: pick(row, 'penalty', 'penaltyAmount', 'outstandingPenaltyAmount'), formatter: money, tone: 'financial' },
      { label: 'Status', value: pick(row, 'status'), formatter: titleCase },
    ]} /></DoubleCheckSection> },
    { key: 'adjustment', title: 'Requested Adjustment', content: <DoubleCheckSection title="Requested Adjustment" helper="Verify only the values entered for this penalty or LMF action." tone="amber"><DoubleCheckFields fields={[
      { label: 'Action', value: request.actionLabel || request.meta?.actionLabel || request.title, wide: true },
      { label: 'Reduction Type', value: pick(actionData, 'waiverType'), formatter: titleCase },
      { label: 'Amount', value: pick(actionData, 'amount', 'waiverAmount', 'reductionAmount', 'correctedAmount'), formatter: money, tone: 'financial' },
      { label: 'New Payment Date', value: pick(actionData, 'newPaymentDate', 'promisedPaymentDate', 'paymentDate'), formatter: formatDate },
      { label: 'Approval Reference', value: pick(actionData, 'approvalReference', 'reference', 'referenceNumber', 'referenceId'), wide: true },
      { label: 'Reason', value: pick(actionData, 'reason'), wide: true },
      { label: 'Private Notes', value: pick(actionData, 'internalNotes', 'notes'), wide: true },
    ]} /></DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || 'Review Penalty Adjustment'} description={request.description || 'Verify the installment and requested adjustment before saving.'} confirmLabel={request.confirmLabel || 'Confirm & Save Adjustment'} summary={pick(row, 'description')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default PenaltyAdjustmentDoubleCheck
