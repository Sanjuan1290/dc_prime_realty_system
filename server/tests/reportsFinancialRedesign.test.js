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

test('Reports provides audited management-summary PDF export', () => {
  assert.match(reportPage, /Export PDF/)
  assert.match(reportPage, /Export Management Summary/)
  assert.match(reportPage, /Summary export only/)
  assert.match(reportPage, /Detailed transaction records, buyer-level tables/)
  assert.match(reportPage, /SYSTEM_REPORTS_EXPORT/)
  assert.match(reportPage, /\/projects\/reports\/export-audit/)
  assert.match(reportPage, /\/portal\/reports\/print\?/)
  assert.match(reportPage, /DC-Prime-Management-Summary_/)
  assert.match(reportPage, /Export Summary PDF/)
})

test('PDF export is a three-page management summary with no transaction-level tables', () => {
  assert.match(printPage, /const totalPages = 3/)
  assert.match(printPage, /Management Summary Report/)
  assert.match(printPage, /Sales & Collections/)
  assert.match(printPage, /Inventory Summary/)
  assert.match(printPage, /Cancellation Summary/)
  assert.match(printPage, /Payment Status/)
  assert.match(printPage, /Commission Summary/)
  assert.match(printPage, /Project Summary/)
  assert.match(printPage, /Summary Comparison/)
  assert.match(printPage, /Management Summary Only/)
  assert.match(printPage, /buyer-level records, individual unit transaction rows/)

  assert.doesNotMatch(printPage, /payload\.payments/)
  assert.doesNotMatch(printPage, /payload\.outstandingAccounts/)
  assert.doesNotMatch(printPage, /payload\.cancellations/)
  assert.doesNotMatch(printPage, /payload\.commissionCohortReleases/)
  assert.doesNotMatch(printPage, /Seller Performance/)
})

test('management summary PDF uses the same project dashboard sources as the Reports page', () => {
  assert.match(printPage, /useFetch\('\/projects\/lot-projects'\)/)
  assert.match(printPage, /\/projects\/lot-projects\/\$\{slug\}\/dashboard\?\$\{query\}/)
  assert.match(printPage, /totalGrossSales/)
  assert.match(printPage, /totalCashCollected/)
  assert.match(printPage, /pendingCancellation/)
  assert.match(printPage, /dueSoonCount/)
  assert.match(printPage, /overdueCount/)
  assert.match(printPage, /totalCommission/)
})

test('report backend keeps historical detailed reconciliation endpoints intact', () => {
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

