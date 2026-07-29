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

test('Lot Project Dashboard exposes accumulated, paid, and outstanding penalty totals', () => {
  assert.match(controller, /AS totalPenaltyAccumulated/)
  assert.match(controller, /AS totalPenaltyPaid/)
  assert.match(controller, /AS totalPenaltyOutstanding/)
  assert.match(controller, /totalPenaltyAccumulated: toNumber\(scheduleSummary\.totalPenaltyAccumulated\)/)
  assert.match(controller, /totalPenaltyPaid: toNumber\(scheduleSummary\.totalPenaltyPaid\)/)
  assert.match(controller, /totalPenaltyOutstanding: toNumber\(scheduleSummary\.totalPenaltyOutstanding\)/)
  assert.match(lotDashboard, /label: 'Penalty Accumulated'/)
  assert.match(lotDashboard, /stats\.totalPenaltyPaid/)
  assert.match(lotDashboard, /stats\.totalPenaltyOutstanding/)
})

test('System Dashboard aggregates penalty totals from every included project', () => {
  assert.match(systemDashboard, /total\.penaltyAccumulated \+= Number\(stats\.totalPenaltyAccumulated \|\| 0\)/)
  assert.match(systemDashboard, /total\.penaltyPaid \+= Number\(stats\.totalPenaltyPaid \|\| 0\)/)
  assert.match(systemDashboard, /total\.penaltyOutstanding \+= Number\(stats\.totalPenaltyOutstanding \|\| 0\)/)
  assert.match(systemDashboard, /label="Penalty Accumulated"/)
  assert.match(systemDashboard, /summary\.penaltyPaid/)
  assert.match(systemDashboard, /summary\.penaltyOutstanding/)
})

test('sales totals remain contract based while gross verified receipts still include paid penalties', () => {
  assert.match(controller, /SELECT SUM\(p\.lot_project_payment_amount\)[\s\S]*p\.lot_project_payment_status = 'Verified'/)
  assert.match(controller, /AS totalNetSales/)
  assert.match(controller, /GREATEST\(\$\{effectiveTcpExpr\} - \(\$\{rangeEarnedDiscountExpr\}\), 0\)/)
  assert.doesNotMatch(controller, /AS totalNetSales[^\n]*penalty_amount/)
})
