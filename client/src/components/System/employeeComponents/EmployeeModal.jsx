import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import Code128Barcode from './Code128Barcode'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const blank = {
  first_name: '', middle_name: '', last_name: '', employee_code: '', department: '',
  employment_type: 'regular', employee_status: 'active',
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
      first_name: employee.first_name || '',
      middle_name: employee.middle_name || '',
      last_name: employee.last_name || '',
      employee_code: employee.employee_code || '',
      department: employee.department || initialDepartment,
      employment_type: employee.employment_type || 'regular',
      employee_status: employee.employee_status || 'active',
    } : { department: initialDepartment }),
  }))

  const departmentOptions = useMemo(() => {
    const values = [...configuredNames]
    if (form.department && !values.includes(form.department)) values.push(form.department)
    return values
  }, [configuredNames, form.department])

  const selectedDepartmentConfig = configs.find((item) => item.name === form.department)
  const fullName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ')

  const setValue = (field, value) => {
    setNotice(null)
    if (field === 'department') setPreview(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  const validateDetails = () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.department) {
      setNotice({ type: 'warning', message: 'First name, last name, and department are required.' })
      return false
    }
    return true
  }

  const previewMutation = useMutation({
    mutationFn: () => useFetchPost('/employees/barcode-preview', { department: form.department }, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: 'Generating the next available department barcode...' }),
    onSuccess: (result) => {
      const data = result?.data || {}
      setPreview(data)
      setForm((current) => ({ ...current, employee_code: data.employee_code || '' }))
      setNotice(null)
      setStep('barcode')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to generate the barcode.' }),
  })

  const saveMutation = useMutation({
    mutationFn: () => isEdit
      ? useFetchPut(`/employees/${employee.employee_id}`, form, { confirmationHandled: 'compact' })
      : useFetchPost('/employees', form, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: isEdit ? 'Saving employee...' : 'Saving employee and confirming the barcode...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      if (isEdit) {
        onSaved?.(result?.message || 'Employee updated.')
        onClose?.()
        return
      }

      const data = result?.data || {}
      const actualCode = data.employee_code || form.employee_code
      setForm((current) => ({ ...current, employee_code: actualCode }))
      setSavedEmployee({ ...data, employee_code: actualCode, full_name: data.full_name || fullName })
      setSavedMessage(result?.message || `Employee created successfully with barcode ${actualCode}.`)
      setNotice({ type: 'success', message: `Saved successfully. ${actualCode} is now the employee's permanent attendance barcode.` })
      setStep('saved')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save employee.' }),
  })

  const generateBarcode = () => {
    if (!validateDetails()) return
    if (!selectedDepartmentConfig) {
      setNotice({ type: 'warning', message: 'This department does not have a barcode prefix. Configure it in System Settings first.' })
      return
    }
    previewMutation.mutate()
  }

  const saveEmployee = (event) => {
    event?.preventDefault?.()
    if (!validateDetails()) return
    if (!isEdit && !preview?.employee_code) {
      setNotice({ type: 'warning', message: 'Generate the employee barcode before saving.' })
      return
    }
    saveMutation.mutate()
  }

  const closeModal = () => {
    if (savedMessage) onSaved?.(savedMessage)
    onClose?.()
  }

  const headerDescription = isEdit
    ? 'Update employee details. The existing barcode stays unchanged.'
    : step === 'details'
      ? 'Enter employee details first. The barcode is generated from the selected department.'
      : step === 'barcode'
        ? 'Review the generated department barcode before saving the employee.'
        : 'Employee saved. You can now print the confirmed attendance barcode.'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={saveEmployee} className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">{isEdit ? 'Edit Employee' : step === 'saved' ? 'Employee Barcode Ready' : 'Add Employee'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{headerDescription}</p>
          </div>
          <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="grid gap-5 p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}

          {(step === 'details' || isEdit) ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">First Name *</span><input autoFocus={!isEdit} className={inputClass} value={form.first_name} onChange={(e) => setValue('first_name', e.target.value)} placeholder="Juan" /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Middle Name</span><input className={inputClass} value={form.middle_name} onChange={(e) => setValue('middle_name', e.target.value)} placeholder="Santos" /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Last Name *</span><input className={inputClass} value={form.last_name} onChange={(e) => setValue('last_name', e.target.value)} placeholder="Dela Cruz" /></label>
              </div>

              {isEdit ? (
                <section className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
                  <div>
                    <p className="text-sm font-black text-blue-950">Employee Barcode</p>
                    <div className="mt-2 rounded-xl border border-blue-200 bg-white px-4 py-3 font-mono text-base font-black text-blue-950">{form.employee_code}</div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-blue-700">Barcode codes are permanent after employee creation so already-printed IDs continue to work, even if the department changes.</p>
                  </div>
                  <Code128Barcode compact value={form.employee_code} employeeName={fullName} />
                </section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3 items-start">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Department *</span>
                  <select className={inputClass} value={form.department} onChange={(e) => setValue('department', e.target.value)}>
                    <option value="">Select Department</option>
                    {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <span className="text-xs font-semibold text-slate-500">{selectedDepartmentConfig?.prefix ? `New employee codes use ${selectedDepartmentConfig.prefix}-001 to ${selectedDepartmentConfig.prefix}-999.` : 'Department barcode prefixes are managed in System Settings.'}</span>
                </label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Employment Type *</span><select className={inputClass} value={form.employment_type} onChange={(e) => setValue('employment_type', e.target.value)}><option value="regular">Full Time</option><option value="probationary">Probationary</option><option value="part_time">Part Time</option></select></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Status</span><select className={inputClass} value={form.employee_status} onChange={(e) => setValue('employee_status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              </div>
            </>
          ) : null}

          {step === 'barcode' && !isEdit ? (
            <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Employee Details</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{fullName}</h3>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-500">Department</span><span className="font-black text-slate-900">{form.department}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-500">Barcode Prefix</span><span className="font-mono font-black text-blue-700">{preview?.prefix}</span></div>
                  <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-500">Next Barcode</span><span className="font-mono text-lg font-black text-blue-700">{preview?.employee_code}</span></div>
                </div>
                <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">This is a preview of the next available code. The server confirms the final code when you click Save Employee, preventing duplicate barcodes if two admins add employees at the same time.</p>
              </div>
              <Code128Barcode compact showPrint={false} value={preview?.employee_code} employeeName={fullName} />
            </section>
          ) : null}

          {step === 'saved' && !isEdit ? (
            <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white"><FiCheckCircle className="h-6 w-6" /></div>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Employee Saved</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{savedEmployee?.full_name || fullName}</h3>
                <p className="mt-2 text-sm font-semibold text-slate-600">Department: <span className="font-black text-slate-900">{savedEmployee?.department || form.department}</span></p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Permanent Barcode: <span className="font-mono font-black text-blue-700">{savedEmployee?.employee_code || form.employee_code}</span></p>
              </div>
              <Code128Barcode compact value={savedEmployee?.employee_code || form.employee_code} employeeName={savedEmployee?.full_name || fullName} />
            </section>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          {isEdit ? (
            <>
              <button type="button" onClick={closeModal} disabled={saveMutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button>
              <button type="submit" disabled={saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiSave />{saveMutation.isPending ? 'Saving...' : 'Save Employee'}</button>
            </>
          ) : step === 'details' ? (
            <>
              <button type="button" onClick={closeModal} disabled={previewMutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button>
              <button type="button" onClick={generateBarcode} disabled={previewMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60">{previewMutation.isPending ? 'Generating...' : 'Next: Generate Barcode'}<FiArrowRight /></button>
            </>
          ) : step === 'barcode' ? (
            <>
              <button type="button" onClick={() => { setNotice(null); setStep('details') }} disabled={saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700"><FiArrowLeft />Back</button>
              <button type="submit" disabled={saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiSave />{saveMutation.isPending ? 'Saving...' : 'Save Employee'}</button>
            </>
          ) : (
            <button type="button" onClick={closeModal} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white"><FiCheckCircle />Done</button>
          )}
        </footer>
      </form>
    </div>
  )
}

export default EmployeeModal
