import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const source = fs.readFileSync(path.join(root, 'CLIENT/SYSTEM/src/pages/System/ReviewCenter.jsx'), 'utf8')
const detailsStart = source.indexOf('export const ReviewDetails =')
const centerStart = source.indexOf('const ReviewCenter = () => {')
const details = source.slice(detailsStart, centerStart)
const center = source.slice(centerStart)

test('Review Details never accesses counts, which belongs to Review Center list', () => {
  assert.ok(detailsStart >= 0 && centerStart > detailsStart)
  assert.doesNotMatch(details, /\bcounts\b/)
})

test("Review Center owns compact task summaries without notification counters", ()=>{assert.ok(center.includes('const counts=summary.data?.data||{}'));assert.ok(center.includes('counts.pendingReviewTasks'));assert.ok(!center.includes('unreadNotifications'))});

test("Review Center keeps role-scoped review navigation", ()=>{assert.ok(center.includes("root='/portal/'+actor.role"));assert.ok(center.includes("navigate(root+'/review-center/reviews/'+row.operational_review_id)"))});
