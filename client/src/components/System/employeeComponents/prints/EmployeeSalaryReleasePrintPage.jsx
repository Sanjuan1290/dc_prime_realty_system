import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import PrintPageShell from '../../../Lot_Projects/ListingProfileComponents/Printouts/PrintPageShell'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch } from '../../../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const number = (value, digits = 2) => new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return '-'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

const SMALL = [
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
]
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

const wholeNumberToWords = (value) => {
  const amount = Math.max(Math.trunc(Number(value || 0)), 0)
  if (amount < 20) return SMALL[amount]
  if (amount < 100) return `${TENS[Math.trunc(amount / 10)]}${amount % 10 ? ` ${SMALL[amount % 10]}` : ''}`
  if (amount < 1000) return `${SMALL[Math.trunc(amount / 100)]} HUNDRED${amount % 100 ? ` ${wholeNumberToWords(amount % 100)}` : ''}`

  for (const [unit, size] of [['BILLION', 1_000_000_000], ['MILLION', 1_000_000], ['THOUSAND', 1_000]]) {
    if (amount >= size) {
      const whole = Math.trunc(amount / size)
      const remainder = amount % size
      return `${wholeNumberToWords(whole)} ${unit}${remainder ? ` ${wholeNumberToWords(remainder)}` : ''}`
    }
  }

  return SMALL[0]
}

const amountToWords = (value) => {
  const rounded = Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
  const pesos = Math.trunc(rounded)
  const centavos = Math.round((rounded - pesos) * 100)
  return `${wholeNumberToWords(pesos)} PESOS${centavos ? ` AND ${wholeNumberToWords(centavos)} CENTAVOS` : ''} ONLY`
}

// A receipt row follows the printed form's Description, Hours, Unit, and Amount columns.
// Detail rows, such as Position, can span all value columns without forcing text into the hours column.
const ReceiptRow = ({ label, hours = '', unit = '', amount = '', detail = '', bold = false }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_105px_85px_125px] border-b border-slate-400 last:border-b-0">
    <div className={`border-r border-slate-400 px-3 py-2 ${bold ? 'font-black' : 'font-semibold'}`}>{label}</div>

    {detail ? (
      <div className={`col-span-3 px-3 py-2 ${bold ? 'font-black' : 'font-semibold'}`}>{detail}</div>
    ) : (
      <>
        <div className={`border-r border-slate-400 px-3 py-2 text-right tabular-nums ${bold ? 'font-black' : 'font-semibold'}`}>{hours}</div>
        <div className={`border-r border-slate-400 px-3 py-2 ${bold ? 'font-black' : 'font-semibold'}`}>{unit}</div>
        <div className={`px-3 py-2 text-right tabular-nums ${bold ? 'font-black' : 'font-semibold'}`}>{amount}</div>
      </>
    )}
  </div>
)

// Optional monetary rows are removed when their amount rounds to zero.
// This keeps the printed receipt close to the supplied salary-release form without changing payroll totals.
const hasNonZeroAmount = (value) => Math.abs(Number(value || 0)) >= 0.005

