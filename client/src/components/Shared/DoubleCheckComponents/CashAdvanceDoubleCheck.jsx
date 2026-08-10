import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, pick } from './core/doubleCheckFormatters'

const CashAdvanceDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const steps = [{ key: 'advance', title: 'Cash Advance', content: <DoubleCheckSection title="Cash Advance" helper="Verify the employee, request date, amount, and notes." tone="amber"><DoubleCheckFields fields={[
    { label: 'Employee', value: pick(data, 'employee_name', 'employeeName') || request.meta?.employeeName, wide: true },
    { label: 'Request Date', value: pick(data, 'request_date', 'deduction_date'), formatter: formatDate },
    { label: request.variant === 'deduction' ? 'Deduction Amount' : 'Advance Amount', value: pick(data, 'amount'), formatter: money, tone: 'financial' },
    { label: 'Notes', value: pick(data, 'notes'), wide: true },
  ]} /></DoubleCheckSection> }]
  return <DoubleCheckShell title={request.title || (request.variant === 'deduction' ? 'Review Cash Advance Deduction' : 'Review Cash Advance')} description={request.description || 'Verify the cash-advance information before saving.'} confirmLabel={request.confirmLabel || (request.variant === 'deduction' ? 'Confirm & Record Deduction' : 'Confirm & Save Cash Advance')} summary={pick(data, 'employee_name') || request.meta?.employeeName} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default CashAdvanceDoubleCheck

