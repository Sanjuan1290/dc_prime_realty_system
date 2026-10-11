import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiCheckCircle, FiDollarSign, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost } from '../../../utils/useFetch'
import { formatPayrollDate, money } from './payrollFormatters'

const manilaDateOnly = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

const ReleasePayrollModal = ({ payroll, onClose, onReleased }) => {
  const queryClient = useQueryClient()
  const [releaseDate, setReleaseDate] = useState(manilaDateOnly())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const payrollId = Number(payroll?.employee_payroll_id || 0)
  const canSubmit = useMemo(() => payrollId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(releaseDate), [payrollId, releaseDate])

  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/employee-payroll/payrolls/${payrollId}/release`, {
      release_date: releaseDate,
      release_reference: reference.trim() || null,
      release_notes: notes.trim() || null,
    }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-history', payroll?.employee_id] })
      onReleased?.(result)
      onClose?.()
    },
  })

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-700"><FiDollarSign /><span className="text-xs font-black uppercase tracking-[0.16em]">Fund Release</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Mark Payroll as Released</h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">Record the actual fund release. This changes the lifecycle status only; the finalized/corrected official salary snapshot and receipt values remain unchanged.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {mutation.isError ? <StatusAlert type="error" message={mutation.error?.message || 'Unable to mark payroll as Released.'} /> : null}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">{payroll?.employee_name_snapshot || 'Employee'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{payroll?.period_label || `${formatPayrollDate(payroll?.period_start)} – ${formatPayrollDate(payroll?.period_end)}`}</p>
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200 pt-3"><span className="text-sm font-bold text-slate-600">Net Fund Release</span><span className="text-xl font-black text-emerald-700">{money(payroll?.net_fund_release)}</span></div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex gap-3"><FiCheckCircle className="mt-0.5 shrink-0 text-emerald-700" /><div><p className="font-black text-emerald-950">Official snapshot stays immutable</p><p className="mt-1 text-sm font-semibold leading-5 text-emerald-900">Marking this payroll as Released will not recalculate Attendance, salary, allowances, deductions, or the final receipt total.</p></div></div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Released Date *</span><input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={180} placeholder="Bank transfer, cash voucher, cheque, etc." className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" /></label>
          </div>
          <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={4} placeholder="Optional fund-release notes" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold" /></label>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button>
          <button type="button" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><FiCheckCircle />{mutation.isPending ? 'Releasing...' : 'Mark as Released'}</button>
        </footer>
      </div>
    </div>
  )
}

export default ReleasePayrollModal