const EmployeeSalaryReleasePrintPage = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const employeeId = params.get('employeeId') || ''
  const releaseDate = params.get('releaseDate') || ''

  const query = useQuery({
    queryKey: ['employee-payroll-release-print', employeeId, releaseDate],
    queryFn: () => useFetch(`/attendance/payroll-release?employeeId=${employeeId}&releaseDate=${releaseDate}`),
    enabled: Boolean(employeeId && releaseDate),
  })

  const row = query.data?.data || null
  const range = query.data?.range || {}
  const period = query.data?.period || {}

  const regularHours = Number(row?.scheduledRegularSeconds || 0) / 3600
  const attendedHours = Number(row?.regularAttendedSeconds || 0) / 3600
  const paidTimeOffHours = Number(row?.paidTimeOffSeconds || 0) / 3600
  const regularHolidayHours = Number(row?.regularHolidaySeconds || 0) / 3600
  const specialHolidayHours = Number(row?.specialHolidaySeconds || 0) / 3600
  const overtimeHours = Number(row?.overtimeSeconds || 0) / 3600
  const nightHours = Number(row?.nightDifferentialSeconds || 0) / 3600
  const tardinessMinutes = Number(row?.lateSeconds || 0) / 60
  const regularTotal = Number(row?.regularPayAfterAttendance || 0)
  const totalAmount = Number(row?.netPay || 0)

  return (
    <PrintPageShell title="Employee Salary Release">
      {query.isLoading ? <div className="mx-auto max-w-3xl"><StatusAlert type="loading" message="Loading salary release receipt..." /></div> : null}
      {query.isError ? <div className="mx-auto max-w-3xl"><StatusAlert type="error" message={query.error?.message || 'Failed to load salary release receipt.'} /></div> : null}

      {row ? (
        <section className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white px-[16mm] py-[14mm] text-[11px] text-slate-950 shadow-xl print:shadow-none">
          <p className="mb-5 text-[12px] font-semibold">{formatDate(range.releaseDate || releaseDate)}</p>
          <h1 className="mb-2 text-[17px] font-black">Acknowledgement Receipt for Fund Release:</h1>

          <div className="border border-slate-500">
            <div className="grid grid-cols-[225px_minmax(0,1fr)_105px_85px_125px] bg-slate-200 text-[12px] font-black">
              <div className="border-r border-slate-500 px-3 py-2">PAYEE</div>
              <div className="border-r border-slate-500 px-3 py-2">Description</div>
              <div className="border-r border-slate-500 px-3 py-2 text-center"># of Hours</div>
              <div className="border-r border-slate-500 px-3 py-2">Unit</div>
              <div className="px-3 py-2 text-right">Amount</div>
            </div>

            <div className="grid grid-cols-[225px_1fr] border-t border-slate-500">
              <div className="border-r border-slate-500 px-3 py-3 text-[13px] font-black uppercase">{row.fullName}</div>
              <div className="px-3 py-3 text-center text-[13px] font-semibold">Pay Period: {range.shortLabel || range.label || '-'}</div>
            </div>

            <div className="grid grid-cols-[225px_1fr] border-t border-slate-500">
              <div className="border-r border-slate-500 px-3 py-3 text-right font-semibold">Summary:</div>
              <div>
                <ReceiptRow
                  label="Position"
                  detail={`${row.position || '-'}${row.employmentType ? ` (${String(row.employmentType).replace('_', ' ')})` : ''}${row.department ? ` · ${row.department}` : ''}`}
                />
                <ReceiptRow label="Rate" hours={number(row.hourlyRate)} unit="Per Hour" />
                <ReceiptRow label="Total Regular Hours" hours={number(regularHours)} unit="Hours" />
                <ReceiptRow label="Total Regular Hours Attended" hours={number(attendedHours)} unit="Hours" />
                <ReceiptRow label="Paid Time Off" hours={number(paidTimeOffHours)} unit="Hours" />
                <ReceiptRow label="Total Holiday Hours (Regular)" hours={number(regularHolidayHours)} unit="Hours" />
                <ReceiptRow label="Total Holiday Hours (Special Non-Working)" hours={number(specialHolidayHours)} unit="Hours" />
                <ReceiptRow label="Tardiness" hours={number(tardinessMinutes)} unit="Minutes" />

                {hasNonZeroAmount(row.lateDeduction) ? (
                  <ReceiptRow label="Tardiness Deduction" amount={money(row.lateDeduction)} />
                ) : null}
                {hasNonZeroAmount(row.undertimeDeduction) ? (
                  <ReceiptRow label="Undertime Deduction" amount={money(row.undertimeDeduction)} />
                ) : null}
                {hasNonZeroAmount(row.absenceDeduction) ? (
                  <ReceiptRow label="Absence Deduction" amount={money(row.absenceDeduction)} />
                ) : null}

                <ReceiptRow label="Regular Pay Total" amount={money(regularTotal)} bold />
                <ReceiptRow label="Overtime" hours={number(overtimeHours)} unit="Hour" amount={money(row.overtimePay)} />
                <ReceiptRow label="Night Differential" hours={number(nightHours)} unit="Hour" amount={money(row.nightDifferentialPay)} />
                <ReceiptRow label="Rice Allowance" amount={money(row.riceAllowance)} />

                {hasNonZeroAmount(row.transportationAllowance) ? (
                  <ReceiptRow label="Transportation Allowance (7th Only)" amount={money(row.transportationAllowance)} />
                ) : null}
                {hasNonZeroAmount(row.attendanceBonus) ? (
                  <ReceiptRow label="Attendance Bonus" amount={money(row.attendanceBonus)} />
                ) : null}
                {hasNonZeroAmount(row.cashAdvanceDeduction) ? (
                  <ReceiptRow label="Cash Advance Deduction" amount={`-${money(row.cashAdvanceDeduction)}`} />
                ) : null}
                {hasNonZeroAmount(row.otherAdjustments) ? (
                  <ReceiptRow label="Other Adjustments" amount={money(row.otherAdjustments)} />
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-[225px_minmax(0,1fr)_105px_85px_125px] border-t-2 border-slate-600 bg-slate-100 text-[13px] font-black">
              <div className="border-r border-slate-500 px-3 py-3 underline">TOTAL</div>
              <div className="col-span-3 border-r border-slate-500 px-3 py-3" />
              <div className="px-3 py-3 text-right tabular-nums underline">{money(totalAmount)}</div>
            </div>
          </div>

          <p className="mt-6 text-[12px] font-semibold leading-relaxed">
            Total Amount: {amountToWords(totalAmount)} ({money(totalAmount)})
          </p>

          {row.attendanceBonusNote ? (
            <p className="mt-2 text-[10px] font-semibold text-slate-600">Attendance Bonus: {row.attendanceBonusNote}</p>
          ) : null}
          {period.release_notes ? <p className="mt-2 text-[10px] font-semibold text-slate-600">Notes: {period.release_notes}</p> : null}

          <div className="mt-10 grid grid-cols-2 gap-16 text-[11px]">
            <div>
              <p className="mb-8 font-semibold">Received by:</p>
              <div className="border-b border-slate-800 pb-1 text-[12px] font-black uppercase">{row.fullName}</div>
              <p className="mt-1 font-semibold">Signature and Date</p>
            </div>
            <div>
              <p className="mb-8 font-semibold">Witness:</p>
              <div className="border-b border-slate-800 pb-1 text-[12px] font-black uppercase">{period.witness_name || ' '}</div>
              <p className="mt-1 font-semibold">Signature and Date</p>
            </div>
          </div>

          <div className="mt-8 border-t border-dashed border-slate-300 pt-3 text-[9px] font-semibold text-slate-500">
            <p>Employee Code: {row.employeeCode || '-'} · Release: {range.releaseLabel || formatDate(releaseDate)} · Status: {query.data?.isFinalized ? 'Finalized' : 'Preview'}</p>
            <p className="mt-1">Daily rate is based on {row.monthWorkDays || 0} scheduled work day(s) in {range.salaryMonthLabel || 'the salary month'}.</p>
          </div>
        </section>
      ) : null}
    </PrintPageShell>
  )
}

export default EmployeeSalaryReleasePrintPage


