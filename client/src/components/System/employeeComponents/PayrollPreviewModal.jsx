import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheckCircle, FiDollarSign, FiPrinter, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { formatPayrollReleaseDate, isPayrollReleaseDate } from '../../../utils/payrollDates'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
}).format(Number(value || 0))

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const PayrollPreviewModal = ({ releaseDate, canFinalize, onClose, onFinalized }) => {
  const queryClient = useQueryClient()
  const [selectedReleaseDate, setSelectedReleaseDate] = useState(releaseDate)
  const [witnessName, setWitnessName] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [notice, setNotice] = useState(null)

  const query = useQuery({
    queryKey: ['payroll-preview', selectedReleaseDate],
    queryFn: () => useFetch(`/attendance/payroll-preview?releaseDate=${selectedReleaseDate}`),
    enabled: isPayrollReleaseDate(selectedReleaseDate),
  })

  const mutation = useMutation({
    mutationFn: () => useFetchPost('/attendance/payroll-finalize', {
      releaseDate: selectedReleaseDate,
      witnessName,
      releaseNotes,
    }),
    onMutate: () => setNotice({ type: 'loading', message: 'Finalizing salary release and posting cash-advance deductions...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-preview'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      queryClient.invalidateQueries({ queryKey: ['employee-cash-advances'] })
      setNotice({ type: 'success', message: result?.message || 'Salary release finalized successfully.' })
      onFinalized?.(result?.message || 'Salary release finalized successfully.')
      query.refetch()
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to finalize the salary release.' }),
  })

  const summary = query.data?.summary || {}
  const rows = query.data?.data || []
  const range = query.data?.range || {}
  const isFinalized = Boolean(query.data?.isFinalized || query.data?.period?.payroll_status === 'finalized')

  const printRelease = (employeeId) => {
    window.open(
      `/employee-payroll/release/print?employeeId=${employeeId}&releaseDate=${selectedReleaseDate}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const finalize = () => {
    if (!isPayrollReleaseDate(selectedReleaseDate)) {
      setNotice({ type: 'warning', message: 'Salary releases are only available on the 7th and 22nd.' })
      return
    }
    if (!window.confirm(`Finalize the ${formatPayrollReleaseDate(selectedReleaseDate)} salary release? Cash-advance deductions will be posted and the payroll values will be saved as a snapshot.`)) return
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FiDollarSign /></span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-slate-950">Salary Release Preview</h2>
              <p className="text-sm font-semibold text-slate-500">Semi-monthly salary releases are scheduled every 7th and 22nd.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} className="mb-4" /> : null}
          {query.isLoading ? <StatusAlert type="loading" message="Calculating salary release..." /> : null}
          {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Failed to calculate the salary release.'} /> : null}
          {isFinalized ? <StatusAlert type="success" title="Salary release finalized" message="The saved payroll snapshot is being displayed. Later attendance or salary edits will not change it." className="mb-4" /> : null}

          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[220px_1fr_1fr]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Release Date *</span>
              <input type="date" className={inputClass} value={selectedReleaseDate} onChange={(event) => { setSelectedReleaseDate(event.target.value); setNotice(null) }} />
              {!isPayrollReleaseDate(selectedReleaseDate) ? <span className="text-xs font-semibold text-red-600">Choose the 7th or 22nd.</span> : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Witness Name</span>
              <input className={inputClass} value={witnessName} onChange={(event) => setWitnessName(event.target.value)} placeholder="Example: Kirsten Jhaycee A. Rioja" disabled={isFinalized || !canFinalize} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Release Notes</span>
              <input className={inputClass} value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} placeholder="Optional salary-release note" disabled={isFinalized || !canFinalize} />
            </label>
          </section>

          {!query.isLoading && !query.isError ? (
            <>
              <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                <p className="font-black">{range.releaseLabel || formatPayrollReleaseDate(selectedReleaseDate)}</p>
                <p className="mt-1">Pay Period: {range.shortLabel || '-'}</p>
                <p className="mt-1 text-xs text-blue-700">Daily rates use the employee's scheduled work days for {range.salaryMonthLabel || 'the salary month'}. Every late second is deducted. The configured grace affects only attendance-bonus qualification. Rice allowance is included in both releases; transportation allowance is included only on the 7th.</p>
              </section>

              <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                {[
                  ['Employees', summary.employeeCount || 0],
                  ['Gross Payroll', money(summary.grossPayroll)],
                  ['Attendance Deductions', money(summary.attendanceDeductions)],
                  ['Cash Advances', money(summary.cashAdvanceDeductions)],
                  ['Allowances', money(summary.allowances)],
                  ['Attendance Bonuses', money(summary.attendanceBonuses)],
                  ['Net Payroll', money(summary.netPayroll)],
                ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-slate-950">{value}</p></div>)}
              </section>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-[1550px] w-full text-sm">
                  <thead className="bg-slate-50"><tr>{['Employee', 'Daily / Hourly Rate', 'Regular Pay', 'Late / Undertime', 'Absence', 'Overtime', 'Allowances', 'Attendance Bonus', 'Cash Advance', 'Net Pay', 'Print'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{head}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {!rows.length ? <tr><td colSpan={11} className="px-6 py-14 text-center font-semibold text-slate-500">No employees are available for this salary release.</td></tr> : null}
                    {rows.map((row) => (
                      <tr key={row.employeeId} className="align-top transition hover:bg-slate-50">
                        <td className="px-4 py-3"><p className="font-black text-slate-950">{row.fullName}</p><p className="text-xs font-semibold text-blue-600">{row.employeeCode}</p><p className="mt-1 text-xs text-slate-500">{row.position} · {row.periodWorkDays} work day(s)</p></td>
                        <td className="px-4 py-3"><p className="font-black">{money(row.dailyRate)} / day</p><p className="text-xs text-slate-500">{money(row.hourlyRate)} / hour</p><p className="text-xs text-slate-500">{row.monthWorkDays} scheduled days/month</p></td>
                        <td className="px-4 py-3 font-black">{money(row.regularPayAfterAttendance)}<p className="text-xs font-semibold text-slate-500">Base: {money(row.monthlySalary)} monthly</p></td>
                        <td className="px-4 py-3"><p className="font-black text-red-700">-{money(Number(row.lateDeduction || 0) + Number(row.undertimeDeduction || 0))}</p><p className="text-xs text-slate-500">Late: {row.lateDuration || '0s'}</p><p className="text-xs text-slate-500">Undertime: {row.undertimeDuration || '0s'}</p></td>
                        <td className="px-4 py-3"><p className="font-black text-red-700">-{money(row.absenceDeduction)}</p><p className="text-xs text-slate-500">{row.absentDays} day(s)</p></td>
                        <td className="px-4 py-3"><p className="font-black text-emerald-700">+{money(row.overtimePay)}</p><p className="text-xs text-slate-500">{row.overtimeDuration || '0s'}</p></td>
                        <td className="px-4 py-3"><p className="font-black text-emerald-700">+{money(Number(row.riceAllowance || 0) + Number(row.transportationAllowance || 0))}</p><p className="text-xs text-slate-500">Rice (each release): {money(row.riceAllowance)}</p><p className="text-xs text-slate-500">Transpo (7th only): {money(row.transportationAllowance)}</p></td>
                        <td className="px-4 py-3"><p className={`font-black ${row.attendanceBonus ? 'text-emerald-700' : 'text-slate-500'}`}>{row.attendanceBonus ? `+${money(row.attendanceBonus)}` : money(0)}</p><p className="max-w-[220px] text-xs text-slate-500">{row.attendanceBonusNote}</p></td>
                        <td className="px-4 py-3 font-black text-red-700">-{money(row.cashAdvanceDeduction)}</td>
                        <td className="px-4 py-3 text-lg font-black text-emerald-700">{money(row.netPay)}</td>
                        <td className="px-4 py-3"><button type="button" onClick={() => printRelease(row.employeeId)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"><FiPrinter />Release</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Close</button>
          {canFinalize && !isFinalized && !query.isLoading && !query.isError ? <button type="button" onClick={finalize} disabled={mutation.isPending || !isPayrollReleaseDate(selectedReleaseDate)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"><FiCheckCircle />{mutation.isPending ? 'Finalizing...' : 'Finalize & Release Payroll'}</button> : null}
        </footer>
      </div>
    </div>
  )
}

export default PayrollPreviewModal


