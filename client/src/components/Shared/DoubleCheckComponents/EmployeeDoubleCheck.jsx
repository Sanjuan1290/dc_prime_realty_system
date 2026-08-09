import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, percent, pick, statusLabel, titleCase } from './core/doubleCheckFormatters'

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const EmployeeDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const workDays = Array.isArray(data.work_days) ? data.work_days.map((day) => weekdayNames[Number(day)] || String(day)).join(', ') : ''
  const steps = [
    { key: 'employee', title: 'Employee Information', content: <DoubleCheckSection title="Employee Information" helper="Verify identity, contact, department, position, and employment status." tone="blue"><DoubleCheckFields fields={[
      { label: 'Employee Code', value: pick(data, 'employee_code') },
      { label: 'First Name', value: pick(data, 'first_name') },
      { label: 'Middle Name', value: pick(data, 'middle_name') },
      { label: 'Last Name', value: pick(data, 'last_name') },
      { label: 'Email', value: pick(data, 'email') },
      { label: 'Contact Number', value: pick(data, 'contact_number') },
      { label: 'Address', value: pick(data, 'address'), wide: true },
      { label: 'Department', value: pick(data, 'department') },
      { label: 'Position', value: pick(data, 'position') },
      { label: 'Employment Type', value: pick(data, 'employment_type'), formatter: titleCase },
      { label: 'Hire Date', value: pick(data, 'hire_date'), formatter: formatDate },
      { label: 'Status', value: pick(data, 'employee_status'), formatter: statusLabel },
    ]} /></DoubleCheckSection> },
    { key: 'payroll', title: 'Payroll & Schedule', content: <DoubleCheckSection title="Payroll & Schedule" helper="Verify salary, allowances, bonus rules, shift, and work days." tone="amber"><DoubleCheckFields fields={[
      { label: 'Monthly Salary', value: pick(data, 'monthly_salary'), formatter: money, tone: 'financial' },
      { label: 'Rice Allowance', value: pick(data, 'rice_allowance'), formatter: money, tone: 'financial' },
      { label: 'Transportation Allowance', value: pick(data, 'transportation_allowance'), formatter: money, tone: 'financial' },
      { label: 'Attendance Bonus', value: pick(data, 'attendance_bonus_amount'), formatter: money, tone: 'financial' },
      { label: 'Attendance Grace (Minutes)', value: pick(data, 'attendance_grace_minutes') },
      { label: 'Overtime Multiplier', value: pick(data, 'overtime_multiplier') },
      { label: 'Night Differential', value: pick(data, 'night_differential_percent'), formatter: percent, tone: 'financial' },
      { label: 'Shift Start', value: pick(data, 'shift_start') },
      { label: 'Shift End', value: pick(data, 'shift_end') },
      { label: 'Break Minutes', value: pick(data, 'break_minutes') },
      { label: 'Work Days', value: workDays, wide: true },
    ]} /></DoubleCheckSection> },
  ]
  const name = [pick(data, 'first_name'), pick(data, 'middle_name'), pick(data, 'last_name')].filter(Boolean).join(' ')
  return <DoubleCheckShell title={request.title || (request.mode === 'edit' ? 'Review Employee Changes' : 'Review New Employee')} description={request.description || 'Verify employee information and payroll settings before saving.'} confirmLabel={request.confirmLabel || 'Confirm & Save Employee'} summary={name} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default EmployeeDoubleCheck
