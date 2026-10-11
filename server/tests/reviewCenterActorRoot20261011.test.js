import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/pages/System/ReviewCenter.jsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const centerStart = source.indexOf('const ReviewCenter = () => {')
const center = source.slice(centerStart)

test('Review Center declares actorRoot in the same component as click handlers', () => {
  assert.ok(centerStart > -1)
  assert.match(center, /const actor = me\?\.user \|\| \{\}/)
  assert.match(center, /const actorRoot = actor\.role \? `\/portal\/\$\{actor\.role\}` : ''/)
})

test('Reviews list opens detail route with the logged-in actor role', () => {
  assert.match(center, /onClick=\{\(\) => navigate\(`\$\{actorRoot\}\/review-center\/reviews\/\$\{row\.operational_review_id\}`\)\}/)
})

test('Internal workflow notification opens detail route with the logged-in actor role', () => {
  assert.match(center, /if \(row\.operational_review_id\) navigate\(`\$\{actorRoot\}\/review-center\/reviews\/\$\{row\.operational_review_id\}`\)/)
})

test('All review-enabled roles have a route at that role path', () => {
  const appSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/App.jsx'), 'utf8')
  assert.match(appSource, /systemRoleRoutes = SYSTEM_USER_ROLES\.map\(\(role\) =>/)
  assert.match(appSource, /path=\{`\/portal\/\$\{role\}`\}/)
  assert.match(appSource, /path="review-center\/reviews\/:reviewId"/)
})
