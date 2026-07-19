import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiClock, FiSave, FiSearch, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'
const statuses = [
  ['present', 'Present'], ['late', 'Late'], ['absent', 'Absent'], ['half_day', 'Half Day'],
  ['paid_leave', 'Paid Leave'], ['unpaid_leave', 'Unpaid Leave'], ['rest_day', 'Rest Day'],
  ['regular_holiday', 'Regular Holiday'], ['special_holiday', 'Special Non-Working Holiday'],
]

const getEmployeeSearchText = (employee = {}) => [
  employee.employee_code,
  employee.full_name,
  employee.position,
  employee.department,
  employee.email,
].filter(Boolean).join(' ').toLowerCase()

const AttendanceModal = ({ record, employees = [], onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const isEdit = Boolean(record?.employee_attendance_id)
  const [notice, setNotice] = useState(null)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [form, setForm] = useState({
    employee_id: String(record?.employee_id || employees?.[0]?.employee_id || ''),
    attendance_date: record?.attendance_date || new Date().toISOString().slice(0, 10),
    actual_time_in: record?.actual_time_in?.slice(0, 8) || '08:00:00',
    actual_time_out: record?.actual_time_out?.slice(0, 8) || '17:00:00',
    attendance_status: record?.attendance_status || 'present',
    notes: record?.notes || '',
    source: record?.source || 'manual',
  })

  const selectedEmployee = useMemo(
    () => employees.find((employee) => Number(employee.employee_id) === Number(form.employee_id)),
    [employees, form.employee_id]
  )

  // Search stays inside the modal so the selected employee ID is still what the API receives.
  const filteredEmployees = useMemo(() => {
    const keyword = employeeSearch.trim().toLowerCase()
    if (!keyword) return employees

    const matches = employees.filter((employee) => getEmployeeSearchText(employee).includes(keyword))
    if (selectedEmployee && !matches.some((employee) => Number(employee.employee_id) === Number(selectedEmployee.employee_id))) {
      return [selectedEmployee, ...matches]
    }
    return matches
  }, [employeeSearch, employees, selectedEmployee])

  const selectedWeekday = form.attendance_date
    ? new Date(`${form.attendance_date}T00:00:00Z`).getUTCDay()
    : null
  const schedule = selectedEmployee?.schedules?.find((item) => Number(item.weekday) === selectedWeekday)
  const requiresTimes = ['present', 'late', 'half_day'].includes(form.attendance_status)

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? useFetchPut(`/attendance/${record.employee_attendance_id}`, form)
      : useFetchPost('/attendance', form),
    onMutate: () => setNotice({
      type: 'loading',
      message: isEdit ? 'Saving attendance changes...' : 'Recording attendance...',
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-preview'] })
      queryClient.invalidateQueries({ queryKey: ['employee-logbook'] })
      onSaved?.(result?.message || 'Attendance saved.')
      onClose()
    },
    onError: (error) => setNotice({
      type: 'error',
      message: error?.message || 'Failed to save attendance.',
    }),
  })

  const setValue = (field, value) => {
    setNotice(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.employee_id || !form.attendance_date) {
      setNotice({ type: 'warning', message: 'Employee and attendance date are required.' })
      return
    }
    if (requiresTimes && !form.actual_time_in) {
      setNotice({ type: 'warning', message: 'Time in is required for this attendance status.' })
      return
    }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiClock /></span>
            <div>
              <h2 className="text-xl font-black">{isEdit ? 'Edit Attendance' : 'Add Attendance'}</h2>
              <p className="text-sm font-semibold text-slate-500">Times are saved to the second for salary deduction calculations.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {notice ? <StatusAlert type={notice.type} message={notice.message} className="mb-4" /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-xs font-black text-slate-700">Employee <span className="text-red-500">*</span></span>
              {!isEdit ? (
                <label className="relative">
                  <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search name, employee code, position, department, or email..."
                    className={`${inputClass} w-full pl-11`}
                  />
                </label>
              ) : null}
              <select
                className={inputClass}
                value={form.employee_id}
                onChange={(event) => setValue('employee_id', event.target.value)}
                disabled={isEdit}
                required
              >
                {!employees.length ? <option value="">No active employees available</option> : null}
                {employees.length && !filteredEmployees.length ? <option value="">No employees match your search</option> : null}
                {filteredEmployees.map((employee) => (
                  <option key={employee.employee_id} value={employee.employee_id}>
                    {employee.employee_code} · {employee.full_name} · {employee.position || 'No position'}
                  </option>
                ))}
              </select>
              {!isEdit ? <p className="text-xs font-semibold text-slate-500">Showing {filteredEmployees.length} of {employees.length} active employee(s).</p> : null}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Attendance Date *</span>
              <input type="date" className={inputClass} value={form.attendance_date} onChange={(event) => setValue('attendance_date', event.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Status *</span>
              <select className={inputClass} value={form.attendance_status} onChange={(event) => setValue('attendance_status', event.target.value)}>
                {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Actual Time In {requiresTimes ? '*' : ''}</span>
              <input type="time" step="1" className={inputClass} value={requiresTimes ? form.actual_time_in : ''} disabled={!requiresTimes} onChange={(event) => setValue('actual_time_in', event.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Actual Time Out</span>
              <input type="time" step="1" className={inputClass} value={requiresTimes ? form.actual_time_out : ''} disabled={!requiresTimes} onChange={(event) => setValue('actual_time_out', event.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-black text-slate-700">Notes</span>
              <textarea rows={3} className={`${inputClass} h-auto py-3`} value={form.notes} onChange={(event) => setValue('notes', event.target.value)} placeholder="Reason for absence, correction note, or attendance details" />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
            <p className="font-black">Schedule Preview</p>
            <p className="mt-1">{schedule?.is_work_day ? `${schedule.shift_start?.slice(0, 8)} to ${schedule.shift_end?.slice(0, 8)} · ${schedule.break_minutes} minute break` : 'Selected date is a rest day based on the employee schedule.'}</p>
            <p className="mt-1 text-xs text-blue-700">Attendance-bonus grace: {selectedEmployee?.attendance_grace_minutes ?? 15} minute(s). Every late second is still counted for salary; the grace only decides bonus eligibility.</p>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending || !employees.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiSave />{mutation.isPending ? 'Saving...' : 'Save Attendance'}</button>
        </footer>
      </form>
    </div>
  )
}

export default AttendanceModal

