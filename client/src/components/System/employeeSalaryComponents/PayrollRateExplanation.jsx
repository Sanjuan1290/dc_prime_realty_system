import { FiInfo } from 'react-icons/fi'
import { explainPayrollRates } from './payrollRateExplanation'
import { money } from './payrollFormatters'

const formatNumber = (value) => Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })

const PayrollRateExplanation = ({ payroll }) => {
  const details = explainPayrollRates(payroll)
  if (!details) return null

  return <section aria-label="How pay rates and deductions are calculated" className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5">
    <div className="flex items-start gap-2 text-blue-900">
      <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>
        <h3 className="text-sm font-black">How your pay and deductions were calculated</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">These numbers come from this pay period. Viewing them does not change the salary.</p>
      </div>
    </div>

    <div className="mt-3 grid gap-2 lg:grid-cols-3">
      <div className="rounded-xl border border-blue-100 bg-white p-3">
        <p className="text-xs font-black text-slate-700">Daily Rate</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{details.annualDays ? <>{money(details.monthly)} × 12 months ÷ {details.annualDays} days</> : <>Saved daily rate for this payroll</>}</p>
        <p className="mt-2 text-sm font-black text-slate-950">= {money(details.daily)}</p>
      </div>
      <div className="rounded-xl border border-blue-100 bg-white p-3">
        <p className="text-xs font-black text-slate-700">Hourly Rate</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{details.hourlyMatchesDaily ? <>{money(details.daily)} ÷ {formatNumber(details.workHours)} paid hours</> : <>Saved hourly rate for this payroll</>}</p>
        <p className="mt-2 text-sm font-black text-slate-950">= {money(details.hourly)} per hour</p>
      </div>
      <div className="rounded-xl border border-blue-100 bg-white p-3">
        <p className="text-xs font-black text-slate-700">Late / Absent Deduction</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{formatNumber(details.missedMinutes)} minutes ÷ 60 × {money(details.hourly)}</p>
        <p className="mt-2 text-sm font-black text-slate-950">= {money(details.recordedDeduction)}</p>
      </div>
    </div>
    {!details.matchesRecordedDeduction ? <p role="note" className="mt-3 text-xs font-semibold leading-5 text-amber-900">The saved deduction differs from this simple estimate ({money(details.deductionFromSavedRate)}). Refer to this payroll's approved deduction details.</p> : null}
  </section>
}

export default PayrollRateExplanation
