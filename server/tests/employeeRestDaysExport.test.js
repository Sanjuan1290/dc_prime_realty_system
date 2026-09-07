import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('employee module stores multiple Rest Days with historical effective dates', () => {
  const migration = read('server/migrations/20260906_employee_rest_days_and_attendance_export.sql')
  const schema = read('server/controllers/System/Employees/employeeModule.shared.js')
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js')
  assert.match(migration, /employee_rest_day_assignments/)
  assert.match(migration, /effective_from/)
  assert.match(migration, /effective_to/)
  assert.match(schema, /employeeRestDaysTableSql/)
  assert.match(controller, /createInitialEmployeeRestDays/)
  assert.match(controller, /replaceEmployeeRestDays/)
})

test('employees UI requires multiple Rest Day selection and shows Rest Days', () => {
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx')
  const employees = read('client/src/pages/System/Employees.jsx')
  assert.match(modal, /Rest Day\(s\) \*/)
  assert.match(modal, /Monday/)
  assert.match(modal, /Sunday/)
  assert.match(modal, /rest_days_effective_from/)
  assert.match(modal, /RD OT/)
  assert.match(employees, /Rest Days/)
})

test('persistent Attendance Settings are wired into attendance and Excel defaults', () => {
  const router = read('server/routers/System/attendance.routers.js')
  const settingsController = read('server/controllers/System/Employees/AttendanceSettings.controller.js')
  const runtime = read('server/controllers/System/Employees/attendanceLite.shared.js')
  const page = read('client/src/pages/System/Attendance.jsx')
  const modal = read('client/src/components/System/employeeComponents/AttendanceSettingsModal.jsx')
  const exportModal = read('client/src/components/System/employeeComponents/AttendanceExportModal.jsx')
  assert.match(router, /\/settings/)
  assert.match(settingsController, /attendance_scheduled_time_in/)
  assert.match(settingsController, /attendance_red_highlight_after/)
  assert.match(runtime, /attendance_regular_work_minutes/)
  assert.match(page, /Attendance Settings/)
  assert.match(page, /AttendanceSettingsModal/)
  assert.match(modal, /Employee Departments & Codes/)
  assert.match(exportModal, /getExportRulesFromSettings/)
  assert.match(exportModal, /Reset to Attendance Settings/)
})

test('attendance export uses saved settings by default but still allows temporary Excel overrides', () => {
  const controller = read('server/controllers/System/Employees/AttendanceExport.controller.js')
  const exportModal = read('client/src/components/System/employeeComponents/AttendanceExportModal.jsx')
  const workbook = read('client/src/utils/attendanceExcelExport.js')
  assert.match(controller, /getAttendanceRuntimeSettings/)
  assert.match(controller, /runtime\.scheduledTimeIn/)
  assert.match(controller, /runtime\.scheduledTimeOut/)
  assert.match(exportModal, /Defaults come from Attendance Settings/)
  assert.match(exportModal, /regularWorkingMinutes: Math\.round\(regularWorkingHours \* 60\)/)
  assert.match(workbook, /breakOverlapSeconds/)
  assert.match(workbook, /remark: 'RD'/)
  assert.doesNotMatch(workbook, /remark: 'RD OT'/)
  assert.match(workbook, /\[h\]:mm:ss/)
})
