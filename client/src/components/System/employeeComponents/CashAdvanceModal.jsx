import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiDollarSign, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const CashAdvanceModal = ({ advance, employees, onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const isEdit = Boolean(advance?.employee_cash_advance_id)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    employee_id: String(advance?.employee_id || employees?.[0]?.employee_id || ''),
    request_date: advance?.request_date || new Date().toISOString().slice(0, 10),
    amount: advance?.amount ?? '',
    installment_count: advance?.installment_count || 1,
    deduction_per_payroll: advance?.deduction_per_payroll ?? '',
    start_deduction_date: advance?.start_deduction_date || new Date().toISOString().slice(0, 10),
    notes: advance?.notes || '',
  })

  const suggestedDeduction = useMemo(() => {
    const amount = Number(form.amount || 0)
    const installments = Math.max(Number(form.installment_count || 1), 1)
    return amount > 0 ? Math.round((amount / installments) * 100) / 100 : 0
  }, [form.amount, form.installment_count])

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? useFetchPut(`/employee-cash-advances/${advance.employee_cash_advance_id}`, form)
      : useFetchPost('/employee-cash-advances', form),
    onMutate: () => setNotice({ type: 'loading', message: isEdit ? 'Saving cash advance changes...' : 'Adding cash advance request...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-cash-advances'] })
      onSaved?.(result?.message || 'Cash advance saved.')
      onClose()
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save cash advance.' }),
  })

  const setValue = (field, value) => { setNotice(null); setForm((current) => ({ ...current, [field]: value })) }
  const submit = (event) => {
    event.preventDefault()
    if (!form.employee_id || !form.request_date || !form.start_deduction_date || Number(form.amount) <= 0) {
      setNotice({ type: 'warning', message: 'Employee, dates, and a valid amount are required.' }); return
    }
    mutation.mutate()
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><FiDollarSign /></span><div><h2 className="text-xl font-black">{isEdit ? 'Edit Employee Cash Advance' : 'Add Employee Cash Advance'}</h2><p className="text-sm font-semibold text-slate-500">Salary deduction only. This does not affect seller commissions.</p></div></div><button type="button" onClick={onClose} disabled={mutation.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"><FiX /></button></header>
    <div className="flex-1 overflow-y-auto p-5">
      {notice ? <StatusAlert type={notice.type} message={notice.message} className="mb-4" /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-xs font-black text-slate-700">Employee *</span><select className={inputClass} value={form.employee_id} onChange={(e) => setValue('employee_id', e.target.value)}>{employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_code} · {employee.full_name}</option>)}</select></label>
        <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Request Date *</span><input type="date" className={inputClass} value={form.request_date} onChange={(e) => setValue('request_date', e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Start Deduction Date *</span><input type="date" className={inputClass} value={form.start_deduction_date} onChange={(e) => setValue('start_deduction_date', e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Advance Amount *</span><input type="number" min="0.01" step="0.01" className={inputClass} value={form.amount} onChange={(e) => setValue('amount', e.target.value)} placeholder="5000.00" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Payroll Installments *</span><input type="number" min="1" max="60" className={inputClass} value={form.installment_count} onChange={(e) => setValue('installment_count', e.target.value)} placeholder="2" /></label>
        <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-xs font-black text-slate-700">Deduction Per Payroll</span><input type="number" min="0" step="0.01" className={inputClass} value={form.deduction_per_payroll} onChange={(e) => setValue('deduction_per_payroll', e.target.value)} placeholder={String(suggestedDeduction)} /><span className="text-xs font-semibold text-slate-500">Leave blank to use the calculated amount: ₱{suggestedDeduction.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.</span></label>
        <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="text-xs font-black text-slate-700">Notes</span><textarea rows={4} className={`${inputClass} h-auto py-3`} value={form.notes} onChange={(e) => setValue('notes', e.target.value)} placeholder="Reason, repayment agreement, or internal notes" /></label>
      </div>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">The request starts as Pending. A Super Admin must approve it before payroll deductions begin.</div>
    </div>
    <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black">Cancel</button><button type="submit" disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300"><FiSave />{mutation.isPending ? 'Saving...' : 'Save Cash Advance'}</button></footer>
  </form></div>
}

export default CashAdvanceModal
