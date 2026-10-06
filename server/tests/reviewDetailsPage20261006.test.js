import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('Review Center opens a dedicated review route instead of rendering the oversized modal', () => {
  const app = read('client/src/App.jsx')
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  const details = read('client/src/pages/System/ReviewDetailsPage.jsx')

  assert.match(app, /review-center\/reviews\/:reviewId/)
  assert.match(center, /navigate\(`\$\{actorRoot\}\/review-center\/reviews\/\$\{row\.operational_review_id\}`\)/)
  assert.doesNotMatch(center, /selectedReviewId/)
  assert.match(details, /<ReviewDetails/)
})

test('Dedicated review workspace prioritizes changed fields and keeps full snapshots collapsed', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(center, /Dedicated review workspace/)
  assert.match(center, /Changed Fields/)
  assert.match(center, /View full Before \/ After snapshots/)
  assert.match(center, /Back to Review Center/)
})

test('Dedicated review page preserves Head, Auditor and correction actions', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx')
  for (const label of [
    'Claim Review',
    'Confirm — No Mistake',
    'Return for Correction',
    'Open Audit Case',
    'Submit Explanation',
    'Finding Invalid',
    'Finding Valid',
    'Verify Correction & Close',
    'Correction Still Wrong',
    'Correct &amp; Confirm',
    'Correct &amp; Resubmit',
  ]) assert.match(center, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
