import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getSettingsAuthorizationLabel } from '../../../CLIENT/SYSTEM/src/utils/settingsAuthorizationRole.js'

const src = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
const project = src('CLIENT/SYSTEM/src/components/Lot_Projects/SettingsComponents/ProjectSettingsAuthorizationModal.jsx')
const payment = src('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx')
const reservation = src('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/ReservationCorrection/ReservationCorrectionModal.jsx')
const commission = src('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/RecalculateCommissionModal.jsx')
const archive = src('CLIENT/SYSTEM/src/components/System/auditLogsComponents/ArchiveAuditLogsModal.jsx')
const archivePage = src('CLIENT/SYSTEM/src/pages/System/AuditLogs.jsx')

test('administrator label is derived from the authenticated role, not the authorization flow name', () => {
  assert.equal(getSettingsAuthorizationLabel('system_admin'), 'System Admin')
  assert.equal(getSettingsAuthorizationLabel('super_admin'), 'Super Admin')
  assert.equal(getSettingsAuthorizationLabel('operations_staff'), 'Current Account')
})

test('project settings role name changes in emergency title, password and code email, but remains owner-verified', () => {
  assert.match(project, /actorRole === 'system_admin' \? 'System Admin Emergency Override' : 'Super Admin Emergency Override'/)
  assert.match(project, /const isOwner = \['super_admin', 'system_admin'\]\.includes\(actorRole\)/)
  assert.match(project, /const isEmergencyOwner = isOwner && !\(Number\(auditCaseId \|\| 0\) > 0\)/)
  assert.match(project, /const administratorLabel = getSettingsAuthorizationLabel\(actorRole\)/)
  assert.match(project, /\{administratorLabel\} Password \*/)
  assert.match(project, /placeholder=\{`Enter \$\{administratorLabel\} password`\}/)
  assert.match(project, /`your \$\{administratorLabel\} email`/)
  assert.match(project, /password: isEmergencyOwner \? password : undefined/)
  assert.match(project, /auditCaseId: isAuditCaseCorrection \? Number\(auditCaseId\) : undefined/)
  assert.doesNotMatch(project, /<FiLock \/> Super Admin Password/)
})

test('payment correction uses signed-in administrator role for its password and email text', () => {
  assert.match(payment, /const administratorLabel = getSettingsAuthorizationLabel\(actorRole\)/)
  assert.match(payment, /\{administratorLabel\} Password \*/)
  assert.match(payment, /`your \$\{administratorLabel\} email`/)
  assert.doesNotMatch(payment, />Super Admin Password/)
})

test('reservation correction uses role-specific text without changing emergency/case logic', () => {
  assert.match(reservation, /const emergencyMode = isOwner && !caseMode/)
  assert.match(reservation, /const administratorLabel = getSettingsAuthorizationLabel\(actorRole\)/)
  assert.match(reservation, /\{administratorLabel\} Password \*/)
  assert.match(reservation, /`your \$\{administratorLabel\} email`/)
  assert.match(reservation, /password: emergencyMode \? superAdminPassword : undefined/)
})

test('commission adjustment uses administrator role for emergency guidance and password', () => {
  assert.match(commission, /const administratorLabel = getSettingsAuthorizationLabel\(actorRole\)/)
  assert.match(commission, /`\$\{administratorLabel\} emergency access requires password and email verification\.`/)
  assert.match(commission, /placeholder=\{`Enter \$\{administratorLabel\} password`\}/)
})

test('audit archive receives the authenticated actor role and shows their own password label', () => {
  assert.match(archivePage, /actorRole=\{currentUserData\?\.user\?\.role\}/)
  assert.match(archive, /actorRole = ''/)
  assert.match(archive, /const administratorLabel = getSettingsAuthorizationLabel\(actorRole\)/)
  assert.match(archive, /\{administratorLabel\} password/)
  assert.match(archive, /placeholder=\{`Enter \$\{administratorLabel\} password`\}/)
  assert.match(archivePage, /\['super_admin', 'system_admin'\]\.includes\(currentUserData\?\.user\?\.role\)/)
})

test('privileged deletion UI is not loosened by role-only wording changes', () => {
  const listingPage = src('CLIENT/SYSTEM/src/pages/Lot_Projects/ListingProfile.jsx')
  assert.match(listingPage, /canPermanentlyDelete=\{currentUserData\?\.user\?\.role === 'super_admin'\}/)
  const backend = src('SERVER/SYSTEM/controllers/Lot_Projects/Settings/Settings.controller.js')
  assert.match(backend, /roleHasPermission|canEditProjectSettings/)
})



