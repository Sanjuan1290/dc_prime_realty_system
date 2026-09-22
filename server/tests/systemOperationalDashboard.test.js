import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const dashboard = read('client/src/pages/System/Dashboard.jsx')
const reports = read('client/src/pages/System/Reports.jsx')
const projectsController = read('server/controllers/System/projects.controller.js')
const projectsRouter = read('server/routers/System/projects.routers.js')

test('System Dashboard is operational instead of financial reporting', () => {
  assert.match(dashboard, /PageHeader[\s\S]*title="Dashboard"/)
  assert.match(dashboard, /Notifications/)
  assert.match(dashboard, /Active Projects/)
  assert.match(dashboard, /Units On Hold/)
  assert.match(dashboard, /Pending Cancellations/)
  assert.match(dashboard, /Overdue Payments/)
  assert.match(dashboard, /Documents Need Attention/)
  assert.match(dashboard, /Quick Navigation/)
  assert.match(dashboard, /Needs Attention/)
  assert.match(dashboard, /Project Status Overview/)
  assert.doesNotMatch(dashboard, /Company Sales Trend/)
  assert.doesNotMatch(dashboard, /Total Gross Sales/)
})

test('Dashboard summary endpoint aggregates current lot-project statuses and respects project access', () => {
  assert.match(projectsController, /export const getSystemDashboardSummary/)
  assert.match(projectsController, /getAccessibleProjectIds\(req\.authUser\)/)
  assert.match(projectsController, /lot_project_listing_status = 'available'/)
  assert.match(projectsController, /lot_project_listing_status = 'hold'/)
  assert.match(projectsController, /lot_project_listing_status = 'pending_for_cancellation'/)
  assert.match(projectsController, /lot_project_listing_sold_substatus = 'fully_paid'/)
  assert.match(projectsRouter, /\/dashboard-summary'[\s\S]*SYSTEM_DASHBOARD_VIEW[\s\S]*getSystemDashboardSummary/)
  assert.match(dashboard, /\/projects\/dashboard-summary/)
})

test('financial analytics moved to Reports with PDF export and Lot Project routes remain separate', () => {
  assert.match(reports, /PageHeader title="Reports"/)
  assert.match(reports, /Company Sales Trend/)
  assert.match(reports, /Export PDF/)
  assert.match(reports, /\/portal\/reports\/print/)
  assert.doesNotMatch(dashboard, /Report Date Filter/)
})
