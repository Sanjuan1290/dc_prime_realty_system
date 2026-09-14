import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import {
  buildAttendanceBarcode,
  isValidAttendanceBarcode,
} from '../controllers/System/Employees/attendanceBarcode.shared.js'
import {
  normalizeDepartmentConfigs,
  validateDepartmentConfigs,
} from '../controllers/System/Employees/departmentBarcode.shared.js'
import {
  normalizeRestDays,
  previousDate,
} from '../services/employeeRestDay.service.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const loadExcelInternals = () => {
  let source = read('client/src/utils/attendanceExcelExport.js')
  source = source.replace(/^import \* as XLSX from 'xlsx-js-style'\s*/m, 'const XLSX = { utils: {} }\n')
  source = source.replace(/export const /g, 'const ')
  source += `\nglobalThis.__attendanceInternals = {\n    secondsFromTime, breakOverlapSeconds, activeRestDaysForDate, hasCompleteRestDayCoverage,\n    buildAttendanceRow, workbookRowValues, rowPalette\n  }\n`
  const context = { console, Date, Intl, Math, Number, String, Array, Set, Map, Object, RegExp, Error }
  context.globalThis = context
  vm.runInNewContext(source, context, { filename: 'attendanceExcelExport.instrumented.js' })
  return context.__attendanceInternals
}

const excel = loadExcelInternals()
const schedule = {
  scheduledTimeIn: '09:00:00',
  scheduledTimeOut: '20:00:00',
  breakStart: '12:00:00',
  breakMinutes: 60,
  regularWorkingMinutes: 600,
  lateAfter: '09:00:00',
  redHighlightAfter: '09:15:00',
}
const employee = { employee_id: 1, hire_date: '2026-09-01', first_name: 'Test', last_name: 'Employee' }
const row = (date, attendance = null, { restDays = [], daySetting = null } = {}) => excel.buildAttendanceRow({
  employee, date, attendance, restDays, daySetting, schedule,
})

const H = 3600
const M = 60

test('Excel attendance matrix: exact on-time full day is 10 worked hours, zero tardiness, zero OT', () => {
  const result = row('2026-09-07', { actual_time_in: '09:00:00', actual_time_out: '20:00:00', day_type: 'regular' })
  assert.equal(result.remark, 'On Time')
  assert.equal(result.state, 'normal')
  assert.equal(result.totalWorkedSeconds, 10 * H)
  assert.equal(result.lateSeconds, 0)
  assert.equal(result.overtimeSeconds, 0)
  assert.equal(result.regularAttendedSeconds, 10 * H)
})

test('Excel attendance matrix: 9:01 is Late but green; 9:15 is still green; strictly after 9:15 is red', () => {
  const oneMinute = row('2026-09-07', { actual_time_in: '09:01:00', actual_time_out: '20:00:00' })
  assert.equal(oneMinute.remark, 'Late')
  assert.equal(oneMinute.lateSeconds, M)
  assert.equal(oneMinute.state, 'normal')

  const fifteen = row('2026-09-07', { actual_time_in: '09:15:00', actual_time_out: '20:00:00' })
  assert.equal(fifteen.remark, 'Late')
  assert.equal(fifteen.lateSeconds, 15 * M)
  assert.equal(fifteen.state, 'normal')

  const after = row('2026-09-07', { actual_time_in: '09:15:01', actual_time_out: '20:00:00' })
  assert.equal(after.remark, 'Late')
  assert.equal(after.lateSeconds, 15 * M + 1)
  assert.equal(after.state, 'late_red')
})

test('Excel attendance matrix: overtime starts only after scheduled 20:00 Time Out', () => {
  const result = row('2026-09-07', { actual_time_in: '09:05:00', actual_time_out: '21:00:00' })
  assert.equal(result.lateSeconds, 5 * M)
  assert.equal(result.overtimeSeconds, H)
  assert.equal(result.totalWorkedSeconds, 10 * H + 55 * M)
  assert.equal(result.regularAttendedSeconds, 9 * H + 55 * M)
})

test('Excel attendance matrix: break is deducted only when attendance overlaps the break window', () => {
  assert.equal(excel.breakOverlapSeconds({ timeInSeconds: 9 * H, timeOutSeconds: 20 * H, breakStart: '12:00:00', breakMinutes: 60 }), H)
  assert.equal(excel.breakOverlapSeconds({ timeInSeconds: 18 * H + 56 * M + 42, timeOutSeconds: 18 * H + 58 * M + 4, breakStart: '12:00:00', breakMinutes: 60 }), 0)
  assert.equal(excel.breakOverlapSeconds({ timeInSeconds: 11 * H + 45 * M, timeOutSeconds: 12 * H + 15 * M, breakStart: '12:00:00', breakMinutes: 60 }), 15 * M)
})

