import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiCamera, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import BarcodeScanner from './BarcodeScanner'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const blank = {
  first_name: '', middle_name: '', last_name: '', employee_code: '', department: '',
  employment_type: 'regular', employee_status: 'active',
}

const EmployeeModal = ({ employee, departments = [], onClose, onSaved }) => {
  const isEdit = Boolean(employee?.employee_id)
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [form, setForm] = useState(() => ({
    ...blank,
    ...(employee ? {
      first_name: employee.first_name || '',
      middle_name: employee.middle_name || '',
      last_name: employee.last_name || '',
      employee_code: employee.employee_code || '',
      department: employee.department || '',
      employment_type: employee.employment_type || 'regular',
      employee_status: employee.employee_status || 'active',
    } : { department: departments[0] || '' }),
  }))

  const departmentOptions = useMemo(() => Array.from(new Set([...(departments || []), form.department].filter(Boolean))).sort(), [departments, form.department])
  const setValue = (field, value) => { setNotice(null); setForm((current) => ({ ...current, [field]: value })) }

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? useFetchPut(`/employees/${employee.employee_id}`, form, { confirmationHandled: 'compact' })
      : useFetchPost('/employees', form, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: isEdit ? 'Saving employee...' : 'Creating employee...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      onSaved?.(result?.message || (isEdit ? 'Employee updated.' : 'Employee created.'))
      onClose?.()
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save employee.' }),
  })

  const submit = (event) => {
    event.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.employee_code.trim() || !form.department) {
      setNotice({ type: 'warning', message: 'First name, last name, barcode code, and department are required.' })
      return
    }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><h2 className="text-xl font-black text-slate-950">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2><p className="mt-1 text-sm font-semibold text-slate-500">Employee identity, barcode, department, and employment type only.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="grid gap-5 p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">First Name *</span><input className={inputClass} value={form.first_name} onChange={(e) => setValue('first_name', e.target.value)} placeholder="Juan" /></label>
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Middle Name</span><input className={inputClass} value={form.middle_name} onChange={(e) => setValue('middle_name', e.target.value)} placeholder="Santos" /></label>
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Last Name *</span><input className={inputClass} value={form.last_name} onChange={(e) => setValue('last_name', e.target.value)} placeholder="Dela Cruz" /></label>
          </div>

          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-2"><span className="text-sm font-black text-blue-950">Barcode Code *</span><input autoFocus={!isEdit} className={`${inputClass} w-full bg-white`} value={form.employee_code} onChange={(e) => setValue('employee_code', e.target.value.toUpperCase())} placeholder="Scan or enter barcode code" /></label>
              <button type="button" onClick={() => setShowScanner(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"><FiCamera />Scan Barcode</button>
            </div>
            <p className="mt-2 text-xs font-semibold text-blue-700">If the camera does not work, enter the code manually or scan it with a USB/Bluetooth barcode scanner while this field is focused.</p>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Department *</span><select className={inputClass} value={form.department} onChange={(e) => setValue('department', e.target.value)}><option value="">Select Department</option>{departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><span className="text-xs font-semibold text-slate-500">Department options are managed in System Settings.</span></label>
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Employment Type *</span><select className={inputClass} value={form.employment_type} onChange={(e) => setValue('employment_type', e.target.value)}><option value="regular">Full Time</option><option value="probationary">Probationary</option><option value="part_time">Part Time</option></select></label>
            <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Status</span><select className={inputClass} value={form.employee_status} onChange={(e) => setValue('employee_status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiSave />{mutation.isPending ? 'Saving...' : 'Save Employee'}</button>
        </footer>
      </form>

      {showScanner ? <BarcodeScanner title="Scan Employee Barcode" onDetected={(code) => { setValue('employee_code', code.toUpperCase()); setShowScanner(false) }} onClose={() => setShowScanner(false)} /> : null}
    </div>
  )
}

export default EmployeeModal
