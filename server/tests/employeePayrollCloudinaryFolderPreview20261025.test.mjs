import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const ui = read('client/src/components/System/employeeSalaryComponents/SignedSalaryReceiptsModal.jsx')
const service = read('server/services/secureCloudinary.service.js')
const controller = read('server/controllers/System/Employees/EmployeePayrollSignedReceipts.controller.js')
const schema = read('server/migrations/20261025_employee_payroll_signed_receipts.sql')

test('Cloudinary asset_folder uses the exact folder returned by the signed backend response', () => {
  assert.match(service, /asset_folder:\s*folder/)
  assert.match(service, /buildSignatureResponse\([\s\S]*?folder,/)
  assert.match(service, /\n\s*folder,\n\s*type: 'authenticated'/)
  assert.match(ui, /form\.append\('asset_folder', signed\.folder\)/)
  assert.doesNotMatch(ui, /form\.append\('asset_folder', signed\.assetFolder\)/)
  assert.match(ui, /if \(!signed\.folder \|\| !signed\.signature/)
})

test('Cloudinary signature mismatch text is not displayed with signed metadata', () => {
  assert.match(ui, /\/invalid signature\/i\.test\(cloudMessage\)/)
  assert.doesNotMatch(ui, /throw new Error\(result\?\.error\?\.message/)
  assert.match(ui, /Receipt upload verification failed/)
})

test('uploaded file preview uses protected API blobs and waits for approved security scans', () => {
  assert.match(ui, /requestApiBlob\(item\.contentPath/)
  assert.match(ui, /item\.scanStatus !== 'approved'/)
  assert.match(ui, /Uploaded Receipt Preview/)
  assert.match(ui, /<iframe title=\{`Preview of/)
  assert.match(ui, /<img src=\{preview\.url\}/)
  assert.match(ui, /URL\.createObjectURL\(file\)/)
  assert.match(ui, /revokeProtectedObjectUrl\(previewUrlRef\.current\)/)
  assert.match(ui, /canPrint && <button/)
  assert.match(ui, /canExport && <button/)
  assert.doesNotMatch(ui, /res\.cloudinary\.com/)
})

test('signed receipt upload stays payroll-scoped and storage is authenticated', () => {
  assert.match(controller, /payrollReceiptFolder\(payroll\.employee_id, payrollId\)/)
  assert.match(controller, /verifyAuthenticatedCloudinaryAsset\(/)
  assert.match(controller, /MAX_SIGNED_PAYROLL_FILES = 5/)
  assert.match(schema, /employee_payroll_signed_receipts/)
  assert.match(service, /type: 'authenticated'/)
})
