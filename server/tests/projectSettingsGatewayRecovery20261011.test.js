import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { projectSettingsMatchPayload } from '../../client/src/utils/projectSettingsSaveStatus.js'
import { safeAvailabilityMessage } from '../../client/src/utils/availabilityMessage.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = (relative) => readFileSync(path.join(root, relative), 'utf8')
const settings = source('client/src/pages/Lot_Projects/Settings.jsx')
const auth = source('client/src/components/Lot_Projects/SettingsComponents/ProjectSettingsAuthorizationModal.jsx')
const api = source('client/src/utils/apiClient.js')
const backend = source('server/controllers/Lot_Projects/Settings/Settings.controller.js')

const submitted = {
  releaseDayOne: 7, releaseDayTwo: 22,
  reservationContactName: 'Reservation Assistance',
  reservationContactEmail: 'reservation@example.com',
  reservationContactNumber: '09123456789',
  companyName: 'D&C Prime Realty',
  companyEmail: 'admin@example.com',
  companyContactNumber: '09999999999',
  paymentEntryEmailNotificationEnabled: true,
}

test('read-back confirmation accepts fully saved settings despite number/string conversion', () => {
  assert.equal(projectSettingsMatchPayload({ ...submitted, releaseDayOne: '7', releaseDayTwo: '22', paymentEntryEmailNotificationEnabled: 1 }, submitted), true)
})

test('read-back confirmation never claims success for a changed email or notification switch', () => {
  assert.equal(projectSettingsMatchPayload({ ...submitted, companyEmail: 'old@example.com' }, submitted), false)
  assert.equal(projectSettingsMatchPayload({ ...submitted, paymentEntryEmailNotificationEnabled: 0 }, submitted), false)
  assert.equal(projectSettingsMatchPayload(null, submitted), false)
  assert.equal(projectSettingsMatchPayload(submitted, null), false)
})

test('Cloudflare 502 HTML is not displayed to users, including legacy session messages', () => {
  const page = '<!DOCTYPE html><html><head><title>502: Bad gateway</title></head><body>private proxy details</body></html>'
  assert.doesNotMatch(safeAvailabilityMessage(page), /html|private proxy|Cloudflare Ray ID/i)
  assert.match(safeAvailabilityMessage('The server could not be reached.'), /server could not/)
})

test('gateway errors do not navigate away from a mutation or expose HTML', () => {
  assert.match(api, /shouldRedirectOnUnavailable = \(method, redirectOnUnavailable\)/)
  assert.match(api, /\['GET', 'HEAD'\]\.includes/)
  assert.match(api, /text\\\/html|html/i)
  assert.match(api, /API server is temporarily unavailable/)
  assert.match(source('client/src/pages/System/ServerDown.jsx'), /safeAvailabilityMessage/)
})

test('settings save stays in authorization dialog and checks current saved values without retrying mutation', () => {
  assert.match(settings, /redirectOnUnavailable: false/)
  assert.match(settings, /onError: async \(mutationError, submittedSettings\)/)
  assert.match(settings, /projectSettingsMatchPayload\(latest\?\.data, submittedSettings\)/)
  assert.match(settings, /queryClient\.setQueryData/)
  assert.match(settings, /saveNotice=\{/)
  assert.doesNotMatch(settings, /retry: 3/)
  assert.match(auth, /saveNotice = null/)
  assert.match(auth, /\{saveNotice \? <StatusAlert/)
  assert.match(auth, /confirmationHandled: 'technical', redirectOnUnavailable: false/)
})

test('project settings never perform database DDL in normal GET or save requests', () => {
  assert.doesNotMatch(backend, /ALTER TABLE lot_project_settings/)
  assert.match(backend, /columnExists\(connection, 'lot_project_settings', 'payment_entry_email_notification_enabled'\)/)
  assert.match(backend, /PROJECT_PAYMENT_NOTIFICATION_SCHEMA_MISSING/)
  assert.match(source('server/migrations/20260927_project_payment_entry_notifications.sql'), /ALTER TABLE lot_project_settings/)
})

test('payment notification validation and protected settings authorization still exist', () => {
  assert.match(backend, /PROJECT_COMPANY_EMAIL_REQUIRED_FOR_PAYMENT_NOTIFICATIONS/)
  assert.match(backend, /verifyAndConsumeSensitiveAction/)
  assert.match(backend, /createOperationalReview/)
  assert.match(auth, /getSettingsAuthorizationLabel/)
})

