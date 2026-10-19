import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { buildSellerTeamCompleteness } from '../services/sellerTeamCompleteness.service.js'
import { buildSellerSetupAudit } from '../services/sellerSetupAudit.service.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const source = (name) => readFileSync(resolve(root, name), 'utf8')
const seller = (id, role, parent = null, active = true) => ({
  user_id: id, accredited_seller_id: id + 100, role,
  accredited_seller_reports_under_user_id: parent,
  user_status: active ? 'active' : 'inactive',
  accredited_seller_status: active ? 'active' : 'inactive',
})
const people = [seller(1, 'division_manager'), seller(2, 'sales_director', 1), seller(3, 'unit_manager', 2), seller(4, 'sales_agent', 3)]
const by = (result, id) => result.records.find((row) => row.userId === id)

test('fully staffed DM -> SD -> UM -> SA hierarchy is complete', () => {
  const result = buildSellerTeamCompleteness(people)
  for (const id of [1, 2, 3, 4]) assert.equal(by(result, id).status, 'complete')
  assert.equal(result.summary.needsAssignment, 0)
})

test('UM with no active SA is flagged without changing existing account readiness', () => {
  const result = buildSellerTeamCompleteness(people.filter(row => row.user_id !== 4))
  assert.equal(by(result, 3).status, 'needs_assignment')
  assert.equal(by(result, 3).missingRole, 'sales_agent')
  const audit = buildSellerSetupAudit({
    group: { seller_group_id: 19, seller_group_name: 'North Star', seller_group_status: 'active', seller_group_head_user_id: 1 },
    members: people.filter(row => row.user_id !== 4),
    managerLinks: [{ managed_user_id: 2, manager_user_id: 1 }, { managed_user_id: 3, manager_user_id: 2 }],
    projects: [{seller_group_lot_project_rate_status:'active',lot_project_status:'active'}]
  })
  assert.equal(by(audit, 3).readiness, 'ready')
  assert.equal(by(audit, 3).team.status, 'needs_assignment')
})

test('incomplete branch is partial if another branch is fully staffed', () => {
  const result = buildSellerTeamCompleteness([...people, seller(5, 'unit_manager', 2)])
  assert.equal(by(result, 2).status, 'partial')
  assert.equal(by(result, 2).directReportCount, 2)
  assert.equal(by(result, 5).status, 'needs_assignment')
})

test('inactive children never satisfy direct report staffing', () => {
  const result = buildSellerTeamCompleteness([...people.slice(0, 3), seller(4, 'sales_agent', 3, false)])
  assert.equal(by(result, 3).status, 'needs_assignment')
  assert.equal(by(result, 4).status, 'inactive')
})

test('sales agent without required upward manager is flagged without bogus Assign Child action', () => {
  const result = buildSellerTeamCompleteness([...people, seller(5, 'sales_agent', 99)])
  assert.equal(by(result, 5).status, 'needs_assignment')
  assert.equal(by(result, 5).missingRole, null)
})

test('bulk-edit workbook download continues through existing audited exporter', () => {
  const workspace = source('client/src/components/Lot_Projects/ListingComponents/BulkEditListingsModal.jsx')
  const modal = source('client/src/components/Lot_Projects/ListingComponents/ExportListingsModal.jsx')
  assert.match(workspace, /Download Editable Template/)
  assert.match(workspace, /<ExportListingsModal[^>]+editableOnly/)
  assert.match(modal, /listing-bulk\/export-audit/)
  assert.match(modal, /editable: format === 'editable'/)
})

test('review modal separates dismiss from intentional back navigation on all record pages', () => {
  const modal = source('client/src/components/Shared/ReviewLiveRecordPanel.jsx')
  assert.match(modal, /onDismiss/)
  assert.match(modal, /onBackToReview/)
  assert.doesNotMatch(modal, /onClick=\{onClose\}/)
  for (const page of [
    'client/src/pages/System/SellerGroupDetails.jsx',
    'client/src/pages/Lot_Projects/Settings.jsx',
    'client/src/pages/Lot_Projects/ListingProfile.jsx',
  ]) {
    assert.match(source(page), /onDismiss=\{\(\) => setSearchParams\(dismissReviewRecordQuery\(searchParams\), \{ replace: true \}\)\}/)
    assert.match(source(page), /onBackToReview/)
    assert.match(source(page), /<ReviewReturnLink/)
  }
})

test('review dismissal removes auto-open state without discarding review return ID', async () => {
  const { dismissReviewRecordQuery, reviewReturnPath } = await import('../../client/src/utils/reviewRecordNavigation.js')
  const next = dismissReviewRecordQuery('?reviewView=1&reviewId=270005&reviewEntityType=accredited_seller&sellerId=150012&project=20')
  assert.equal(next.get('reviewView'), null)
  assert.equal(next.get('reviewId'), null)
  assert.equal(next.get('sellerId'), null)
  assert.equal(next.get('project'), '20')
  assert.equal(next.get('reviewReturnId'), '270005')
  assert.equal(reviewReturnPath('auditor', next.get('reviewReturnId')), '/portal/auditor/review-center/reviews/270005')
})
