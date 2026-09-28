import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiClock, FiFileText, FiLock, FiRefreshCw, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import FinalizePayrollModal from './FinalizePayrollModal'
import FundReleaseReceiptModal from './FundReleaseReceiptModal'
import ReleasePayrollModal from './ReleasePayrollModal'
import CorrectPayrollModal from './CorrectPayrollModal'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { decimalHours, employmentLabel, formatPayrollDate, money, payrollStatusLabel, payrollStatusTone } from './payrollFormatters'

const Metric = ({ label, value, hint }) => <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-base font-black text-slate-950">{value}</p>{hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}</div>

const MoneyRow = ({ label, value, strong = false }) => <div className={`flex items-center justify-between gap-4 py-2.5 ${strong ? 'font-black text-slate-950' : 'font-semibold text-slate-700'}`}><span>{label}</span><span>{money(value)}</span></div>

const dayTypeLabel = (value) => ({ regular: 'Regular', double_pay: 'Double Pay', regular_holiday: 'Regular Holiday', special_holiday: 'Special Holiday', company_event: 'Company Event' }[value] || value || '—')
const stateLabel = (row) => row.absence ? 'Absent' : row.state ? String(row.state).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—'
const settingValue = (value, suffix = '') => value === null || value === undefined ? 'Not configured' : `${Number(value)}${suffix}`

