import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_ROLES,
  SUPER_ADMIN_ROLES,
  getProtectedRouteDecision,
} from '../src/auth/routeAccess.js'

const activeUser = (role = 'admin', overrides = {}) => ({
  id: 1,
  email: `${role}@example.test`,
  role,
  must_change_password: false,
  ...overrides,
})

test('protected routes wait for the current-session check before rendering', () => {
  assert.equal(
    getProtectedRouteDecision({ isLoading: true, allowedRoles: ADMIN_ROLES }),
    'loading'
  )
})

test('logged-out and expired sessions return to login', () => {
  assert.equal(
    getProtectedRouteDecision({ user: null, allowedRoles: ADMIN_ROLES }),
    'login'
  )

  assert.equal(
    getProtectedRouteDecision({ isError: true, user: activeUser(), allowedRoles: ADMIN_ROLES }),
    'login'
  )
})

test('temporary-password accounts are sent to password change first', () => {
  assert.equal(
    getProtectedRouteDecision({
      user: activeUser('admin', { must_change_password: true }),
      allowedRoles: ADMIN_ROLES,
    }),
    'change-password'
  )
})

test('admin cannot open a super-admin-only page', () => {
  assert.equal(
    getProtectedRouteDecision({ user: activeUser('admin'), allowedRoles: SUPER_ADMIN_ROLES }),
    'forbidden'
  )
})

test('super admin and admin can open shared management routes', () => {
  assert.equal(
    getProtectedRouteDecision({ user: activeUser('super_admin'), allowedRoles: ADMIN_ROLES }),
    'allow'
  )

  assert.equal(
    getProtectedRouteDecision({ user: activeUser('admin'), allowedRoles: ADMIN_ROLES }),
    'allow'
  )
})

test('browser-back access after logout is blocked when the cache has no user', () => {
  const decisionAfterLogout = getProtectedRouteDecision({
    user: null,
    allowedRoles: ADMIN_ROLES,
  })

  assert.equal(decisionAfterLogout, 'login')
})
