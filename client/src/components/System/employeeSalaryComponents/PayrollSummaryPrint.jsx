import { formatPayrollDate, payrollStatusLabel } from './payrollFormatters'

const amount = (value) => Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const paymentLabel = (row) => row.payment_state === 'released' ? 'Paid'
  : row.payment_state === 'awaiting_release' ? 'Awaiting release'
  : 'Draft'

const SummaryValue = ({ label, value, emphasis = false }) => (
  <div className={`flex items-center justify-between gap-3 border-b border-slate-200 py-1.5 ${emphasis ? 'font-black' : ''}`}>
    <span>{label}</span><span className="whitespace-nowrap tabular-nums">₱{amount(value)}</span>
  </div>
)

const PayrollSummaryPrint = ({ summary }) => {
  if (!summary) return null
  const rows = summary.rows || []
  const totals = summary.totals || {}
  const period = summary.period || {}
  const counts = Object.entries(summary.status_counts || {}).filter(([, count]) => Number(count || 0) > 0)

  return (
    <article style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827' }} className="payroll-summary-print print-export-page mx-auto min-h-[794px] w-[1123px] bg-white px-[40px] py-[35px] text-black shadow-xl print:shadow-none">
      {!summary.official ? <div className="mb-4 border-2 border-dashed border-black px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.13em]">Draft payroll included — Provisional summary</div> : null}

      <header className="mb-4 flex items-end justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em]">D&amp;C Prime Realty</p>
          <h1 className="mt-1 text-[21px] font-black tracking-tight">Employee Payroll Summary</h1>
          <p className="mt-2 text-[11px] font-medium">Pay period: {formatPayrollDate(period.periodStart)} – {formatPayrollDate(period.periodEnd)}</p>
        </div>
        <div className="text-right text-[10px]">
          <p className="font-black uppercase tracking-wide">{summary.official ? 'Final salary figures' : 'Includes draft estimates'}</p>
          <p className="mt-1">{totals.employee_count || 0} payroll record(s)</p>
          {counts.length ? <p className="mt-1">{counts.map(([status, count]) => `${payrollStatusLabel(status)}: ${count}`).join('  |  ')}</p> : null}
        </div>
      </header>

      <div className="mb-5 grid grid-cols-4 gap-3 text-[10px]" style={{ breakInside: 'avoid' }}>
        {[
          ['Total payroll', totals.total_fund_release],
          ['Released / Paid', totals.total_released],
          ['Awaiting release', totals.total_awaiting_release],
          ['Draft estimate', totals.total_draft],
        ].map(([label, value]) => <div key={label} className="border border-black px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase">{label}</p>
          <p className="mt-1 text-[16px] font-black tabular-nums">₱{amount(value)}</p>
        </div>)}
      </div>

      <table className="w-full table-fixed border-collapse border border-black text-[9px]" style={{ breakInside: 'auto' }}>
        <colgroup>
          {[15, 16, 8, 9, 6, 8, 8, 8, 9, 13].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}
        </colgroup>
        <thead style={{ display: 'table-header-group' }}>
          <tr className="bg-[#d9d9d9]">
            {['Employee', 'Position', 'Basic', 'Attendance Deduction', 'OT', 'Rest Day OT', 'Allowances', 'Adjustments', 'Net Pay', 'Payment Status / Date'].map((label) => <th key={label} className="border border-black px-1.5 py-2 text-center font-black">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => <tr key={row.employee_payroll_id} style={{ breakInside: 'avoid' }}>
            <td className="break-words border border-black px-1.5 py-2 font-bold">{row.employee_name || '—'}{row.employee_code ? <div className="mt-1 text-[8px] font-normal">{row.employee_code}</div> : null}</td>
            <td className="break-words border border-black px-1.5 py-2">{row.position || '—'}</td>
            <td className="border border-black px-1 py-2 text-right tabular-nums">{amount(row.basic)}</td>
            <td className="border border-black px-1 py-2 text-right tabular-nums">{amount(row.deduction)}</td>
            <td className="border border-black px-1 py-2 text-right tabular-nums">{amount(row.overtime)}</td>
            <td className="border border-black px-1 py-2 text-right tabular-nums">{amount(row.rest_day_overtime)}</td>
            <td className="border border-black px-1 py-2 text-right tabular-nums">{amount(row.allowances)}</td>
            <td className="border border-black px-1 py-2 text-right tabular-nums">{amount(row.adjustments)}</td>
            <td className="border border-black px-1 py-2 text-right font-black tabular-nums">{amount(row.net)}</td>
            <td className="break-words border border-black px-1.5 py-2 font-bold">{paymentLabel(row)}
              {row.release_date ? <div className="mt-1 text-[8px] font-normal">{formatPayrollDate(row.release_date, { short: true })}</div> : null}
              {row.payment_state === 'awaiting_release' && row.scheduled_payday ? <div className="mt-1 text-[8px] font-normal">Due {formatPayrollDate(row.scheduled_payday, { short: true })}</div> : null}
            </td>
          </tr>) : <tr><td colSpan={10} className="border border-black px-3 py-8 text-center font-bold">No non-cancelled payroll records for this period.</td></tr>}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-2 gap-8 text-[10px]" style={{ breakInside: 'avoid' }}>
        <section>
          <h2 className="border-b border-black pb-2 text-[11px] font-black uppercase">Salary breakdown</h2>
          <SummaryValue label="Basic salary" value={totals.total_basic} />
          <SummaryValue label="Attendance deductions" value={totals.total_attendance_deduction} />
          <SummaryValue label="Overtime" value={totals.total_overtime} />
          <SummaryValue label="Rest day overtime" value={totals.total_rest_day_overtime} />
          <SummaryValue label="Holiday pay" value={totals.total_holiday_pay} />
          <SummaryValue label="Night shift differential" value={totals.total_night_differential} />
          <SummaryValue label="Allowances" value={totals.total_allowances} />
          <SummaryValue label="Manual adjustments (net)" value={totals.total_manual_adjustments} />
        </section>
        <section>
          <h2 className="border-b border-black pb-2 text-[11px] font-black uppercase">Payment summary</h2>
          <SummaryValue label={`Released (${totals.released_count || 0})`} value={totals.total_released} />
          <SummaryValue label={`Awaiting release (${totals.awaiting_release_count || 0})`} value={totals.total_awaiting_release} />
          <SummaryValue label={`Draft estimate (${totals.draft_count || 0})`} value={totals.total_draft} />
          <SummaryValue label="Total payroll" value={totals.total_fund_release} emphasis />
          <p className="mt-3 text-[9px] leading-4">Payment status reflects recorded releases, not the scheduled payday. Draft figures are estimates. Cancelled payroll and employees without payroll records are excluded.</p>
          <p className="mt-2 text-[9px] leading-4">Adjustments column includes holiday pay, night shift differential, and net manual changes.</p>
        </section>
      </div>
    </article>
  )
}

export default PayrollSummaryPrint
