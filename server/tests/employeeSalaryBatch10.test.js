import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPayrollSummaryFromRows } from '../services/payrollSummary.shared.js'
import { amountToPhilippineWords, buildFundReleaseReceipt } from '../services/payrollReceipt.service.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const router = read('server/routers/System/employeePayroll.routers.js')
const controller = read('server/controllers/System/Employees/EmployeePayroll.controller.js')
const serverPermissions = read('server/config/permissions.js')
const clientPermissions = read('client/src/config/permissions.js')
const recommended = read('server/config/recommendedRolePermissions.js')
const accessControl = read('server/controllers/System/accessControl.controller.js')
const salaryPage = read('client/src/pages/System/EmployeeSalary.jsx')
const exportModal = read('client/src/components/System/employeeSalaryComponents/PayrollSummaryExportModal.jsx')
const summaryPrint = read('client/src/components/System/employeeSalaryComponents/PayrollSummaryPrint.jsx')
const exportUtility = read('client/src/utils/payrollSummaryExport.js')
const migration = read('server/migrations/20260928_employee_salary_batch10_summary_export.sql')

const period = {
  periodStart: '2026-09-01',
  periodEnd: '2026-09-15',
  periodType: 'first_half',
  periodLabel: 'September 1 - September 15, 2026',
}

const payrollRow = (overrides = {}) => ({
  employee_payroll_id: 1,
  employee_id: 1,
  employee_code: 'IT-001',
  employee_name_snapshot: 'ROBERT RENBY C. SAN JUAN',
  position_snapshot: 'Junior IT & Systems Developer',
  payroll_status: 'finalized',
  half_month_basic: 7500,
  attendance_deduction: 1031.61,
  overtime_pay: 0,
  rest_day_overtime_pay: 0,
  regular_holiday_pay: 0,
  special_holiday_pay: 0,
  night_differential_pay: 0,
  rice_allowance: 0,
  transportation_allowance: 0,
  attendance_bonus: 0,
  manual_additions_total: 0,
  manual_deductions_total: 0,
  net_fund_release: 6468.39,
  ...overrides,
})

