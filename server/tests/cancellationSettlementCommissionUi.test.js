import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const modal = fs.readFileSync(
  path.join(root, 'client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/CancellationSettlementModal.jsx'),
  'utf8'
)
const unitStatus = fs.readFileSync(
  path.join(root, 'client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx'),
  'utf8'
)
const accountService = fs.readFileSync(
  path.join(root, 'server/services/lotProjectAccount.service.js'),
  'utf8'
)

test('Cancellation Settlement keeps refund controls but removes the confusing commission preview', () => {
  assert.match(modal, /Verified Collections/)
  assert.match(modal, /Refund Amount/)
  assert.match(modal, /Discontinued Amount/)
  assert.doesNotMatch(modal, /Cancellation commission preview/)
  assert.doesNotMatch(modal, /commissionStages/)
  assert.doesNotMatch(modal, /retainedPercent/)
  assert.doesNotMatch(unitStatus, /commissionBase=/)
})

test('Cancellation commission processing keeps released stages and preserves reached retained milestones', () => {
  assert.match(accountService, /if \(release\.release_status === 'Released'\) continue/)
  assert.match(accountService, /const earned = rowPercent >= Number\(release\.release_trigger_percent \|\| 0\)/)
  assert.match(accountService, /Earned on Cancellation/)
  assert.match(accountService, /Forfeited on Cancellation/)
})
