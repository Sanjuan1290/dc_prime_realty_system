import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { validatePayrollReleaseInput } from '../services/payrollRelease.service.js'
import { buildFundReleaseReceipt } from '../services/payrollReceipt.service.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const releaseService = read('server/services/payrollRelease.service.js')
const payrollService = read('server/services/employeePayroll.service.js')
const controller = read('server/controllers/System/Employees/EmployeePayroll.controller.js')
const router = read('server/routers/System/employeePayroll.routers.js')
const serverPermissions = read('server/config/permissions.js')
const clientPermissions = read('client/src/config/permissions.js')
const recommended = read('server/config/recommendedRolePermissions.js')
const accessControl = read('server/controllers/System/accessControl.controller.js')
const salaryPage = read('client/src/pages/System/EmployeeSalary.jsx')
const salaryDetail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx')
const releaseModal = read('client/src/components/System/employeeSalaryComponents/ReleasePayrollModal.jsx')
const historyModal = read('client/src/components/System/employeeSalaryComponents/SalaryHistoryModal.jsx')
const migration = read('server/migrations/20260928_employee_salary_batch7_release_workflow.sql')

test('Batch 7 adds a granular Mark Payroll as Released permission to server, client, RBAC catalog, and recommended payroll roles', () => {
  assert.match(serverPermissions, /PAYROLL_RELEASE:\s*'employee_salary\.release'/)
  assert.match(clientPermissions, /PAYROLL_RELEASE:\s*'employee_salary\.release'/)
  assert.match(accessControl, /Mark Payroll as Released'[\s\S]*PERMISSIONS\.PAYROLL_RELEASE/)
  assert.match(recommended, /PAYROLL_FINALIZE,[\s\S]*PERMISSIONS\.PAYROLL_RELEASE,[\s\S]*PERMISSIONS\.PAYROLL_HISTORY_VIEW/)
})

test('release endpoint is authenticated and independently permission-protected', () => {
  assert.match(router, /router\.use\(authenticateUser\)/)
  assert.match(router, /post\('\/payrolls\/:employeePayrollId\/release', requirePermission\(PERMISSIONS\.PAYROLL_RELEASE\), releaseEmployeePayroll\)/)
})

test('Batch 7 migration persists per-employee release metadata and Released lifecycle status', () => {
  assert.match(migration, /ENUM\('draft','finalized','released','cancelled'\)|ENUM\('draft','finalized','corrected','released','cancelled'\)/)
  assert.match(migration, /released_date DATE NULL/)
  assert.match(migration, /released_at DATETIME NULL/)
  assert.match(migration, /released_by_user_id INT UNSIGNED NULL/)
  assert.match(migration, /release_reference VARCHAR\(180\) NULL/)
  assert.match(migration, /release_notes TEXT NULL/)
  assert.match(migration, /employee_salary\.release/)
})

test('release validation only accepts an immutable Finalized payroll and requires Released Date + actor', () => {
  const finalized = { employee_payroll_id: 77, payroll_status: 'finalized', finalized_snapshot: { net_fund_release: 6468.39 } }
  const normalized = validatePayrollReleaseInput({
    payroll: finalized,
    releasedByUserId: 9,
    releaseDate: '2026-09-22',
    releaseReference: ' CASH-001 ',
    releaseNotes: ' Released to employee. ',
  })
  assert.deepEqual(normalized, {
    releasedByUserId: 9,
    releaseDate: '2026-09-22',
    releaseReference: 'CASH-001',
    releaseNotes: 'Released to employee.',
  })
  assert.throws(() => validatePayrollReleaseInput({ payroll: { ...finalized, payroll_status: 'draft' }, releasedByUserId: 9, releaseDate: '2026-09-22' }), /Only Finalized or formally Corrected payroll/)
  assert.throws(() => validatePayrollReleaseInput({ payroll: { ...finalized, payroll_status: 'released' }, releasedByUserId: 9, releaseDate: '2026-09-22' }), /already been marked as Released/)
  assert.throws(() => validatePayrollReleaseInput({ payroll: { ...finalized, finalized_snapshot: null }, releasedByUserId: 9, releaseDate: '2026-09-22' }), /immutable finalized snapshot/)
  assert.throws(() => validatePayrollReleaseInput({ payroll: finalized, releasedByUserId: 9, releaseDate: '' }), /valid Released Date/)
})

test('release write changes lifecycle metadata only and never rewrites finalized salary snapshot values', () => {
  assert.match(releaseService, /SET payroll_status = 'released'/)
  assert.match(releaseService, /released_date = \?[\s\S]*released_at = CURRENT_TIMESTAMP[\s\S]*released_by_user_id = \?[\s\S]*release_reference = \?[\s\S]*release_notes = \?/)
  assert.match(releaseService, /WHERE employee_payroll_id = \?[\s\S]*AND payroll_status IN \('finalized','corrected'\)/)
  assert.doesNotMatch(releaseService, /finalized_snapshot_json\s*=/)
  assert.doesNotMatch(releaseService, /net_fund_release\s*=/)
})

test('controller writes Payroll Released audit log with release metadata', () => {
  assert.match(controller, /export const releaseEmployeePayroll/)
  assert.match(controller, /title: 'Payroll Released'/)
  assert.match(controller, /releaseDate: release\.releaseDate/)
  assert.match(controller, /releasedByUserId: release\.releasedByUserId/)
  assert.match(controller, /releaseReference: release\.releaseReference/)
  assert.match(controller, /releaseNotes: release\.releaseNotes/)
})

test('receipt date uses actual employee release date before finalized date and remains based on finalized snapshot', () => {
  const payroll = {
    employee_payroll_id: 1,
    payroll_status: 'released',
    released_date: '2026-09-22',
    finalized_at: '2026-09-20T10:00:00.000Z',
    finalized_snapshot: {
      period: { label: 'September 1–15, 2026', start: '2026-09-01', end: '2026-09-15', type: 'first_half' },
      employee: { name: 'ROBERT RENBY C. SAN JUAN', position: 'Junior IT & Systems Developer', department: 'IT', employment_status: 'probationary' },
      compensation: { half_month_basic: 7500, hourly_rate: 49.32 },
      attendance: { expected_regular_minutes: 4620, regular_attended_minutes: 3543, pto_minutes: 0, regular_holiday_minutes: 0, special_holiday_minutes: 0, tardiness_absence_minutes: 1255, overtime_minutes: 0, rest_day_overtime_minutes: 0, night_differential_minutes: 0 },
      deductions: { attendance_deduction: 1031.61 },
      earnings: {}, allowances: {}, adjustments: {}, net_fund_release: 6468.39,
    },
  }
  const receipt = buildFundReleaseReceipt(payroll, { today: '2026-09-28' })
  assert.equal(receipt.official, true)
  assert.equal(receipt.receipt_date, '2026-09-22')
  assert.equal(receipt.total, 6468.39)
  assert.equal(receipt.source, 'finalized_snapshot')
})

test('register and history support Released status and release metadata', () => {
  assert.match(payrollService, /\['draft', 'finalized', 'corrected', 'released', 'cancelled'\]/)
  assert.match(payrollService, /released_date[\s\S]*released_at[\s\S]*release_reference[\s\S]*release_notes/)
  assert.match(salaryPage, /<option value="released">Released<\/option>/)
  assert.match(historyModal, /Released \{formatPayrollDate\(row\.released_date \|\| row\.release_date/)
  assert.match(historyModal, /row\.released_by_name/)
  assert.match(historyModal, /row\.release_reference/)
})

test('salary UI exposes Mark as Released only from Finalized status to authorized users', () => {
  assert.match(salaryPage, /PERMISSIONS\.PAYROLL_RELEASE/)
  assert.match(salaryDetail, /canRelease && \['finalized', 'corrected'\]\.includes\(payroll\?\.payroll_status\)/)
  assert.match(salaryDetail, /Mark as Released/)
  assert.match(releaseModal, /Released Date \*/)
  assert.match(releaseModal, /Reference/)
  assert.match(releaseModal, /Notes/)
  assert.match(releaseModal, /(finalized\/corrected official|finalized) salary snapshot and receipt values remain unchanged/i)
})

test('released payroll remains official, historical, and exportable rather than becoming recalculable', () => {
  assert.match(salaryDetail, /\['finalized', 'corrected', 'released'\]/)
  assert.match(salaryDetail, /Fund Release Recorded/)
  assert.doesNotMatch(salaryDetail, /canRecalculate && payroll\?\.payroll_status === 'released'/)
  assert.match(historyModal, /Released payroll remains historical and exportable/)
})
