import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiClock, FiPlus, FiSave, FiTrash2, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPut } from '../../../utils/useFetch'

const DEFAULT_DEPARTMENTS = [
  { name: 'Administration', prefix: 'ADM' },
  { name: 'Accounting', prefix: 'ACC' },
  { name: 'IT', prefix: 'IT' },
  { name: 'Sales', prefix: 'SLS' },
  { name: 'Marketing', prefix: 'MKT' },
  { name: 'Operations', prefix: 'OPS' },
]

const timeInput = (value, fallback) => String(value || fallback).slice(0, 5)
const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const initialForm = (settings = {}) => ({
  scheduledTimeIn: timeInput(settings.scheduledTimeIn, '09:00'),
  scheduledTimeOut: timeInput(settings.scheduledTimeOut, '20:00'),
  automaticTimeOut: timeInput(settings.automaticTimeOut, '20:00'),
  regularWorkingHours: String((Number(settings.regularWorkingMinutes || 660) / 60)),
  breakStart: timeInput(settings.breakStart, '12:00'),
  breakMinutes: String(settings.breakMinutes ?? 60),
  lateAfter: timeInput(settings.lateAfter, '09:00'),
  redHighlightAfter: timeInput(settings.redHighlightAfter, '09:15'),
  departmentConfigs: Array.isArray(settings.departmentConfigs) && settings.departmentConfigs.length
    ? settings.departmentConfigs.map((item) => ({ name: item.name || '', prefix: item.prefix || '' }))
    : DEFAULT_DEPARTMENTS,
})

const Field = ({ label, helper, children }) => (
  <label className="grid gap-2">
    <span className="text-sm font-black text-slate-700">{label}</span>
    {children}
    {helper ? <span className="text-xs font-semibold leading-5 text-slate-500">{helper}</span> : null}
  </label>
)

