import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('workflow notifications only surface review-linked items currently assigned to the signed-in role', () => {
  const controller = read('SERVER/SYSTEM/controllers/System/workflow.controller.js')
  assert.match(controller, /const notificationVisibilityWhere/)
  assert.match(controller, /reviewQueueWhere\(actor, \{ alias: reviewAlias \}\)/)
  assert.match(controller, /LEFT JOIN operational_reviews nr ON nr\.operational_review_id=n\.operational_review_id/)
  const counter = read('SERVER/SYSTEM/services/workflowSummaryNotifications.service.js')
  assert.match(counter, /n\.user_id=\? AND n\.read_at IS NULL AND \$\{visibility\.sql\}/)
  assert.match(controller, /visibility: notificationVisibilityWhere\(actor\)/)
  assert.match(controller, /const access = notificationVisibilityWhere\(req\.authUser\)/)
})

test("Role queues and detail caches include account identity without Review Center notifications", ()=>{const center=read('CLIENT/SYSTEM/src/pages/System/ReviewCenter.jsx');assert.ok(center.includes("['workflow-summary',actor.id,actor.role]"));assert.ok(center.includes("['workflow-reviews',actor.id,actor.role,params.toString()]"));assert.ok(center.includes("['workflow-review', actor.id || 0, actor.role || '', reviewId]"));assert.ok(!center.includes("['workflow-notifications'"))});

test('review details never render raw JSON blocks and use user-facing Network rate cards', () => {
  const center = read('CLIENT/SYSTEM/src/pages/System/ReviewCenter.jsx')
  assert.match(center, /const ProjectRatesValue/)
  assert.match(center, /Pool Rate/)
  assert.match(center, /Company Profit/)
  assert.match(center, /Division Manager Share/)
  assert.match(center, /Broker Details/)
  const comparison = read('CLIENT/SYSTEM/src/components/Shared/ReviewFormComparison.jsx')
  assert.match(center, /<ReviewFormComparison/)
  assert.match(comparison, /neverShow/)
  assert.match(comparison, /Not Recorded/)
  assert.doesNotMatch(center, /<pre/)
  assert.doesNotMatch(center, /JSON\.stringify\(value, null, 2\)/)
})




