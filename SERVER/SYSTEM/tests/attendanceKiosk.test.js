import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('attendance kiosk is not mounted on Realty portal and remains feature-gated in HR', () => {
 const system = read('CLIENT/SYSTEM/src/App.jsx')
 const hr = read('CLIENT/HR/src/App.jsx')
 const flags = read('CLIENT/HR/src/config/featureFlags.js')
 const kiosk = read('CLIENT/HR/src/pages/Public/AttendanceKiosk.jsx')
 assert.doesNotMatch(system, /path="\/attendance"/)
 assert.match(hr, /path:'\/kiosk'/)
 assert.match(hr, /HR_FEATURE_FLAGS\.kiosk/)
 assert.match(flags, /kiosk: import\.meta\.env\.DEV/)
 assert.match(kiosk, /attendance-kiosk\/unlock/)
 assert.match(kiosk, /attendance-kiosk\/scan/)
})

test('kiosk API is owned by the independent HR server, gated until staging approval', () => {
 const hr = read('SERVER/HR/server.js')
 const middleware = read('SERVER/HR/middleware/attendanceKiosk.middleware.js')
 const router = read('SERVER/HR/routers/attendanceKiosk.router.js')
 assert.match(hr, /app\.use\('\/api\/v1\/attendance-kiosk',guard,kiosk\)/)
 assert.match(hr, /HR_ENABLE_WRITES/)
 assert.match(router, /requireAttendanceKiosk/)
 assert.match(middleware, /ATTENDANCE_PINCODE/)
})

test('company event participants are paginated at ten employees per page', () => {
  const modal = read('CLIENT/SYSTEM/src/components/System/employeeComponents/AttendanceEventModal.jsx')
  assert.match(modal, /PARTICIPANT_PAGE_SIZE = 10/)
  assert.match(modal, /filteredEmployees\.slice\(start, start \+ PARTICIPANT_PAGE_SIZE\)/)
  assert.match(modal, /Select Page/)
  assert.match(modal, /Showing/)
})

test('employee modal separates human Employee Code from secure Attendance Barcode', () => {
  const modal = read('CLIENT/SYSTEM/src/components/System/employeeComponents/EmployeeModal.jsx')
  const barcode = read('CLIENT/SYSTEM/src/components/System/employeeComponents/Code128Barcode.jsx')
  assert.match(modal, /Employee Code/)
  assert.match(modal, /Attendance Barcode/)
  // A shorter button label must not remove the protected regeneration action.
  assert.match(modal, /Generate New Barcode/)
  assert.match(modal, /onClick=\{regenerateAttendanceBarcode\}/)
  assert.match(modal, /const regenerateAttendanceBarcode = \(\) =>/)
  assert.match(modal, /\/regenerate-barcode/)
  assert.match(modal, /window\.confirm\('Regenerate this employee/)
  assert.match(barcode, /employeeCode/)
  assert.match(barcode, /Print Attendance Barcode/)
})

test('duplicate attendance scans use friendly Already Timed In / Already Timed Out messages', () => {
  const controller = read('SERVER/SYSTEM/controllers/System/Employees/AttendanceSimple.controller.js')
  const kiosk = read('CLIENT/SYSTEM/src/pages/Public/AttendanceKiosk.jsx')
  assert.match(controller, /code: 'ALREADY_TIMED_IN'/)
  assert.match(controller, /No action is needed\./)
  assert.match(controller, /code: 'ALREADY_TIMED_OUT'/)
  assert.match(controller, /code: 'TIME_IN_REQUIRED'/)
  assert.match(kiosk, /title: 'Already Timed In'/)
  assert.match(kiosk, /title: 'Already Timed Out'/)
  assert.doesNotMatch(kiosk, />Attendance not recorded</)
})





