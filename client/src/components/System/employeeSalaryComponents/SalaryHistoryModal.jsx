import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiClock, FiFileText, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import {
  formatPayrollDate,
  money,
  payrollAdditionTotal,
  payrollStatusLabel,
  payrollStatusTone,
} from './payrollFormatters'
import SalaryDetailModal from './SalaryDetailModal'
import FundReleaseReceiptModal from './FundReleaseReceiptModal'

const SalaryHistoryModal = ({ employee, canCorrect = false, canRelease = false, canPrintReceipt = false, canExportReceipt = false, onClose }) => {
  const employeeId = Number(employee?.employee_id || 0)
  const [selectedPayrollId, setSelectedPayrollId] = useState(null)
  const [selectedReceiptId, setSelectedReceiptId] = useState(null)
  const query = useQuery({
    queryKey: ['employee-salary-history', employeeId],
    queryFn: () => useFetch(`/employee-payroll/history/${employeeId}`),
    enabled: employeeId > 0,
  })

  const data = query.data?.data || null
  const history = data?.history || []
  const summary = data?.summary || { payroll_count: 0, finalized_count: 0, total_basic: 0, total_deductions: 0, total_net_fund_release: 0 }
  const employeeInfo = data?.employee || employee || {}

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiClock /><span className="text-xs font-black uppercase tracking-[0.16em]">Employee Salary History</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">{employeeInfo.current_employee_name || employee?.full_name || 'Employee'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{employeeInfo.employee_code || employee?.employee_code || ''} · Historical payroll remains tied to the position, salary, attendance, and allowances captured for each pay period.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-6">
          {query.isLoading ? <StatusAlert type="loading" message="Loading employee salary history..." /> : null}
          {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Unable to load employee salary history.'} /> : null}

          {!query.isLoading && data ? <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Payroll Records', summary.payroll_count],
                ['Finalized / Official', summary.finalized_count],
                ['Historical Basic', money(summary.total_basic)],
                ['Historical Deductions', money(summary.total_deductions)],
                ['Historical Fund Release', money(summary.total_net_fund_release)],
              ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-black text-slate-950">{value}</p></div>)}
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Promotion-Safe History</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-blue-900">Finalized rows use their immutable finalized payroll snapshot. A later promotion, salary increase, department transfer, or Attendance correction does not rewrite these historical values or receipts.</p>
            </section>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1280px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Pay Period', 'Position / Status', 'Basic', 'Deduction', 'Additions', 'Net', 'Payroll Status', 'Historical Source', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {!history.length ? <tr><td colSpan={9} className="px-5 py-14 text-center"><p className="font-black text-slate-800">No salary history yet</p><p className="mt-1 text-sm font-semibold text-slate-500">Payroll periods will appear here after a Draft payroll has been generated for this employee.</p></td></tr> : null}
                  {history.map((row) => <tr key={row.employee_payroll_id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4"><p className="font-black text-slate-950">{row.period_label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{formatPayrollDate(row.period_start, { short: true })} – {formatPayrollDate(row.period_end, { short: true })}</p></td>
                    <td className="px-4 py-4"><p className="font-black text-slate-800">{row.position_snapshot || '—'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{row.employment_status_snapshot || '—'} · {row.department_snapshot || '—'}</p></td>
                    <td className="px-4 py-4 font-black text-slate-950">{money(row.half_month_basic)}</td>
                    <td className="px-4 py-4 font-semibold text-rose-700">{money(Number(row.attendance_deduction || 0) + Number(row.manual_deductions_total || 0))}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{money(payrollAdditionTotal(row))}</td>
                    <td className="px-4 py-4 text-base font-black text-emerald-700">{money(row.net_fund_release)}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${payrollStatusTone(row.payroll_status)}`}>{payrollStatusLabel(row.payroll_status)}</span>{row.finalized_at ? <p className="mt-2 text-xs font-semibold text-slate-500">Finalized {String(row.finalized_at).replace('T', ' ').slice(0, 16)}</p> : null}{row.payroll_status === 'released' ? <><p className="mt-1 text-xs font-black text-emerald-700">Released {formatPayrollDate(row.released_date || row.release_date, { short: true })}</p>{row.released_by_name ? <p className="mt-1 text-xs font-semibold text-slate-500">By {row.released_by_name}</p> : null}{row.release_reference ? <p className="mt-1 text-xs font-semibold text-slate-500">Ref: {row.release_reference}</p> : null}</> : null}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${row.snapshot_source === 'finalized_snapshot' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.snapshot_source === 'finalized_snapshot' ? 'Immutable Snapshot' : 'Stored Payroll Record'}</span></td>
                    <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedPayrollId(row.employee_payroll_id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiFileText />View Salary</button><button type="button" onClick={() => setSelectedReceiptId(row.employee_payroll_id)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">{row.official_receipt_available ? 'Receipt / Export' : 'Preview Receipt'}</button></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div> : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold text-slate-500">Finalized or formally Corrected historical payroll can be marked as Released by authorized users. Released payroll remains historical and exportable.</p>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Close</button>
        </footer>
      </div>

      {selectedPayrollId ? <SalaryDetailModal payrollId={selectedPayrollId} historyMode canRecalculate={false} canFinalize={false} canCorrect={canCorrect} canRelease={canRelease} canPrintReceipt={canPrintReceipt} canExportReceipt={canExportReceipt} onClose={() => setSelectedPayrollId(null)} onUpdated={() => query.refetch()} /> : null}
      {selectedReceiptId ? <FundReleaseReceiptModal payrollId={selectedReceiptId} historyMode canPrint={canPrintReceipt} canExport={canExportReceipt} onClose={() => setSelectedReceiptId(null)} /> : null}
    </div>
  )
}

export default SalaryHistoryModal

