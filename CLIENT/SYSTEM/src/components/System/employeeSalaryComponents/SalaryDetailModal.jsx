import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiClock, FiFileText, FiLock, FiRefreshCw, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import FinalizePayrollModal from './FinalizePayrollModal'
import FundReleaseReceiptModal from './FundReleaseReceiptModal'
import ReleasePayrollModal from './ReleasePayrollModal'
import PayrollSettingsModal from './PayrollSettingsModal'
import SignedSalaryReceiptsModal from './SignedSalaryReceiptsModal'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { employmentLabel, formatPayrollDate, money, payrollStatusLabel, payrollStatusTone } from './payrollFormatters'
import PayrollRateExplanation from './PayrollRateExplanation'
import { formatPayrollDuration } from './payrollTimeFormat.mjs'

const Metric = ({ label, value, hint }) => <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-base font-black text-slate-950">{value}</p>{hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}</div>

const MoneyRow = ({ label, value, strong = false }) => <div className={`flex items-center justify-between gap-4 py-2.5 ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}`}><span>{label}</span><span>{money(value)}</span></div>

const dayTypeLabel = (value) => ({ regular: 'Regular', double_pay: 'Double Pay', regular_holiday: 'Regular Holiday', special_holiday: 'Special Holiday', company_event: 'Company Event' }[value] || value || '—')
const stateLabel = (row) => row.absence ? 'Absent' : row.state ? String(row.state).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—'
const settingValue = (value, suffix = '') => value === null || value === undefined ? 'Not configured' : `${Number(value)}${suffix}`

