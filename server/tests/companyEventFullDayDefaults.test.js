import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('Company Event Full Day Present auto-fills current Attendance Settings in both create and edit UI', () => {
  const page = read('client/src/pages/System/Attendance.jsx')
  const modal = read('client/src/components/System/employeeComponents/AttendanceEventModal.jsx')
  assert.match(page, /attendanceSettings=\{attendanceSettings\}/)
  assert.match(modal, /attendanceSettings = \{\}/)
  assert.match(modal, /scheduledTimeIn = timeInput\(attendanceSettings\.scheduledTimeIn, '09:00'\)/)
  assert.match(modal, /scheduledTimeOut = timeInput\(attendanceSettings\.scheduledTimeOut, '20:00'\)/)
  assert.match(modal, /treatment === 'full_day'[\s\S]*event_time_in: scheduledTimeIn, event_time_out: scheduledTimeOut/)
  assert.match(modal, /Full Day Present automatically uses the Attendance Settings schedule/)
  assert.match(modal, /disabled=\{form\.attendance_treatment === 'full_day'\}/)
})

test('Server enforces Full Day Present event times from Attendance Settings even if client submits other times', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js')
  assert.match(controller, /validateEventPayload = \(body = \{\}, runtime = \{\}\)/)
  assert.match(controller, /treatment === 'full_day'[\s\S]*runtime\.scheduledTimeIn/)
  assert.match(controller, /treatment === 'full_day'[\s\S]*runtime\.scheduledTimeOut/)
  const runtimeCalls = controller.match(/await getAttendanceRuntimeSettings\([\s\S]*?connection[\s\S]*?\);/g) || []
  assert.ok(runtimeCalls.length >= 2, 'create and update event handlers should load Attendance Settings')
})

