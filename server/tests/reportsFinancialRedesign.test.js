import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const controller = read('server/controllers/System/reports.controller.js')
const reportPage = read('client/src/pages/System/Reports.jsx')
const printPage = read('client/src/pages/System/ReportsPrintPage.jsx')

test('Reports now uses the former System Dashboard analytics experience', () => {
  assert.match(reportPage, /PageHeader title="Reports"/)
  assert.match(reportPage, /Total Gross Sales/)
  assert.match(reportPage, /Cash Collected/)
  assert.match(reportPage, /Total Number of Reservations/)
  assert.match(reportPage, /Pending Cancellations/)
  assert.match(reportPage, /Company Sales Trend/)
  assert.match(reportPage, /Sales Summary per Project/)
  assert.match(reportPage, /Cancellation Trend/)
  assert.match(reportPage, /Commission Comparison/)
  assert.match(reportPage, /Inventory by Project/)
})

test('Reports keeps exact date-range behavior from the former System Dashboard', () => {
  assert.match(reportPage, /range: dateRange,[\s\S]*from: fromDate,[\s\S]*to: toDate/)
  assert.match(reportPage, /max=\{isCustom \? toDate \|\| undefined : undefined\}/)
  assert.match(reportPage, /min=\{isCustom \? fromDate \|\| undefined : undefined\}/)
  assert.match(reportPage, /administratorNeedsConfirmation/)
  assert.match(reportPage, /Report Date Filter/)
})

test('Reports provides audited PDF export through the existing print report', () => {
  assert.match(reportPage, /Export PDF/)
  assert.match(reportPage, /SYSTEM_REPORTS_EXPORT/)
  assert.match(reportPage, /\/projects\/reports\/export-audit/)
  assert.match(reportPage, /\/portal\/reports\/print\?/)
  assert.match(reportPage, /DC-Prime-Management-Report_/)
})

test('PDF export remains multi-section and preserves management-report reconciliation', () => {
  assert.match(printPage, /const totalSections = 8/)
  assert.match(printPage, /Management Report — Executive Summary/)
  assert.match(printPage, /Sales & Reservations/)
  assert.match(printPage, /Outstanding Accounts — As of/)
  assert.match(printPage, /Cancellation activity uses cancellation date; refund cash movement uses refund date/)
  assert.match(printPage, /Seller Performance/)
  assert.match(printPage, /Project Breakdown/)
  assert.match(printPage, /report-table thead \{ display: table-header-group; \}/)
})

test('report backend keeps sales, refund, and commission reconciliation used by PDF export', () => {
  assert.match(controller, /cancelledAsOf/)
  assert.match(controller, /cohortCancelledValue/)
  assert.match(controller, /grossContractedValue/)
  assert.match(controller, /netActiveContractValue/)
  assert.match(controller, /history\.refund_date BETWEEN \? AND \?/)
  assert.match(controller, /refundsPaidInRange/)
  assert.match(controller, /netCashMovement: roundMoney\(collectedInRange - refundsPaidInRange\)/)
  assert.match(controller, /const cohortCommissionIds = new Set\(commissions\.map/)
  assert.match(controller, /const commissionCohortReleases = releases\.filter/)
  assert.match(controller, /const commissionReconciliation = reconcileCommissionCohort/)
})

test('PDF commission section uses selected-sales cohort reconciliation', () => {
  assert.match(printPage, /Commission Liability Reconciliation/)
  assert.match(printPage, /Status of Net Commission Payable/)
  assert.match(printPage, /payload\.commissionCohortReleases/)
  assert.match(printPage, /Gross Commission Created/)
  assert.match(printPage, /Net Commission Payable/)
  assert.doesNotMatch(printPage, /Commission Generated in Range/)
  assert.doesNotMatch(printPage, /Commission Released in Range/)
})
