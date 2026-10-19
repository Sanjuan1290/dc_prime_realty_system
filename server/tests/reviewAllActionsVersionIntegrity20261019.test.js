import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getSavedReviewRevisions } from '../../client/src/utils/reviewRevisionHistory.js'
import { REVIEW_ACTIONS } from '../config/reviewActions.js'

const source = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
const snapshot = (status, action, price = 858000) => ({unitCode:'LA-1806',status,netSellingPrice:price,statusTransitionAction:action})
const entry = (from,to,revision,actionKey,oldActionKey,extras={}) => ({
  event_type: 'super_admin_updated_before_audit', actor_user_id: 12, created_at:'2026-10-19 08:10:00',
  metadata_json: JSON.stringify({previousRevision:revision-1,reviewRevision:revision,
    previousActionKey:oldActionKey,latestActionKey:actionKey,
    previousAfterSnapshot:from, nextBeforeSnapshot:from, nextAfterSnapshot:to,...extras}),
})

test('every registered Review Center action uses one evidence-only, multi-version engine', () => {
  const actions = Object.entries(REVIEW_ACTIONS)
  assert.ok(actions.length >= 45)
  const departments = new Set()
  for (const [key, rule] of actions) {
    departments.add(rule.department)
    const before = {entity:rule.entityType, amount:100}
    const after = {entity:rule.entityType, amount:200}
    const history = getSavedReviewRevisions({before,after,actionKey:key})
    assert.deepEqual(history.map(v=>v.revision),[1],key)
    assert.deepEqual(history[0].before,before,key)
    assert.deepEqual(history[0].after,after,key)
    assert.equal(history[0].actionKey,key)
  }
  assert.deepEqual([...departments].sort(),['accounting','marketing','operations','sales'])
})

test('Start Cancellation and Cancel Cancellation show exact operation-before and after, retaining all versions', () => {
  const available = snapshot('available',null)
  const sold = snapshot('sold',null)
  const pending = snapshot('pending_for_cancellation','start_cancellation')
  const active = snapshot('sold','cancel_cancellation')
  const events = [
    entry(sold,pending,2,'cancellation.start','reservation.create',{previousAfterSnapshot:sold}),
    entry(pending,active,3,'cancellation.cancel','cancellation.start',{previousAfterSnapshot:pending}),
  ]
  const history = getSavedReviewRevisions({before:available,after:active,latestRevision:3,events,actionKey:'cancellation.cancel'})
  assert.deepEqual(history.map(v=>v.revision),[3,2,1])
  assert.equal(history[0].before.status,'pending_for_cancellation')
  assert.equal(history[0].after.status,'sold')
  assert.equal(history[0].actionKey,'cancellation.cancel')
  assert.equal(history[1].before.status,'sold')
  assert.equal(history[1].after.status,'pending_for_cancellation')
  assert.equal(history[1].actionKey,'cancellation.start')
  assert.equal(history[2].before.status,'available')
  assert.equal(history[2].after.status,'sold')
  assert.equal(history[2].actionKey,'reservation.create')
})

test('older review uses preceding saved After only with explicit uncertainty label, not claimed immediate Before', () => {
  const initial={status:'sold',price:100}
  const past={status:'pending_for_cancellation',price:100}
  const current={status:'sold',price:100}
  const events=[{metadata_json:JSON.stringify({reviewRevision:2,previousAfterSnapshot:past,previousActionKey:'cancellation.start',latestActionKey:'cancellation.cancel'})}]
  const history=getSavedReviewRevisions({before:initial,after:current,latestRevision:2,events,actionKey:'cancellation.cancel'})
  assert.equal(history[0].before.status,'pending_for_cancellation')
  assert.equal(history[0].beforeEvidence,'prior-saved')
  assert.equal(history[1].before.status,'sold')
  assert.equal(history[1].after.status,'pending_for_cancellation')
})

