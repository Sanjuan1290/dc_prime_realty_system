import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../controllers/System/workflow.controller.js', import.meta.url), 'utf8')
const code = source.slice(source.indexOf('const MANUAL_RESUBMIT_ACTION_KEYS ='), source.indexOf('export const auditorVerifyReview ='))
  .replace('export const resubmitManualReviewCorrection =', 'const resubmitManualReviewCorrection =')

const withController = (review) => {
  const calls = { updates: [], events: [], notifications: [], audits: [], commits: 0, rollbacks: 0 }
  const conn = {
    async beginTransaction() {},
    async commit() { calls.commits++ },
    async rollback() { calls.rollbacks++ },
    release() {},
    async query(sql, args) { calls.updates.push({ sql, args }); return [{ affectedRows: 1 }] },
  }
  const values = {
    db: { getConnection: async () => conn },
    getOperationalReviewForUpdate: async () => review,
    DEPARTMENT_STAFF_ROLES: ['operations_staff','marketing_staff','accounting_staff','sales_staff'],
    getRoleDepartment: (actor) => actor.role.replace(/_(head|staff)$/, ''),
    canActorSeeReview: async () => true,
    appendReviewEvent: async (_conn, event) => { calls.events.push(event) },
    notifyDepartmentHeads: async (_conn, data) => { calls.notifications.push(data) },
    writeAuditLog: async (_conn, _req, audit) => { calls.audits.push(audit) },
    errorMessage: (err) => err?.message || 'Unknown error',
  }
  const fn = new Function(...Object.keys(values), `${code}\nreturn resubmitManualReviewCorrection`)(...Object.values(values))
  return { fn, calls }
}
const makeReview = (overrides = {}) => ({
  operational_review_id: 60001, review_number: 'REV-00060001',
  action_key: 'listing.import', entity_type: 'lot_project_listing_import',
  entity_label: 'Bailen import', initiated_by_user_id: 11, department: 'operations', lot_project_id: 2,
  status: 'returned_for_correction', ...overrides,
})
const request = (overrides = {}) => ({
  params: { id: '60001' },
  body: { correctionSummary: 'Corrected affected imported units #2 and #4 in Listings, changes saved and auditable.' },
  authUser: { id: 11, role: 'operations_staff' }, ...overrides,
})
const result = () => {
  let code = 200
  let payload
  return { res: { status(n) { code = n; return this }, json(v) { payload = v; return this } }, outcome: () => ({ code, payload }) }
}

test('original Operations Staff can resubmit an imported-listing correction, keeping original snapshots', async () => {
  const { fn, calls } = withController(makeReview())
  const { res, outcome } = result()
  await fn(request(), res)
  assert.equal(outcome().code, 200, JSON.stringify(outcome()))
  assert.equal(calls.commits, 1)
  assert.equal(calls.rollbacks, 0)
  assert.equal(calls.updates.length, 1)
  assert.match(calls.updates[0].sql, /status='pending_head_review'/)
  assert.doesNotMatch(calls.updates[0].sql, /before_snapshot_json|after_snapshot_json/)
  assert.equal(calls.events[0].eventType, 'staff_correction_submitted')
  assert.equal(calls.events[0].metadata.correctionMode, 'manual_follow_up')
  assert.equal(calls.notifications[0].department, 'operations')
  assert.match(calls.audits[0].description, /imported units/)
})

test('different staff member or department cannot resubmit a returned review', async () => {
  for (const actor of [{ id: 18, role: 'operations_staff' }, { id: 11, role: 'sales_staff' }, { id: 11, role: 'operations_head' }]) {
    const { fn, calls } = withController(makeReview())
    const { res, outcome } = result()
    await fn(request({ authUser: actor }), res)
    assert.equal(outcome().code, 403)
    assert.equal(calls.commits, 0)
    assert.equal(calls.events.length, 0)
  }
})

test('manual resubmission denies reviews outside returned stage and editable normal actions', async () => {
  for (const review of [makeReview({ status: 'pending_auditor_review' }), makeReview({ action_key: 'listing.update', entity_type: 'lot_project_listing' })]) {
    const { fn, calls } = withController(review)
    const { res, outcome } = result()
    await fn(request(), res)
    assert.equal(outcome().code, 409)
    assert.equal(calls.commits, 0)
  }
})

test('manual resubmission requires meaningful correction summary', async () => {
  const { fn, calls } = withController(makeReview())
  const { res, outcome } = result()
  await fn(request({ body: { correctionSummary: 'done' } }), res)
  assert.equal(outcome().code, 400)
  assert.equal(calls.events.length, 0)
})
