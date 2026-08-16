import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, pick, statusLabel } from './core/doubleCheckFormatters'

const AttendanceDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const steps = [{ key: 'attendance', title: 'Attendance Record', content: <DoubleCheckSection title="Attendance Record" helper="Verify the employee, date, time, status, and notes." tone="blue"><DoubleCheckFields fields={[
    { label: 'Employee', value: pick(data, 'employee_name', 'employeeName') || request.meta?.employeeName, wide: true },
    { label: 'Attendance Date', value: pick(data, 'attendance_date'), formatter: formatDate },
    { label: 'Time In', value: pick(data, 'actual_time_in') },
    { label: 'Time Out', value: pick(data, 'actual_time_out') },
    { label: 'Attendance Status', value: pick(data, 'attendance_status'), formatter: statusLabel },
    { label: 'Notes', value: pick(data, 'notes'), wide: true },
  ]} /></DoubleCheckSection> }]
  return <DoubleCheckShell title={request.title || (request.mode === 'edit' ? 'Review Attendance Changes' : 'Review Attendance')} description={request.description || 'Verify attendance details before saving.'} confirmLabel={request.confirmLabel || 'Confirm & Save Attendance'} summary={pick(data, 'employee_name') || request.meta?.employeeName} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default AttendanceDoubleCheck
