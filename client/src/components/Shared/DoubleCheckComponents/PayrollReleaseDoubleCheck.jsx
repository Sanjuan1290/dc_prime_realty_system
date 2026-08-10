import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, pick } from './core/doubleCheckFormatters'

const PayrollReleaseDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const summary = data.summary || request.meta?.summary || {}
  const steps = [
    { key: 'release', title: 'Salary Release', content: <DoubleCheckSection title="Salary Release" helper="Verify the release date, witness, and notes." tone="blue"><DoubleCheckFields fields={[
      { label: 'Release Date', value: pick(data, 'releaseDate'), formatter: formatDate },
      { label: 'Witness Name', value: pick(data, 'witnessName'), wide: true },
      { label: 'Release Notes', value: pick(data, 'releaseNotes'), wide: true },
    ]} /></DoubleCheckSection> },
    { key: 'summary', title: 'Payroll Summary', content: <DoubleCheckSection title="Payroll Summary" helper="Verify the calculated payroll totals before finalizing the permanent snapshot." tone="amber"><DoubleCheckFields fields={[
      { label: 'Employees', value: pick(summary, 'employeeCount') },
      { label: 'Gross Payroll', value: pick(summary, 'grossPayroll'), formatter: money, tone: 'financial' },
      { label: 'Attendance Deductions', value: pick(summary, 'attendanceDeductions'), formatter: money, tone: 'financial' },
      { label: 'Cash Advance Deductions', value: pick(summary, 'cashAdvanceDeductions'), formatter: money, tone: 'financial' },
      { label: 'Allowances', value: pick(summary, 'allowances'), formatter: money, tone: 'financial' },
      { label: 'Attendance Bonuses', value: pick(summary, 'attendanceBonuses'), formatter: money, tone: 'financial' },
      { label: 'Net Payroll', value: pick(summary, 'netPayroll'), formatter: money, tone: 'financial' },
    ]} /></DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || 'Review Salary Release'} description={request.description || 'Verify release details and payroll totals before finalizing the snapshot.'} confirmLabel={request.confirmLabel || 'Confirm & Finalize Salary Release'} summary={formatDate(pick(data, 'releaseDate'))} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default PayrollReleaseDoubleCheck

