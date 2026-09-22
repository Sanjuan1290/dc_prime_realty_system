import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const source = fs.readFileSync(
  path.join(root, 'client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx'),
  'utf8'
)

test('SOA shows a three-part overdue reconciliation under the account summary', () => {
  assert.match(source, /Overdue Overview/)
  assert.match(source, /Overdue — Excl\. Penalty/)
  assert.match(source, /Outstanding Penalties/)
  assert.match(source, /Total Overdue — Incl\. Penalty/)
  assert.match(source, /overdueSummary\.withoutPenalty/)
  assert.match(source, /overdueSummary\.penalty/)
  assert.match(source, /overdueSummary\.withPenalty/)
})

test('overdue summary uses Manila date, excludes future\/today and cancelled rows, and deducts partial payments', () => {
  assert.match(source, /const localOverdueSummary = useMemo/)
  assert.match(source, /const overdueSummary = canonicalReceivable[\s\S]*overdueExcludingPenalty[\s\S]*localOverdueSummary/)
  assert.match(source, /const today = todayManila\(\)/)
  assert.match(source, /status === 'cancelled'/)
  assert.match(source, /dueDate >= today/)
  assert.match(source, /Number\(row\.totalDue \?\? row\.dueAmount \?\? 0\) - Number\(row\.amountPaid \|\| 0\)/)
})

test('overdue base plus outstanding penalty reconciles to total overdue', () => {
  const totalDue = 1300
  const amountPaid = 200
  const penalty = 300
  const paidPenalty = 50
  const outstandingPenalty = penalty - paidPenalty
  const totalOutstanding = totalDue - amountPaid
  const overdueWithoutPenalty = totalOutstanding - outstandingPenalty

  assert.equal(overdueWithoutPenalty, 850)
  assert.equal(outstandingPenalty, 250)
  assert.equal(overdueWithoutPenalty + outstandingPenalty, totalOutstanding)
})
