import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')
const source = read('server/controllers/System/workflow.controller.js')
const client = read('client/src/pages/System/ReviewCenter.jsx')

// Exercise the actual production SQL-building code with an isolated database stub.
// We deliberately don't need a real database to verify the same queue exclusion
// applies to BOTH count and rows queries, before pagination.
const roles = {
  operations_staff: { id: 41, role: 'operations_staff' },
  operations_head: { id: 42, role: 'operations_head', all_projects_access: 1 },
  marketing_head: { id: 46, role: 'marketing_head', all_projects_access: 0 },
  sales_head: { id: 47, role: 'sales_head', all_projects_access: 1 },
  accounting_head: { id: 48, role: 'accounting_head', all_projects_access: 0 },
  marketing_staff: { id: 49, role: 'marketing_staff' },
  sales_staff: { id: 50, role: 'sales_staff' },
  accounting_staff: { id: 51, role: 'accounting_staff' },
  auditor: { id: 43, role: 'auditor' },
  system_admin: { id: 44, role: 'system_admin' },
  super_admin: { id: 45, role: 'super_admin' },
}
const departmentHeads = { operations: 'operations_head', marketing: 'marketing_head', sales: 'sales_head', accounting: 'accounting_head' }
const getRoleDepartment = (actor) => String(actor?.role || '').split('_').slice(0, -1).join('_') || null

function extractBlock(start, end) {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a + start.length)
  assert.ok(a >= 0 && b > a, `Could not locate ${start} -> ${end}`)
  return source.slice(a, b)
}

const makeFunctions = new Function('DEPARTMENT_STAFF_ROLES', 'DEPARTMENT_HEAD_ROLE', 'getRoleDepartment', 'db', 'pageValues', 'getReviewActionLabel', 'errorMessage', `
  ${extractBlock('const reviewQueueWhere =', 'const canActorOpenReview =')}
  ${extractBlock('const AUDIT_STAGE_STATUSES =', '// Internal Notifications shown')}
  ${extractBlock('export const listOperationalReviews =', 'export const getReviewCenterSummary =').replace('export const listOperationalReviews =', 'const listOperationalReviews =')}
  return { reviewQueueWhere, reviewHistoryWhere, listOperationalReviews }
`)

const pageValues = (query = {}) => ({ page: Math.max(Number(query.page || 1), 1), limit: Math.min(Math.max(Number(query.limit || 25), 1), 100) })

function setup() {
  const queries = []
  const db = { async query(sql, params) {
    queries.push({ sql, params })
    if (/SELECT COUNT\(\*\) total FROM operational_reviews/.test(sql)) return [[{ total: 2 }]]
    return [[{ operational_review_id: 1, action_key: 'network.create', needs_my_action: 0 }]]
  } }
  const fns = makeFunctions(['operations_staff', 'marketing_staff', 'sales_staff', 'accounting_staff'], departmentHeads, getRoleDepartment, db, pageValues, (action) => action, (e) => e.message)
  const respond = () => {
    let status = 200
    let body
    return { res: { status(value) { status = value; return this }, json(value) { body = value; return this } }, result: () => ({ status, body }) }
  }
  return { ...fns, queries, respond }
}

test('History excludes the exact actionable-queue predicate for all 11 workflow roles in BOTH SQL queries', async () => {
  for (const [label, actor] of Object.entries(roles)) {
    const { reviewQueueWhere, reviewHistoryWhere, listOperationalReviews, queries, respond } = setup()
    const queue = reviewQueueWhere(actor)
    const history = reviewHistoryWhere(actor)
    const { res, result } = respond()
    await listOperationalReviews({ query: { scope: 'history', page: '2', limit: '10' }, authUser: actor }, res)
    assert.equal(result().status, 200, label)
    assert.equal(result().body.scope, 'history')
    assert.equal(result().body.pagination.total, 2)
    assert.equal(queries.length, 2)
    const expectedWhere = `WHERE (${history.sql}) AND NOT (${queue.sql})`
    assert.ok(queries[0].sql.includes(expectedWhere), `${label}: count must exclude queue before pagination`)
    assert.ok(queries[1].sql.includes(expectedWhere), `${label}: list must exclude queue before pagination`)
    assert.deepEqual(queries[0].params, [...history.params, ...queue.params], `${label}: count bindings`)
    assert.deepEqual(queries[1].params, [...queue.params, ...history.params, ...queue.params, 10, 10], `${label}: rows bindings`)
    assert.match(queries[1].sql, /ORDER BY r\.updated_at DESC,r\.operational_review_id DESC LIMIT \? OFFSET \?$/)
    assert.equal(result().body.data[0].needs_my_action, false)
  }
})

test('Queue remains unchanged, and filtering History by status operates before pagination', async () => {
  const actor = roles.operations_head
  const { reviewQueueWhere, reviewHistoryWhere, listOperationalReviews, queries, respond } = setup()
  const queue = reviewQueueWhere(actor)
  const history = reviewHistoryWhere(actor)
  await listOperationalReviews({ query: { scope: 'queue', page: '1', limit: '10' }, authUser: actor }, respond().res)
  assert.ok(queries[0].sql.includes(`WHERE ${queue.sql}`))
  assert.ok(!queries[0].sql.includes('AND NOT ('))
  queries.length = 0
  const { res, result } = respond()
  await listOperationalReviews({ query: { scope: 'history', status: 'closed', page: '1', limit: '10' }, authUser: actor }, res)
  assert.equal(result().status, 200)
  assert.ok(queries[0].sql.includes(`WHERE (${history.sql}) AND NOT (${queue.sql}) AND r.status IN (?)`))
  assert.deepEqual(queries[0].params, [...history.params, ...queue.params, 'closed'])
  assert.deepEqual(queries[1].params, [...queue.params, ...history.params, ...queue.params, 'closed', 10, 0])
})

test('Client names History correctly and never temporarily displays queue rows as History', () => {
  assert.match(client, />History<\/button>/)
  assert.doesNotMatch(client, /History &amp; Tracking/)
  assert.match(client, /Needs My Action/)
  assert.match(client, /reviewScope === 'history' \? 'View' : 'Open'/)
  assert.match(client, /reviewScope === 'history' \? <select aria-label="Filter History by status"/)
  assert.doesNotMatch(client, /placeholderData:\s*\(previous\) => previous/)
  assert.doesNotMatch(client, /Waiting on you/)
})
