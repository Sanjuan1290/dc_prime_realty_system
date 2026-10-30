import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildPayrollSummaryFromRows } from '../services/payrollSummary.shared.js'

const read = (relative) => readFileSync(new URL(`../../../${relative}`, import.meta.url), 'utf8')
const period = { periodStart: '2026-10-01', periodEnd: '2026-10-15', periodLabel: 'October 1 - 15, 2026' }
const makeRow = (id, status, net = 6957.48, extra = {}) => ({
  employee_payroll_id: id, employee_id: id, employee_code: `IT-${id}`,
  employee_name_snapshot: `Employee ${id}`, position_snapshot: 'Developer',
  payroll_status: status, half_month_basic: 7500, attendance_deduction: 542.52,
  overtime_pay: 0, rest_day_overtime_pay: 0, regular_holiday_pay: 0, special_holiday_pay: 0,
  night_differential_pay: 0, rice_allowance: 0, transportation_allowance: 0,
  attendance_bonus: 0, manual_additions_total: 0, manual_deductions_total: 0,
  net_fund_release: net, released_date: status === 'released' ? '2026-10-26' : null,
  scheduled_release_date: '2026-10-22', ...extra,
})

test('released, approved unpaid and draft salaries remain separate and reconcile to total payroll', () => {
  const summary = buildPayrollSummaryFromRows({ rows: [
    makeRow(1, 'released'), makeRow(2, 'finalized'), makeRow(3, 'corrected'), makeRow(4, 'draft'),
    makeRow(5, 'cancelled', 999999),
  ], period })
  assert.equal(summary.rows.length, 4)
  assert.equal(summary.totals.employee_count, 4)
  assert.equal(summary.totals.total_released, 6957.48)
  assert.equal(summary.totals.total_awaiting_release, 13914.96)
  assert.equal(summary.totals.total_draft, 6957.48)
  assert.equal(summary.totals.total_fund_release, 27829.92)
  assert.equal(summary.totals.released_count, 1)
  assert.equal(summary.totals.awaiting_release_count, 2)
  assert.equal(summary.totals.draft_count, 1)
  assert.equal(summary.official, false)
  assert.equal(summary.can_export, true)
})

test('a finalized payroll stays unpaid until released; a released payroll records actual date', () => {
  const summary = buildPayrollSummaryFromRows({ rows: [makeRow(1, 'finalized'), makeRow(2, 'released')], period })
  assert.equal(summary.official, true)
  assert.equal(summary.rows[0].payment_state, 'awaiting_release')
  assert.equal(summary.rows[0].release_date, null)
  assert.equal(summary.rows[0].scheduled_payday, '2026-10-22')
  assert.equal(summary.rows[1].payment_state, 'released')
  assert.equal(summary.rows[1].release_date, '2026-10-26')
  assert.equal(summary.totals.total_released, summary.totals.total_awaiting_release)
})

test('inconsistent saved salary blocks export without silently correcting its amount', () => {
  const summary = buildPayrollSummaryFromRows({ rows: [makeRow(1, 'released', 7500)], period })
  assert.equal(summary.rows[0].net, 7500)
  assert.equal(summary.rows[0].reconciliation_difference, 542.52)
  assert.equal(summary.can_export, false)
  assert.equal(summary.reconciliation_issues.length, 1)
  assert.equal(summary.reconciliation_issues[0].employee_payroll_id, 1)
  assert.match(summary.warnings.join(' '), /before exporting/)
})

test('cancelled-only or empty periods cannot export a misleading empty report', () => {
  for (const rows of [[], [makeRow(1, 'cancelled')]]) {
    const summary = buildPayrollSummaryFromRows({ rows, period })
    assert.equal(summary.can_export, false)
    assert.equal(summary.official, false)
    assert.equal(summary.totals.total_fund_release, 0)
  }
})

test('manual changes and premium pay remain reconciled in total adjustments', () => {
  const sample = makeRow(1, 'released', 7860, {
    attendance_deduction: 100, overtime_pay: 50, rest_day_overtime_pay: 60,
    regular_holiday_pay: 70, special_holiday_pay: 30, night_differential_pay: 20,
    rice_allowance: 100, transportation_allowance: 100,
    manual_additions_total: 40, manual_deductions_total: 10,
  })
  const report = buildPayrollSummaryFromRows({ rows: [sample], period })
  assert.equal(report.rows[0].adjustments, 150)
  assert.equal(report.rows[0].deduction, 100)
  assert.equal(report.rows[0].net, 7860)
  assert.equal(report.can_export, true)
})

test('PDF design shows paid/unpaid and release dates, keeps official draft marker and A4 landscape', () => {
  const page = read('CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/PayrollSummaryPrint.jsx')
  const modal = read('CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/PayrollSummaryExportModal.jsx')
  assert.match(page, /Employee Payroll Summary/)
  assert.match(page, /Payment Status \/ Date/)
  assert.match(page, /summary\.official/)
  assert.match(page, /payment_state === 'awaiting_release'/)
  assert.match(page, /row\.release_date/)
  assert.match(modal, /pageSize: 'A4 landscape'/)
  assert.match(modal, /!canExport \|\| exporting/)
  assert.match(modal, /mismatches\.length === 0/)
  assert.match(modal, /Includes all payroll records for this period/)
})

test('CSV/XLSX helper columns and totals use consistent paid/unpaid language', () => {
  const source = read('CLIENT/SYSTEM/src/utils/payrollSummaryExport.js')
  for (const value of ['Payment Status', 'Actual Release Date', 'Released / Paid', 'Awaiting Release', 'Draft Estimate', 'Total Payroll']) {
    assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(source, /safe\.replaceAll/)
  assert.match(source, /A1:K1/)
})


