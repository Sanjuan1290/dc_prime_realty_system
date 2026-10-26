import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { explainPayrollRates } from '../../client/src/components/System/employeeSalaryComponents/payrollRateExplanation.js'

const money = (value) => Number(value).toFixed(2)

test('example from signed acknowledgment: 260 days, 8 paid hours, 1,830 minutes', () => {
  const data = explainPayrollRates({ monthly_salary_snapshot: 15000, daily_rate: 692.307692, hourly_rate_snapshot: 86.54, regular_working_minutes_snapshot: 480, tardiness_absence_minutes: 1830, attendance_deduction: 2639.47 })
  assert.equal(data.annualDays, 260)
  assert.equal(data.workHours, 8)
  assert.equal(money(data.deductionFromSavedRate), '2639.47')
  assert.equal(data.matchesRecordedDeduction, true)
  assert.equal(data.hourlyMatchesDaily, true)
})

test('older payroll actually uses 365-day divisor and 10 paid hours, not the new reference example', () => {
  const data = explainPayrollRates({ monthly_salary_snapshot: 15000, daily_rate: 493.150685, hourly_rate_snapshot: 49.32, regular_working_minutes_snapshot: 600, tardiness_absence_minutes: 660, attendance_deduction: 542.52 })
  assert.equal(data.annualDays, 365)
  assert.equal(data.workHours, 10)
  assert.equal(data.deductionFromSavedRate, 542.52)
})

test('unknown legacy factor does not claim 260 or 365 days', () => {
  const data = explainPayrollRates({ monthly_salary_snapshot: 15000, daily_rate: 700, hourly_rate_snapshot: 70, regular_working_minutes_snapshot: 600, tardiness_absence_minutes: 60, attendance_deduction: 70 })
  assert.equal(data.annualDays, null)
})

test('manual or corrected deductions do not get displayed as a matching formula', () => {
  const data = explainPayrollRates({ monthly_salary_snapshot: 15000, daily_rate: 493.150685, hourly_rate_snapshot: 49.32, regular_working_minutes_snapshot: 600, tardiness_absence_minutes: 660, attendance_deduction: 500 })
  assert.equal(data.matchesRecordedDeduction, false)
  assert.equal(data.deductionFromSavedRate, 542.52)
})

test('invalid or incomplete historical values do not fabricate a rate', () => {
  assert.equal(explainPayrollRates({ monthly_salary_snapshot: 15000, daily_rate: 0 }), null)
})

test('Salary Details shows explanation and leaves payroll engine unchanged', () => {
  const source = readFileSync(new URL('../../client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx', import.meta.url), 'utf8')
  const engine = readFileSync(new URL('../services/payrollCalculation.service.js', import.meta.url), 'utf8')
  assert.match(source, /<PayrollRateExplanation payroll=\{payroll\}/)
  assert.match(engine, /\(monthly \* 12\) \/ 365/)
})
