import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiCheckCircle, FiLock, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { decimalHours, employmentLabel, formatPayrollDate, money } from './payrollFormatters'

const settingValue = (value, suffix = '') => value === null || value === undefined ? 'Not configured' : `${Number(value)}${suffix}`

const ReviewRow = ({ label, value, strong = false }) => (
  <div className={`flex items-start justify-between gap-5 border-b border-slate-100 py-2.5 last:border-b-0 ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}`}>
    <span className="text-sm">{label}</span>
    <span className="text-right text-sm">{value ?? '—'}</span>
  </div>
)

const FinalizePayrollModal = ({ payrollId, onClose, onFinalized }) => {
  const queryClient = useQueryClient()
  const reviewQuery = useQuery({
    queryKey: ['employee-salary', 'final-review', payrollId],
    queryFn: () => useFetch(`/employee-payroll/drafts/${payrollId}/final-review`),
    enabled: Boolean(payrollId),
  })

  const review = reviewQuery.data?.data || null
  const payroll = review?.payroll || null
  const canFinalize = Boolean(review?.can_finalize)

  const finalizeMutation = useMutation({
    mutationFn: () => useFetchPost(`/employee-payroll/drafts/${payrollId}/finalize`, {}, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      onFinalized?.(result)
      onClose?.()
    },
  })

  const attendance = payroll ? [
    ['Expected Hours', decimalHours(payroll.expected_regular_minutes)],
    ['Attended Hours', decimalHours(payroll.regular_attended_minutes)],
    ['Paid Time Off', decimalHours(payroll.pto_minutes)],
    ['Regular Holiday Hours', decimalHours(payroll.regular_holiday_minutes)],
    ['Special Holiday Hours', decimalHours(payroll.special_holiday_minutes)],
    ['Tardiness / Absences', `${Number(payroll.tardiness_absence_minutes || 0).toLocaleString()} Minutes`],
    ['Overtime', decimalHours(payroll.overtime_minutes)],
    ['Rest Day Overtime', decimalHours(payroll.rest_day_overtime_minutes)],
    ['Night Differential', decimalHours(payroll.night_differential_minutes)],
  ] : []

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiLock /><p className="text-xs font-black uppercase tracking-wider">Payroll Final Double-Check</p></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Final Review</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Review the exact Draft values that will become the immutable payroll snapshot.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          {reviewQuery.isLoading ? <StatusAlert type="loading" message="Preparing Final Review..." /> : null}
          {reviewQuery.isError ? <StatusAlert type="error" message={reviewQuery.error?.message || 'Unable to prepare Final Review.'} /> : null}
          {finalizeMutation.isError ? <div className="mb-4"><StatusAlert type="error" message={finalizeMutation.error?.message || 'Unable to finalize payroll.'} /></div> : null}

          {review && !canFinalize ? <section className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3"><FiAlertTriangle className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-950">Draft changed since its last calculation</p><p className="mt-1 text-sm font-semibold leading-5 text-amber-900">Recalculate the Draft and reopen Final Review before finalizing. Finalization will not silently approve stale Attendance, compensation, or Payroll Settings.</p></div></div>
            {review.attendance_changed_since_draft && review.attendance_differences?.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3"><p className="text-xs font-black uppercase tracking-wide text-amber-800">Attendance Differences</p><div className="mt-2 divide-y divide-slate-100">{review.attendance_differences.map((item) => <ReviewRow key={item.field} label={item.label} value={`${item.before ?? '—'} → ${item.after ?? '—'}`} />)}</div></div> : null}
            {review.compensation_changed_since_draft ? <p className="mt-3 text-sm font-bold text-amber-900">The effective employment/compensation record also differs from this Draft.</p> : null}
            {review.payroll_settings_changed_since_draft ? <p className="mt-3 text-sm font-bold text-amber-900">Payroll Settings changed after this Draft was calculated. Recalculate so the latest approved multipliers are captured before Finalization.</p> : null}
          </section> : null}

          {payroll ? <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-lg font-black text-slate-950">{payroll.employee_name_snapshot}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{payroll.position_snapshot || '—'} · {employmentLabel(payroll.employment_status_snapshot)} · {payroll.department_snapshot || '—'}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">{formatPayrollDate(payroll.period_start)} – {formatPayrollDate(payroll.period_end)}</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Compensation & Rates</h3><div>
                <ReviewRow label="Monthly Basic" value={money(payroll.monthly_salary_snapshot)} />
                <ReviewRow label="Half-Month Basic" value={money(payroll.half_month_basic)} />
                <ReviewRow label="Daily Rate" value={money(payroll.daily_rate)} />
                <ReviewRow label="Hourly Rate" value={money(payroll.hourly_rate_snapshot)} />
                <ReviewRow label="Minute Rate" value={money(payroll.minute_rate)} />
              </div></div>
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Attendance</h3><div>{attendance.map(([label, value]) => <ReviewRow key={label} label={label} value={value} />)}</div></div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Payroll Settings Snapshot</h3><span className="text-xs font-bold text-slate-500">Revision {payroll.payroll_settings_snapshot?.settings_revision ?? '—'}</span></div>
              <div className="mt-2 grid gap-x-6 lg:grid-cols-2">
                <ReviewRow label="Regular OT Multiplier" value={settingValue(payroll.payroll_settings_snapshot?.regular_ot_multiplier, '×')} />
                <ReviewRow label="Rest Day OT Multiplier" value={settingValue(payroll.payroll_settings_snapshot?.rest_day_ot_multiplier, '×')} />
                <ReviewRow label="Regular Holiday Multiplier" value={settingValue(payroll.payroll_settings_snapshot?.regular_holiday_multiplier, '×')} />
                <ReviewRow label="Special Holiday Multiplier" value={settingValue(payroll.payroll_settings_snapshot?.special_holiday_multiplier, '×')} />
                <ReviewRow label="Regular Holiday OT Multiplier" value={settingValue(payroll.payroll_settings_snapshot?.regular_holiday_ot_multiplier, '×')} />
                <ReviewRow label="Special Holiday OT Multiplier" value={settingValue(payroll.payroll_settings_snapshot?.special_holiday_ot_multiplier, '×')} />
                <ReviewRow label="Night Differential" value={settingValue(payroll.payroll_settings_snapshot?.night_differential_percentage, '%')} />
                <ReviewRow label="Mid-Period Salary Change" value={payroll.payroll_settings_snapshot?.mid_period_change_rule === 'period_boundary_only' ? '1st / 16th boundary only' : (payroll.payroll_settings_snapshot?.mid_period_change_rule || '—')} />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Earnings</h3><ReviewRow label="Overtime Pay" value={money(payroll.overtime_pay)} /><ReviewRow label="Rest Day OT" value={money(payroll.rest_day_overtime_pay)} /><ReviewRow label="Regular Holiday Pay" value={money(payroll.regular_holiday_pay)} /><ReviewRow label="Special Holiday Pay" value={money(payroll.special_holiday_pay)} /><ReviewRow label="Night Differential" value={money(payroll.night_differential_pay)} /><ReviewRow label="Manual Additions" value={money(payroll.manual_additions_total)} /></div>
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Allowances</h3><ReviewRow label="Rice Allowance" value={money(payroll.rice_allowance)} /><ReviewRow label="Transportation" value={money(payroll.transportation_allowance)} /><ReviewRow label="Attendance Bonus" value={money(payroll.attendance_bonus)} /></div>
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Deductions & Total</h3><ReviewRow label="Attendance Deduction" value={money(payroll.attendance_deduction)} /><ReviewRow label="Manual Deductions" value={money(payroll.manual_deductions_total)} /><ReviewRow label="Net Fund Release" value={money(payroll.net_fund_release)} strong /></div>
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex gap-3"><FiCheckCircle className="mt-0.5 shrink-0 text-blue-700" /><div><p className="font-black text-blue-950">Finalization locks these approved values</p><p className="mt-1 text-sm font-semibold leading-6 text-blue-900">Future promotions, Attendance Settings changes, Payroll Settings changes, salary changes, or Attendance corrections will not automatically rewrite this payroll. Later Attendance differences will be flagged against this finalized snapshot.</p></div></div></section>
          </div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button>
          <button type="button" onClick={() => finalizeMutation.mutate()} disabled={!canFinalize || finalizeMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><FiLock />{finalizeMutation.isPending ? 'Finalizing...' : 'Finalize Salary'}</button>
        </footer>
      </div>
    </div>
  )
}

export default FinalizePayrollModal