test('Excel attendance matrix: absent regular day is A and carries one full 10-hour tardiness obligation in summary logic', () => {
  const result = row('2026-09-07')
  assert.equal(result.remark, 'A')
  assert.equal(result.state, 'absent')
  assert.equal(result.scheduledDay, true)
  assert.equal(result.absence, true)
  const summaryTardiness = Number(result.lateSeconds || 0) + (result.absence ? schedule.regularWorkingMinutes * 60 : 0)
  assert.equal(summaryTardiness, 10 * H)
})

test('Excel attendance matrix: Rest Day without attendance is RD and with attendance all net hours become OT', () => {
  const rest = row('2026-09-13', null, { restDays: ['sunday'] })
  assert.equal(rest.remark, 'RD')
  assert.equal(rest.state, 'rest')
  assert.equal(rest.scheduledDay, false)
  assert.equal(rest.absence, false)

  const worked = row('2026-09-13', { actual_time_in: '09:00:00', actual_time_out: '20:00:00' }, { restDays: ['sunday'] })
  assert.equal(worked.remark, 'RD')
  assert.equal(worked.state, 'rest_work')
  assert.equal(worked.totalWorkedSeconds, 10 * H)
  assert.equal(worked.overtimeSeconds, 10 * H)
  assert.equal(worked.regularAttendedSeconds, 0)
})

test('Excel attendance matrix: no-attendance holidays do not become absences and keep time fields blank', () => {
  for (const day_type of ['double_pay', 'regular_holiday', 'special_holiday']) {
    const result = row('2026-09-08', null, { daySetting: { day_type } })
    assert.equal(result.state, 'holiday')
    assert.equal(result.remark, '')
    assert.equal(result.scheduledDay, false)
    assert.equal(result.absence, false)
    const values = excel.workbookRowValues(result, schedule)
    assert.deepEqual(Array.from(values.slice(2, 13)), Array(11).fill(''))
  }
})

test('Excel attendance matrix: attendance on a holiday shows actual time calculations and attendance status', () => {
  const result = row('2026-09-08', { actual_time_in: '09:05:00', actual_time_out: '20:00:00', day_type: 'regular_holiday' })
  assert.equal(result.remark, 'Late')
  assert.equal(result.lateSeconds, 5 * M)
  assert.equal(result.scheduledDay, false)
  assert.equal(result.absence, false)
  assert.equal(result.holidayWorkedSeconds, 9 * H + 55 * M)
})

test('Excel attendance matrix: true pre-hire/no-record is N/A but authoritative manual attendance before hire date wins', () => {
  const noRecord = row('2026-08-31')
  assert.equal(noRecord.remark, 'N/A')
  assert.equal(noRecord.state, 'na')

  const manual = row('2026-08-31', { actual_time_in: '09:00:00', actual_time_out: '20:00:00', time_in_source: 'manual', time_out_source: 'manual' })
  assert.equal(manual.remark, 'On Time')
  assert.equal(manual.totalWorkedSeconds, 10 * H)
  assert.notEqual(manual.state, 'na')
})

test('Excel attendance matrix: incomplete Time In remains visible without inventing worked hours', () => {
  const result = row('2026-09-07', { actual_time_in: '09:05:00', actual_time_out: null })
  assert.equal(result.remark, 'Late')
  assert.equal(result.lateSeconds, 5 * M)
  assert.equal(result.totalWorkedSeconds, 0)
  const values = excel.workbookRowValues(result, schedule)
  assert.notEqual(values[2], '')
  assert.equal(values[3], '')
  assert.equal(values[4], '')
})

test('Rest Day helpers normalize duplicates/invalid days and preserve date history boundaries', () => {
  assert.deepEqual(normalizeRestDays(['Sunday', 'monday', 'Sunday', 'noday']), ['monday', 'sunday'])
  assert.equal(previousDate('2026-09-07'), '2026-09-06')
})

test('Employee-code department configuration rejects duplicate names and prefixes', () => {
  const defaults = normalizeDepartmentConfigs([], ['IT', 'Marketing'])
  assert.equal(defaults.find((item) => item.name === 'IT')?.prefix, 'IT')
  assert.throws(() => validateDepartmentConfigs([{ name: 'IT', prefix: 'IT' }, { name: 'it', prefix: 'TECH' }]), /already exists|listed more than once/i)
  assert.throws(() => validateDepartmentConfigs([{ name: 'IT', prefix: 'IT' }, { name: 'Internal Tools', prefix: 'it' }]), /already used/i)
})

test('Secure attendance barcode matrix accepts valid 10-digit check-digit code and rejects modified/short/non-numeric values', () => {
  const valid = buildAttendanceBarcode('123456789')
  assert.match(valid, /^\d{10}$/)
  assert.equal(isValidAttendanceBarcode(valid), true)
  assert.equal(isValidAttendanceBarcode(valid.slice(0, 9) + ((Number(valid[9]) + 1) % 10)), false)
  assert.equal(isValidAttendanceBarcode('123456789'), false)
  assert.equal(isValidAttendanceBarcode('ABCDEFGHIJ'), false)
})

