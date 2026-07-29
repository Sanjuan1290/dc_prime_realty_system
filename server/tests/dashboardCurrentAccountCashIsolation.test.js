import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const controller = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js')
const lotDashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx')
const systemDashboard = read('client/src/pages/System/Dashboard.jsx')

test('dashboard cash and discount calculations use only the listing current buyer account', () => {
  assert.match(controller, /columnExists\(connection, 'lot_project_payments', 'lot_project_account_id'\)/)
  assert.match(controller, /const currentPaymentPredicate = hasPaymentAccountId && hasListingCurrentAccountId/)
  assert.match(controller, /p\.lot_project_account_id = l\.current_account_id/)
  assert.match(controller, /p\.lot_project_client_profile_id = cp\.lot_project_client_profile_id/)

  const predicateUses = controller.match(/AND \$\{currentPaymentPredicate\}/g) || []
  assert.ok(predicateUses.length >= 6, 'current account predicate must cover summary, range, trend, and discount queries')

  assert.match(controller, /const paymentSummarySelect = hasPayments[\s\S]*AND \$\{currentPaymentPredicate\}/)
  assert.match(controller, /const rangePaymentSummarySelect = hasPayments[\s\S]*AND \$\{currentPaymentPredicate\}/)
  assert.match(controller, /const \[collectionTrendRows\][\s\S]*AND \$\{currentPaymentPredicate\}/)
  assert.match(controller, /const \[discountPaymentRows\][\s\S]*AND \$\{currentPaymentPredicate\}/)
})

test('dashboard client pricing joins follow current_account_id instead of any retained profile on the listing', () => {
  assert.match(controller, /LEFT JOIN lot_project_accounts \$\{accountAlias\}[\s\S]*current_account_id/)
  assert.match(controller, /lot_project_client_profile_id = \$\{accountAlias\}\.lot_project_client_profile_id/)
  assert.match(controller, /const saleClientJoin = getCurrentClientJoin\(\)/)
  assert.match(controller, /const clientJoin = hasClientProfiles[\s\S]*getCurrentClientJoin\(\)/)
})

test('cash cards explain that finalized cancelled accounts stay in cancellation totals', () => {
  for (const page of [lotDashboard, systemDashboard]) {
    assert.match(page, /Verified payments from current buyer accounts/)
    assert.match(page, /Finalized cancelled-account cash stays in the cancellation totals/)
  }
  assert.match(controller, /AS totalRefundedAmount/)
  assert.match(controller, /AS totalDiscontinuedAmount/)
  assert.match(controller, /AS cancellationCashCollected/)
})
