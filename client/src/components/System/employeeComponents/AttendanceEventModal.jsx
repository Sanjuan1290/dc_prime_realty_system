import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiCalendar, FiSave, FiSearch, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const AttendanceEventModal = ({ event, employees = [], defaultDate, onClose, onSaved }) => {
  const isEdit = Boolean(event?.attendance_event_id)
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(null)
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [form, setForm] = useState({
    event_name: event?.event_name || '',
    start_date: event?.start_date?.slice?.(0, 10) || defaultDate || '',
    end_date: event?.end_date?.slice?.(0, 10) || event?.start_date?.slice?.(0, 10) || defaultDate || '',
    location: event?.location || '',
    attendance_treatment: event?.attendance_treatment || 'record_only',
    event_time_in: event?.event_time_in ? String(event.event_time_in).slice(0, 5) : '',
    event_time_out: event?.event_time_out ? String(event.event_time_out).slice(0, 5) : '',
    day_type: event?.day_type || 'regular',
    notes: event?.notes || '',
    employee_ids: event?.participants?.map((item) => Number(item.employee_id)) || [],
  })

  const departments = useMemo(() => Array.from(new Set(employees.map((item) => item.department).filter(Boolean))).sort(), [employees])
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employees.filter((employee) => {
      if (departmentFilter !== 'all' && employee.department !== departmentFilter) return false
      if (!term) return true
      return `${employee.full_name} ${employee.employee_code} ${employee.department}`.toLowerCase().includes(term)
    })
  }, [employees, search, departmentFilter])
  const selected = new Set(form.employee_ids.map(Number))
  const update = (field, value) => { setNotice(null); setForm((current) => ({ ...current, [field]: value })) }
  const toggleEmployee = (employeeId) => setForm((current) => ({ ...current, employee_ids: current.employee_ids.includes(employeeId) ? current.employee_ids.filter((id) => id !== employeeId) : [...current.employee_ids, employeeId] }))
  const selectAllActive = () => setForm((current) => ({ ...current, employee_ids: employees.map((item) => Number(item.employee_id)) }))
  const selectVisible = () => setForm((current) => ({ ...current, employee_ids: Array.from(new Set([...current.employee_ids, ...filteredEmployees.map((item) => Number(item.employee_id))])) }))
  const clearVisible = () => setForm((current) => ({ ...current, employee_ids: current.employee_ids.filter((id) => !filteredEmployees.some((item) => Number(item.employee_id) === Number(id))) }))

  const mutation = useMutation({
    mutationFn: () => isEdit ? useFetchPut(`/attendance/events/${event.attendance_event_id}`, form, { confirmationHandled: 'compact' }) : useFetchPost('/attendance/events', form, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: isEdit ? 'Updating company event...' : 'Creating company event attendance...' }),
    onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); queryClient.invalidateQueries({ queryKey: ['attendance-events'] }); onSaved?.(result?.message || 'Company event saved.'); onClose?.() },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save company event.' }),
  })

  const submit = (e) => {
    e.preventDefault()
    if (!form.event_name.trim() || !form.start_date || !form.end_date) { setNotice({ type: 'warning', message: 'Event name and date are required.' }); return }
    if (!form.employee_ids.length) { setNotice({ type: 'warning', message: 'Select at least one participant.' }); return }
    if (form.attendance_treatment !== 'record_only' && (!form.event_time_in || !form.event_time_out)) { setNotice({ type: 'warning', message: 'Time In and Time Out are required for Full Day and Custom Time events.' }); return }
    if (form.event_time_in && form.event_time_out && form.event_time_out < form.event_time_in) { setNotice({ type: 'warning', message: 'Event Time Out cannot be earlier than Event Time In.' }); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><FiCalendar /></span><div><h3 className="font-black text-slate-950">{isEdit ? 'Edit Company Event' : 'Add Company Event'}</h3><p className="text-xs font-semibold text-slate-500">Record off-site attendance without pretending employees used the office scanner.</p></div></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button></header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-5">
            {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}
            <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 md:col-span-2"><span className="text-sm font-black text-slate-700">Event Name *</span><input className={inputClass} value={form.event_name} onChange={(e) => update('event_name', e.target.value)} placeholder="Annual Team Building" /></label><label className="grid gap-2"><span className="text-sm font-black text-slate-700">Start Date *</span><input type="date" className={inputClass} value={form.start_date} onChange={(e) => update('start_date', e.target.value)} /></label><label className="grid gap-2"><span className="text-sm font-black text-slate-700">End Date *</span><input type="date" className={inputClass} value={form.end_date} min={form.start_date} onChange={(e) => update('end_date', e.target.value)} /></label><label className="grid gap-2 md:col-span-2"><span className="text-sm font-black text-slate-700">Location</span><input className={inputClass} value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Tagaytay City" /></label></div>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-2"><span className="text-sm font-black text-slate-700">Attendance Treatment</span><select className={inputClass} value={form.attendance_treatment} onChange={(e) => update('attendance_treatment', e.target.value)}><option value="record_only">Attendance Record Only</option><option value="full_day">Full Day Present</option><option value="custom_time">Custom Time</option></select></label><label className="grid gap-2"><span className="text-sm font-black text-slate-700">Day Classification</span><select className={inputClass} value={form.day_type} onChange={(e) => update('day_type', e.target.value)}><option value="regular">Regular Day</option><option value="double_pay">Double Pay Day</option><option value="regular_holiday">Regular Holiday</option><option value="special_holiday">Special Holiday</option></select></label>{form.attendance_treatment !== 'record_only' ? <><label className="grid gap-2"><span className="text-sm font-black text-slate-700">Event Time In *</span><input type="time" className={inputClass} value={form.event_time_in} onChange={(e) => update('event_time_in', e.target.value)} /></label><label className="grid gap-2"><span className="text-sm font-black text-slate-700">Event Time Out *</span><input type="time" className={inputClass} value={form.event_time_out} onChange={(e) => update('event_time_out', e.target.value)} /></label></> : null}</div><p className="mt-3 text-xs font-semibold text-slate-500">Attendance Record Only marks participants as present without inventing exact arrival and departure times.</p></section>

            <section className="rounded-2xl border border-slate-200"><div className="border-b border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h4 className="font-black text-slate-950">Participants ({form.employee_ids.length})</h4><p className="text-xs font-semibold text-slate-500">Select all active employees, a department, or individual employees.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={selectAllActive} className="h-9 rounded-lg bg-violet-600 px-3 text-xs font-black text-white">Select All Active</button><button type="button" onClick={selectVisible} className="h-9 rounded-lg bg-blue-50 px-3 text-xs font-black text-blue-700">Select Visible</button><button type="button" onClick={clearVisible} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700">Clear Visible</button></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm font-semibold" /></label><select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="all">All Departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div><div className="max-h-72 overflow-y-auto p-3"><div className="grid gap-2 md:grid-cols-2">{filteredEmployees.map((employee) => <label key={employee.employee_id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected.has(Number(employee.employee_id)) ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}><input type="checkbox" checked={selected.has(Number(employee.employee_id))} onChange={() => toggleEmployee(Number(employee.employee_id))} className="h-4 w-4" /><span><span className="block text-sm font-black text-slate-900">{employee.full_name}</span><span className="text-xs font-semibold text-slate-500">{employee.employee_code} · {employee.department}</span></span></label>)}</div></div></section>

            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Notes</span><textarea rows={3} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional event notes" /></label>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiSave />{mutation.isPending ? 'Saving...' : 'Save Company Event'}</button></footer>
      </form>
    </div>
  )
}

export default AttendanceEventModal
