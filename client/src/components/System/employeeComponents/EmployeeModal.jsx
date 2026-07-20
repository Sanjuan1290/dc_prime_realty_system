import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiSave, FiUser, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const weekdays = [
  ['0', 'Sunday'], ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'],
  ['4', 'Thursday'], ['5', 'Friday'], ['6', 'Saturday'],
]

const getInitialForm = (employee) => ({
  employee_code: employee?.employee_code || '',
  first_name: employee?.first_name || '',
  middle_name: employee?.middle_name || '',
  last_name: employee?.last_name || '',
  email: employee?.email || '',
  contact_number: employee?.contact_number || '',
  address: employee?.address || '',
  department: employee?.department || '',
  position: employee?.position || '',
  employment_type: employee?.employment_type || 'regular',
  hire_date: employee?.hire_date || new Date().toISOString().slice(0, 10),
  monthly_salary: employee?.monthly_salary ?? '',
  attendance_grace_minutes: employee?.attendance_grace_minutes ?? 15,
  rice_allowance: employee?.rice_allowance ?? 500,
  transportation_allowance: employee?.transportation_allowance ?? 500,
  attendance_bonus_amount: employee?.attendance_bonus_amount ?? 3000,
  overtime_multiplier: employee?.overtime_multiplier ?? 2,
  night_differential_percent: employee?.night_differential_percent ?? 0,
  employee_status: employee?.employee_status || 'active',
  shift_start: employee?.schedules?.find((item) => item.is_work_day)?.shift_start?.slice(0, 5) || '08:00',
  shift_end: employee?.schedules?.find((item) => item.is_work_day)?.shift_end?.slice(0, 5) || '17:00',
  break_minutes: employee?.schedules?.find((item) => item.is_work_day)?.break_minutes ?? 60,
  work_days: (employee?.work_days || [1, 2, 3, 4, 5]).map(String),
})

