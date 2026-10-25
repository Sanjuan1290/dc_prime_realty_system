import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { signedReceiptErrorResponse } from '../services/employeePayrollReceiptErrors.service.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const controller = read('server/controllers/System/Employees/EmployeePayrollSignedReceipts.controller.js')
const modal = read('client/src/components/System/employeeSalaryComponents/SignedSalaryReceiptsModal.jsx')
const release = read('client/src/components/System/employeeSalaryComponents/ReleasePayrollModal.jsx')
const detail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx')
const page = read('client/src/pages/System/EmployeeSalary.jsx')
const receiptModal = read('client/src/components/System/employeeSalaryComponents/FundReleaseReceiptModal.jsx')

test('GET signed receipts uses real finalized_snapshot_json column, not nonexistent finalized_snapshot', () => {
  assert.match(controller, /SELECT employee_payroll_id, employee_id, payroll_status, finalized_snapshot_json FROM employee_payrolls/)
  assert.match(controller, /!record\.finalized_snapshot_json/)
  assert.doesNotMatch(controller, /SELECT employee_payroll_id, employee_id, payroll_status, finalized_snapshot FROM/)
})
test('missing receipt table returns actionable 503, not a vague HTTP 500', () => {
  const result = signedReceiptErrorResponse({ code: 'ER_NO_SUCH_TABLE', errno: 1146 })
  assert.equal(result.status, 503)
  assert.equal(result.code, 'SALARY_RECEIPTS_SETUP_REQUIRED')
  assert.match(result.message, /install.*database update/i)
})
test('unknown columns return schema warning and other errors hide technical details', () => {
  assert.equal(signedReceiptErrorResponse({ code: 'ER_BAD_FIELD_ERROR', errno: 1054 }).code, 'SALARY_RECEIPTS_SCHEMA_MISMATCH')
  const error = signedReceiptErrorResponse(new Error('password=root@private-db'))
  assert.equal(error.status, 500)
  assert.doesNotMatch(error.message, /private-db/)
  assert.equal(signedReceiptErrorResponse({ statusCode: 403, message: 'Forbidden' }).status, 403)
})
test('Payroll release retains actual date, witness and notes without old reference input or verbose cards', () => {
  assert.match(release, /release_date: releaseDate/)
  assert.match(release, /release_witness_name: witnessName\.trim\(\)/)
  assert.match(release, /release_notes: notes\.trim\(\)/)
  assert.doesNotMatch(release, /<span[^>]*>Reference<\/span>|release_reference:|Actual Release Date may differ|Official snapshot stays immutable|After the release is recorded, the system opens/)
  assert.equal((release.match(/Released Date \*/g) || []).length, 1)
})
test('Both Salary access points label document tool Receipts and retain permissions', () => {
  assert.match(detail, /Receipts<\/button>/)
  assert.match(page, /title="Receipts"/)
  assert.match(detail, /canUpload=\{canRelease\} canPrint=\{canPrintReceipt\} canExport=\{canExportReceipt\}/)
  assert.match(page, /canUpload=\{canRelease\} canPrint=\{canPrintReceipt\} canExport=\{canExportReceipt\}/)
})
test('Receipts distinguishes official acknowledgment and uploaded scanned copies', () => {
  assert.match(modal, /Official Acknowledgment/)
  assert.match(modal, /Uploaded Signed Copies/)
  assert.match(modal, /<FundReleaseReceiptModal/)
  assert.match(modal, /scanStatus !== 'approved'/)
  assert.match(modal, /canPrint && <button/)
  assert.match(modal, /canExport && <button/)
  assert.match(modal, /canUpload && <button/)
  assert.match(receiptModal, /z-\[130\]/)
})
test('Failed receipt loading does not imply zero stored files or enable uploads', () => {
  assert.match(modal, /loadFailed \? 'Unavailable'/)
  assert.match(modal, /!loading && !loadFailed && files\.length === 0/)
  assert.match(modal, /canUpload && !loadFailed && !loading && files\.length < 5/)
  assert.match(modal, /Couldn't load uploaded receipts/)
})
test('Signed files are fetched over authenticated API and only signed Cloudinary uploads bypass it', () => {
  assert.match(modal, /requestApiBlob\(item\.contentPath/)
  assert.match(modal, /fetch\(signed\.uploadUrl, \{ method: 'POST'/)
  assert.match(modal, /confirmationHandled: 'compact'/)
  assert.match(controller, /sendAuthenticatedAssetContent/)
  assert.doesNotMatch(modal, /res\.cloudinary\.com/)
})
