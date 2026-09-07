import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiRefreshCw, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import Code128Barcode from './Code128Barcode'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const WEEKDAYS = [
  ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'], ['thursday', 'Thursday'],
  ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday'],
]

const getManilaDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const blank = {
  first_name: '', middle_name: '', last_name: '', employee_code: '', barcode_code: '', department: '',
  employment_type: 'regular', employee_status: 'active', rest_days: [], rest_days_effective_from: getManilaDate(),
}

const normalizeConfigs = (departmentConfigs = [], departments = []) => {
  const configs = Array.isArray(departmentConfigs) ? departmentConfigs.filter((item) => item?.name) : []
  if (configs.length) return configs
  return (departments || []).filter(Boolean).map((name) => ({ name, prefix: '' }))
}

const EmployeeModal = ({ employee, departmentConfigs = [], departments = [], onClose, onSaved }) => {
  const isEdit = Boolean(employee?.employee_id)
  const queryClient = useQueryClient()
  const configs = useMemo(() => normalizeConfigs(departmentConfigs, departments), [departmentConfigs, departments])
  const configuredNames = useMemo(() => configs.map((item) => item.name), [configs])
  const initialDepartment = employee?.department || configuredNames[0] || ''

  const [step, setStep] = useState(isEdit ? 'edit' : 'details')
  const [notice, setNotice] = useState(null)
  const [preview, setPreview] = useState(null)
  const [savedEmployee, setSavedEmployee] = useState(null)
  const [savedMessage, setSavedMessage] = useState('')
  const [form, setForm] = useState(() => ({
    ...blank,
    ...(employee ? {
      first_name: employee.first_name || '', middle_name: employee.middle_name || '', last_name: employee.last_name || '',
      employee_code: employee.employee_code || '', barcode_code: employee.barcode_code || '',
      department: employee.department || initialDepartment,
      employment_type: employee.employment_type || 'regular', employee_status: employee.employee_status || 'active',
      rest_days: Array.isArray(employee.rest_days) ? employee.rest_days : [], rest_days_effective_from: getManilaDate(),
    } : { department: initialDepartment }),
  }))

  const departmentOptions = useMemo(() => {
    const values = [...configuredNames]
    if (form.department && !values.includes(form.department)) values.push(form.department)
    return values
  }, [configuredNames, form.department])

  const selectedDepartmentConfig = configs.find((item) => item.name === form.department)
  const restDayLabels = WEEKDAYS.filter(([value]) => form.rest_days.includes(value)).map(([, label]) => label)
  const fullName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ')

  const setValue = (field, value) => {
    setNotice(null)
    if (field === 'department') setPreview(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  const toggleRestDay = (day) => {
    setNotice(null)
    setForm((current) => ({
      ...current,
      rest_days: current.rest_days.includes(day) ? current.rest_days.filter((item) => item !== day) : [...current.rest_days, day],
    }))
  }

  const validateDetails = () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.department) {
      setNotice({ type: 'warning', message: 'First name, last name, and department are required.' })
      return false
    }
    if (!form.rest_days.length) {
      setNotice({ type: 'warning', message: 'Select at least one Rest Day.' })
      return false
    }
    if (isEdit && !form.rest_days_effective_from) {
      setNotice({ type: 'warning', message: 'Select when the Rest Day schedule becomes effective.' })
      return false
    }
    return true
  }

  const previewMutation = useMutation({
    mutationFn: () => useFetchPost('/employees/employee-code-preview', { department: form.department }, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: 'Generating the next available Employee Code...' }),
    onSuccess: (result) => {
      const data = result?.data || {}
      setPreview(data)
      setForm((current) => ({ ...current, employee_code: data.employee_code || '' }))
      setNotice(null)
      setStep('barcode')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to generate the Employee Code.' }),
  })

  const saveMutation = useMutation({
    mutationFn: () => isEdit
      ? useFetchPut(`/employees/${employee.employee_id}`, form, { confirmationHandled: 'compact' })
      : useFetchPost('/employees', form, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: isEdit ? 'Saving employee...' : 'Saving employee and creating the secure Attendance Barcode...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      if (isEdit) {
        onSaved?.(result?.message || 'Employee updated.')
        onClose?.()
        return
      }
      const data = result?.data || {}
      const actualCode = data.employee_code || form.employee_code
      const attendanceBarcode = data.barcode_code || ''
      setForm((current) => ({ ...current, employee_code: actualCode, barcode_code: attendanceBarcode }))
      setSavedEmployee({ ...data, employee_code: actualCode, barcode_code: attendanceBarcode, full_name: data.full_name || fullName })
      setSavedMessage(result?.message || `Employee created successfully with Employee Code ${actualCode}.`)
      setNotice({ type: 'success', message: `Saved successfully. ${actualCode} is the permanent Employee Code and the secure 10-digit Attendance Barcode is ready to print.` })
      setStep('saved')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save employee.' }),
  })

  const regenerateMutation = useMutation({
    mutationFn: () => useFetchPost(`/employees/${employee.employee_id}/regenerate-barcode`, {}, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: 'Generating a new secure Attendance Barcode...' }),
    onSuccess: (result) => {
      const next = result?.data?.barcode_code || ''
      setForm((current) => ({ ...current, barcode_code: next }))
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setNotice({ type: 'success', message: result?.message || 'Attendance Barcode regenerated successfully.' })
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Attendance Barcode could not be regenerated.' }),
  })

  const generateEmployeeCode = () => {
    if (!validateDetails()) return
    if (!selectedDepartmentConfig) {
      setNotice({ type: 'warning', message: 'This department does not have an Employee Code prefix. Configure it in Attendance Settings first.' })
      return
    }
    previewMutation.mutate()
  }

  const saveEmployee = (event) => {
    event?.preventDefault?.()
    if (!validateDetails()) return
    if (!isEdit && !preview?.employee_code) {
      setNotice({ type: 'warning', message: 'Generate the Employee Code before saving.' })
      return
    }
    saveMutation.mutate()
  }

  const regenerateAttendanceBarcode = () => {
    const confirmed = window.confirm('Regenerate this employee’s Attendance Barcode?\n\nThe current printed barcode will immediately stop working. The Employee Code and attendance history will remain unchanged.')
    if (confirmed) regenerateMutation.mutate()
  }

  const closeModal = () => {
    if (savedMessage) onSaved?.(savedMessage)
    onClose?.()
  }

  const headerDescription = isEdit
    ? 'Update employee details. Employee Code and Attendance Barcode remain unchanged unless you explicitly regenerate the Attendance Barcode.'
    : step === 'details'
      ? 'Enter employee details first. The system previews a human Employee Code from the selected department.'
      : step === 'barcode'
        ? 'Review the Employee Code. A separate random 10-digit Attendance Barcode is created securely when you save.'
        : 'Employee saved. Print the secure Attendance Barcode for Time In / Time Out.'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={saveEmployee} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">{isEdit ? 'Edit Employee' : step === 'saved' ? 'Attendance Barcode Ready' : 'Add Employee'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{headerDescription}</p>
          </div>
          <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="grid gap-5 overflow-y-auto p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}

          {(step === 'details' || isEdit) ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">First Name *</span><input autoFocus={!isEdit} className={inputClass} value={form.first_name} onChange={(e) => setValue('first_name', e.target.value)} placeholder="Juan" /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Middle Name</span><input className={inputClass} value={form.middle_name} onChange={(e) => setValue('middle_name', e.target.value)} placeholder="Santos" /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Last Name *</span><input className={inputClass} value={form.last_name} onChange={(e) => setValue('last_name', e.target.value)} placeholder="Dela Cruz" /></label>
              </div>

              {isEdit ? (
                <section className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-blue-700">Employee Identifiers</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-blue-200 bg-white p-3"><p className="text-xs font-black uppercase text-slate-400">Employee Code</p><p className="mt-1 font-mono text-lg font-black text-blue-900">{form.employee_code || '—'}</p></div>
                      <div className="rounded-xl border border-blue-200 bg-white p-3"><p className="text-xs font-black uppercase text-slate-400">Attendance Barcode</p><p className="mt-1 font-mono text-lg font-black tracking-[0.12em] text-slate-950">{form.barcode_code || 'Not generated'}</p></div>
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-5 text-blue-700">The Employee Code is for human/admin reference. Attendance scanning accepts only the separate 10-digit barcode.</p>
                    <button type="button" onClick={regenerateAttendanceBarcode} disabled={regenerateMutation.isPending || !form.barcode_code} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-xs font-black text-amber-800 disabled:opacity-40"><FiRefreshCw />{regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate Attendance Barcode'}</button>
                  </div>
                  <Code128Barcode compact value={form.barcode_code} employeeName={fullName} employeeCode={form.employee_code} />
                </section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Department *</span>
                  <select className={inputClass} value={form.department} onChange={(e) => setValue('department', e.target.value)}>
                    <option value="">Select Department</option>
                    {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <span className="text-xs font-semibold text-slate-500">{selectedDepartmentConfig?.prefix ? `Human Employee Codes use ${selectedDepartmentConfig.prefix}-001 to ${selectedDepartmentConfig.prefix}-999.` : 'Department Employee Code prefixes are managed in Attendance Settings.'}</span>
                </label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Employment Type *</span><select className={inputClass} value={form.employment_type} onChange={(e) => setValue('employment_type', e.target.value)}><option value="regular">Full Time</option><option value="probationary">Probationary</option><option value="part_time">Part Time</option></select></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Status</span><select className={inputClass} value={form.employee_status} onChange={(e) => setValue('employee_status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div><p className="text-sm font-black text-slate-800">Rest Day(s) *</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Select every weekly Rest Day. Work on a Rest Day is reported as Rest Day Overtime (RD OT).</p></div>
                  {restDayLabels.length ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">{restDayLabels.join(', ')}</span> : null}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {WEEKDAYS.map(([value, label]) => {
                    const checked = form.rest_days.includes(value)
                    return <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-black transition ${checked ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}><input type="checkbox" checked={checked} onChange={() => toggleRestDay(value)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />{label}</label>
                  })}
                </div>
                {isEdit ? (
                  <label className="mt-4 grid max-w-sm gap-2"><span className="text-sm font-black text-slate-700">Rest Day Effective From *</span><input type="date" max={getManilaDate()} className={inputClass} value={form.rest_days_effective_from} onChange={(e) => setValue('rest_days_effective_from', e.target.value)} /><span className="text-xs font-semibold leading-5 text-slate-500">Previous Rest Day assignments remain in history so older Attendance Excel exports stay correct.</span></label>
                ) : <p className="mt-3 text-xs font-semibold text-slate-500">The first Rest Day schedule starts on the employee hire date.</p>}
              </section>
            </>
          ) : null}

          {step === 'barcode' && !isEdit ? (
            <section className="grid gap-5 lg:grid-cols-[.95fr] lg:items-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Employee Code Preview</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{fullName}</h3>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-500">Department</span><span className="font-black text-slate-900">{form.department}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-500">Employee Code Prefix</span><span className="font-mono font-black text-blue-700">{preview?.prefix}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-500">Next Employee Code</span><span className="font-mono text-lg font-black text-blue-700">{preview?.employee_code}</span></div>
                  <div className="flex items-start justify-between gap-4"><span className="font-semibold text-slate-500">Rest Days</span><span className="text-right font-black text-slate-900">{restDayLabels.join(', ')}</span></div>
                </div>
              </div>
            </section>
          ) : null}

          {step === 'saved' && !isEdit ? (
            <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white"><FiCheckCircle className="h-6 w-6" /></div>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Employee Saved</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{savedEmployee?.full_name || fullName}</h3>
                <p className="mt-2 text-sm font-semibold text-slate-600">Department: <span className="font-black text-slate-900">{savedEmployee?.department || form.department}</span></p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Employee Code: <span className="font-mono font-black text-blue-700">{savedEmployee?.employee_code || form.employee_code}</span></p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Attendance Barcode: <span className="font-mono font-black tracking-[0.12em] text-slate-950">{savedEmployee?.barcode_code || form.barcode_code}</span></p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Rest Days: <span className="font-black text-slate-900">{restDayLabels.join(', ')}</span></p>
              </div>
              <Code128Barcode compact value={savedEmployee?.barcode_code || form.barcode_code} employeeName={savedEmployee?.full_name || fullName} employeeCode={savedEmployee?.employee_code || form.employee_code} />
            </section>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          {isEdit ? (
            <><button type="button" onClick={closeModal} disabled={saveMutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button type="submit" disabled={saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiSave />{saveMutation.isPending ? 'Saving...' : 'Save Employee'}</button></>
          ) : step === 'details' ? (
            <><button type="button" onClick={closeModal} disabled={previewMutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button type="button" onClick={generateEmployeeCode} disabled={previewMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60">{previewMutation.isPending ? 'Generating...' : 'Next: Generate Employee Code'}<FiArrowRight /></button></>
          ) : step === 'barcode' ? (
            <><button type="button" onClick={() => { setNotice(null); setStep('details') }} disabled={saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700"><FiArrowLeft />Back</button><button type="submit" disabled={saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiSave />{saveMutation.isPending ? 'Saving...' : 'Save Employee'}</button></>
          ) : <button type="button" onClick={closeModal} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white"><FiCheckCircle />Done</button>}
        </footer>
      </form>
    </div>
  )
}

export default EmployeeModal
