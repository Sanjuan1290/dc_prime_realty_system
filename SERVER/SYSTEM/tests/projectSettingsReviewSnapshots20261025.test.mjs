import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const backend = readFileSync(resolve(root, 'SERVER/SYSTEM/controllers/Lot_Projects/Settings/Settings.controller.js'), 'utf8')
const comparison = readFileSync(resolve(root, 'CLIENT/SYSTEM/src/components/Shared/ReviewFormComparison.jsx'), 'utf8')

// Evaluate the unmodified controller functions with mocked dependencies so that
// this regression test exercises the actual settings update handler without
// accessing a real database or email provider.
const helpers = backend.slice(backend.indexOf('const toDay ='), backend.indexOf('export const getLotProjectSettings ='))
const handlerStart = backend.indexOf('export const updateLotProjectSettings =')
const handlerEnd = backend.indexOf('\n};', handlerStart) + 3
const handler = backend.slice(handlerStart, handlerEnd).replace('export const updateLotProjectSettings =', 'globalThis.updateLotProjectSettings =')

function createScenario() {
  const project = {lot_project_id: 7, lot_project_slug: 'prime-enclave-maragondon', lot_project_name: 'Prime Enclave'}
  const actor = {id: 99, role: 'operations_head', email: 'head@example.test'}
  const prior = {
    lot_project_setting_id: 1,
    lot_project_id: project.lot_project_id,
    release_day_one: 7,
    release_day_two: 22,
    reservation_contact_name: 'D&C Prime Realty',
    reservation_contact_email: 'before@example.test',
    reservation_contact_number: '09123456789',
    company_name: 'D&C Prime Realty',
    company_email: 'company@example.test',
    company_contact_number: '0468660616',
    payment_entry_email_notification_enabled: 0,
    lot_project_setting_created_at: '2026-10-25 10:13:00',
    lot_project_setting_updated_at: '2026-10-25 10:13:00',
  }
  let row = { ...prior }
  let inTransaction = false
  const calls = []
  let savedReview = null
  let savedAudit = null
  const connection = {
    async beginTransaction() { calls.push('begin'); inTransaction = true },
    async commit() { calls.push('commit'); inTransaction = false },
    async rollback() { calls.push('rollback'); inTransaction = false },
    release() { calls.push('release') },
    async query(sql, params) {
      if (/SELECT \*/.test(sql) && /FROM lot_project_settings/.test(sql)) {
        calls.push(`read:${inTransaction ? 'tx' : 'outside'}`)
        return [[{...row}]]
      }
      if (/INSERT INTO lot_project_settings/.test(sql)) {
        calls.push('update')
        assert.ok(inTransaction, 'settings write should be inside the transaction')
        row = {
          ...row,
          release_day_one: params[1], release_day_two: params[2],
          reservation_contact_name: params[3], reservation_contact_email: params[4],
          reservation_contact_number: params[5], company_name: params[6],
          company_email: params[7], company_contact_number: params[8],
          payment_entry_email_notification_enabled: params[9],
          lot_project_setting_updated_at: '2026-10-25 10:23:00',
        }
        return [{affectedRows:1}]
      }
      throw new Error(`Unexpected query ${sql}`)
    },
  }
  const context = {
    db: {getConnection: async () => connection},
    getProjectBySlug: async () => project,
    getAuthenticatedUser: async () => actor,
    getUserFullName: () => 'Operations Head',
    getErrorMessage: (e) => e.message,
    tableExists: async () => true,
    columnExists: async () => true,
    toNullable: (value) => value == null || value === '' ? null : value,
    roleHasPermission: () => true,
    PERMISSIONS: {LOT_SETTINGS_MANAGE: 'lot_settings_manage'},
    isOwnerAdministrator: () => false,
    buildSettingsVerificationPayload: () => ({verified: true}),
    LOT_PROJECT_SETTINGS_ACTION: 'lot_project_settings_update',
    assertEntityNotReviewLocked: async () => {},
    createOperationalReview: async (_connection, item) => {
      calls.push('review');
      assert.ok(inTransaction, 'review should be recorded inside the transaction')
      savedReview = item
      return {reviewId:3}
    },
    writeAuditLog: async (_connection, _req, item) => {
      calls.push('audit');
      assert.ok(inTransaction)
      savedAudit = item
    },
    console,
  }
  runInNewContext(`${helpers}\n${handler}`, context)
  const request = {
    params: {projectSlug: project.lot_project_slug},
    authUser: actor,
    body: {
      reason: 'Tested project notification settings',
      releaseDayOne: 7, releaseDayTwo: 22,
      reservationContactName: 'D&C Prime Realty',
      reservationContactEmail: 'after@example.test',
      reservationContactNumber: '09123456789',
      companyName: 'D&C Prime Realty', companyEmail: 'company@example.test',
      companyContactNumber: '0468660616',
      paymentEntryEmailNotificationEnabled: true,
    },
  }
  let statusCode = 200
  let reply
  const response = {
    status(code) { statusCode = code; return this },
    json(value) { reply = value; return this },
  }
  return { run: async () => { await context.updateLotProjectSettings(request, response); return {statusCode,reply,calls,savedReview,savedAudit,prior} } }
}

test('Project Settings stores complete matching Before and After audit snapshots from DB', async () => {
  const {statusCode,reply,calls,savedReview,savedAudit} = await createScenario().run()
  assert.equal(statusCode, 200, reply?.message)
  assert.equal(reply?.success, true)
  assert.equal(savedReview?.actionKey, 'project.settings.update')
  const before = savedReview.beforeSnapshot
  const after = savedReview.afterSnapshot
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort())
  for (const key of ['id','createdAt','lotProjectId','releaseDayOne','releaseDayTwo']) {
    assert.equal(after[key], before[key], `${key} must not appear changed or Not Recorded`)
  }
  assert.equal(before.id, 1)
  assert.equal(after.id, 1)
  assert.equal(before.releaseDayOne, '7')
  assert.equal(after.releaseDayOne, '7')
  assert.equal(before.releaseDayTwo, '22')
  assert.equal(after.releaseDayTwo, '22')
  assert.equal(before.reservationContactEmail, 'before@example.test')
  assert.equal(after.reservationContactEmail, 'after@example.test')
  assert.equal(before.paymentEntryEmailNotificationEnabled, false)
  assert.equal(after.paymentEntryEmailNotificationEnabled, true)
  assert.notEqual(after.updatedAt, before.updatedAt, 'updated timestamp reflects the actual update')
  assert.deepEqual(savedAudit.metadata.before, before)
  assert.deepEqual(savedAudit.metadata.after, after)
  assert.deepEqual(calls, ['begin','read:tx','update','read:tx','review','audit','commit','read:outside','release'])
})

test('Warning applies to any incomplete saved review, without assuming its age', () => {
  assert.match(comparison, /Some fields were not recorded on one side of this review/)
  assert.match(comparison, /They have not been filled in from live data/)
  assert.doesNotMatch(comparison, /Some fields were not recorded in an older review/)
  assert.match(comparison, /!comparable\(field\.key\)/)
})

