import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('notification badge counts payment notices plus document records that need attention', () => {
  const hook = read('client/src/utils/useNotificationBadge.js')
  assert.match(hook, /system-payment-notifications/)
  assert.match(hook, /system-document-notifications/)
  assert.match(hook, /\/notifications\/payment-dues\?category=all/)
  assert.match(hook, /\/notifications\/documents\?category=all/)
  assert.match(hook, /pendingRequiredDocuments/)
  assert.match(hook, /awaitingApprovalDocuments/)
  assert.match(hook, /paymentCount \+ documentCount/)
  assert.match(hook, /refetchInterval:\s*60_000/)
})

test('super admin and admin sidebars display the live Notifications badge only when there are pending items', () => {
  for (const file of ['client/src/layout/SystemLayout.jsx', 'client/src/layout/adminLayout.jsx']) {
    const source = read(file)
    assert.match(source, /useNotificationBadge/)
    assert.match(source, /label: ['\"]Notifications['\"][^\n]*badge: notificationCount/)
    assert.match(source, /Number\(item\.badge \|\| 0\) > 0/)
    assert.match(source, /99\+/)
  }
})

test('reservation and document actions refresh notification badge queries immediately', () => {
  const profile = read('client/src/pages/Lot_Projects/ListingProfile.jsx')
  assert.match(profile, /system-payment-notifications/)
  const documentInvalidations = profile.match(/system-document-notifications/g) || []
  assert.ok(documentInvalidations.length >= 5, 'expected reservation and document mutations to refresh document notification counts')
})

test('marking a payment notification contacted records the clicking user in Audit Logs', () => {
  const controller = read('server/controllers/System/notifications.controller.js')
  const start = controller.indexOf('export const markPaymentDueContacted')
  const end = controller.indexOf('const getDocumentNotificationContext', start)
  const contactedHandler = controller.slice(start, end)

  assert.ok(start >= 0 && end > start, 'expected markPaymentDueContacted handler')
  assert.match(contactedHandler, /sent_by_user_id/)
  assert.match(contactedHandler, /const \[contactLogResult\] = await connection\.query/)
  assert.match(contactedHandler, /writeAuditLog\(connection, req, \{/)
  assert.match(contactedHandler, /actor: user/)
  assert.match(contactedHandler, /action: 'update'/)
  assert.match(contactedHandler, /module: 'Notifications'/)
  assert.match(contactedHandler, /title: 'Marked payment notification as contacted'/)
  assert.match(contactedHandler, /contactedBy: actorName/)

  const backfill = read('server/migrations/20260818_notification_contact_audit_backfill.sql')
  assert.match(backfill, /WHERE notification_log\.send_status = 'contacted'/)
  assert.match(backfill, /existing_audit\.audit_log_id IS NULL/)
  assert.match(backfill, /Marked payment notification as contacted/)
  assert.match(backfill, /notification_log\.sent_by_user_id/)
})

