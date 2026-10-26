const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

// The employee's saved daily rate is the source of truth. Avoid attributing a
// historical payroll to a new company divisor that was not used for that record.
const findAnnualDayFactor = (monthly, daily) => {
  if (!(monthly > 0 && daily > 0)) return null
  return [365, 313, 261, 260, 258].find((days) => Math.abs((monthly * 12) / days - daily) < 0.001) ?? null
}

export const explainPayrollRates = (payroll = {}) => {
  const monthly = Number(payroll.monthly_salary_snapshot)
  const daily = Number(payroll.daily_rate)
  const hourly = Number(payroll.hourly_rate_snapshot)
  const paidMinutes = Number(payroll.regular_working_minutes_snapshot)
  const missedMinutes = Number(payroll.tardiness_absence_minutes)
  const recordedDeduction = Number(payroll.attendance_deduction)

  if (![monthly, daily, hourly, paidMinutes, missedMinutes, recordedDeduction].every(Number.isFinite) ||
      monthly < 0 || daily <= 0 || hourly <= 0 || paidMinutes <= 0 || missedMinutes < 0 || recordedDeduction < 0) {
    return null
  }

  const annualDays = findAnnualDayFactor(monthly, daily)
  const workHours = paidMinutes / 60
  const deductionFromSavedRate = roundMoney((missedMinutes / 60) * hourly)
  const matchesRecordedDeduction = Math.abs(deductionFromSavedRate - recordedDeduction) <= 0.01
  const hourlyMatchesDaily = Math.abs(roundMoney(daily / workHours) - hourly) <= 0.01

  return {
    monthly,
    daily,
    hourly,
    annualDays,
    workHours,
    missedMinutes,
    recordedDeduction,
    deductionFromSavedRate,
    matchesRecordedDeduction,
    hourlyMatchesDaily,
  }
}