test('missing legacy evidence stays missing; no historic state invented from latest/current business value', () => {
  const events=[{metadata_json:JSON.stringify({previousRevision:1,reviewRevision:2,previousAfterSnapshot:{status:'old'}})}]
  const versioned=getSavedReviewRevisions({before:null,after:{status:'new',secret:'do not carry back'},latestRevision:2,events})
  assert.equal(versioned[1].before,null)
  assert.equal(versioned[0].before.secret,undefined)
  assert.equal(versioned[0].beforeEvidence,'prior-saved')
  const noHistory=getSavedReviewRevisions({before:{status:'old'},after:{status:'new'},latestRevision:2,events:[]})
  assert.equal(noHistory[0].before,null)
  assert.equal(noHistory[0].beforeEvidence,'missing')
})

test('multi-step revisions preserve per-operation Before rather than the original baseline', () => {
  const events=[entry({value:1},{value:2},2,'listing.edit','listing.create'),entry({value:2},{value:3},3,'listing.edit','listing.edit',{
    previousBeforeSnapshot:{value:0}, originalBaselinePreserved:true,
  })]
  const history=getSavedReviewRevisions({before:{value:0},after:{value:3},latestRevision:3,events,actionKey:'listing.edit'})
  assert.deepEqual(history.map(({before,after})=>[before?.value,after?.value]),[[2,3],[1,2],[0,1]])
})

test('review mutations preserve original snapshots and include revision evidence for routine, head, and returned corrections', () => {
  const op=source('server/services/operationalReview.service.js')
  const workflow=source('server/controllers/System/workflow.controller.js')
  const payment=source('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js')
  for(const file of [op,workflow,payment]) {
    assert.match(file,/previousRevision/)
    assert.match(file,/reviewRevision/)
    assert.match(file,/nextBeforeSnapshot/)
    assert.match(file,/nextAfterSnapshot/)
  }
  assert.match(op,/originalBaselinePreserved: true/)
  assert.match(op,/beforeSnapshot, afterSnapshot, link/)
  const ui=source('client/src/components/Shared/ReviewFormComparison.jsx')
  assert.match(ui,/Action Performed/)
  assert.match(ui,/statusTransitionAction/)
  const page=source('client/src/pages/System/ReviewCenter.jsx')
  assert.match(page,/ReviewVersionedSpecial/)
  assert.match(page,/ReviewFormComparison/)
})

test('Audit Case corrections preserve prior saved evidence as a separate review version, not an overwrite', async () => {
  const {advanceAuditCaseToRecheck} = await import('../services/auditCaseAuthorization.service.js')
  const statements=[]
  const savedEvents=[]
  const connection = {async query(sql,params=[]) {
    statements.push(sql)
    if(sql.includes('FROM operational_reviews') && sql.includes('FOR UPDATE')) return [[{
      revision:1, action_key:'listing.edit', before_snapshot_json:JSON.stringify({price:10}),
      after_snapshot_json:JSON.stringify({price:12}),
    }]]
    if(sql.includes('INSERT INTO operational_review_events')) savedEvents.push({metadata:JSON.parse(params[7]),eventType:params[1]})
    if(sql.trimStart().startsWith('INSERT')) return [{insertId:123,affectedRows:1}]
    if(sql.trimStart().startsWith('UPDATE')) return [{affectedRows:1}]
    return [[]]
  }}
  const result = await advanceAuditCaseToRecheck(connection, {
    auditCase:{audit_case_id:91,operational_review_id:27,correction_role:'system_admin',case_number:'CASE-91'},
    actor:{id:5,role:'system_admin'},correctionSummary:'Corrected saved price',afterSnapshot:{price:13},
  })
  assert.equal(result.status,'pending_auditor_recheck')
  assert.ok(statements.some(sql=>/revision=revision\+1/.test(sql)))
  const event=savedEvents.find(x=>x.eventType==='controlled_correction_applied')
  assert.ok(event,'correction must have immutable event evidence')
  assert.deepEqual(JSON.parse(event.metadata.previousAfterSnapshot),{price:12})
  assert.equal(event.metadata.latestActionKey,'audit_case.correction')
  const history=getSavedReviewRevisions({before:{price:10},after:{price:13},latestRevision:2,
    actionKey:'listing.edit',events:[{event_type:event.eventType,metadata_json:JSON.stringify(event.metadata)}]})
  assert.deepEqual(history.map(v=>v.after.price),[13,12])
  assert.equal(history[0].before.price,12)
  assert.equal(history[0].beforeEvidence,'prior-saved')
})
