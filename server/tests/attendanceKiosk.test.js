import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('public /attendance route renders the attendance-only kiosk', () => {
  const app = read('client/src/App.jsx')
  const kiosk = read('client/src/pages/Public/AttendanceKiosk.jsx')
  assert.match(app, /path="\/attendance" element={<AttendanceKiosk\s*\/>}/)
  assert.match(kiosk, /attendance-kiosk\/unlock/)
  assert.match(kiosk, /attendance-kiosk\/scan/)
  assert.match(kiosk, /Scan with Camera/)
  assert.match(kiosk, /No employee management, calendar, reports, or admin controls/)
})

test('attendance kiosk API is PIN gated and separate from admin attendance routes', () => {
  const server = read('server/server.js')
  const router = read('server/routers/attendanceKiosk.router.js')
  const middleware = read('server/middleware/attendanceKiosk.middleware.js')
  const env = read('server/.env.example')

  assert.match(server, /app\.use\('\/api\/v1\/attendance-kiosk', attendanceKioskRouter\)/)
  assert.match(router, /router\.post\('\/scan', requireAttendanceKiosk, scanAttendance\)/)
  assert.match(router, /router\.post\('\/unlock'/)
  assert.match(middleware, /timingSafeEqual/)
  assert.match(middleware, /MAX_FAILED_ATTEMPTS = 5/)
  assert.match(middleware, /ATTENDANCE_KIOSK_COOKIE/)
  assert.match(env, /ATTENDANCE_PINCODE=123456/)
})

test('company event participants are paginated at ten employees per page', () => {
  const modal = read('client/src/components/System/employeeComponents/AttendanceEventModal.jsx')
  assert.match(modal, /PARTICIPANT_PAGE_SIZE = 10/)
  assert.match(modal, /filteredEmployees\.slice\(start, start \+ PARTICIPANT_PAGE_SIZE\)/)
  assert.match(modal, /Select Page/)
  assert.match(modal, /Showing/)
})

test('employee barcode preview uses the compact right-side layout', () => {
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx')
  assert.match(modal, /lg:grid-cols-\[1\.05fr_\.95fr\]/)
  assert.match(modal, /<Code128Barcode compact/)
  assert.doesNotMatch(modal, /Barcode scanning is only used on the Attendance page/)
})


test('duplicate attendance scans use friendly Already Timed In / Already Timed Out messages', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js')
  const kiosk = read('client/src/pages/Public/AttendanceKiosk.jsx')
  assert.match(controller, /code: 'ALREADY_TIMED_IN'/)
  assert.match(controller, /No action is needed\./)
  assert.match(controller, /code: 'ALREADY_TIMED_OUT'/)
  assert.match(controller, /code: 'TIME_IN_REQUIRED'/)
  assert.match(kiosk, /title: 'Already Timed In'/)
  assert.match(kiosk, /title: 'Already Timed Out'/)
  assert.doesNotMatch(kiosk, />Attendance not recorded</)
})
