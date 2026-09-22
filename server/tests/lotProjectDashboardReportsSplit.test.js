import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('Lot Project workspace separates operational Dashboard from Reports', () => {
  const app = read('client/src/App.jsx')
  const layout = read('client/src/layout/LotLayout.jsx')
  const dashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx')
  const reports = read('client/src/pages/Lot_Projects/Reports.jsx')

  assert.match(app, /const LotReports = lazy\(\(\) => import\('\.\/pages\/Lot_Projects\/Reports'\)\)/)
  assert.match(app, /path="reports"[\s\S]*PERMISSIONS\.LOT_DASHBOARD_VIEW[\s\S]*<LotReports \/>/)
  assert.match(layout, /label: 'Dashboard'[\s\S]*label: 'Reports'/)
  assert.match(layout, /path: `\$\{basePath\}\/reports`/)
  assert.match(layout, /pathname\.includes\('\/reports'\)/)

  assert.match(dashboard, /Needs Attention/)
  assert.match(dashboard, /Upcoming Dues/)
  assert.match(dashboard, /Quick Navigation/)
  assert.match(dashboard, /Financial analytics moved to Reports/)
  assert.doesNotMatch(dashboard, /Seller Performance Details/)
  assert.doesNotMatch(dashboard, /Graph Date Filter/)
  assert.match(dashboard, />View Details<\/button>/)
  assert.match(dashboard, />Edit Project<\/button>/)
  assert.match(dashboard, />Price List<\/button>/)

  assert.match(reports, /const Reports = \(\) =>/)
  assert.match(reports, /Reports`}/)
  assert.match(reports, /Graph Date Filter/)
  assert.match(reports, /Business Snapshot/)
  assert.match(reports, /Seller Performance Details/)
  assert.doesNotMatch(reports, />View Details<\/button>/)
  assert.doesNotMatch(reports, />Edit Project<\/button>/)
  assert.doesNotMatch(reports, />Price List<\/button>/)
  assert.match(reports, /export default Reports/)
})

