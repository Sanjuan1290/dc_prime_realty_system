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
