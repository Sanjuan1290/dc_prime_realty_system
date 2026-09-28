import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateDraftPayrollMoney } from '../services/payrollCalculation.service.js'
import { normalizePayrollSettingsSnapshot, validatePayrollSettingsPayload } from '../services/payrollSettings.service.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const payrollService = read('server/services/employeePayroll.service.js')
const finalizationService = read('server/services/payrollFinalization.service.js')
const correctionService = read('server/services/payrollCorrection.service.js')
const settingsService = read('server/services/payrollSettings.service.js')
const controller = read('server/controllers/System/Employees/EmployeePayroll.controller.js')
const router = read('server/routers/System/employeePayroll.routers.js')
const serverPermissions = read('server/config/permissions.js')
const clientPermissions = read('client/src/config/permissions.js')
const recommended = read('server/config/recommendedRolePermissions.js')
const accessControl = read('server/controllers/System/accessControl.controller.js')
const salaryPage = read('client/src/pages/System/EmployeeSalary.jsx')
const settingsModal = read('client/src/components/System/employeeSalaryComponents/PayrollSettingsModal.jsx')
const finalReview = read('client/src/components/System/employeeSalaryComponents/FinalizePayrollModal.jsx')
const salaryDetail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx')
const migration = read('server/migrations/20260928_employee_salary_batch9_payroll_settings.sql')

test('Batch 9 adds Manage Payroll Settings permission across server/client RBAC and recommended Admin + Accounting roles', () => {
  assert.match(serverPermissions, /PAYROLL_SETTINGS_MANAGE:\s*'employee_salary\.settings\.manage'/)
  assert.match(clientPermissions, /PAYROLL_SETTINGS_MANAGE:\s*'employee_salary\.settings\.manage'/)
  assert.match(accessControl, /Manage Payroll Settings'[\s\S]*PERMISSIONS\.PAYROLL_SETTINGS_MANAGE/)
  assert.match(recommended, /PAYROLL_RECEIPT_EXPORT, PERMISSIONS\.PAYROLL_SETTINGS_MANAGE/)
  assert.match(migration, /employee_salary\.settings\.manage/)
})

test('Payroll Settings endpoints are permission-protected and changes are audited', () => {
  assert.match(router, /get\('\/settings', requirePermission\(PERMISSIONS\.PAYROLL_SETTINGS_MANAGE\), getEmployeePayrollSettings\)/)
  assert.match(router, /put\('\/settings', requirePermission\(PERMISSIONS\.PAYROLL_SETTINGS_MANAGE\), updateEmployeePayrollSettings\)/)
  assert.match(controller, /title: 'Payroll Settings Changed'/)
  assert.match(controller, /before: result\.before/)
  assert.match(controller, /after: result\.after/)
})

test('Batch 9 migration stores configurable premium rules and a Draft settings snapshot', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS employee_payroll_settings/)
  for (const field of ['regular_ot_multiplier', 'rest_day_ot_multiplier', 'regular_holiday_multiplier', 'regular_holiday_ot_multiplier', 'special_holiday_multiplier', 'special_holiday_ot_multiplier', 'night_differential_percentage', 'mid_period_change_rule']) {
    assert.match(migration, new RegExp(field))
  }
  assert.match(migration, /payroll_settings_snapshot_json JSON NULL/)
})

test('settings values are nullable until company-approved and unsupported mid-period proration is rejected', () => {
  const validated = validatePayrollSettingsPayload({
    regular_ot_multiplier: '',
    rest_day_ot_multiplier: null,
    night_differential_percentage: '10',
    mid_period_change_rule: 'period_boundary_only',
  })
  assert.equal(validated.regular_ot_multiplier, null)
  assert.equal(validated.rest_day_ot_multiplier, null)
  assert.equal(validated.night_differential_percentage, 10)
  assert.equal(validated.mid_period_change_rule, 'period_boundary_only')
  assert.throws(() => validatePayrollSettingsPayload({ mid_period_change_rule: 'calendar_day_proration' }), /No approved mid-period proration formula/)
})