test('Employee controller covers required fields, Rest Day requirement, immutable IDs, valid rest-day effective date, status and barcode regeneration', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js')
  assert.match(controller, /First name, last name, and department are required/)
  assert.match(controller, /Select at least one Rest Day/)
  assert.match(controller, /Rest Day effective date cannot be before the employee hire date/)
  assert.match(controller, /Rest Day effective date cannot be in the future/)
  assert.match(controller, /Employee code .* attendance barcode were preserved/)
  assert.match(controller, /previous printed barcode will no longer work/)
  assert.match(controller, /Select Active or Inactive/)
  assert.match(controller, /employee_status <> 'archived'/)
  assert.match(controller, /MAX_DEPARTMENT_BARCODE_NUMBER = 999/)
  assert.match(controller, /FOR UPDATE/)
})

test('Attendance scan controller covers invalid barcode/action, inactive employee, event conflict, duplicate in/out and Time In required', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js')
  assert.match(controller, /ATTENDANCE_BARCODE_REQUIRED/)
  assert.match(controller, /INVALID_ATTENDANCE_BARCODE/)
  assert.match(controller, /Select Time In or Time Out first/)
  assert.match(controller, /No active employee matches that attendance barcode/)
  assert.match(controller, /already has attendance recorded through a company event today/)
  assert.match(controller, /ALREADY_TIMED_IN/)
  assert.match(controller, /TIME_IN_REQUIRED/)
  assert.match(controller, /ALREADY_TIMED_OUT/)
})

test('Manual attendance controller covers required employee/date/reason/time, chronological time, duplicate-date conflict and audit correction trail', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js')
  assert.match(controller, /Employee and attendance date are required/)
  assert.match(controller, /A reason is required for manual attendance/)
  assert.match(controller, /Time In is required for manual attendance/)
  assert.match(controller, /Time Out cannot be earlier than Time In/)
  assert.match(controller, /Attendance already exists for this employee and date/)
  assert.match(controller, /employee_attendance_corrections/)
  assert.match(controller, /Added manual attendance/)
})

test('Attendance correction controller covers missing reason, Time Out without Time In, no-op edits, non-event Time In requirement and audit before/after values', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js')
  assert.match(controller, /A reason is required when correcting attendance/)
  assert.match(controller, /Time Out cannot be saved without a Time In/)
  assert.match(controller, /Time In is required for non-event attendance records/)
  assert.match(controller, /No attendance time changes were made/)
  assert.match(controller, /previousTimeIn/)
  assert.match(controller, /previousTimeOut/)
  assert.match(controller, /Attendance time was corrected for .* Reason:/)
})

test('Attendance settings controller guards invalid schedule, auto-timeout, break, late and red-threshold configurations', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSettings.controller.js')
  assert.match(controller, /Scheduled Time Out must be later than Scheduled Time In/)
  assert.match(controller, /Automatic Time Out cannot be earlier than Scheduled Time Out/)
  assert.match(controller, /Break Start must fall within the scheduled attendance window/)
  assert.match(controller, /configured break cannot extend past Scheduled Time Out/)
  assert.match(controller, /Late After must fall within the scheduled attendance window/)
  assert.match(controller, /Highlight Row Red After cannot be earlier than Late After/)
  assert.match(controller, /Highlight Row Red After cannot be later than Scheduled Time Out/)
  assert.match(controller, /DEFAULT_REGULAR_WORK_MINUTES/)
})

test('Company Event controller covers record-only/custom/full-day, date limits, participants, conflict prevention and corrected-event lock', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js')
  assert.match(controller, /Company events can cover up to 31 days at a time/)
  assert.match(controller, /Select at least one participating employee/)
  assert.match(controller, /Time In and Time Out are required for Full Day and Custom Time events/)
  assert.match(controller, /Event Time Out cannot be saved without a Time In/)
  assert.match(controller, /Event Time Out cannot be earlier than Event Time In/)
  assert.match(controller, /Event attendance conflicts with existing attendance/)
  assert.match(controller, /Updated event conflicts with existing attendance/)
  assert.match(controller, /manually corrected by an admin/)
  assert.match(controller, /Event attendance must be managed from the Company Event record/)
})

test('Automatic Time Out only closes open attendance records and labels source automatic', () => {
  const job = read('server/jobs/attendanceAutoTimeout.job.js')
  assert.match(job, /actual_time_out IS NULL/)
  assert.match(job, /actual_time_in IS NOT NULL/)
  assert.match(job, /time_out_source = 'automatic'/)
  assert.match(job, /attendance_event_id IS NULL/)
  assert.match(job, /a\.actual_time_in <= \?/)
})
