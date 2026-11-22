import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../CLIENT/SYSTEM/src/pages/System/ReviewCenter.jsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const centerStart = source.indexOf('const ReviewCenter = () => {')
const center = source.slice(centerStart)

test("Review Center declares its actor and route root in the click-handler component", ()=>{assert.ok(centerStart>-1);assert.ok(center.includes('actor=me?.user||{}'));assert.ok(center.includes("root='/portal/'+actor.role"))});

test("Review rows open detail routes under the signed-in role", ()=>{assert.ok(center.includes("navigate(root+'/review-center/reviews/'+row.operational_review_id)"))});

test("Review Center has no internal notification navigation", ()=>{assert.ok(!center.includes('workflow-notifications'));assert.ok(!center.includes('Mark as Read'))});

test('All review-enabled roles have a route at that role path', () => {
  const appSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../CLIENT/SYSTEM/src/App.jsx'), 'utf8')
  assert.match(appSource, /systemRoleRoutes = SYSTEM_USER_ROLES\.map\(\(role\) =>/)
  assert.match(appSource, /path=\{`\/portal\/\$\{role\}`\}/)
  assert.match(appSource, /path="review-center\/reviews\/:reviewId"/)
})


