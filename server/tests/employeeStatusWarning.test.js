import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('employee activation and deactivation require a warning confirmation', () => {
  const page = read('client/src/pages/System/Employees.jsx')

  assert.match(page, /ConfirmActionModal/)
  assert.match(
    page,
    /title=\{`\$\{confirmEmployee\?\.employee_status === 'active' \? 'Deactivate' : 'Activate'\} Employee\?`\}/
  )
  assert.match(
    page,
    /confirmLabel=\{confirmEmployee\?\.employee_status === 'active' \? 'Deactivate Employee' : 'Activate Employee'\}/
  )
  assert.match(page, /no longer be included in active attendance operations or future attendance Excel exports/)
  assert.match(page, /onConfirm=\{\(\) => confirmEmployee && statusMutation\.mutate\(confirmEmployee\)\}/)
})
