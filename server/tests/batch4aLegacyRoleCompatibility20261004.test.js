import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

const app = read('client/src/App.jsx')
const legacyAdminLayout = read('client/src/layout/adminLayout.jsx')
const createSystemUser = read('client/src/components/System/userComponents/CreateSystemUserModal.jsx')
const usersPage = read('client/src/pages/System/Users.jsx')
const permissions = read('client/src/config/permissions.js')

test('legacy system-role URLs redirect to the migrated Staff/System Admin role routes', () => {
  for (const [legacy, current] of [
    ['admin', 'system_admin'],
    ['marketing', 'marketing_staff'],
    ['sales', 'sales_staff'],
    ['accounting', 'accounting_staff'],
    ['operations', 'operations_staff'],
  ]) {
    assert.match(app, new RegExp(`${legacy}: ['\"]${current}['\"]`))
  }
  assert.match(app, /path=\{`\/portal\/\$\{legacyRole\}\/\*`\}/)
  assert.match(app, /LegacySystemRoleRedirect/)
})

test('legacy Admin layout no longer rejects migrated System Admin accounts', () => {
  assert.doesNotMatch(legacyAdminLayout, /user\.role !== ['\"]admin['\"]/)
  assert.match(legacyAdminLayout, /user\.role !== ['\"]system_admin['\"]/)
  assert.doesNotMatch(legacyAdminLayout, /\/portal\/admin\//)
  assert.match(legacyAdminLayout, /\/portal\/system_admin\//)
  assert.match(legacyAdminLayout, /System Admin · Governance access/)
})

test('system-user authoring UI uses only the new governance role model', () => {
  assert.match(createSystemUser, /SYSTEM_ADMIN_MANAGEABLE_ROLES/)
  assert.match(createSystemUser, /ROLE_LABELS/)
  assert.match(usersPage, /System Admin, Auditor, Department Staff and Department Head accounts/)
  for (const role of ['system_admin', 'auditor', 'marketing_staff', 'marketing_head', 'sales_staff', 'sales_head', 'accounting_staff', 'accounting_head', 'operations_staff', 'operations_head']) {
    assert.match(permissions, new RegExp(`['\"]${role}['\"]`))
  }
})
