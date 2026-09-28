import { formatPayrollDate, payrollStatusLabel } from './payrollFormatters'

const amount = (value) => Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const PayrollSummaryPrint = ({ summary }) => {
  if (!summary) return null
  const rows = summary.rows || []
  const totals = summary.totals || {}
  const statusEntries = Object.entries(summary.status_counts || {}).filter(([, count]) => Number(count || 0) > 0)

  return (
    <article style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className="payroll-summary-print print-export-page mx-auto min-h-[794px] w-[1123px] bg-white px-[42px] py-[38px] text-black shadow-xl print:shadow-none">
      {!summary.official ? <div className="mb-4 border-2 border-dashed border-black px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.18em]">Draft / Mixed Status Payroll Summary - Not Official</div> : null}

      <header className="mb-5 text-center">
        <h1 className="text-[18px] font-black uppercase">D&amp;C Prime Realty</h1>
        <h2 className="mt-1 text-[16px] font-black">Employee Payroll Summary</h2>
        <p className="mt-2 text-[12px] font-semibold">Pay Period: {formatPayrollDate(summary.period?.periodStart)} - {formatPayrollDate(summary.period?.periodEnd)}</p>
        {statusEntries.length ? <p className="mt-1 text-[10px] font-medium">Status: {statusEntries.map(([status, count]) => `${payrollStatusLabel(status)} ${count}`).join(' | ')}</p> : null}
      </header>

      <table className="w-full table-fixed border-collapse border border-black text-[9px]">
        <colgroup>
          <col className="w-[18%]" /><col className="w-[19%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[9%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#d9d9d9]">
            {['Employee', 'Position', 'Basic', 'Deduction', 'OT', 'Rest Day OT', 'Allowances', 'Adjustments', 'Net'].map((label) => <th key={label} className="border border-black px-1.5 py-2 text-center font-black">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => <tr key={row.employee_payroll_id}>
            <td className="border border-black px-1.5 py-1.5 font-bold">{row.employee_name || '—'}</td>
            <td className="border border-black px-1.5 py-1.5">{row.position || '—'}</td>
            <td className="border border-black px-1.5 py-1.5 text-right">{amount(row.basic)}</td>
            <td className="border border-black px-1.5 py-1.5 text-right">{amount(row.deduction)}</td>
            <td className="border border-black px-1.5 py-1.5 text-right">{amount(row.overtime)}</td>
            <td className="border border-black px-1.5 py-1.5 text-right">{amount(row.rest_day_overtime)}</td>
            <td className="border border-black px-1.5 py-1.5 text-right">{amount(row.allowances)}</td>
            <td className="border border-black px-1.5 py-1.5 text-right">{amount(row.adjustments)}</td>
            <td className="border border-black px-1.5 py-1.5 text-right font-black">{amount(row.net)}</td>
          </tr>) : <tr><td colSpan={9} className="border border-black px-3 py-8 text-center font-bold">No non-cancelled payroll records for this period.</td></tr>}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-2 gap-8 text-[10px]">
        <section>
          <h3 className="border-b border-black pb-1 font-black uppercase">Period Totals</h3>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-5 gap-y-1.5">
            <span>Employee Count</span><strong>{Number(totals.employee_count || 0)}</strong>
            <span>Total Basic</span><strong>{amount(totals.total_basic)}</strong>
            <span>Total Attendance Deduction</span><strong>{amount(totals.total_attendance_deduction)}</strong>
            <span>Total Overtime</span><strong>{amount(totals.total_overtime)}</strong>
            <span>Total Rest Day OT</span><strong>{amount(totals.total_rest_day_overtime)}</strong>
            <span>Total Holiday Pay</span><strong>{amount(totals.total_holiday_pay)}</strong>
          </div>
        </section>
        <section>
          <h3 className="border-b border-black pb-1 font-black uppercase">Additional Totals</h3>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-5 gap-y-1.5">
            <span>Total Night Differential</span><strong>{amount(totals.total_night_differential)}</strong>
            <span>Total Allowances</span><strong>{amount(totals.total_allowances)}</strong>
            <span>Total Manual Adjustments</span><strong>{amount(totals.total_manual_adjustments)}</strong>
            <span>Total Adjustments</span><strong>{amount(totals.total_adjustments)}</strong>
            <span className="mt-1 border-t border-black pt-2 font-black">TOTAL FUND RELEASE</span><strong className="mt-1 border-t border-black pt-2 text-[12px] underline">{amount(totals.total_fund_release)}</strong>
          </div>
        </section>
      </div>

      <p className="mt-5 text-[9px] leading-relaxed">Adjustments combine Holiday Pay, Night Differential Pay, and net manual additions/deductions so the row columns reconcile to the stored Net Fund Release. Cancelled payroll is excluded from the period summary.</p>
    </article>
  )
}

export default PayrollSummaryPrint
