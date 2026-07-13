import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheckCircle, FiDollarSign, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

const PayrollPreviewModal = ({ month, canFinalize, onClose, onFinalized }) => {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['payroll-preview', month], queryFn: () => useFetch(`/attendance/payroll-preview?month=${month}`) })
  const mutation = useMutation({
    mutationFn: () => useFetchPost('/attendance/payroll-finalize', { month }),
    onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ['payroll-preview'] }); queryClient.invalidateQueries({ queryKey: ['employee-cash-advances'] }); onFinalized?.(result?.message || 'Payroll finalized.'); onClose() },
  })
  const summary = data?.summary || {}
  const rows = data?.data || []
  const isFinalized = data?.period?.payroll_status === 'finalized'

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FiDollarSign /></span><div><h2 className="text-xl font-black">Payroll Preview</h2><p className="text-sm font-semibold text-slate-500">{data?.range?.label || month} salary and attendance deductions.</p></div></div><button type="button" onClick={onClose} disabled={mutation.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"><FiX /></button></header>
    <div className="flex-1 overflow-y-auto p-5">
      {isLoading ? <StatusAlert type="loading" message="Calculating payroll preview..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to calculate payroll.'} /> : null}
      {mutation.isError ? <StatusAlert type="error" message={mutation.error?.message || 'Failed to finalize payroll.'} className="mb-4" /> : null}
      {isFinalized ? <StatusAlert type="success" title="Payroll finalized" message="This month has a saved payroll snapshot. Later salary changes will not alter it." className="mb-4" /> : null}
      {!isLoading && !isError ? <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
          ['Employees', summary.employeeCount || 0], ['Gross Payroll', money(summary.grossPayroll)], ['Attendance Deductions', money(summary.attendanceDeductions)], ['Cash Advance Deductions', money(summary.cashAdvanceDeductions)], ['Net Payroll', money(summary.netPayroll)],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-slate-950">{value}</p></div>)}</section>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-[1150px] w-full text-sm"><thead className="bg-slate-50"><tr>{['Employee', 'Base Salary', 'Late', 'Undertime', 'Absence', 'Cash Advance', 'Total Deductions', 'Net Pay'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.employeeId}><td className="px-4 py-3"><p className="font-black">{row.fullName}</p><p className="text-xs text-blue-600">{row.employeeCode}</p></td><td className="px-4 py-3 font-black">{money(row.monthlySalary)}</td><td className="px-4 py-3">{money(row.lateDeduction)}<p className="text-xs text-slate-500">{row.lateDuration}</p></td><td className="px-4 py-3">{money(row.undertimeDeduction)}<p className="text-xs text-slate-500">{row.undertimeDuration}</p></td><td className="px-4 py-3">{money(row.absenceDeduction)}<p className="text-xs text-slate-500">{row.absentDays} day(s)</p></td><td className="px-4 py-3">{money(row.cashAdvanceDeduction)}</td><td className="px-4 py-3 font-black text-red-700">{money(row.totalDeductions)}</td><td className="px-4 py-3 font-black text-emerald-700">{money(row.netPay)}</td></tr>)}</tbody></table></div>
      </> : null}
    </div>
    <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black">Close</button>{canFinalize && !isFinalized && !isLoading && !isError ? <button type="button" onClick={() => { if (window.confirm(`Finalize ${data?.range?.label || month} payroll? This will post cash advance deductions.`)) mutation.mutate() }} disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-emerald-300"><FiCheckCircle />{mutation.isPending ? 'Finalizing...' : 'Finalize Payroll'}</button> : null}</footer>
  </div></div>
}

export default PayrollPreviewModal