test('Batch 10 adds dedicated Export Payroll Summary permission to RBAC and Admin + Accounting defaults', () => {
  assert.match(serverPermissions, /PAYROLL_SUMMARY_EXPORT:\s*'employee_salary\.summary\.export'/)
  assert.match(clientPermissions, /PAYROLL_SUMMARY_EXPORT:\s*'employee_salary\.summary\.export'/)
  assert.match(accessControl, /Export Payroll Summary'[\s\S]*PERMISSIONS\.PAYROLL_SUMMARY_EXPORT/)
  assert.match(recommended, /PERMISSIONS\.PAYROLL_RECEIPT_EXPORT, PERMISSIONS\.PAYROLL_SETTINGS_MANAGE, PERMISSIONS\.PAYROLL_SUMMARY_EXPORT/)
  assert.match(migration, /employee_salary\.summary\.export/)
})

test('whole-period summary endpoint is server-side permission protected', () => {
  assert.match(router, /get\('\/summary-export', requirePermission\(PERMISSIONS\.PAYROLL_SUMMARY_EXPORT\), getPayrollSummaryExportData\)/)
  assert.match(controller, /getPayrollPeriodSummary/)
  assert.match(controller, /month: req\.query\.month/)
  assert.match(controller, /periodType: req\.query\.period_type/)
})

test('summary rows follow the master-plan columns and reconcile to stored Net Fund Release', () => {
  const summary = buildPayrollSummaryFromRows({ rows: [payrollRow()], period })
  assert.equal(summary.rows.length, 1)
  assert.equal(summary.rows[0].basic, 7500)
  assert.equal(summary.rows[0].deduction, 1031.61)
  assert.equal(summary.rows[0].adjustments, 0)
  assert.equal(summary.rows[0].net, 6468.39)
  assert.equal(summary.rows[0].reconciliation_difference, 0)
  assert.equal(summary.totals.total_fund_release, 6468.39)
  assert.equal(summary.official, true)
})

test('summary keeps holiday/night/manual values auditable while fitting the planned Adjustments column', () => {
  const summary = buildPayrollSummaryFromRows({ rows: [payrollRow({
    attendance_deduction: 100,
    overtime_pay: 50,
    rest_day_overtime_pay: 60,
    regular_holiday_pay: 70,
    special_holiday_pay: 30,
    night_differential_pay: 20,
    rice_allowance: 100,
    transportation_allowance: 100,
    manual_additions_total: 40,
    manual_deductions_total: 10,
    net_fund_release: 7900,
  })], period })
  const row = summary.rows[0]
  assert.equal(row.holiday_pay, 100)
  assert.equal(row.night_differential, 20)
  assert.equal(row.manual_adjustments, 30)
  assert.equal(row.adjustments, 150)
  assert.equal(row.net, 7900)
  assert.equal(summary.totals.total_holiday_pay, 100)
  assert.equal(summary.totals.total_manual_adjustments, 30)
})

test('cancelled payroll is excluded and Draft presence marks the period summary not official', () => {
  const summary = buildPayrollSummaryFromRows({ rows: [
    payrollRow({ employee_payroll_id: 1, payroll_status: 'draft' }),
    payrollRow({ employee_payroll_id: 2, payroll_status: 'cancelled', net_fund_release: 99999 }),
  ], period })
  assert.equal(summary.rows.length, 1)
  assert.equal(summary.totals.employee_count, 1)
  assert.equal(summary.totals.total_fund_release, 6468.39)
  assert.equal(summary.official, false)
  assert.match(summary.warnings[0], /Draft payroll/)
})

test('CSV, Excel, and PDF use the planned payroll-summary columns and totals', () => {
  for (const label of ['Employee', 'Position', 'Basic', 'Deduction', 'OT', 'Rest Day OT', 'Allowances', 'Adjustments', 'Net']) {
    assert.match(exportUtility, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(summaryPrint, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(exportUtility, /Total Holiday Pay/)
  assert.match(exportUtility, /TOTAL FUND RELEASE/)
  assert.match(exportUtility, /XLSX\.writeFile/)
  assert.match(exportUtility, /text\/csv/)
  assert.match(exportModal, />CSV</)
  assert.match(exportModal, />Excel</)
  assert.match(exportModal, /Export PDF/)
  assert.match(exportModal, /downloadElementAsPdf/)
})

test('PDF summary is a black-and-white A4 landscape accounting table and whole-period export ignores page filters', () => {
  assert.match(exportModal, /@page \{ size: A4 landscape/)
  assert.match(summaryPrint, /border border-black/)
  assert.match(summaryPrint, /bg-\[#d9d9d9\]/)
  assert.match(exportModal, /ignores the page's Department, Status, and Search filters/)
  assert.match(salaryPage, /<FiDownload \/>Export Summary/)
  assert.match(salaryPage, /PERMISSIONS\.PAYROLL_SUMMARY_EXPORT/)
})

test('final QA still reproduces the supplied Fund Release receipt benchmark exactly', () => {
  assert.equal(amountToPhilippineWords(6468.39), 'SIX THOUSAND FOUR HUNDRED SIXTY EIGHT PESOS AND THIRTY NINE CENTAVOS ONLY')
  const receipt = buildFundReleaseReceipt({
    employee_payroll_id: 11,
    payroll_status: 'finalized',
    finalized_at: '2026-09-22 09:00:00',
    finalized_snapshot: {
      period: { label: 'September 1-15, 2026', start: '2026-09-01', end: '2026-09-15', type: 'first_half' },
      employee: { name: 'ROBERT RENBY C. SAN JUAN', position: 'Junior IT & Systems Developer', department: 'Sales', employment_status: 'probationary' },
      compensation: { monthly_basic: 15000, half_month_basic: 7500, hourly_rate: 49.32 },
      attendance: { expected_regular_minutes: 4620, regular_attended_minutes: 3543, pto_minutes: 0, regular_holiday_minutes: 0, special_holiday_minutes: 0, tardiness_absence_minutes: 1255, overtime_minutes: 0, rest_day_overtime_minutes: 0, night_differential_minutes: 0 },
      earnings: { overtime_pay: 0, rest_day_overtime_pay: 0, regular_holiday_pay: 0, special_holiday_pay: 0, night_differential_pay: 0 },
      allowances: { rice_allowance: 0, transportation_allowance: 0, attendance_bonus: 0 },
      adjustments: { manual_additions_total: 0, manual_deductions_total: 0 },
      deductions: { attendance_deduction: 1031.61 },
      net_fund_release: 6468.39,
    },
  }, { today: '2026-09-28' })
  assert.equal(receipt.total_regular_hours, 77)
  assert.equal(receipt.total_regular_hours_attended, 59.05)
  assert.equal(receipt.tardiness_absence_minutes, 1255)
  assert.equal(receipt.total_deduction, 1031.61)
  assert.equal(receipt.total, 6468.39)
})

