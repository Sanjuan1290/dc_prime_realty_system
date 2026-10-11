import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { markVisibleInternalNotificationsRead } from '../services/internalNotificationRead.service.js'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const visibility = {
  join: 'LEFT JOIN operational_reviews nr ON nr.operational_review_id=n.operational_review_id',
  sql: '(nr.status = ? AND n.notification_type = ?)',
  params: ['returned_for_correction', 'review_returned'],
}

test('read-all marks EVERY visible unread notification, even beyond the UI first page of 100; never writes reviews', async () => {
  const ids = Array.from({ length: 237 }, (_, i) => ({ internal_notification_id: i + 1 }))
  const updates = []
  const conn = { async query(sql, params) {
    if (sql.startsWith('SELECT')) {
      assert.match(sql, /SELECT n\.internal_notification_id FROM internal_notifications n LEFT JOIN operational_reviews nr/)
      assert.match(sql, /n\.user_id=\? AND n\.read_at IS NULL AND \(nr\.status = \? AND n\.notification_type = \?\)/)
      assert.deepEqual(params, [73, 'returned_for_correction', 'review_returned'])
      return [ids]
    }
    assert.match(sql, /^UPDATE internal_notifications SET read_at=NOW\(\) WHERE user_id=\? AND read_at IS NULL AND internal_notification_id IN/)
    assert.deepEqual(params[0], 73)
    assert.ok(params.length <= 51)
    updates.push(params.slice(1))
    return [{ affectedRows: params.length - 1 }]
  } }
  const total = await markVisibleInternalNotificationsRead(conn, 73, visibility, 50)
  assert.equal(total, 237)
  assert.equal(updates.length, 5)
  assert.deepEqual(updates.flat(), ids.map(row => row.internal_notification_id))
})

test('read-all does nothing when no visible unread notifications exist', async () => {
  let queries = 0
  const conn = { async query(sql) { queries++; assert.match(sql, /^SELECT/); return [[]] } }
  assert.equal(await markVisibleInternalNotificationsRead(conn, 73, visibility), 0)
  assert.equal(queries, 1)
})

test('read-all rejects bad actor or visibility and deduplicates ids', async () => {
  await assert.rejects(() => markVisibleInternalNotificationsRead({}, 0, visibility), /authenticated user/)
  await assert.rejects(() => markVisibleInternalNotificationsRead({}, 73, null), /visibility/)
  let count = 0
  const conn = { async query(sql, params) {
    if (sql.startsWith('SELECT')) return [[{internal_notification_id:22},{internal_notification_id:22},{internal_notification_id:23},{internal_notification_id:null}]]
    count++
    assert.deepEqual(params, [73,22,23])
    return [{affectedRows:2}]
  } }
  assert.equal(await markVisibleInternalNotificationsRead(conn, 73, visibility),2)
  assert.equal(count,1)
})

test('read-all controller uses transaction and rolls back on failure, and hides DB details', async () => {
  const src = read('server/controllers/System/workflow.controller.js')
  const slice = src.slice(src.indexOf('export const markAllInternalNotificationsRead ='), src.indexOf('const caseNumber ='))
    .replace('export const markAllInternalNotificationsRead =', 'const markAllInternalNotificationsRead =')
  assert.ok(slice.includes('markVisibleInternalNotificationsRead'))
  const logs = []
  const conn = { async beginTransaction(){logs.push('begin')}, async commit(){logs.push('commit')}, async rollback(){logs.push('rollback')}, release(){logs.push('release')} }
  let fail = false
  const withMock = new Function('db','notificationVisibilityWhere','markVisibleInternalNotificationsRead','console', `${slice}\nreturn markAllInternalNotificationsRead`)
  const fn = withMock({getConnection: async()=>conn},()=>visibility, async(_c,id,access)=>{ assert.equal(id,73); assert.equal(access,visibility); if(fail) throw new Error('Sensitive SQL detail');return 8 }, {error:()=>{}})
  const result = () => { let status=200; let body; return { res:{status(n){status=n;return this},json(x){body=x;return this}},outcome:()=>({status,body})} }
  const good = result()
  await fn({authUser:{id:73}},good.res)
  assert.deepEqual(good.outcome(),{status:200,body:{message:'8 notifications marked as read.',markedCount:8}})
  assert.deepEqual(logs,['begin','commit','release'])
  logs.length=0
  fail=true
  const bad=result()
  await fn({authUser:{id:73}},bad.res)
  assert.equal(bad.outcome().status,500)
  assert.doesNotMatch(bad.outcome().body.message,/Sensitive SQL detail/)
  assert.deepEqual(logs,['begin','rollback','release'])
})

test('authenticated PATCH route and UI provide individual and bulk controls, without mutating review status', () => {
  const router = read('server/routers/System/workflow.routers.js')
  const controller = read('server/controllers/System/workflow.controller.js')
  const client = read('client/src/pages/System/ReviewCenter.jsx')
  assert.match(router, /router\.patch\('\/notifications\/read-all',requirePermission\(PERMISSIONS\.WORKFLOW_REVIEW_CENTER_VIEW\),markAllInternalNotificationsRead\)/)
  assert.match(router, /router\.patch\('\/notifications\/:id\/read',requirePermission\(PERMISSIONS\.WORKFLOW_REVIEW_CENTER_VIEW\),markInternalNotificationRead\)/)
  assert.ok(router.indexOf("'/notifications/read-all'") < router.indexOf("'/notifications/:id/read'"))
  assert.match(controller, /const access = notificationVisibilityWhere\(req\.authUser\)/)
  assert.match(client, /Mark All as Read/)
  assert.match(client, /Mark as Read/)
  assert.match(client, /const notificationBusy = markRead\.isPending \|\| markAllRead\.isPending/)
  assert.match(client, /await Promise\.all\(\[notifications\.refetch\(\), summary\.refetch\(\)\]\)/)
  assert.match(client, /Marking these read does not complete pending reviews or corrections/)
  assert.match(client, /if \(row\.operational_review_id\) navigate/)
  assert.doesNotMatch(client.slice(client.indexOf('const ReviewCenter = () => {')), /markAllRead\.mutate\([^)]*status/)
})
