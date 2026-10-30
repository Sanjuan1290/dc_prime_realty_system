import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculatePayrollRates, calculateDraftPayrollMoney, PAYROLL_ANNUAL_WORKDAYS, PAYROLL_PAID_WORK_MINUTES } from '../services/payrollCalculation.service.js'
import { calculateAttendancePayrollRow, summarizeAttendancePayrollRows } from '../services/payrollAttendance.service.js'
import { explainPayrollRates } from '../../../CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/payrollRateExplanation.js'

test('D&C signed salary receipt: 260-day daily rate, 8-hour rate, and 1,830 minutes deducted', () => {
  assert.equal(PAYROLL_ANNUAL_WORKDAYS, 260)
  assert.equal(PAYROLL_PAID_WORK_MINUTES, 480)
  const result = calculateDraftPayrollMoney({ monthlyBasicSalary: 15000, regularWorkingMinutes: 480, tardinessAbsenceMinutes: 1830, periodType: 'first_half' })
  assert.equal(result.dailyRate, 692.307692)
  assert.equal(result.hourlyRate, 86.54)
  assert.equal(result.minuteRate, 1.442333)
  assert.equal(result.attendanceDeduction, 2639.47)
  assert.equal(result.netFundRelease, 4860.53)
})

test('a previous 10-hour attendance setting cannot change the newly approved 8-hour payroll rate', () => {
  const rates = calculatePayrollRates({ monthlyBasicSalary: 15000, regularWorkingMinutes: 600 })
  assert.equal(rates.regularHoursPerDay, 8)
  assert.equal(rates.hourlyRate, 86.54)
})

test('legacy 8-hour attendance remains supported without changing the hourly rate calculation', () => {
  const schedule = { scheduledTimeIn: '09:00:00', scheduledTimeOut: '20:00:00', breakStart: '12:00:00', breakMinutes: 60, regularWorkingMinutes: 480, lateAfter: '09:00:00' }
  const rows = [
    calculateAttendancePayrollRow({ date: '2026-10-01', attendance: { actual_time_in: '09:00:00', actual_time_out: '20:00:00' }, restDays: [], daySetting: { day_type: 'regular' }, schedule }),
    calculateAttendancePayrollRow({ date: '2026-10-02', attendance: null, restDays: [], daySetting: { day_type: 'regular' }, schedule }),
  ]
  const summary = summarizeAttendancePayrollRows({ rows, regularWorkingMinutes: schedule.regularWorkingMinutes })
  assert.equal(summary.expectedRegularMinutes, 960)
  assert.equal(summary.regularAttendedMinutes, 480)
  assert.equal(summary.absenceMinutes, 480)
  assert.equal(summary.tardinessAbsenceMinutes, 480)
})

test('new drafts use the 10-hour attendance clock and 8-hour salary rate divisor', () => {
  const payroll = readFileSync(new URL('../services/employeePayroll.service.js', import.meta.url), 'utf8')
  const attendance = readFileSync(new URL('../services/payrollAttendance.service.js', import.meta.url), 'utf8')
  assert.doesNotMatch(payroll, /paidWorkMinutesOverride: PAYROLL_PAID_WORK_MINUTES/)
  assert.match(payroll, /employee-salary-260days-compressed-shift-v3/)
  assert.match(attendance, /paidWorkMinutesOverride \?\? runtime\.regularWorkingMinutes/)
  assert.match(attendance, /regularWorkingMinutes: schedule\.regularWorkingMinutes/)
})

test('previous released payroll values remain visible exactly as saved', () => {
  const old = explainPayrollRates({ monthly_salary_snapshot: 15000, daily_rate: 493.150685, hourly_rate_snapshot: 49.32, regular_working_minutes_snapshot: 600, tardiness_absence_minutes: 660, attendance_deduction: 542.52 })
  assert.equal(old.annualDays, 365)
  assert.equal(old.workHours, 10)
  assert.equal(old.recordedDeduction, 542.52)
  const recent = explainPayrollRates({ monthly_salary_snapshot: 15000, daily_rate: 692.307692, hourly_rate_snapshot: 86.54, regular_working_minutes_snapshot: 480, tardiness_absence_minutes: 1830, attendance_deduction: 2639.47 })
  assert.equal(recent.annualDays, 260)
  assert.equal(recent.workHours, 8)
})


