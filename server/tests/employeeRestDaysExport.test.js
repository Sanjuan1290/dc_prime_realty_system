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

  assert.match(migration, /CREATE TABLE IF NOT EXISTS `employee_rest_day_assignments`/)
  assert.match(migration, /'monday'.*'sunday'/s)
  assert.match(migration, /effective_from/)
  assert.match(migration, /effective_to/)
  assert.match(schema, /employeeRestDaysTableSql/)
  assert.match(controller, /normalizeRestDays/)
  assert.match(controller, /createInitialEmployeeRestDays/)
  assert.match(controller, /replaceEmployeeRestDays/)
  assert.match(controller, /restDaysEffectiveFrom/)
})

test('employees UI requires Rest Day selection and exposes Rest Days in the employee table', () => {
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx')
  const employees = read('client/src/pages/System/Employees.jsx')

  assert.match(modal, /Rest Day\(s\) \*/)
  assert.match(modal, /Monday/)
  assert.match(modal, /Sunday/)
  assert.match(modal, /rest_days_effective_from/)
  assert.match(modal, /RD OT/)
  assert.match(employees, /Rest Days/)
  assert.match(employees, /employee\.rest_days/)
})

test('attendance export endpoint and workbook generation are wired into Attendance', () => {
  const router = read('server/routers/System/attendance.routers.js')
  const controller = read('server/controllers/System/Employees/AttendanceExport.controller.js')
  const attendancePage = read('client/src/pages/System/Attendance.jsx')
  const exportModal = read('client/src/components/System/employeeComponents/AttendanceExportModal.jsx')
  const workbook = read('client/src/utils/attendanceExcelExport.js')

  assert.match(router, /\/export-data/)
  assert.match(router, /ATTENDANCE_VIEW/)
  assert.match(controller, /employee_rest_day_assignments|restDayAssignments/)
  assert.match(controller, /scheduledTimeIn: '09:00:00'/)
  assert.match(controller, /scheduledTimeOut: '20:00:00'/)
  assert.match(controller, /breakMinutes: 60/)
  assert.match(controller, /regularWorkingMinutes: 11 \* 60/)
  assert.match(attendancePage, /Export Attendance/)
  assert.match(attendancePage, /AttendanceExportModal/)
  assert.match(exportModal, /Download Excel/)
  assert.match(workbook, /xlsx-js-style/)
  assert.match(workbook, /RD OT/)
  assert.match(workbook, /09:15:00/)
  assert.match(workbook, /book_append_sheet/)
  assert.match(workbook, /one worksheet|active employees/i)
})