const AttendanceSettingsModal = ({ settings, onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => initialForm(settings))
  const [notice, setNotice] = useState(null)

  const departmentPreview = useMemo(() => {
    const item = form.departmentConfigs.find((entry) => entry.name.trim() && entry.prefix.trim())
    return item ? `${item.name.trim()} → ${item.prefix.trim().toUpperCase()}-001` : 'IT → IT-001'
  }, [form.departmentConfigs])

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const mutation = useMutation({
    mutationFn: (payload) => useFetchPut('/attendance/settings', payload, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: 'Saving Attendance Settings...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-settings'] })
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
      onSaved?.(result?.message || 'Attendance settings saved successfully.')
      onClose?.()
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Attendance settings could not be saved.' }),
  })

  const submit = (event) => {
    event.preventDefault()
    const regularWorkingHours = Number(form.regularWorkingHours)
    const breakMinutes = Number(form.breakMinutes)
    if (!Number.isFinite(regularWorkingHours) || regularWorkingHours <= 0 || regularWorkingHours > 24) {
      setNotice({ type: 'warning', message: 'Regular Working Hours must be greater than 0 and not more than 24.' })
      return
    }
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) {
      setNotice({ type: 'warning', message: 'Break Duration must be between 0 and 240 minutes.' })
      return
    }
    const departments = form.departmentConfigs
      .map((item) => ({
        name: String(item.name || '').trim(),
        prefix: String(item.prefix || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
      }))
      .filter((item) => item.name || item.prefix)
    if (!departments.length || departments.some((item) => !item.name || !item.prefix)) {
      setNotice({ type: 'warning', message: 'Every employee department needs both a name and an Employee Code prefix.' })
      return
    }

    mutation.mutate({
      scheduledTimeIn: form.scheduledTimeIn,
      scheduledTimeOut: form.scheduledTimeOut,
      automaticTimeOut: form.automaticTimeOut,
      regularWorkingMinutes: Math.round(regularWorkingHours * 60),
      breakStart: form.breakStart,
      breakMinutes: Math.round(breakMinutes),
      lateAfter: form.lateAfter,
      redHighlightAfter: form.redHighlightAfter,
      departmentConfigs: departments,
    })
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiClock /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Attendance Management</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Attendance Settings</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">These saved rules drive daily attendance behavior and become the default Excel Rules when exporting attendance.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40" aria-label="Close"><FiX /></button>
        </header>

        <div className="grid gap-6 overflow-y-auto p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}

          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="font-black text-slate-950">Attendance Rules</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Automatic Time Out changes the real attendance scheduler. The remaining rules also become the default values used by Attendance Excel exports.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Scheduled Time In *"><input type="time" required value={form.scheduledTimeIn} onChange={(e) => update('scheduledTimeIn', e.target.value)} className={inputClass} /></Field>
              <Field label="Scheduled Time Out *"><input type="time" required value={form.scheduledTimeOut} onChange={(e) => update('scheduledTimeOut', e.target.value)} className={inputClass} /></Field>
              <Field label="Automatic Time Out *" helper="Open attendance records are closed automatically at this time."><input type="time" required value={form.automaticTimeOut} onChange={(e) => update('automaticTimeOut', e.target.value)} className={inputClass} /></Field>
              <Field label="Regular Working Hours *" helper="Reference value shown in Excel."><input type="number" min="0.25" max="24" step="0.25" required value={form.regularWorkingHours} onChange={(e) => update('regularWorkingHours', e.target.value)} className={inputClass} /></Field>
              <Field label="Break Start *"><input type="time" required value={form.breakStart} onChange={(e) => update('breakStart', e.target.value)} className={inputClass} /></Field>
              <Field label="Break Duration (minutes) *"><input type="number" min="0" max="240" step="1" required value={form.breakMinutes} onChange={(e) => update('breakMinutes', e.target.value)} className={inputClass} /></Field>
              <Field label="Late After *" helper="Normal workdays become Late after this time."><input type="time" required value={form.lateAfter} onChange={(e) => update('lateAfter', e.target.value)} className={inputClass} /></Field>
              <Field label="Highlight Row Red After *" helper="Excel row turns red strictly after this time."><input type="time" required value={form.redHighlightAfter} onChange={(e) => update('redHighlightAfter', e.target.value)} className={inputClass} /></Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-black text-slate-950">Employee Departments & Codes</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Prefixes generate human Employee Codes such as IT-001. The secure 10-digit Attendance Barcode is generated separately and does not use this prefix.</p>
              </div>
              <button type="button" onClick={() => update('departmentConfigs', [...form.departmentConfigs, { name: '', prefix: '' }])} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-black text-blue-700 hover:bg-blue-100"><FiPlus />Add Department</button>
            </div>
            <div className="mt-4 grid gap-3">
              {form.departmentConfigs.map((item, index) => (
                <div key={`${item.name || 'department'}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                  <Field label="Department Name"><input value={item.name} onChange={(e) => { const next = [...form.departmentConfigs]; next[index] = { ...next[index], name: e.target.value }; update('departmentConfigs', next) }} placeholder="Information Technology" className={inputClass} /></Field>
                  <Field label="Employee Code Prefix" helper="1–8 letters/numbers"><input value={item.prefix} onChange={(e) => { const next = [...form.departmentConfigs]; next[index] = { ...next[index], prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) }; update('departmentConfigs', next) }} maxLength={8} placeholder="IT" className={`${inputClass} font-mono uppercase`} /></Field>
                  <button type="button" onClick={() => update('departmentConfigs', form.departmentConfigs.filter((_, itemIndex) => itemIndex !== index))} disabled={form.departmentConfigs.length <= 1} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-40"><FiTrash2 />Remove</button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-black text-blue-700">Example: {departmentPreview}</p>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"><FiSave />{mutation.isPending ? 'Saving...' : 'Save Attendance Settings'}</button>
        </footer>
      </form>
    </div>
  )
}

export default AttendanceSettingsModal