const SalaryDetailModal = ({ payrollId, canManagePayrollSettings = false, initialTab = 'salary', canRecalculate = false, canFinalize = false, canRelease = false, canPrintReceipt = false, canExportReceipt = false, historyMode = false, onClose, onUpdated }) => {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(initialTab)
  const [alert, setAlert] = useState(null)
  const [showFinalReview, setShowFinalReview] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showRelease, setShowRelease] = useState(false)
  const [showPayrollSettings, setShowPayrollSettings] = useState(false)
  const [showSignedReceipts, setShowSignedReceipts] = useState(false)

  useEffect(() => setTab(initialTab), [initialTab, payrollId])

  const query = useQuery({
    queryKey: ['employee-salary-detail', payrollId],
    queryFn: () => useFetch(historyMode ? `/employee-payroll/history/payrolls/${payrollId}` : `/employee-payroll/drafts/${payrollId}`),
    enabled: Boolean(payrollId),
  })
  const payroll = query.data?.data || null
  const officialStatus = ['finalized', 'corrected', 'released'].includes(String(payroll?.payroll_status || '').toLowerCase())

  const recalcMutation = useMutation({
    mutationFn: () => useFetchPost(`/employee-payroll/drafts/${payrollId}/recalculate`, {}, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result.message || 'Draft payroll recalculated.' })
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] })
      onUpdated?.()
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Unable to recalculate Draft payroll.' }),
  })

  const breakdown = payroll?.attendance_breakdown || []
  const attendance = useMemo(() => payroll ? [
    ['Expected Work Hours', formatPayrollDuration(payroll.expected_regular_minutes)],
    ['Hours Worked', formatPayrollDuration(payroll.regular_attended_minutes)],
    ['Paid Time Off', formatPayrollDuration(payroll.pto_minutes)],
    ['Regular Holiday Hours', formatPayrollDuration(payroll.regular_holiday_minutes)],
    ['Special Holiday Hours', formatPayrollDuration(payroll.special_holiday_minutes)],
    ['Late / Absent Time', `${Number(payroll.tardiness_absence_minutes || 0).toLocaleString('en-PH')} mins`],
    ['Overtime', formatPayrollDuration(payroll.overtime_minutes)],
    ['Rest-Day Work', formatPayrollDuration(payroll.rest_day_overtime_minutes)],
    ['Night Differential', formatPayrollDuration(payroll.night_differential_minutes)],
  ] : [], [payroll])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiFileText /><span className="text-xs font-black uppercase tracking-[0.16em]">Employee Salary</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">{payroll?.employee_name_snapshot || 'Salary Detail'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{payroll?.period_label || 'Loading payroll period...'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="border-b border-slate-200 bg-slate-50 px-5 pt-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto">
            <button type="button" onClick={() => setTab('salary')} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-t-xl px-4 text-sm font-black ${tab === 'salary' ? 'border border-b-white border-slate-200 bg-white text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}><FiFileText />Salary Detail</button>
            <button type="button" onClick={() => setTab('attendance')} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-t-xl px-4 text-sm font-black ${tab === 'attendance' ? 'border border-b-white border-slate-200 bg-white text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}><FiActivity />Attendance Breakdown</button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {alert ? <div className="mb-4"><StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /></div> : null}
          {query.isLoading ? <StatusAlert type="loading" message="Loading salary details..." /> : null}
          {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Unable to load salary detail.'} /> : null}

          {!query.isLoading && payroll && tab === 'salary' ? <div className="space-y-5">
            <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-lg font-black text-slate-950">{payroll.employee_name_snapshot}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{payroll.position_snapshot || '—'} · {employmentLabel(payroll.employment_status_snapshot)} · {payroll.department_snapshot || '—'}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Pay Period: {formatPayrollDate(payroll.period_start)} – {formatPayrollDate(payroll.period_end)}</p>
              </div>
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${payrollStatusTone(payroll.payroll_status)}`}>{payrollStatusLabel(payroll.payroll_status)}</span>
            </section>

            {(payroll.calculation_warnings || []).length ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-amber-950">Review these payroll items</p>
                  <p className="mt-1 text-xs text-amber-900">Check the items below. Update the settings and recalculate Draft payroll before finalizing.</p>
                </div>
                {payroll.calculation_warnings.some((warning) => /attendance bonus|payroll settings|premium/i.test(warning)) && canManagePayrollSettings ?
                  <button type="button" onClick={() => setShowPayrollSettings(true)} className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100">{payroll.calculation_warnings.some((warning) => /attendance bonus/i.test(warning)) ? 'Set Attendance Bonus Rule' : 'Open Payroll Settings'}</button> : null}
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">{payroll.calculation_warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              {payroll.calculation_warnings.some((warning) => /attendance bonus/i.test(warning)) && !canManagePayrollSettings ? <p className="mt-2 text-xs font-semibold text-amber-900">Ask an account with Manage Payroll Settings access to approve the bonus policy.</p> : null}
            </section> : null}

            {officialStatus ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-900">{payroll.payroll_status === 'released' ? 'Salary Released' : 'Salary Finalized'}</p><p className="mt-1 text-sm text-emerald-900">Finalized {payroll.finalized_at ? formatPayrollDate(payroll.finalized_at) : '—'}{payroll.finalized_by_name ? ` by ${payroll.finalized_by_name}` : ''}</p></section> : null}

            {officialStatus && payroll.attendance_change?.changed ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-start gap-3"><FiAlertTriangle className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-950">Attendance changed after this payroll was finalized.</p><p className="mt-1 text-sm font-semibold leading-5 text-amber-900">This finalized salary remains unchanged. Review the saved attendance and payroll records before the next salary run.</p></div></div><div className="mt-3 divide-y divide-amber-200 rounded-xl border border-amber-200 bg-white px-3">{(payroll.attendance_change.differences || []).map((item) => <div key={item.field} className="flex items-center justify-between gap-4 py-2 text-xs font-bold text-slate-700"><span>{item.label}</span><span className="text-right">{String(item.before ?? '—')} → {String(item.after ?? '—')}</span></div>)}</div></section> : null}

            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Salary and Pay Rates</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="Monthly Basic Pay" value={money(payroll.monthly_salary_snapshot)} />
                <Metric label="Basic Pay This Period" value={money(payroll.half_month_basic)} />
                <Metric label="Daily Rate" value={money(payroll.daily_rate)} />
                <Metric label="Hourly Rate" value={money(payroll.hourly_rate_snapshot)} />
                <Metric label="Minute Rate" value={money(payroll.minute_rate)} />
              </div>
            </section>

            <PayrollRateExplanation payroll={payroll} />

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Applied Payroll Settings</h3><span className="text-xs font-bold text-slate-500">Revision {payroll.payroll_settings_snapshot?.settings_revision ?? '—'}</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Regular Overtime" value={settingValue(payroll.payroll_settings_snapshot?.regular_ot_multiplier, '×')} />
                <Metric label="Rest-Day Work" value={settingValue(payroll.payroll_settings_snapshot?.rest_day_ot_multiplier, '×')} />
                <Metric label="Holiday Pay Rate" value={payroll.payroll_settings_snapshot?.regular_holiday_multiplier === payroll.payroll_settings_snapshot?.special_holiday_multiplier
                  ? settingValue(payroll.payroll_settings_snapshot?.regular_holiday_multiplier, '×')
                  : `Regular: ${settingValue(payroll.payroll_settings_snapshot?.regular_holiday_multiplier, '×')} / Special: ${settingValue(payroll.payroll_settings_snapshot?.special_holiday_multiplier, '×')}`} />
                <Metric label="Night Shift Differential" value={settingValue(payroll.payroll_settings_snapshot?.night_differential_percentage, '%')} />
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Attendance for This Pay Period</h3><button type="button" onClick={() => setTab('attendance')} className="inline-flex items-center gap-2 text-xs font-black text-blue-700 hover:text-blue-800"><FiClock />View Attendance Breakdown</button></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{attendance.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Attendance calculated through {formatPayrollDate(payroll.attendance_calculated_through, { short: true })}. Regular working day: {Number(payroll.regular_working_minutes_snapshot || 0)} minutes.</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Earnings</h3><div className="divide-y divide-slate-100"><MoneyRow label="Basic Pay This Period" value={payroll.half_month_basic} /><MoneyRow label="Overtime Pay" value={payroll.overtime_pay} /><MoneyRow label="Rest-Day Overtime Rate" value={payroll.rest_day_overtime_pay} /><MoneyRow label="Regular Holiday Pay" value={payroll.regular_holiday_pay} /><MoneyRow label="Special Holiday Pay" value={payroll.special_holiday_pay} /><MoneyRow label="Night Differential" value={payroll.night_differential_pay} /><MoneyRow label="Manual Additions" value={payroll.manual_additions_total} /></div></div>
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Allowances</h3><div className="divide-y divide-slate-100"><MoneyRow label="Rice Allowance" value={payroll.rice_allowance} /><MoneyRow label="Transportation" value={payroll.transportation_allowance} /><MoneyRow label="Attendance Bonus" value={payroll.attendance_bonus} /></div></div>
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Deductions and Take-Home Pay</h3><div className="divide-y divide-slate-100"><MoneyRow label="Late or Absent Time" value={payroll.attendance_deduction} /><MoneyRow label="Manual Deductions" value={payroll.manual_deductions_total} /><MoneyRow label="Take-Home Pay" value={payroll.net_fund_release} strong /></div></div>
            </section>

            {(payroll.correction_history || []).length ? <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-violet-700">Correction History</p><div className="mt-3 space-y-2">{payroll.correction_history.map((item) => <div key={item.employee_payroll_correction_id} className="rounded-xl border border-violet-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-slate-900">Correction #{item.employee_payroll_correction_id}</p><p className="text-xs font-semibold text-slate-500">{item.created_by_name ? `By ${item.created_by_name} · ` : ''}{String(item.created_at || '').replace('T', ' ').slice(0, 16)}</p></div><p className="mt-1 text-sm font-semibold text-slate-700">{item.reason}</p><p className="mt-2 text-xs font-bold text-slate-500">Net Fund Release: {money(item.before_snapshot?.net_fund_release)} → {money(item.after_snapshot?.net_fund_release)}</p></div>)}</div></section> : null}

            {payroll.payroll_status === 'draft' ? <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Draft Payroll</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Recalculate when Attendance, applicable compensation, or Payroll Settings change, then use Proceed to Final Review. You can preview the Fund Release Receipt while Draft, but official Print / PDF Export stays locked until Finalization.</p></section> : null}
            {officialStatus ? <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-600">Official Receipt</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">You can preview, print, or save the approved salary receipt. Approved salary corrections appear on this receipt.</p></section> : null}
            {payroll.payroll_status === 'released' ? <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4"><div className="flex items-start gap-3"><FiCheckCircle className="mt-0.5 shrink-0 text-emerald-700" /><div><p className="font-black text-emerald-950">Fund Release Recorded</p><p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">Released {payroll.released_date ? formatPayrollDate(payroll.released_date) : '—'}{payroll.released_by_name ? ` by ${payroll.released_by_name}` : ''}. The approved salary amounts are kept in the receipt.</p>{payroll.release_reference ? <p className="mt-1 text-sm font-bold text-emerald-900">Reference: {payroll.release_reference}</p> : null}{payroll.release_notes ? <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-emerald-900">Notes: {payroll.release_notes}</p> : null}</div></div></section> : null}
          </div> : null}

          {!query.isLoading && payroll && tab === 'attendance' ? <div className="space-y-4">
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-black text-blue-900">Attendance source for {payroll.period_label}</p><p className="mt-1 text-xs font-semibold leading-5 text-blue-800">{officialStatus ? 'These attendance records were used to finalize this salary. Later attendance changes do not change this pay period.' : 'These attendance records were used for the draft. Recalculate the draft after fixing attendance.'}</p></section>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Date', 'Day Type', 'Status', 'Time In', 'Time Out', 'Regular Time', 'Late (min)', 'Overtime', 'Rest Day OT', 'Regular Holiday', 'Special Holiday', 'Night Hrs'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {!breakdown.length ? <tr><td colSpan={12} className="px-5 py-12 text-center font-semibold text-slate-500">No attendance rows were recorded for this calculation range.</td></tr> : null}
                  {breakdown.map((row) => <tr key={row.date} className="hover:bg-slate-50"><td className="px-4 py-3 font-black text-slate-900">{formatPayrollDate(row.date, { short: true })}</td><td className="px-4 py-3 font-semibold text-slate-700">{dayTypeLabel(row.day_type)}</td><td className="px-4 py-3 font-semibold text-slate-700">{stateLabel(row)}</td><td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.time_in || '—'}</td><td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.time_out || '—'}</td><td className="px-4 py-3 font-semibold text-slate-700">{formatPayrollDuration(row.regular_attended_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{Number(row.late_minutes || 0).toLocaleString('en-PH')} min</td><td className="px-4 py-3 font-semibold text-slate-700">{formatPayrollDuration(row.overtime_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{formatPayrollDuration(row.rest_day_overtime_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{formatPayrollDuration(row.regular_holiday_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{formatPayrollDuration(row.special_holiday_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{formatPayrollDuration(row.night_differential_minutes)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500">Salary details for this pay period</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Close</button>
            {payroll?.payroll_status === 'released' && canPrintReceipt ? <button type="button" onClick={() => setShowSignedReceipts(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-800">Receipts</button> : null}
            {payroll ? <button type="button" onClick={() => setShowReceipt(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 hover:bg-slate-50"><FiFileText />{officialStatus ? 'Acknowledgement Receipt' : 'Preview Receipt'}</button> : null}
            {canRecalculate && payroll?.payroll_status === 'draft' ? <button type="button" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"><FiRefreshCw className={recalcMutation.isPending ? 'animate-spin' : ''} />{recalcMutation.isPending ? 'Recalculating...' : 'Recalculate Draft'}</button> : null}
            {canFinalize && payroll?.payroll_status === 'draft' ? <button type="button" onClick={() => setShowFinalReview(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700"><FiLock />Proceed to Final Review</button> : null}
            {canRelease && ['finalized', 'corrected'].includes(payroll?.payroll_status) ? <button type="button" onClick={() => setShowRelease(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"><FiCheckCircle />Mark as Released</button> : null}
          </div>
        </footer>
      </div>
      {showSignedReceipts && payroll ? <SignedSalaryReceiptsModal payrollId={payrollId} employeeName={payroll.employee_name_snapshot} canUpload={canRelease} canPrint={canPrintReceipt} canExport={canExportReceipt} onClose={() => setShowSignedReceipts(false)} /> : null}
      {showPayrollSettings ? <PayrollSettingsModal initialSection={payroll?.calculation_warnings?.some((warning) => /attendance bonus/i.test(warning)) ? 'attendance-bonus' : null} onClose={() => setShowPayrollSettings(false)} onSaved={() => { setShowPayrollSettings(false); setAlert({ type: 'success', message: payroll?.payroll_status === 'draft' ? 'Payroll Settings saved. Recalculate this Draft to apply the new policy.' : 'Payroll Settings saved. Existing finalized payroll history is unchanged.' }); queryClient.invalidateQueries({ queryKey: ['employee-salary'] }); }} /> : null}
      {showFinalReview ? <FinalizePayrollModal payrollId={payrollId} onClose={() => setShowFinalReview(false)} onFinalized={(result) => { setAlert({ type: 'success', message: result?.message || 'Payroll finalized.' }); queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] }); queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] }); onUpdated?.() }} /> : null}
      {showReceipt ? <FundReleaseReceiptModal payrollId={payrollId} canPrint={canPrintReceipt} canExport={canExportReceipt} historyMode={historyMode} onClose={() => setShowReceipt(false)} /> : null}
      {showRelease && payroll ? <ReleasePayrollModal payroll={payroll} onClose={() => setShowRelease(false)} onReleased={(result) => { setShowReceipt(true); setAlert({ type: 'success', message: 'Payroll release recorded. The acknowledgment receipt is ready to print and sign.' }); queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] }); queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] }); onUpdated?.() }} /> : null}
    </div>
  )
}

export default SalaryDetailModal