test('configured premium-pay rules calculate OT, rest-day OT, holiday pay and night differential from the existing hourly rate', () => {
  const money = calculateDraftPayrollMoney({
    monthlyBasicSalary: 15000,
    regularWorkingMinutes: 600,
    tardinessAbsenceMinutes: 0,
    periodType: 'first_half',
    riceAllowance: 500,
    transportationAllowance: 500,
    overtimeMinutes: 60,
    restDayOvertimeMinutes: 60,
    regularHolidayMinutes: 60,
    specialHolidayMinutes: 60,
    nightDifferentialMinutes: 60,
    payrollSettings: {
      regular_ot_multiplier: 1.25,
      rest_day_ot_multiplier: 1.30,
      regular_holiday_multiplier: 2.00,
      special_holiday_multiplier: 1.30,
      night_differential_percentage: 10,
    },
  })
  assert.equal(money.hourlyRate, 49.32)
  assert.equal(money.overtimePay, 61.65)
  assert.equal(money.restDayOvertimePay, 64.12)
  assert.equal(money.regularHolidayPay, 98.64)
  assert.equal(money.specialHolidayPay, 64.12)
  assert.equal(money.nightDifferentialPay, 4.93)
  assert.equal(money.netFundRelease, 7793.46)
})

test('unconfigured premium rules remain zero and preserve the original receipt benchmark when no premium hours exist', () => {
  const money = calculateDraftPayrollMoney({
    monthlyBasicSalary: 15000,
    regularWorkingMinutes: 600,
    tardinessAbsenceMinutes: 1255,
    periodType: 'first_half',
    riceAllowance: 500,
    transportationAllowance: 500,
    payrollSettings: normalizePayrollSettingsSnapshot({}),
  })
  assert.equal(money.halfMonthBasic, 7500)
  assert.equal(money.attendanceDeduction, 1031.61)
  assert.equal(money.overtimePay, 0)
  assert.equal(money.netFundRelease, 6468.39)
})

test('Draft payroll snapshots current settings and Final Review rejects a settings revision change until recalculation', () => {
  assert.match(payrollService, /getPayrollSettingsSnapshot/)
  assert.match(payrollService, /payrollSettingsSnapshot: payrollSettings/)
  assert.match(payrollService, /payroll_settings_snapshot_json/)
  assert.match(finalizationService, /payrollSettingsChanged = !payrollSettingsEqual/)
  assert.match(finalizationService, /payroll_settings_changed_since_draft: payrollSettingsChanged/)
  assert.match(finalizationService, /can_finalize: !attendanceChanged && !compensationChanged && !payrollSettingsChanged/)
  assert.match(finalReview, /Payroll Settings changed after this Draft was calculated/)
})

test('Finalized payroll snapshot freezes the exact multiplier revision used by the approved payroll', () => {
  assert.match(finalizationService, /payroll_multipliers: payroll\.payroll_settings_snapshot/)
  assert.match(payrollService, /payroll_settings_snapshot: snapshot\.payroll_multipliers/)
  assert.match(salaryDetail, /Applied Payroll Settings/)
  assert.match(salaryDetail, /settings_revision/)
})

test('formal corrections recalculate with current approved settings and version the Before/After settings snapshot', () => {
  assert.match(correctionService, /getPayrollSettingsSnapshot/)
  assert.match(correctionService, /payrollSettings,/)
  assert.match(correctionService, /payroll_settings_snapshot: payrollSettings/)
  assert.match(correctionService, /payroll_multipliers\.regular_ot_multiplier/)
  assert.match(correctionService, /afterSnapshot: proposed\.snapshot/)
})

test('Payroll Settings UI clearly keeps rates blank until approved and exposes only the supported boundary rule', () => {
  assert.match(salaryPage, /PERMISSIONS\.PAYROLL_SETTINGS_MANAGE/)
  assert.match(salaryPage, /<FiSettings \/>Payroll Settings/)
  assert.match(settingsModal, /Enter only company-approved rates/)
  assert.match(settingsModal, /Leave a field blank until the company confirms it/)
  assert.match(settingsModal, /Payroll Boundary Only — 1st or 16th/)
  assert.match(settingsModal, /current Attendance does not yet expose separate Regular Holiday OT minutes/)
})
