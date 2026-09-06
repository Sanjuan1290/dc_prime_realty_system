import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiClock, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const normalizeTime = (value) => value ? String(value).slice(0, 5) : ''

const AttendanceCorrectionModal = ({ record, employees = [], defaultDate, onClose, onSaved }) => {
  const isEdit = Boolean(record?.employee_attendance_id)
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    employee_id: String(record?.employee_id || employees?.[0]?.employee_id || ''),
    attendance_date: record?.attendance_date?.slice?.(0, 10) || defaultDate || '',
    actual_time_in: normalizeTime(record?.actual_time_in),
    actual_time_out: normalizeTime(record?.actual_time_out),
    reason: '',
  })

  const employee = useMemo(() => employees.find((item) => Number(item.employee_id) === Number(form.employee_id)) || null, [employees, form.employee_id])
  const update = (field, value) => { setNotice(null); setForm((current) => ({ ...current, [field]: value })) }

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? useFetchPut(`/attendance/${record.employee_attendance_id}/correction`, {
          actual_time_in: form.actual_time_in || null,
          actual_time_out: form.actual_time_out || null,
          reason: form.reason,
        }, { confirmationHandled: 'compact' })
      : useFetchPost('/attendance/manual', {
          employee_id: Number(form.employee_id),
          attendance_date: form.attendance_date,
          actual_time_in: form.actual_time_in || null,
          actual_time_out: form.actual_time_out || null,
          reason: form.reason,
        }, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: isEdit ? 'Saving attendance correction...' : 'Adding manual attendance...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      onSaved?.(result?.message || 'Attendance saved.')
      onClose?.()
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save attendance.' }),
  })

  const submit = (event) => {
    event.preventDefault()
    if (!isEdit && (!form.employee_id || !form.attendance_date)) { setNotice({ type: 'warning', message: 'Employee and date are required.' }); return }
    if (!form.reason.trim()) { setNotice({ type: 'warning', message: 'Enter a reason for this manual attendance change.' }); return }
    if (!isEdit && !form.actual_time_in) { setNotice({ type: 'warning', message: 'Time In is required for manual attendance. Use Company Event when exact times are intentionally not recorded.' }); return }
    if (isEdit && !record?.attendance_event_id && !form.actual_time_in) { setNotice({ type: 'warning', message: 'Time In is required for non-event attendance records.' }); return }
    if (!form.actual_time_in && form.actual_time_out) { setNotice({ type: 'warning', message: 'Time Out cannot be saved without a Time In.' }); return }
    if (form.actual_time_in && form.actual_time_out && form.actual_time_out < form.actual_time_in) { setNotice({ type: 'warning', message: 'Time Out cannot be earlier than Time In.' }); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><FiClock /></span><div><h3 className="font-black text-slate-950">{isEdit ? 'Correct Attendance' : 'Add Manual Attendance'}</h3><p className="text-xs font-semibold text-slate-500">Manual changes are recorded in the audit trail.</p></div></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="grid gap-4 p-5">
          {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}
          {isEdit ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-950">{record.full_name}</p><p className="text-sm font-semibold text-slate-500">{record.employee_code} · {String(record.attendance_date).slice(0, 10)}</p></div> : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Employee *</span><select className={inputClass} value={form.employee_id} onChange={(e) => update('employee_id', e.target.value)}><option value="">Select Employee</option>{employees.map((item) => <option key={item.employee_id} value={item.employee_id}>{item.full_name} · {item.employee_code}</option>)}</select></label>
              <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Date *</span><input type="date" className={inputClass} value={form.attendance_date} onChange={(e) => update('attendance_date', e.target.value)} /></label>
            </div>
          )}

          {!isEdit && employee ? <p className="text-xs font-semibold text-slate-500">{employee.department} · {employee.employment_label || String(employee.employment_type || '').replace('_', ' ')}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Time In</span><input type="time" step="60" className={inputClass} value={form.actual_time_in} onChange={(e) => update('actual_time_in', e.target.value)} /></label>
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Time Out</span><input type="time" step="60" className={inputClass} value={form.actual_time_out} onChange={(e) => update('actual_time_out', e.target.value)} /></label>
          </div>

          <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Reason *</span><textarea rows={3} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" value={form.reason} onChange={(e) => update('reason', e.target.value)} placeholder="Example: Employee forgot to time out after leaving the office." /></label>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiSave />{mutation.isPending ? 'Saving...' : 'Save Attendance'}</button></footer>
      </form>
    </div>
  )
}

export default AttendanceCorrectionModal
