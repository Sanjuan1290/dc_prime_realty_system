import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('Excel remarks stay attendance-status only and holiday labels are not repeated into time cells', () => {
  const workbook = read('client/src/utils/attendanceExcelExport.js')
  assert.match(workbook, /remark: 'RD'/)
  assert.match(workbook, /remark: 'A'/)
  assert.match(workbook, /remark: isLate \? 'Late' : 'On Time'/)
  assert.match(workbook, /row\.state === 'holiday'[\s\S]*return \[row\.weekday, toUtcDate\(row\.date\), '', '', '', '', '', '', '', '', '', '', ''\]/)
  assert.doesNotMatch(workbook, /remark: dayTypeText/)
  assert.doesNotMatch(workbook, /remark: 'RD OT'/)
})

test('actual attendance overrides pre-hire N/A and late color turns red only after the red threshold', () => {
  const workbook = read('client/src/utils/attendanceExcelExport.js')
  const timeRead = workbook.indexOf("const timeIn = attendance?.actual_time_in || null")
  const preHireGuard = workbook.indexOf('if (isPreHire && !timeIn && !timeOut)')
  assert.ok(timeRead >= 0 && preHireGuard > timeRead, 'attendance must be read before the pre-hire N/A guard')
  assert.match(workbook, /const isLate = lateSeconds > 0/)
  assert.match(workbook, /timeInSeconds > redAfter/)
  assert.match(workbook, /state: isRedLate \? 'late_red' : 'normal'/)
})

test('manual attendance and corrections expose reasons and attendance details in Audit Logs', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js')
  const modal = read('client/src/components/System/auditLogsComponents/AuditLogDetailsModal.jsx')
  assert.match(controller, /Manual attendance was added for .* Reason:/)
  assert.match(controller, /Attendance time was corrected for .* Reason:/)
  assert.match(controller, /employeeName: employee\.full_name/)
  assert.match(controller, /employeeCode: employee\.employee_code/)
  assert.match(controller, /employeeName: attendance\.full_name/)
  assert.match(controller, /attendanceDate: dateOnly\(attendance\.attendance_date\)/)
  assert.match(modal, /Attendance Details/)
  assert.match(modal, /Attendance Date/)
  assert.match(modal, /Previous Time In/)
  assert.match(modal, /New Time Out/)
  assert.match(modal, /log\.metadata\?\.reason/)
})

test('Attendance Settings uses a separate required Add Department modal with stable row keys', () => {
  const modal = read('client/src/components/System/employeeComponents/AttendanceSettingsModal.jsx')
  assert.match(modal, /AddDepartmentModal/)
  assert.match(modal, /Department Name \*/)
  assert.match(modal, /Employee Code Prefix \*/)
  assert.match(modal, /Department Name is required/)
  assert.match(modal, /Employee Code Prefix is required/)
  assert.match(modal, /_rowId/)
  assert.doesNotMatch(modal, /key=\{`\$\{item\.name/)
})

test('Excel Tardiness includes one full regular workday for every absent scheduled day', () => {
  const workbook = read('client/src/utils/attendanceExcelExport.js')
  assert.match(workbook, /const regularWorkingSeconds = Number\(schedule\.regularWorkingMinutes \|\| 600\) \* 60/)
  assert.match(workbook, /row\.absence \? regularWorkingSeconds : 0/)
  assert.match(workbook, /const requiredHours = scheduledDays \* regularWorkingSeconds/)
})
