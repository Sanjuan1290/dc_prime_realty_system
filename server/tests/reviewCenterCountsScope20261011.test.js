import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(root, 'client/src/pages/System/ReviewCenter.jsx'), 'utf8')
const detailsStart = source.indexOf('export const ReviewDetails =')
const centerStart = source.indexOf('const ReviewCenter = () => {')
const details = source.slice(detailsStart, centerStart)
const center = source.slice(centerStart)

test('Review Details never accesses counts, which belongs to Review Center list', () => {
  assert.ok(detailsStart >= 0 && centerStart > detailsStart)
  assert.doesNotMatch(details, /\bcounts\b/)
})

test('Review Center owns the summary counts and availability warning', () => {
  assert.match(center, /const counts = summary\.data\?\.data \|\| \{\}/)
  assert.match(center, /counts\.notificationCountsAvailable === false \|\| counts\.protectedCountsAvailable === false/)
  assert.match(center, /Some alert totals are temporarily unavailable/)
  assert.equal((source.match(/Some alert totals are temporarily unavailable/g) || []).length, 1)
})

test('Review Center keeps scoped actorRoot for review and notification navigation', () => {
  assert.match(center, /const actorRoot = actor\.role \? `\/portal\/\$\{actor\.role\}` : ''/)
  assert.match(center, /navigate\(`\$\{actorRoot\}\/review-center\/reviews\/\$\{row\.operational_review_id\}`\)/)
})
