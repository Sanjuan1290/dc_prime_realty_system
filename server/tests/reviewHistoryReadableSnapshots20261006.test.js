import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('review snapshots render structured fields instead of raw JSON blocks', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(center, /SNAPSHOT_LABELS/)
  assert.match(center, /Broker Details/)
  assert.match(center, /Project Rates/)
  assert.match(center, /isTechnicalSnapshotField/)
  assert.doesNotMatch(center, /JSON\.stringify\(value, null, 2\)/)
})

test('Head and Auditor can track reviews after their action without keeping them actionable', () => {
  const controller = read('server/controllers/System/workflow.controller.js')
  assert.match(controller, /const reviewHistoryWhere/)
  assert.match(controller, /scope === 'history' \? reviewHistoryWhere\(req\.authUser\) : reviewQueueWhere\(req\.authUser\)/)
  assert.match(controller, /role === 'auditor'[\s\S]*head_reviewed_at IS NOT NULL/)
  assert.match(controller, /department = \?[\s\S]*user_project_access hupa/)
  assert.match(controller, /canActorOpenReview[\s\S]*reviewHistoryWhere\(actor\)/)
})

test('Review Center separates actionable work from history and paginates it', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(center, /Needs My Action/)
  assert.match(center, /History &amp; Tracking/)
  assert.match(center, /scope=\$\{reviewScope\}/)
  assert.match(center, /limit=10/)
  assert.match(center, /Previous/)
  assert.match(center, /Next/)
})

test('completed transitions stay visible instead of producing stale workflow errors', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  const controller = read('server/controllers/System/workflow.controller.js')
  assert.match(center, /This review already moved to its next workflow stage\. The latest status is now shown below\./)
  assert.match(controller, /Confirmed\. The Auditor has been notified\. You can continue tracking this review in History & Tracking\./)
  assert.match(controller, /Audit verification completed\. Review closed\. It remains available in History & Tracking\./)
})
