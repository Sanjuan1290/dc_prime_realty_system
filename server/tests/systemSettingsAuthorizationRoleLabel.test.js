import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getSettingsAuthorizationLabel } from '../../client/src/utils/settingsAuthorizationRole.js'

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('System Settings password label reflects the current signed-in role', () => {
  assert.equal(getSettingsAuthorizationLabel('super_admin'), 'Super Admin')
  assert.equal(getSettingsAuthorizationLabel('system_admin'), 'System Admin')
  assert.equal(getSettingsAuthorizationLabel('auditor'), 'Current Account')
  assert.equal(getSettingsAuthorizationLabel(undefined), 'Current Account')
})

test('System Settings passes the authenticated actor role to the authorization modal', () => {
  const page = source('client/src/pages/System/Settings.jsx')
  assert.match(page, /const actor = currentUserData\?\.user \|\| \{\}/)
  assert.match(page, /authorizationLabel=\{getSettingsAuthorizationLabel\(actor\.role\)\}/)
  assert.match(page, /codeEndpoint="\/system-settings\/code"/)
})

test('Authorization dialog uses one role-aware label for error, input and verification email', () => {
  const modal = source('client/src/components/Shared/SettingsAuthorizationModal.jsx')
  assert.match(modal, /authorizationLabel = 'Current Account'/)
  assert.match(modal, /\{authorizationLabel\} Password \*/)
  assert.match(modal, /\$\{authorizationLabel\} password is required/)
  assert.match(modal, /authorizationLabel\.toLowerCase\(\)/)
})

test('Server requires each signed-in owner account to enter their own password', () => {
  const routes = source('server/routers/System/systemSettings.routers.js')
  const middleware = source('server/middleware/auth.middleware.js')
  assert.match(routes, /requireExactRole\('super_admin', 'system_admin'\)/)
  assert.match(routes, /requireCurrentPassword\(\{ field: 'password'/)
  assert.match(middleware, /req\.authUser\?\.password_hash/)
  assert.match(middleware, /bcrypt\.compare\(password, passwordHash\)/)
})
