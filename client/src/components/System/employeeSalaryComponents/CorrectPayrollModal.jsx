import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiEdit3, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { employmentLabel, money } from './payrollFormatters'

const moneyFields = new Set([
  'compensation.monthly_basic', 'compensation.half_month_basic', 'compensation.daily_rate',
  'compensation.hourly_rate', 'compensation.minute_rate', 'deductions.attendance_deduction',
  'earnings.overtime_pay', 'earnings.rest_day_overtime_pay', 'earnings.regular_holiday_pay',
  'earnings.special_holiday_pay', 'earnings.night_differential_pay', 'allowances.rice_allowance',
  'allowances.transportation_allowance', 'allowances.attendance_bonus', 'adjustments.manual_additions_total',
  'adjustments.manual_deductions_total', 'net_fund_release',
])

const displayValue = (item, value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (moneyFields.has(item.field)) return money(value)
  if (item.field === 'employee.employment_status') return employmentLabel(value)
  if (item.field.includes('minutes')) return `${Number(value || 0).toLocaleString('en-PH')} mins`
  return String(value)
}

const CorrectPayrollModal = ({ payrollId, onClose, onCorrected }) => {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const reviewQuery = useQuery({
    queryKey: ['employee-salary', 'correction-review', payrollId],
    queryFn: () => useFetch(`/employee-payroll/payrolls/${payrollId}/correction-review`),
    enabled: Boolean(payrollId),
  })
  const review = reviewQuery.data?.data || null
  const differences = review?.differences || []
  const canSubmit = reason.trim().length >= 5 && confirmed && review?.has_changes && review?.review_hash

  const grouped = useMemo(() => ({
    identity: differences.filter((item) => item.field.startsWith('employee.') || item.field.startsWith('compensation.')),
    attendance: differences.filter((item) => item.field.startsWith('attendance.')),
    money: differences.filter((item) => !item.field.startsWith('employee.') && !item.field.startsWith('compensation.') && !item.field.startsWith('attendance.')),
  }), [differences])

  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/employee-payroll/payrolls/${payrollId}/corrections`, {
      reason: reason.trim(),
      review_hash: review.review_hash,
    }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-history'] })
      onCorrected?.(result)
      onClose?.()
    },
  })

  const Group = ({ title, items }) => items.length ? <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</h3>
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[1.25fr_1fr_1fr] bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500"><span>Field</span><span>Before</span><span>After</span></div>
      <div className="divide-y divide-slate-100">{items.map((item) => <div key={item.field} className="grid grid-cols-[1.25fr_1fr_1fr] gap-3 px-3 py-2.5 text-sm"><span className="font-bold text-slate-700">{item.label}</span><span className="font-semibold text-rose-700">{displayValue(item, item.before)}</span><span className="font-black text-emerald-700">{displayValue(item, item.after)}</span></div>)}</div>
    </div>
  </section> : null

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><div className="flex items-center gap-2 text-violet-700"><FiEdit3 /><span className="text-xs font-black uppercase tracking-[0.16em]">Salary Correction</span></div><h2 className="mt-1 text-xl font-black text-slate-950">Final Double-Check — Before vs After</h2><p className="mt-1 text-sm font-semibold text-slate-500">This controlled workflow preserves the previous finalized snapshot in Correction History before replacing the active official snapshot.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {reviewQuery.isLoading ? <StatusAlert type="loading" message="Preparing Salary Correction review..." /> : null}
          {reviewQuery.isError ? <StatusAlert type="error" message={reviewQuery.error?.message || 'Unable to prepare Salary Correction.'} /> : null}
          {mutation.isError ? <div className="mb-4"><StatusAlert type="error" message={mutation.error?.message || 'Unable to save Salary Correction.'} /></div> : null}

          {review ? <div className="space-y-5">
            <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="flex gap-3"><FiAlertTriangle className="mt-0.5 shrink-0 text-violet-700" /><div><p className="font-black text-violet-950">Formal correction — original payroll is not silently rewritten</p><p className="mt-1 text-sm font-semibold leading-6 text-violet-900">The current finalized snapshot is stored as the Before record. The approved After snapshot becomes the corrected official payroll, and the complete correction is recorded in Audit Logs.</p></div></div></section>

            {!review.has_changes ? <StatusAlert type="info" message="No salary or Attendance differences are currently detected. There is nothing to correct." /> : null}
            <Group title="Employment & Compensation" items={grouped.identity} />
            <Group title="Attendance" items={grouped.attendance} />
            <Group title="Payroll Amounts" items={grouped.money} />

            {review.has_changes ? <section className="rounded-2xl border border-slate-200 p-4"><label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">Correction Reason *</span><textarea value={reason} onChange={(event) => { setReason(event.target.value); setConfirmed(false) }} rows={4} maxLength={2000} placeholder="Explain why this finalized payroll must be corrected..." className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold outline-none focus:border-violet-500" /></label><p className="mt-2 text-xs font-semibold text-slate-500">Required. This reason is stored with the Before/After snapshots and Audit Log.</p></section> : null}

            {review.has_changes ? <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4" /><span><span className="block font-black text-amber-950">Final Double-Check confirmed</span><span className="mt-1 block text-sm font-semibold leading-5 text-amber-900">I reviewed the Before vs After values and understand that this creates a formal corrected payroll record. It does not delete the previous finalized snapshot.</span></span></label> : null}

            {(review.correction_history || []).length ? <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Previous Corrections</p><div className="mt-2 space-y-2">{review.correction_history.map((item) => <div key={item.employee_payroll_correction_id} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-sm font-black text-slate-900">Correction #{item.employee_payroll_correction_id}</p><p className="mt-1 text-xs font-semibold text-slate-500">{item.created_by_name ? `By ${item.created_by_name} · ` : ''}{String(item.created_at || '').replace('T', ' ').slice(0, 16)}</p><p className="mt-1 text-sm font-semibold text-slate-700">{item.reason}</p></div>)}</div></section> : null}
          </div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button type="button" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"><FiCheckCircle />{mutation.isPending ? 'Saving Correction...' : 'Confirm Salary Correction'}</button></footer>
      </div>
    </div>
  )
}

export default CorrectPayrollModal