const Field = ({ label, required, helper, children, className = '' }) => (
  <label className={`flex flex-col gap-1.5 ${className}`}>
    <span className="text-xs font-black text-slate-700">{label}{required ? <span className="text-red-500"> *</span> : null}</span>
    {children}
    {helper ? <span className="text-xs font-semibold text-slate-500">{helper}</span> : null}
  </label>
)

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const EmployeeModal = ({ employee, onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => getInitialForm(employee))
  const [notice, setNotice] = useState(null)
  const isEdit = Boolean(employee?.employee_id)
  const title = isEdit ? 'Edit Employee' : 'Add Employee'

  const payload = useMemo(() => ({
    ...form,
    monthly_salary: Number(form.monthly_salary || 0),
    attendance_grace_minutes: Number(form.attendance_grace_minutes || 0),
    rice_allowance: Number(form.rice_allowance || 0),
    transportation_allowance: Number(form.transportation_allowance || 0),
    attendance_bonus_amount: Number(form.attendance_bonus_amount || 0),
    overtime_multiplier: Number(form.overtime_multiplier || 0),
    night_differential_percent: Number(form.night_differential_percent || 0),
    break_minutes: Number(form.break_minutes || 0),
    work_days: form.work_days.map(Number),
  }), [form])

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? useFetchPut(`/employees/${employee.employee_id}`, payload)
      : useFetchPost('/employees', payload),
    onMutate: () => setNotice({ type: 'loading', message: isEdit ? 'Saving employee changes...' : 'Adding employee...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee-options'] })
      onSaved?.(result?.message || 'Employee saved.')
      onClose()
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save employee.' }),
  })

  const setValue = (field, value) => { setNotice(null); setForm((current) => ({ ...current, [field]: value })) }
  const toggleWorkDay = (value) => setForm((current) => ({
    ...current,
    work_days: current.work_days.includes(value) ? current.work_days.filter((item) => item !== value) : [...current.work_days, value],
  }))

  const submit = (event) => {
    event.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.position.trim() || !form.hire_date) {
      setNotice({ type: 'warning', message: 'First name, last name, position, and hire date are required.' }); return
    }
    if (Number(form.monthly_salary) <= 0) { setNotice({ type: 'warning', message: 'Monthly salary must be greater than zero.' }); return }
    if (!form.work_days.length) { setNotice({ type: 'warning', message: 'Select at least one work day.' }); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiUser className="h-5 w-5" /></span><div><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="text-sm font-semibold text-slate-500">Employee profile, salary, and work schedule.</p></div></div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} className="mb-5" /> : null}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Employee Code" helper="Leave blank to generate EMP-0001."><input className={inputClass} value={form.employee_code} onChange={(e) => setValue('employee_code', e.target.value.toUpperCase())} placeholder="EMP-0001" /></Field>
            <Field label="First Name" required><input className={inputClass} value={form.first_name} onChange={(e) => setValue('first_name', e.target.value)} placeholder="Juan" /></Field>
            <Field label="Middle Name"><input className={inputClass} value={form.middle_name} onChange={(e) => setValue('middle_name', e.target.value)} placeholder="Santos" /></Field>
            <Field label="Last Name" required><input className={inputClass} value={form.last_name} onChange={(e) => setValue('last_name', e.target.value)} placeholder="Dela Cruz" /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(e) => setValue('email', e.target.value)} placeholder="employee@company.com" /></Field>
            <Field label="Contact Number"><input className={inputClass} value={form.contact_number} onChange={(e) => setValue('contact_number', e.target.value)} placeholder="09XX XXX XXXX" /></Field>
            <Field label="Department"><input className={inputClass} value={form.department} onChange={(e) => setValue('department', e.target.value)} placeholder="Administration" /></Field>
            <Field label="Position" required><input className={inputClass} value={form.position} onChange={(e) => setValue('position', e.target.value)} placeholder="Office Staff" /></Field>
            <Field label="Employment Type"><select className={inputClass} value={form.employment_type} onChange={(e) => setValue('employment_type', e.target.value)}><option value="regular">Regular</option><option value="probationary">Probationary</option><option value="contractual">Contractual</option><option value="part_time">Part Time</option><option value="intern">Intern</option></select></Field>
            <Field label="Hire Date" required><input type="date" className={inputClass} value={form.hire_date} onChange={(e) => setValue('hire_date', e.target.value)} /></Field>
            <Field label="Monthly Salary" required helper="The daily rate is calculated from the employee's scheduled work days in the salary month."><input type="number" min="0" step="0.01" className={inputClass} value={form.monthly_salary} onChange={(e) => setValue('monthly_salary', e.target.value)} placeholder="15000.00" /></Field>
            <Field label="Attendance Bonus Grace (minutes)" helper="Late time is still deducted. This grace only controls the ₱3,000 attendance-bonus qualification."><input type="number" min="0" max="180" className={inputClass} value={form.attendance_grace_minutes} onChange={(e) => setValue('attendance_grace_minutes', e.target.value)} placeholder="15" /></Field>
            <Field label="Rice Allowance per Salary Release" helper="Added to both the 7th and 22nd salary releases."><input type="number" min="0" step="0.01" className={inputClass} value={form.rice_allowance} onChange={(e) => setValue('rice_allowance', e.target.value)} placeholder="500.00" /></Field>
            <Field label="Transportation Allowance (7th Release Only)" helper="Added only to the salary release dated on the 7th."><input type="number" min="0" step="0.01" className={inputClass} value={form.transportation_allowance} onChange={(e) => setValue('transportation_allowance', e.target.value)} placeholder="500.00" /></Field>
            <Field label="Attendance Bonus (7th Release)" helper="Paid only when the employee passes the full previous-month attendance check."><input type="number" min="0" step="0.01" className={inputClass} value={form.attendance_bonus_amount} onChange={(e) => setValue('attendance_bonus_amount', e.target.value)} placeholder="3000.00" /></Field>
            <Field label="Overtime Multiplier"><input type="number" min="0" step="0.01" className={inputClass} value={form.overtime_multiplier} onChange={(e) => setValue('overtime_multiplier', e.target.value)} placeholder="2.00" /></Field>
            <Field label="Night Differential (%)" helper="Set to 0 when night differential is not used."><input type="number" min="0" max="100" step="0.01" className={inputClass} value={form.night_differential_percent} onChange={(e) => setValue('night_differential_percent', e.target.value)} placeholder="0.00" /></Field>
            <Field label="Status"><select className={inputClass} value={form.employee_status} onChange={(e) => setValue('employee_status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></Field>
            <Field label="Address" className="md:col-span-2 xl:col-span-3"><textarea rows={3} className={`${inputClass} h-auto py-3`} value={form.address} onChange={(e) => setValue('address', e.target.value)} placeholder="Complete home address" /></Field>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <h3 className="font-black text-slate-950">Default Work Schedule</h3><p className="mt-1 text-xs font-semibold text-slate-500">The system uses this schedule to calculate late seconds and undertime deductions.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Shift Start"><input type="time" step="1" className={inputClass} value={form.shift_start} onChange={(e) => setValue('shift_start', e.target.value)} /></Field>
              <Field label="Shift End"><input type="time" step="1" className={inputClass} value={form.shift_end} onChange={(e) => setValue('shift_end', e.target.value)} /></Field>
              <Field label="Unpaid Break (minutes)"><input type="number" min="0" max="480" className={inputClass} value={form.break_minutes} onChange={(e) => setValue('break_minutes', e.target.value)} /></Field>
            </div>
            <div className="mt-4"><p className="mb-2 text-xs font-black text-slate-700">Work Days</p><div className="flex flex-wrap gap-2">{weekdays.map(([value, label]) => <label key={value} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-black transition ${form.work_days.includes(value) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}><input type="checkbox" className="sr-only" checked={form.work_days.includes(value)} onChange={() => toggleWorkDay(value)} />{label}</label>)}</div></div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiSave />{mutation.isPending ? 'Saving...' : isEdit ? 'Save Employee' : 'Add Employee'}</button>
        </footer>
      </form>
    </div>
  )
}

export default EmployeeModal


