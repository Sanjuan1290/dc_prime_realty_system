import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { releasePayroll, validatePayrollReleaseInput } from '../services/payrollRelease.service.js'
import { buildFundReleaseReceipt } from '../services/payrollReceipt.service.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const finalizedSnapshot = {
  period: { label: 'September 1–15, 2026', start: '2026-09-01', end: '2026-09-15', type: 'first_half' },
  employee: { name: 'TEST EMPLOYEE', position: 'Junior IT & Systems Developer', department: 'Sales', employment_status: 'probationary' },
  compensation: { half_month_basic: 7500, hourly_rate: 49.32 },
  attendance: { expected_regular_minutes: 4620, regular_attended_minutes: 3543, tardiness_absence_minutes: 1255 },
  deductions: { attendance_deduction: 1031.61 },
  earnings: {}, allowances: {}, adjustments: {}, net_fund_release: 6468.39,
}

const payroll = (overrides = {}) => ({
  employee_payroll_id: 77, payroll_status: 'finalized', finalized_snapshot: finalizedSnapshot, ...overrides,
})

test('released acknowledgment uses the immutable benchmark pay amounts, actual release date and individual witness', () => {
  const receipt = buildFundReleaseReceipt(payroll({
    payroll_status: 'released', released_date: '2026-09-22', release_witness_name: 'SAMPLE WITNESS',
    witness_name: 'Older Period Witness', net_fund_release: 999999,
  }))
  assert.equal(receipt.official, true)
  assert.equal(receipt.receipt_date, '2026-09-22')
  assert.equal(receipt.witness_name, 'SAMPLE WITNESS')
  assert.equal(receipt.half_month_basic, 7500)
  assert.equal(receipt.hourly_rate, 49.32)
  assert.equal(receipt.total_regular_hours, 77)
  assert.equal(receipt.total_regular_hours_attended, 59.05)
  assert.equal(receipt.tardiness_absence_minutes, 1255)
  assert.equal(receipt.total_deduction, 1031.61)
  assert.equal(receipt.total, 6468.39)
  assert.equal(receipt.amount_in_words, 'SIX THOUSAND FOUR HUNDRED SIXTY EIGHT PESOS AND THIRTY NINE CENTAVOS ONLY')
})

test('previously saved period witness is respected and an unknown witness name is never invented', () => {
  assert.equal(buildFundReleaseReceipt(payroll({ witness_name: 'Period Witness' })).witness_name, 'Period Witness')
  assert.equal(buildFundReleaseReceipt(payroll()).witness_name, '')
  const receiptTemplate = read('client/src/components/System/employeeSalaryComponents/FundReleaseReceipt.jsx')
  assert.match(receiptTemplate, /receipt\.witness_name \|\|/)
  assert.doesNotMatch(receiptTemplate, /Authorized Representative/)
})

test('marking released writes only lifecycle and witness metadata, never payroll amounts', async () => {
  const statements = []
  const connection = { query: async (sql, params) => { statements.push({ sql, params }); return [{ affectedRows: 1 }] } }
  const value = await releasePayroll(connection, {
    payroll: payroll(), releasedByUserId: 12, releaseDate: '2026-09-22',
    releaseReference: 'PAY-001', releaseWitnessName: ' SAMPLE WITNESS ',
  })
  assert.equal(value.releaseWitnessName, 'SAMPLE WITNESS')
  assert.equal(statements.length, 1)
  assert.match(statements[0].sql, /release_witness_name = \?/)
  assert.deepEqual(statements[0].params, ['2026-09-22', 12, 'PAY-001', null, 'SAMPLE WITNESS', 77])
  assert.doesNotMatch(statements[0].sql, /SET\s+net_fund_release|finalized_snapshot_json\s*=/i)
})

test('draft and already released payroll cannot be released again', () => {
  assert.throws(() => validatePayrollReleaseInput({ payroll: payroll({ payroll_status: 'draft' }), releasedByUserId: 1, releaseDate: '2026-09-22' }), /Only Finalized/)
  assert.throws(() => validatePayrollReleaseInput({ payroll: payroll({ payroll_status: 'released' }), releasedByUserId: 1, releaseDate: '2026-09-22' }), /already been marked/)
})

test('release screen captures witness and automatically opens official receipt after successful save', () => {
  const release = read('client/src/components/System/employeeSalaryComponents/ReleasePayrollModal.jsx')
  const detail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx')
  const modal = read('client/src/components/System/employeeSalaryComponents/FundReleaseReceiptModal.jsx')
  assert.match(release, /Witness Name \(for acknowledgment receipt\)/)
  assert.match(release, /release_witness_name: witnessName\.trim\(\)/)
  assert.match(detail, /onReleased=\{\(result\) => \{ setShowReceipt\(true\)/)
  assert.match(detail, /<FundReleaseReceiptModal/)
  assert.match(modal, /openElementInPdfPrintWindow/)
  assert.match(modal, /downloadElementAsPdf/)
})

test('TiDB migration is additive, and witness is recorded in the employee payroll audit metadata', () => {
  const migration = read('server/migrations/20261012_payroll_release_witness.sql')
  const controller = read('server/controllers/System/Employees/EmployeePayroll.controller.js')
  const service = read('server/services/employeePayroll.service.js')
  assert.match(migration, /ADD COLUMN IF NOT EXISTS `release_witness_name`/)
  assert.doesNotMatch(migration, /TRUNCATE|DELETE FROM|DROP TABLE|UPDATE employee_payrolls/i)
  assert.match(controller, /releaseWitnessName: req\.body\?\.release_witness_name/)
  assert.match(controller, /releaseWitnessName: release\.releaseWitnessName/)
  assert.match(service, /p\.release_witness_name/)
})

