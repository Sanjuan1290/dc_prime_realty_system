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

const ReceiptRow = ({ label, value, unit = '', bold = false }) => (
  <div className="grid grid-cols-[215px_1fr_105px] border-b border-slate-400 last:border-b-0">
    <div className={`border-r border-slate-400 px-3 py-2 ${bold ? 'font-black' : 'font-semibold'}`}>{label}</div>
    <div className={`px-3 py-2 text-right tabular-nums ${bold ? 'font-black' : 'font-semibold'}`}>{value}</div>
    <div className="border-l border-slate-400 px-3 py-2 font-semibold">{unit}</div>
  </div>
)

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
            <div className="grid grid-cols-[225px_1fr_110px] bg-slate-200 text-[12px] font-black">
              <div className="border-r border-slate-500 px-3 py-2">PAYEE</div>
              <div className="border-r border-slate-500 px-3 py-2">Description</div>
              <div className="px-3 py-2"># of Hours</div>
            </div>

            <div className="grid grid-cols-[225px_1fr] border-t border-slate-500">
              <div className="border-r border-slate-500 px-3 py-3 text-[13px] font-black uppercase">{row.fullName}</div>
              <div className="px-3 py-3 text-center text-[13px] font-semibold">Pay Period: {range.shortLabel || range.label || '-'}</div>
            </div>

            <div className="grid grid-cols-[225px_1fr] border-t border-slate-500">
              <div className="border-r border-slate-500 px-3 py-3 text-right font-semibold">Summary:</div>
              <div>
                <ReceiptRow label="Position" value={`${row.position || '-'}${row.employmentType ? ` (${String(row.employmentType).replace('_', ' ')})` : ''}`} unit={row.department || ''} />
                <ReceiptRow label="Rate" value={number(row.hourlyRate)} unit="Per Hour" />
                <ReceiptRow label="Total Regular Hours" value={number(regularHours)} unit="Hours" />
                <ReceiptRow label="Total Regular Hours Attended" value={number(attendedHours)} unit="Hours" />
                <ReceiptRow label="Paid Time Off" value={number(paidTimeOffHours)} unit="Hours" />
                <ReceiptRow label="Total Holiday Hours (Regular)" value={number(regularHolidayHours)} unit="Hours" />
                <ReceiptRow label="Total Holiday Hours (Special Non-Working)" value={number(specialHolidayHours)} unit="Hours" />
                <ReceiptRow label="Tardiness" value={number(tardinessMinutes)} unit="Minutes" />
                <ReceiptRow label="Tardiness Deduction" value={money(row.lateDeduction)} />
                <ReceiptRow label="Undertime Deduction" value={money(row.undertimeDeduction)} />
                <ReceiptRow label="Absence Deduction" value={money(row.absenceDeduction)} />
                <ReceiptRow label="Regular Pay Total" value={money(regularTotal)} bold />
                <ReceiptRow label="Overtime" value={`${number(overtimeHours)} (${money(row.overtimePay)})`} unit="Hours / Pay" />
                <ReceiptRow label="Night Differential" value={`${number(nightHours)} (${money(row.nightDifferentialPay)})`} unit="Hours / Pay" />
                <ReceiptRow label="Rice Allowance" value={money(row.riceAllowance)} />
                <ReceiptRow label="Transportation Allowance (7th Only)" value={money(row.transportationAllowance)} />
                <ReceiptRow label="Attendance Bonus" value={money(row.attendanceBonus)} />
                <ReceiptRow label="Cash Advance Deduction" value={`-${money(row.cashAdvanceDeduction)}`} />
                <ReceiptRow label="Other Adjustments" value={money(row.otherAdjustments)} />
              </div>
            </div>

            <div className="grid grid-cols-[225px_1fr] border-t-2 border-slate-600 bg-slate-100 text-[13px] font-black">
              <div className="border-r border-slate-500 px-3 py-3 underline">TOTAL</div>
              <div className="px-3 py-3 text-right underline">{money(totalAmount)}</div>
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