const SalaryDetailModal = ({ payrollId, initialTab = 'salary', canRecalculate = false, canFinalize = false, canCorrect = false, canRelease = false, canPrintReceipt = false, canExportReceipt = false, historyMode = false, onClose, onUpdated }) => {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(initialTab)
  const [alert, setAlert] = useState(null)
  const [showFinalReview, setShowFinalReview] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showRelease, setShowRelease] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)

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
    ['Expected Regular Hours', decimalHours(payroll.expected_regular_minutes)],
    ['Regular Hours Attended', decimalHours(payroll.regular_attended_minutes)],
    ['Paid Time Off', decimalHours(payroll.pto_minutes)],
    ['Regular Holiday Hours', decimalHours(payroll.regular_holiday_minutes)],
    ['Special Holiday Hours', decimalHours(payroll.special_holiday_minutes)],
    ['Tardiness / Absences', `${Number(payroll.tardiness_absence_minutes || 0).toLocaleString('en-PH')} mins`],
    ['Overtime', decimalHours(payroll.overtime_minutes)],
    ['Rest Day Overtime', decimalHours(payroll.rest_day_overtime_minutes)],
    ['Night Differential', decimalHours(payroll.night_differential_minutes)],
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

            {(payroll.calculation_warnings || []).length ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-amber-800">Calculation Warnings</p><ul className="mt-2 space-y-1 text-sm font-semibold leading-5 text-amber-900">{payroll.calculation_warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></section> : null}

            {officialStatus ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-800">Immutable Official Payroll Snapshot</p><p className="mt-1 text-sm font-semibold leading-6 text-emerald-950">Originally finalized {payroll.finalized_at ? formatPayrollDate(payroll.finalized_at) : ''}{payroll.finalized_by_name ? ` by ${payroll.finalized_by_name}` : ''}. Formal corrections are versioned below; fund release never silently recalculates these approved values.</p></section> : null}

            {officialStatus && payroll.attendance_change?.changed ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-start gap-3"><FiAlertTriangle className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-950">Attendance changed after this payroll was finalized.</p><p className="mt-1 text-sm font-semibold leading-5 text-amber-900">The official salary has not been silently rewritten. Authorized users can open Salary Correction to review the complete Before vs After recalculation.</p></div></div><div className="mt-3 divide-y divide-amber-200 rounded-xl border border-amber-200 bg-white px-3">{(payroll.attendance_change.differences || []).map((item) => <div key={item.field} className="flex items-center justify-between gap-4 py-2 text-xs font-bold text-slate-700"><span>{item.label}</span><span className="text-right">{String(item.before ?? '—')} → {String(item.after ?? '—')}</span></div>)}</div>{canCorrect && payroll.payroll_status !== 'released' ? <button type="button" onClick={() => setShowCorrection(true)} className="mt-3 h-9 rounded-lg bg-violet-700 px-3 text-xs font-black text-white hover:bg-violet-800">Create Salary Correction</button> : null}</section> : null}

            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Compensation & Rates</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="Monthly Basic" value={money(payroll.monthly_salary_snapshot)} />
                <Metric label="Half-Month Basic" value={money(payroll.half_month_basic)} />
                <Metric label="Daily Rate" value={money(payroll.daily_rate)} />
                <Metric label="Hourly Rate" value={money(payroll.hourly_rate_snapshot)} />
                <Metric label="Minute Rate" value={money(payroll.minute_rate)} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Applied Payroll Settings</h3><span className="text-xs font-bold text-slate-500">Revision {payroll.payroll_settings_snapshot?.settings_revision ?? '—'}</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Regular OT" value={settingValue(payroll.payroll_settings_snapshot?.regular_ot_multiplier, '×')} />
                <Metric label="Rest Day OT" value={settingValue(payroll.payroll_settings_snapshot?.rest_day_ot_multiplier, '×')} />
                <Metric label="Regular Holiday" value={settingValue(payroll.payroll_settings_snapshot?.regular_holiday_multiplier, '×')} />
                <Metric label="Special Holiday" value={settingValue(payroll.payroll_settings_snapshot?.special_holiday_multiplier, '×')} />
                <Metric label="Regular Holiday OT" value={settingValue(payroll.payroll_settings_snapshot?.regular_holiday_ot_multiplier, '×')} hint="Stored; separate holiday OT minutes are not available yet." />
                <Metric label="Special Holiday OT" value={settingValue(payroll.payroll_settings_snapshot?.special_holiday_ot_multiplier, '×')} hint="Stored; separate holiday OT minutes are not available yet." />
                <Metric label="Night Differential" value={settingValue(payroll.payroll_settings_snapshot?.night_differential_percentage, '%')} />
                <Metric label="Mid-Period Rule" value={payroll.payroll_settings_snapshot?.mid_period_change_rule === 'period_boundary_only' ? '1st / 16th boundary only' : (payroll.payroll_settings_snapshot?.mid_period_change_rule || '—')} />
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Attendance Summary</h3><button type="button" onClick={() => setTab('attendance')} className="inline-flex items-center gap-2 text-xs font-black text-blue-700 hover:text-blue-800"><FiClock />View Attendance Breakdown</button></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{attendance.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Attendance calculated through {formatPayrollDate(payroll.attendance_calculated_through, { short: true })}. Regular working day: {Number(payroll.regular_working_minutes_snapshot || 0)} minutes.</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Earnings</h3><div className="divide-y divide-slate-100"><MoneyRow label="Half-Month Basic" value={payroll.half_month_basic} /><MoneyRow label="Overtime Pay" value={payroll.overtime_pay} /><MoneyRow label="Rest Day OT" value={payroll.rest_day_overtime_pay} /><MoneyRow label="Regular Holiday Pay" value={payroll.regular_holiday_pay} /><MoneyRow label="Special Holiday Pay" value={payroll.special_holiday_pay} /><MoneyRow label="Night Differential" value={payroll.night_differential_pay} /><MoneyRow label="Manual Additions" value={payroll.manual_additions_total} /></div></div>
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Allowances</h3><div className="divide-y divide-slate-100"><MoneyRow label="Rice Allowance" value={payroll.rice_allowance} /><MoneyRow label="Transportation" value={payroll.transportation_allowance} /><MoneyRow label="Attendance Bonus" value={payroll.attendance_bonus} /></div></div>
              <div className="rounded-2xl border border-slate-200 p-4"><h3 className="border-b border-slate-200 pb-3 text-sm font-black uppercase tracking-wide text-slate-500">Deductions & Net</h3><div className="divide-y divide-slate-100"><MoneyRow label="Tardiness / Absences" value={payroll.attendance_deduction} /><MoneyRow label="Manual Deductions" value={payroll.manual_deductions_total} /><MoneyRow label="Net Fund Release" value={payroll.net_fund_release} strong /></div></div>
            </section>

            {(payroll.correction_history || []).length ? <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-violet-700">Correction History</p><div className="mt-3 space-y-2">{payroll.correction_history.map((item) => <div key={item.employee_payroll_correction_id} className="rounded-xl border border-violet-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-slate-900">Correction #{item.employee_payroll_correction_id}</p><p className="text-xs font-semibold text-slate-500">{item.created_by_name ? `By ${item.created_by_name} · ` : ''}{String(item.created_at || '').replace('T', ' ').slice(0, 16)}</p></div><p className="mt-1 text-sm font-semibold text-slate-700">{item.reason}</p><p className="mt-2 text-xs font-bold text-slate-500">Net Fund Release: {money(item.before_snapshot?.net_fund_release)} → {money(item.after_snapshot?.net_fund_release)}</p></div>)}</div></section> : null}

            {payroll.payroll_status === 'draft' ? <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Draft Payroll</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Recalculate when Attendance, applicable compensation, or Payroll Settings change, then use Proceed to Final Review. You can preview the Fund Release Receipt while Draft, but official Print / PDF Export stays locked until Finalization.</p></section> : null}
            {officialStatus ? <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-600">Official Receipt</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Preview, Print and PDF Export use the current immutable official payroll snapshot, including any formally approved correction.</p></section> : null}
            {payroll.payroll_status === 'released' ? <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4"><div className="flex items-start gap-3"><FiCheckCircle className="mt-0.5 shrink-0 text-emerald-700" /><div><p className="font-black text-emerald-950">Fund Release Recorded</p><p className="mt-1 text-sm font-semibold leading-6 text-emerald-900">Released {payroll.released_date ? formatPayrollDate(payroll.released_date) : '—'}{payroll.released_by_name ? ` by ${payroll.released_by_name}` : ''}. The finalized payroll snapshot remains unchanged.</p>{payroll.release_reference ? <p className="mt-1 text-sm font-bold text-emerald-900">Reference: {payroll.release_reference}</p> : null}{payroll.release_notes ? <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-emerald-900">Notes: {payroll.release_notes}</p> : null}</div></div></section> : null}
          </div> : null}

          {!query.isLoading && payroll && tab === 'attendance' ? <div className="space-y-4">
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-black text-blue-900">Attendance source for {payroll.period_label}</p><p className="mt-1 text-xs font-semibold leading-5 text-blue-800">{officialStatus ? 'These are the date-level Attendance facts frozen with the finalized payroll snapshot. Later Attendance corrections do not rewrite them.' : 'These are the date-level facts saved with this Draft calculation. Recalculate Draft payroll to consume corrected Attendance data.'}</p></section>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Date', 'Day Type', 'Status', 'Time In', 'Time Out', 'Regular Hrs', 'Late Mins', 'OT Hrs', 'Rest Day OT', 'Regular Holiday', 'Special Holiday'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {!breakdown.length ? <tr><td colSpan={11} className="px-5 py-12 text-center font-semibold text-slate-500">No attendance rows were recorded for this calculation range.</td></tr> : null}
                  {breakdown.map((row) => <tr key={row.date} className="hover:bg-slate-50"><td className="px-4 py-3 font-black text-slate-900">{formatPayrollDate(row.date, { short: true })}</td><td className="px-4 py-3 font-semibold text-slate-700">{dayTypeLabel(row.day_type)}</td><td className="px-4 py-3 font-semibold text-slate-700">{stateLabel(row)}</td><td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.time_in || '—'}</td><td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.time_out || '—'}</td><td className="px-4 py-3 font-semibold text-slate-700">{decimalHours(row.regular_attended_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{Number(row.late_minutes || 0)}</td><td className="px-4 py-3 font-semibold text-slate-700">{decimalHours(row.overtime_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{decimalHours(row.rest_day_overtime_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{decimalHours(row.regular_holiday_minutes)}</td><td className="px-4 py-3 font-semibold text-slate-700">{decimalHours(row.special_holiday_minutes)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-semibold text-slate-500">Calculation version: {payroll?.calculation_version || '—'}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Close</button>
            {payroll ? <button type="button" onClick={() => setShowReceipt(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 hover:bg-slate-50"><FiFileText />Preview Receipt</button> : null}
            {canRecalculate && payroll?.payroll_status === 'draft' ? <button type="button" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"><FiRefreshCw className={recalcMutation.isPending ? 'animate-spin' : ''} />{recalcMutation.isPending ? 'Recalculating...' : 'Recalculate Draft'}</button> : null}
            {canFinalize && payroll?.payroll_status === 'draft' ? <button type="button" onClick={() => setShowFinalReview(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700"><FiLock />Proceed to Final Review</button> : null}
            {canCorrect && ['finalized', 'corrected'].includes(payroll?.payroll_status) ? <button type="button" onClick={() => setShowCorrection(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800"><FiAlertTriangle />Salary Correction</button> : null}
            {canRelease && ['finalized', 'corrected'].includes(payroll?.payroll_status) ? <button type="button" onClick={() => setShowRelease(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"><FiCheckCircle />Mark as Released</button> : null}
          </div>
        </footer>
      </div>
      {showFinalReview ? <FinalizePayrollModal payrollId={payrollId} onClose={() => setShowFinalReview(false)} onFinalized={(result) => { setAlert({ type: 'success', message: result?.message || 'Payroll finalized.' }); queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] }); queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] }); onUpdated?.() }} /> : null}
      {showReceipt ? <FundReleaseReceiptModal payrollId={payrollId} canPrint={canPrintReceipt} canExport={canExportReceipt} historyMode={historyMode} onClose={() => setShowReceipt(false)} /> : null}
      {showCorrection && payroll ? <CorrectPayrollModal payrollId={payrollId} onClose={() => setShowCorrection(false)} onCorrected={(result) => { setAlert({ type: 'success', message: result?.message || 'Salary Correction saved.' }); queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] }); queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] }); onUpdated?.() }} /> : null}
      {showRelease && payroll ? <ReleasePayrollModal payroll={payroll} onClose={() => setShowRelease(false)} onReleased={(result) => { setAlert({ type: 'success', message: result?.message || 'Payroll marked as Released.' }); queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] }); queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] }); onUpdated?.() }} /> : null}
    </div>
  )
}

export default SalaryDetailModal
