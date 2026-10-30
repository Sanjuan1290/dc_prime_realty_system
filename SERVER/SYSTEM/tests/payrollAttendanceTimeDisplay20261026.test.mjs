import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatPayrollDuration } from '../../../CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/payrollTimeFormat.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const component = fs.readFileSync(path.resolve(here, '../../../CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx'), 'utf8')

test('time formatter displays stored minutes as hours and minutes', () => {
  for (const [minutes, expected] of [
    [0, '0h 00m'], [600, '10h 00m'], [590, '9h 50m'],
    [585, '9h 45m'], [580, '9h 40m'], [660, '11h 00m'],
    [null, '0h 00m'], ['49', '0h 49m'], [61, '1h 01m'],
  ]) assert.equal(formatPayrollDuration(minutes), expected)
})

test('time formatter does not silently present invalid recorded minutes as valid attendance', () => {
  assert.equal(formatPayrollDuration('invalid'), '—')
  assert.equal(formatPayrollDuration(-10), '—')
  assert.equal(formatPayrollDuration(Infinity), '—')
})

test('daily attendance breakdown uses minute formatter for every duration column', () => {
  for (const field of [
    'regular_attended_minutes', 'overtime_minutes', 'rest_day_overtime_minutes',
    'regular_holiday_minutes', 'special_holiday_minutes',
  ]) {
    assert.match(component, new RegExp(`formatPayrollDuration\\(row\\.${field}\\)`))
  }
  assert.doesNotMatch(component, /decimalHours\(row\./)
})

test('salary attendance summary uses the same formatter for all hour-based fields', () => {
  for (const field of [
    'expected_regular_minutes', 'regular_attended_minutes', 'pto_minutes',
    'regular_holiday_minutes', 'special_holiday_minutes', 'overtime_minutes',
    'rest_day_overtime_minutes', 'night_differential_minutes',
  ]) {
    assert.match(component, new RegExp(`formatPayrollDuration\\(payroll\\.${field}\\)`))
  }
  assert.doesNotMatch(component, /decimalHours\(payroll\./)
})

test('late minutes retain their original minute measure and financial fields remain untouched', () => {
  assert.match(component, /Number\(row\.late_minutes \|\| 0\)\.toLocaleString\('en-PH'\)/)
  assert.match(component, /tardiness_absence_minutes/)
  assert.match(component, /<MoneyRow/)
})

