import { formatPayrollDate } from './payrollFormatters'

const amount = (value) => Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberValue = (value) => Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const durationLabel = (minutes) => {
  const total = Math.round(Number(minutes || 0))
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

const FundReleaseReceipt = ({ receipt }) => {
  if (!receipt) return null

  const position = receipt.position || '—'
  const status = ({ regular: 'Regular', probationary: 'Probationary', contractual: 'Contractual', part_time: 'Part Time', intern: 'Intern' }[receipt.employment_status] || receipt.employment_status || '—')
  const rows = [
    { key: 'position', label: 'Position', custom: true, unit: receipt.department || '' },
    { key: 'half', label: 'Half-month Basic', value: amount(receipt.half_month_basic) },
    { key: 'rate', label: 'Rate', value: amount(receipt.hourly_rate), unit: 'Per Hour' },
    ...(receipt.scheduled_attendance_minutes == null ? [] : [
      { key: 'attendance-hours', label: 'Scheduled Attendance Hours', value: durationLabel(receipt.scheduled_attendance_minutes) },
      { key: 'worked-hours', label: 'Actual Hours Worked (after break)', value: durationLabel(receipt.actual_worked_minutes) },
    ]),
    { key: 'regular-hours', label: receipt.compressed_shift ? 'Scheduled Regular Hours (10h shift)' : 'Standard Regular Hours (8h/day payroll basis)', value: receipt.compressed_shift ? durationLabel(receipt.total_regular_hours * 60) : numberValue(receipt.total_regular_hours), unit: receipt.compressed_shift ? '' : 'Hours' },
    { key: 'regular-attended', label: receipt.compressed_shift ? 'Regular Hours Attended (scheduled shift)' : 'Total Regular Hours Attended (credited at 8h/day)', value: receipt.compressed_shift ? durationLabel(receipt.total_regular_hours_attended * 60) : numberValue(receipt.total_regular_hours_attended), unit: receipt.compressed_shift ? '' : 'Hours' },
    { key: 'pto', label: 'Paid Time Off', value: numberValue(receipt.paid_time_off_hours), unit: 'Hour' },
    { key: 'regular-holiday', label: 'Total Holiday Hours (Regular)', value: numberValue(receipt.regular_holiday_hours) },
    { key: 'special-holiday', label: 'Total Holiday Hours (Special Non-Working)', value: numberValue(receipt.special_holiday_hours) },
    { key: 'tardiness', label: 'Tardiness/Absences', value: Number(receipt.tardiness_absence_minutes || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 }), unit: 'Minutes' },
    { key: 'deduction', label: 'Total Deduction', value: amount(receipt.total_deduction), emphasized: true, italic: true },
    { key: 'subtotal', label: 'Total', value: amount(receipt.subtotal_after_attendance), emphasized: true, italic: true },
    { key: 'overtime', label: 'Overtime', value: numberValue(receipt.overtime_hours), unit: 'Hour' },
    { key: 'rest-day-overtime', label: 'Rest Day Overtime', value: numberValue(receipt.rest_day_overtime_hours) },
    { key: 'night-differential', label: 'Night Differential', value: numberValue(receipt.night_differential_hours) },
    { key: 'rice', label: 'Rice Allowance', value: amount(receipt.rice_allowance) },
    { key: 'transportation', label: 'Transportation Allowance', value: amount(receipt.transportation_allowance) },
    { key: 'attendance-bonus', label: 'Attendance Bonus', value: amount(receipt.attendance_bonus) },
  ]

  return (
    <article style={{ fontFamily: 'Arial, Helvetica, sans-serif' }} className="fund-release-receipt print-export-page mx-auto min-h-[1080px] w-[794px] bg-white px-[40px] py-[36px] text-black shadow-xl print:shadow-none">
      {/* Included in the cloned print window as well as the in-app preview. */}
      <style>{`
        @media print {
          .fund-release-receipt.print-export-page {
            width: 210mm !important;
            max-width: 210mm !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 10mm 12mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            break-after: auto !important;
            page-break-after: auto !important;
          }
          .fund-release-receipt tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .fund-release-receipt__signatures,
          .fund-release-receipt__amount,
          .fund-release-receipt__note {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
      {!receipt.official ? (
        <div className="mb-5 border-2 border-dashed border-black px-4 py-2 text-center text-[12px] font-black uppercase tracking-[0.18em]">
          Preview Only — Draft Payroll — Not Official
        </div>
      ) : null}

      <p className="mb-5 text-[14px] font-medium">{formatPayrollDate(receipt.receipt_date)}</p>
      <h1 className="mb-2 text-[17px] font-black">Acknowledgement Receipt for Fund Release:</h1>

      <table className="w-full table-fixed border-collapse border border-black">
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[31%]" />
          <col className="w-[27%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#d9d9d9]">
            <th className="border border-black px-2 py-1.5 text-left text-[12px] font-black">PAYEE</th>
            <th className="border border-black px-2 py-1.5 text-left text-[12px] font-black">Description</th>
            <th colSpan={2} className="border border-black px-2 py-1.5 text-left text-[12px] font-black"># of Hours</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td rowSpan={rows.length + 1} className="border border-black px-2 py-2 align-top text-[12px] font-black uppercase leading-tight">
              <div>{receipt.employee_name || '—'}</div>
              <div className="mt-10 text-right text-[11px] font-medium normal-case">Summary:</div>
            </td>
            <td colSpan={3} className="border border-black px-3 py-2 text-center text-[13px] font-medium">
              Pay Period: {formatPayrollDate(receipt.pay_period?.start)} - {formatPayrollDate(receipt.pay_period?.end)}
            </td>
          </tr>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className={`border border-black px-2.5 py-1 align-middle text-[12px] leading-tight ${row.emphasized ? 'font-bold' : 'font-medium'} ${row.italic ? 'italic' : ''}`}>{row.label}</td>
              <td className={`border border-black px-2.5 py-1 align-middle text-[12px] leading-tight ${row.custom ? 'text-left' : 'text-right'} ${row.emphasized ? 'font-bold' : 'font-medium'}`}>
                {row.custom ? <><div>{position}</div><div>({status})</div></> : row.value}
              </td>
              <td className="border border-black px-2.5 py-1.5 align-middle text-[12px] font-medium leading-tight">{row.unit || ''}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-2 py-2 text-[13px] font-black underline">TOTAL</td>
            <td className="border border-black px-2 py-2" />
            <td className="border border-black px-2 py-2 text-right text-[14px] font-black underline">{amount(receipt.total)}</td>
            <td className="border border-black px-2 py-2" />
          </tr>
        </tbody>
      </table>

      {receipt.unclassified_extra_minutes > 0 ? (
        <p className="fund-release-receipt__note mt-3 text-[11px] font-semibold leading-snug">
          Attendance includes {durationLabel(receipt.unclassified_extra_minutes)} outside the current regular-pay and premium-hour categories.
          Review the applicable pay arrangement before finalizing. These hours are not automatically added as overtime.
        </p>
      ) : null}
      <p className="fund-release-receipt__amount mt-4 text-[13px] font-medium leading-snug">
        <span className="mr-1">Total Amount:</span>
        <span className="font-bold uppercase">{receipt.amount_in_words}</span>
        <span className="ml-1 font-bold">(PHP {amount(receipt.total)})</span>
      </p>

      <div className="fund-release-receipt__signatures mt-6 grid grid-cols-2 gap-10 text-[13px]">
        <section>
          <p className="mb-9 font-medium">Received by:</p>
          <div className="pt-1">
            <p className="font-black uppercase">{receipt.employee_name || '—'}</p>
            <p className="mt-1 font-medium">Signature and Date</p>
          </div>
        </section>
        <section>
          <p className="mb-9 font-medium">Witness:</p>
          <div className="pt-1">
            <p className="font-black uppercase">{receipt.witness_name || '\u00a0'}</p>
            <p className="mt-1 font-medium">Signature and Date</p>
          </div>
        </section>
      </div>
    </article>
  )
}

export default FundReleaseReceipt
