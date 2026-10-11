import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const correctionService = read('server/services/payrollCorrection.service.js')
const payrollService = read('server/services/employeePayroll.service.js')
const finalizationService = read('server/services/payrollFinalization.service.js')
const releaseService = read('server/services/payrollRelease.service.js')
const controller = read('server/controllers/System/Employees/EmployeePayroll.controller.js')
const router = read('server/routers/System/employeePayroll.routers.js')
const serverPermissions = read('server/config/permissions.js')
const clientPermissions = read('client/src/config/permissions.js')
const recommended = read('server/config/recommendedRolePermissions.js')
const accessControl = read('server/controllers/System/accessControl.controller.js')
const salaryPage = read('client/src/pages/System/EmployeeSalary.jsx')
const salaryDetail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx')
const correctionModal = read('client/src/components/System/employeeSalaryComponents/CorrectPayrollModal.jsx')
const historyModal = read('client/src/components/System/employeeSalaryComponents/SalaryHistoryModal.jsx')
const migration = read('server/migrations/20260928_employee_salary_batch8_corrections.sql')

test('Batch 8 adds a dedicated Correct Finalized Payroll permission across RBAC and recommended payroll roles', () => {
  assert.match(serverPermissions, /PAYROLL_CORRECT_FINALIZED:\s*'employee_salary\.correct_finalized'/)
  assert.match(clientPermissions, /PAYROLL_CORRECT_FINALIZED:\s*'employee_salary\.correct_finalized'/)
  assert.match(accessControl, /Correct Finalized Payroll'[\s\S]*PERMISSIONS\.PAYROLL_CORRECT_FINALIZED/)
  assert.match(recommended, /PAYROLL_FINALIZE, PERMISSIONS\.PAYROLL_CORRECT_FINALIZED, PERMISSIONS\.PAYROLL_RELEASE/)
  assert.match(migration, /employee_salary\.correct_finalized/)
})

test('correction review and submit endpoints are independently permission protected', () => {
  assert.match(router, /get\('\/payrolls\/:employeePayrollId\/correction-review', requirePermission\(PERMISSIONS\.PAYROLL_CORRECT_FINALIZED\), getPayrollCorrectionReview\)/)
  assert.match(router, /post\('\/payrolls\/:employeePayrollId\/corrections', requirePermission\(PERMISSIONS\.PAYROLL_CORRECT_FINALIZED\), correctFinalizedEmployeePayroll\)/)
})

test('Batch 8 migration creates immutable Before/After correction history and Corrected lifecycle status', () => {
  assert.match(migration, /ENUM\('draft','finalized','corrected','released','cancelled'\)/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS employee_payroll_corrections/)
  assert.match(migration, /before_snapshot_json JSON NOT NULL/)
  assert.match(migration, /after_snapshot_json JSON NOT NULL/)
  assert.match(migration, /reason TEXT NOT NULL/)
  assert.match(migration, /review_hash CHAR\(64\) NOT NULL/)
  assert.match(migration, /created_by_user_id INT UNSIGNED NULL/)
})

test('formal correction is Finalized-only, blocks Released payroll, and requires immutable snapshot + reason + actor', () => {
  assert.match(correctionService, /\['finalized', 'corrected'\]\.includes\(status\)/)
  assert.match(correctionService, /Released payroll is historical and cannot be directly rewritten/)
  assert.match(correctionService, /immutable finalized snapshot is required/i)
  assert.match(correctionService, /correction reason with at least 5 characters/i)
  assert.match(correctionService, /Correction authorization requires an authenticated user/)
})

test('correction Final Double-Check uses a review hash so stale proposed values cannot be approved', () => {
  assert.match(correctionService, /const reviewHash = stableHash/)
  assert.match(correctionService, /PAYROLL_CORRECTION_REVIEW_STALE/)
  assert.match(correctionService, /Reopen Salary Correction and review the latest Before vs After values/)
  assert.match(correctionModal, /Final Double-Check — Before vs After/)
  assert.match(correctionModal, /review_hash: review\.review_hash/)
  assert.match(correctionModal, /Final Double-Check confirmed/)
})

test('correction preserves the prior official snapshot in the correction table before replacing active corrected snapshot', () => {
  assert.match(correctionService, /INSERT INTO employee_payroll_corrections[\s\S]*before_snapshot_json[\s\S]*after_snapshot_json/)
  assert.match(correctionService, /JSON\.stringify\(review\.before_snapshot\)/)
  assert.match(correctionService, /JSON\.stringify\(review\.after_snapshot\)/)
  assert.match(correctionService, /SET payroll_status = 'corrected'[\s\S]*finalized_snapshot_json = \?[\s\S]*finalized_attendance_fingerprint = \?/)
  assert.doesNotMatch(correctionService, /DELETE FROM employee_payroll_corrections/)
})

test('correction proposal consumes current Attendance + effective compensation and reuses the approved payroll calculation engine', () => {
  assert.match(correctionService, /getPayrollAttendanceSummary/)
  assert.match(correctionService, /getEffectiveCompensationForPeriod/)
  assert.match(correctionService, /calculateDraftPayrollMoney/)
  assert.match(correctionService, /buildFinalizedPayrollSnapshot/)
  assert.match(correctionService, /manualAdditionsTotal[\s\S]*manualDeductionsTotal/)
})

test('corrected official reads are driven by the corrected immutable snapshot, not stale denormalized columns', () => {
  assert.match(payrollService, /overlayFinalizedSnapshot/)
  assert.match(payrollService, /\['finalized', 'corrected', 'released'\]/)
  assert.match(payrollService, /finalized_snapshot_json/)
  assert.match(finalizationService, /\['finalized', 'corrected', 'released'\]/)
})

test('controller writes Payroll Corrected audit log with reason, Before/After totals, and differences', () => {
  assert.match(controller, /export const correctFinalizedEmployeePayroll/)
  assert.match(controller, /title: 'Payroll Corrected'/)
  assert.match(controller, /reason: result\.reason/)
  assert.match(controller, /beforeNetFundRelease/)
  assert.match(controller, /afterNetFundRelease/)
  assert.match(controller, /differences: result\.review\.differences/)
})

test('UI exposes correction workflow only to authorized users and displays Correction History', () => {
  assert.match(salaryPage, /PERMISSIONS\.PAYROLL_CORRECT_FINALIZED/)
  assert.match(salaryPage, /<option value="corrected">Corrected<\/option>/)
  assert.match(salaryDetail, /canCorrect && \['finalized', 'corrected'\]\.includes\(payroll\?\.payroll_status\)/)
  assert.match(salaryDetail, /Correction History/)
  assert.match(salaryDetail, /CorrectPayrollModal/)
  assert.match(historyModal, /canCorrect=\{canCorrect\}/)
})

test('Corrected payroll remains official and can still be released, while Released payroll cannot be corrected', () => {
  assert.match(releaseService, /\['finalized', 'corrected'\]\.includes\(status\)/)
  assert.match(releaseService, /payroll_status IN \('finalized','corrected'\)/)
  assert.match(salaryDetail, /canRelease && \['finalized', 'corrected'\]\.includes\(payroll\?\.payroll_status\)/)
  assert.match(correctionService, /RELEASED_PAYROLL_CORRECTION_BLOCKED/)
})

