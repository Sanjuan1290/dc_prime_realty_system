import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('workflow notifications only surface review-linked items currently assigned to the signed-in role', () => {
  const controller = read('server/controllers/System/workflow.controller.js')
  assert.match(controller, /const notificationVisibilityWhere/)
  assert.match(controller, /reviewQueueWhere\(actor, \{ alias: reviewAlias \}\)/)
  assert.match(controller, /LEFT JOIN operational_reviews nr ON nr\.operational_review_id=n\.operational_review_id/)
  assert.match(controller, /n\.user_id=\? AND n\.read_at IS NULL AND \$\{notificationAccess\.sql\}/)
  assert.match(controller, /const access = notificationVisibilityWhere\(req\.authUser\)/)
})

test('workflow query caches are account-aware so one role never sees another account cached queue', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(center, /\['workflow-summary', actor\.id \|\| 0, actor\.role \|\| ''\]/)
  assert.match(center, /\['workflow-reviews', actor\.id \|\| 0, actor\.role \|\| '', reviewScope, status, reviewPage\]/)
  assert.match(center, /\['workflow-notifications', actor\.id \|\| 0, actor\.role \|\| ''\]/)
  assert.match(center, /\['workflow-review', actor\.id \|\| 0, actor\.role \|\| '', reviewId\]/)
})

test('review details never render raw JSON blocks and use user-facing Network rate cards', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(center, /const ProjectRatesValue/)
  assert.match(center, /Pool Rate/)
  assert.match(center, /Company Profit/)
  assert.match(center, /Division Manager Share/)
  assert.match(center, /Broker Details/)
  assert.match(center, /Internal field names and raw JSON are intentionally hidden/)
  assert.doesNotMatch(center, /<pre/)
  assert.doesNotMatch(center, /JSON\.stringify\(value, null, 2\)/)
})
