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

test('sales summary separates gross contracts, selected-cohort cancellations and net active contract value', () => {
  assert.match(controller, /cancelledAsOf/)
  assert.match(controller, /cohortCancelledValue/)
  assert.match(controller, /netContractValue/)
  assert.match(controller, /grossContractedValue/)
  assert.match(controller, /netActiveContractValue/)
  assert.match(reportPage, /Gross Contracted Value/)
  assert.match(reportPage, /Less: Cancelled from Selected Sales/)
  assert.match(reportPage, /Net Active Contract Value/)
})

test('refund cash movement is based on refund date instead of cancellation date', () => {
  assert.match(controller, /history\.refund_date BETWEEN \? AND \?/)
  assert.match(controller, /refundsPaidInRange/)
  assert.match(controller, /netCashMovement: roundMoney\(collectedInRange - refundsPaidInRange\)/)
  assert.match(reportPage, /Refunds are counted by refund payment date/)
  assert.match(reportPage, /Refunds Paid/)
})

test('reports distinguish in-range activity from report-end snapshots', () => {
  assert.match(reportPage, /IN RANGE = transactions\/events dated/)
  assert.match(reportPage, /AS OF = balances calculated through/)
  assert.match(reportPage, /Outstanding Receivables/)
  assert.match(reportPage, /Unreleased \/ Remaining/)
  assert.match(controller, /cumulativeRefunded/)
  assert.match(controller, /netCumulativeCash/)
})

test('detailed report tables paginate and sales is no longer a duplicate Reservations tab', () => {
  assert.match(reportPage, /Sales & Reservations/)
  assert.doesNotMatch(reportPage, /\['reservations', 'Reservations'\]/)
  assert.match(reportPage, /\[25, 50, 100\]/)
  assert.match(reportPage, /Showing \{rows\.length \? start \+ 1 : 0\}/)
  assert.match(reportPage, /sticky top-0/)
})

test('report bridge cards render with React Fragment instead of the undefined Children.Fragment member', () => {
  assert.match(reportPage, /import \{ Children, Fragment, useEffect/)
  assert.match(reportPage, /<Fragment key=\{item\.label\}>/)
  assert.doesNotMatch(reportPage, /Children\.Fragment/)
})

test('PDF export is intentionally multi-section and keeps cancellation and refund timing separate', () => {
  assert.match(printPage, /const totalSections = 8/)
  assert.match(printPage, /Management Report — Executive Summary/)
  assert.match(printPage, /Sales & Reservations/)
  assert.match(printPage, /Outstanding Accounts — As of/)
  assert.match(printPage, /Cancellation activity uses cancellation date; refund cash movement uses refund date/)
  assert.match(printPage, /Seller Performance/)
  assert.match(printPage, /Project Breakdown/)
  assert.match(printPage, /report-table thead \{ display: table-header-group; \}/)
})

test('commission reporting uses the same selected-sales cohort and reconciles gross to payable status', () => {
  assert.match(controller, /const cohortCommissionIds = new Set\(commissions\.map/)
  assert.match(controller, /const commissionCohortReleases = releases\.filter/)
  assert.match(controller, /const cohortReleased = commissionCohortReleases\.filter/)
  assert.match(controller, /const commissionRemaining = roundMoney\(cohortRemainingCommission\.reduce/)
  assert.match(controller, /const commissionNonPayable = roundMoney\(commissionForfeitedOnCancellation \+ commissionCancelled\)/)
  assert.match(controller, /const commissionNetPayable = roundMoney\(commissionReleased \+ commissionRemaining\)/)
  assert.match(controller, /commissionReconciliationDifference/)
  assert.match(reportPage, /Commission from Sales in Selected Range/)
  assert.match(reportPage, /Less: Non-Payable \/ Deductions/)
  assert.match(reportPage, /Status of Net Commission Payable/)
  assert.match(reportPage, /rows=\{data\.commissionCohortReleases \|\| \[\]\}/)
  assert.doesNotMatch(reportPage, /label="Commission Generated"/)
  assert.doesNotMatch(reportPage, /label="Commission Released"/)
})

test('PDF commission section uses cohort reconciliation instead of mixing in-range and as-of cards', () => {
  assert.match(printPage, /Commission Liability Reconciliation/)
  assert.match(printPage, /Status of Net Commission Payable/)
  assert.match(printPage, /payload\.commissionCohortReleases/)
  assert.match(printPage, /Gross Commission Created/)
  assert.match(printPage, /Net Commission Payable/)
  assert.doesNotMatch(printPage, /Commission Generated in Range/)
  assert.doesNotMatch(printPage, /Commission Released in Range/)
})
