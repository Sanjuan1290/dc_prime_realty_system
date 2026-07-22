import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const dashboard = fs.readFileSync(path.join(root, 'client/src/pages/System/Dashboard.jsx'), 'utf8')

test('System Dashboard combines refunded and discontinued amounts from every loaded project', () => {
  assert.match(dashboard, /total\.totalRefundedAmount \+= Number\(stats\.totalRefundedAmount \|\| 0\)/)
  assert.match(dashboard, /total\.totalDiscontinuedAmount \+= Number\(stats\.totalDiscontinuedAmount \|\| 0\)/)
  assert.match(dashboard, /totalRefundedAmount: 0/)
  assert.match(dashboard, /totalDiscontinuedAmount: 0/)
  assert.match(dashboard, /label="Refunded Amount"[\s\S]*summary\.totalRefundedAmount/)
  assert.match(dashboard, /label="Discontinued Amount"[\s\S]*summary\.totalDiscontinuedAmount/)
})


test('System Dashboard aggregates and charts commission comparison totals from every loaded project', () => {
  assert.match(dashboard, /total\.totalCommission \+= Number\(stats\.totalCommission \|\| 0\)/)
  assert.match(dashboard, /total\.eligibleCommission \+= Number\(stats\.eligibleCommission \|\| 0\)/)
  assert.match(dashboard, /total\.releasedCommission \+= Number\(stats\.releasedCommission \|\| 0\)/)
  assert.match(dashboard, /total\.netRemainingCommission \+= Number\(stats\.netRemainingCommission \|\| 0\)/)
  assert.match(dashboard, /const commissionChartData = \[/)
  assert.match(dashboard, /title="Commission Comparison"/)
  assert.match(dashboard, /label: 'Total'[\s\S]*summary\.totalCommission/)
  assert.match(dashboard, /label: 'Eligible'[\s\S]*summary\.eligibleCommission/)
  assert.match(dashboard, /label: 'Released'[\s\S]*summary\.releasedCommission/)
  assert.match(dashboard, /label: 'Remaining'[\s\S]*summary\.netRemainingCommission/)
})
