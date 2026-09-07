import * as XLSX from 'xlsx-js-style'

const COLUMN_COUNT = 13
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const DAY_KEY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const COLORS = Object.freeze({
  header: '356854',
  total: 'D8E5E0',
  grid: '262626',
  normal: '1E6600',
  gray: '969696',
  red: 'E5391B',
  redFill: 'FDE5E5',
  blue: '4472C4',
  blueFill: 'EAF1FB',
  violet: '7030A0',
  violetFill: 'F1E9FA',
  alt: 'F5F7F7',
  white: 'FFFFFF',
  black: '000000',
})

const thinBorder = {
  top: { style: 'thin', color: { rgb: COLORS.grid } },
  bottom: { style: 'thin', color: { rgb: COLORS.grid } },
  left: { style: 'thin', color: { rgb: COLORS.grid } },
  right: { style: 'thin', color: { rgb: COLORS.grid } },
}

const baseFont = { name: 'Arial', sz: 11, bold: true, color: { rgb: COLORS.normal } }
const center = { horizontal: 'center', vertical: 'center' }
const dataStyle = (fontColor = COLORS.normal, fill = null) => ({
  font: { ...baseFont, color: { rgb: fontColor } },
  alignment: center,
  border: thinBorder,
  ...(fill ? { fill: { patternType: 'solid', fgColor: { rgb: fill } } } : {}),
})

const textStyle = (fontColor = COLORS.black, bold = true, align = 'center') => ({
  font: { name: 'Arial', sz: 11, bold, color: { rgb: fontColor } },
  alignment: { horizontal: align, vertical: 'center', wrapText: true },
})

const secondsFromTime = (value) => {
  if (!value) return null
  const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  return (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3] || 0)
}

const excelDuration = (seconds) => Math.max(Number(seconds || 0), 0) / 86400
const excelTime = (value) => {
  const seconds = secondsFromTime(value)
  return seconds === null ? null : seconds / 86400
}

const breakOverlapSeconds = ({ timeInSeconds, timeOutSeconds, breakStart, breakMinutes }) => {
  if (timeInSeconds === null || timeOutSeconds === null || timeOutSeconds <= timeInSeconds) return 0
  const start = secondsFromTime(breakStart)
  const duration = Math.max(Number(breakMinutes || 0), 0) * 60
  if (start === null || duration <= 0) return 0
  const end = Math.min(start + duration, 24 * 60 * 60)
  return Math.max(Math.min(timeOutSeconds, end) - Math.max(timeInSeconds, start), 0)
}

const dateOnly = (value) => String(value || '').slice(0, 10)
const toUtcDate = (value) => {
  const date = dateOnly(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const formatLongDate = (value) => {
  const date = toUtcDate(value)
  if (!date) return String(value || '')
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date)
}

const middleInitial = (value) => {
  const text = String(value || '').trim()
  return text ? `${text.charAt(0).toUpperCase()}.` : ''
}

const employeeHeaderName = (employee) => [
  `${String(employee.last_name || '').toUpperCase()},`,
  String(employee.first_name || '').toUpperCase(),
  middleInitial(employee.middle_name),
].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

const displayEmployeeName = (employee) => [employee.first_name, employee.middle_name, employee.last_name]
  .filter(Boolean).join(' ').toUpperCase()

const sanitizeSheetBase = (value) => String(value || 'EMPLOYEE')
  .replace(/[\\/?*\[\]:]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || 'EMPLOYEE'

const uniqueSheetName = (base, used) => {
  const cleaned = sanitizeSheetBase(base)
  let name = cleaned.slice(0, 31)
  let counter = 2
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${counter})`
    name = `${cleaned.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    counter += 1
  }
  used.add(name.toLowerCase())
  return name
}

const cellRef = (row, col) => XLSX.utils.encode_cell({ r: row, c: col })

const setCell = (sheet, row, col, value, style = null, numberFormat = '') => {
  const ref = cellRef(row, col)
  const cell = sheet[ref] || { t: 's', v: '' }
  if (value instanceof Date) {
    cell.t = 'd'
    cell.v = value
  } else if (typeof value === 'number') {
    cell.t = 'n'
    cell.v = value
  } else {
    cell.t = 's'
    cell.v = value == null ? '' : String(value)
  }
  if (style) cell.s = style
  if (numberFormat) cell.z = numberFormat
  sheet[ref] = cell
}

const applyRangeStyle = (sheet, startRow, endRow, startCol, endCol, style) => {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const ref = cellRef(row, col)
      if (!sheet[ref]) sheet[ref] = { t: 's', v: '' }
      sheet[ref].s = style
    }
  }
}

const activeRestDaysForDate = (employeeId, date, assignments) => assignments
  .filter((assignment) => Number(assignment.employee_id) === Number(employeeId)
    && date >= dateOnly(assignment.effective_from)
    && (!assignment.effective_to || date <= dateOnly(assignment.effective_to)))
  .map((assignment) => String(assignment.day_of_week || '').toLowerCase())

const hasCompleteRestDayCoverage = (employee, dates, assignments) => {
  const hireDate = dateOnly(employee.hire_date)
  return dates.every((date) => {
    if (hireDate && date < hireDate) return true
    return activeRestDaysForDate(employee.employee_id, date, assignments).length > 0
  })
}

const normalizeDayType = (value) => {
  const day = String(value || 'regular')
  return ['regular', 'double_pay', 'regular_holiday', 'special_holiday'].includes(day) ? day : 'regular'
}

const buildAttendanceRow = ({ employee, date, attendance, restDays, daySetting, schedule }) => {
  const dateObject = toUtcDate(date)
  const weekdayIndex = dateObject?.getUTCDay() ?? 0
  const weekday = DAY_NAMES[weekdayIndex]
  const weekdayKey = DAY_KEY_NAMES[weekdayIndex]
  const hireDate = dateOnly(employee.hire_date)
  const isPreHire = Boolean(hireDate && date < hireDate)
  const dayType = normalizeDayType(attendance?.day_type || daySetting?.day_type || 'regular')
  const hasEvent = Boolean(attendance?.attendance_event_id)
  const isHoliday = !hasEvent && dayType !== 'regular'
  const isRestDay = !hasEvent && !isHoliday && restDays.includes(weekdayKey)

  // A real attendance record is authoritative, even when it was manually added
  // for a date earlier than the employee's stored hire date. Only show N/A when
  // the date is pre-hire AND there is no attendance to report.
  const timeIn = attendance?.actual_time_in || null
  const timeOut = attendance?.actual_time_out || null

  if (isPreHire && !timeIn && !timeOut) {
    return {
      weekday, date, state: 'na', remark: 'N/A', marker: 'N/A',
      scheduledDay: false, absence: false, lateSeconds: 0, overtimeSeconds: 0,
      totalWorkedSeconds: 0, regularAttendedSeconds: 0, holidayWorkedSeconds: 0,
    }
  }
  const timeInSeconds = secondsFromTime(timeIn)
  const timeOutSeconds = secondsFromTime(timeOut)
  const scheduledOut = secondsFromTime(schedule.scheduledTimeOut)
  const lateAfter = secondsFromTime(schedule.lateAfter || schedule.scheduledTimeIn || '09:00:00')
  const regularWorkingSeconds = Number(schedule.regularWorkingMinutes || 600) * 60
  const redAfter = secondsFromTime(schedule.redHighlightAfter || '09:15:00')

  if (isRestDay && !timeIn && !timeOut) {
    return {
      weekday, date, state: 'rest', remark: 'RD', marker: 'RD',
      scheduledDay: false, absence: false, lateSeconds: 0, overtimeSeconds: 0,
      totalWorkedSeconds: 0, regularAttendedSeconds: 0, holidayWorkedSeconds: 0,
    }
  }

  if (isHoliday && !timeIn && !timeOut) {
    return {
      weekday, date, state: 'holiday', remark: '',
      scheduledDay: false, absence: false, lateSeconds: 0, overtimeSeconds: 0,
      totalWorkedSeconds: 0, regularAttendedSeconds: 0, holidayWorkedSeconds: 0,
    }
  }

  if (hasEvent && !timeIn && !timeOut) {
    return {
      weekday, date, state: 'event', remark: attendance?.event_name ? `COMPANY EVENT - ${attendance.event_name}` : 'COMPANY EVENT', marker: 'EVENT',
      scheduledDay: true, absence: false, lateSeconds: 0, overtimeSeconds: 0,
      totalWorkedSeconds: 0, regularAttendedSeconds: 0, holidayWorkedSeconds: 0,
    }
  }

  if (!timeIn && !timeOut) {
    return {
      weekday, date, state: 'absent', remark: 'A', marker: 'A',
      scheduledDay: true, absence: true, lateSeconds: 0, overtimeSeconds: 0,
      totalWorkedSeconds: 0, regularAttendedSeconds: 0, holidayWorkedSeconds: 0,
    }
  }

  let totalWorkedSeconds = 0
  if (timeInSeconds !== null && timeOutSeconds !== null && timeOutSeconds >= timeInSeconds) {
    const grossWorkedSeconds = timeOutSeconds - timeInSeconds
    const deductedBreakSeconds = breakOverlapSeconds({
      timeInSeconds,
      timeOutSeconds,
      breakStart: schedule.breakStart || '12:00:00',
      breakMinutes: schedule.breakMinutes ?? 60,
    })
    totalWorkedSeconds = Math.max(grossWorkedSeconds - deductedBreakSeconds, 0)
  }

  if (isRestDay) {
    return {
      weekday, date, state: 'rest_work', remark: 'RD', timeIn, timeOut,
      totalWorkedSeconds,
      lateSeconds: 0,
      overtimeSeconds: totalWorkedSeconds,
      regularWorkingSeconds: 0,
      regularAttendedSeconds: 0,
      scheduledDay: false,
      absence: false,
      holidayWorkedSeconds: 0,
    }
  }

  if (isHoliday) {
    const holidayLateSeconds = timeInSeconds !== null && lateAfter !== null
      ? Math.max(timeInSeconds - lateAfter, 0)
      : 0
    const holidayIsLate = holidayLateSeconds > 0
    const holidayIsRedLate = timeInSeconds !== null && redAfter !== null && timeInSeconds > redAfter

    return {
      weekday,
      date,
      state: holidayIsRedLate ? 'late_red' : 'normal',
      remark: holidayIsLate ? 'Late' : 'On Time',
      timeIn,
      timeOut,
      totalWorkedSeconds,
      lateSeconds: holidayLateSeconds,
      overtimeSeconds: 0,
      regularWorkingSeconds: 0,
      regularAttendedSeconds: 0,
      scheduledDay: false,
      absence: false,
      holidayWorkedSeconds: totalWorkedSeconds,
    }
  }

  if (hasEvent) {
    const eventOvertime = timeOutSeconds !== null && scheduledOut !== null
      ? Math.min(Math.max(timeOutSeconds - scheduledOut, 0), totalWorkedSeconds)
      : 0
    return {
      weekday, date, state: 'event_work', remark: attendance?.event_name ? `COMPANY EVENT - ${attendance.event_name}` : 'COMPANY EVENT', timeIn, timeOut,
      totalWorkedSeconds,
      lateSeconds: 0,
      overtimeSeconds: eventOvertime,
      regularWorkingSeconds,
      regularAttendedSeconds: Math.min(Math.max(totalWorkedSeconds - eventOvertime, 0), regularWorkingSeconds),
      scheduledDay: true,
      absence: false,
      holidayWorkedSeconds: 0,
    }
  }

  const lateSeconds = timeInSeconds !== null && lateAfter !== null
    ? Math.max(timeInSeconds - lateAfter, 0)
    : 0
  const rawOvertime = timeOutSeconds !== null && scheduledOut !== null
    ? Math.max(timeOutSeconds - scheduledOut, 0)
    : 0
  const overtimeSeconds = Math.min(rawOvertime, totalWorkedSeconds)
  const regularAttendedSeconds = Math.min(Math.max(totalWorkedSeconds - overtimeSeconds, 0), regularWorkingSeconds)
  const isLate = lateSeconds > 0
  const isRedLate = timeInSeconds !== null && redAfter !== null && timeInSeconds > redAfter

  return {
    weekday,
    date,
    state: isRedLate ? 'late_red' : 'normal',
    remark: isLate ? 'Late' : 'On Time',
    timeIn,
    timeOut,
    totalWorkedSeconds,
    lateSeconds,
    overtimeSeconds,
    regularWorkingSeconds,
    regularAttendedSeconds,
    scheduledDay: true,
    absence: false,
    holidayWorkedSeconds: 0,
  }
}

const rowPalette = (state, alternate = false) => {
  if (state === 'late_red') return { color: COLORS.red, fill: COLORS.redFill }
  if (state === 'absent') return { color: COLORS.red, fill: alternate ? COLORS.alt : null }
  if (state === 'rest' || state === 'na') return { color: COLORS.gray, fill: alternate ? COLORS.alt : null }
  if (state === 'holiday' || state === 'holiday_work') return { color: COLORS.blue, fill: COLORS.blueFill }
  if (state === 'event' || state === 'event_work') return { color: COLORS.violet, fill: COLORS.violetFill }
  return { color: COLORS.normal, fill: alternate ? COLORS.alt : null }
}

const workbookRowValues = (row, schedule) => {
  if (row.state === 'holiday') {
    return [row.weekday, toUtcDate(row.date), '', '', '', '', '', '', '', '', '', '', '']
  }

  if (row.marker) {
    return [
      row.weekday, toUtcDate(row.date), row.marker, row.marker, row.marker, row.marker,
      row.marker, row.marker, row.marker, row.marker, row.marker, row.marker, row.remark,
    ]
  }

  const regularWorkingSeconds = row.regularWorkingSeconds ?? Number(schedule.regularWorkingMinutes || 600) * 60
  return [
    row.weekday,
    toUtcDate(row.date),
    row.timeIn ? excelTime(row.timeIn) : '',
    row.timeOut ? excelTime(row.timeOut) : '',
    row.timeIn && row.timeOut ? excelDuration(row.totalWorkedSeconds) : '',
    excelDuration(row.lateSeconds),
    row.state === 'rest_work' ? 'RD' : excelTime(schedule.scheduledTimeOut),
    excelDuration(Number(schedule.breakMinutes || 60) * 60),
    excelDuration(row.overtimeSeconds),
    row.state === 'rest_work' ? 'RD' : excelDuration(regularWorkingSeconds),
    row.state === 'rest_work' ? 'RD' : excelDuration(row.regularAttendedSeconds),
    row.state === 'rest_work' ? 'RD' : excelTime(schedule.scheduledTimeIn),
    row.remark,
  ]
}

const applyDataNumberFormats = (sheet, sheetRow, values) => {
  const zeroBased = sheetRow - 1
  if (values[1] instanceof Date) setCell(sheet, zeroBased, 1, values[1], sheet[cellRef(zeroBased, 1)]?.s, 'mm/dd/yyyy')
  if (typeof values[2] === 'number') setCell(sheet, zeroBased, 2, values[2], sheet[cellRef(zeroBased, 2)]?.s, 'h:mm AM/PM')
  if (typeof values[3] === 'number') setCell(sheet, zeroBased, 3, values[3], sheet[cellRef(zeroBased, 3)]?.s, 'h:mm:ss')
  for (const col of [4, 5, 7, 8, 9, 10]) {
    if (typeof values[col] === 'number') setCell(sheet, zeroBased, col, values[col], sheet[cellRef(zeroBased, col)]?.s, '[h]:mm:ss')
  }
  if (typeof values[6] === 'number') setCell(sheet, zeroBased, 6, values[6], sheet[cellRef(zeroBased, 6)]?.s, 'h:mm:ss')
  if (typeof values[11] === 'number') setCell(sheet, zeroBased, 11, values[11], sheet[cellRef(zeroBased, 11)]?.s, 'h:mm:ss')
}

const buildEmployeeSheet = (employee, data, cutoffLabel) => {
  const { dates, attendance, restDayAssignments, daySettings, schedule, generatedAt } = data
  const attendanceMap = new Map(
    attendance
      .filter((row) => Number(row.employee_id) === Number(employee.employee_id))
      .map((row) => [dateOnly(row.attendance_date), row])
  )
  const dayMap = new Map(daySettings.map((day) => [dateOnly(day.attendance_date), day]))

  const rows = dates.map((date) => buildAttendanceRow({
    employee,
    date,
    attendance: attendanceMap.get(date),
    restDays: activeRestDaysForDate(employee.employee_id, date, restDayAssignments),
    daySetting: dayMap.get(date),
    schedule,
  }))

  const totalRow = 3 + rows.length + 1
  const summaryStart = totalRow + 1
  const lastRow = summaryStart + 6
  const matrix = Array.from({ length: lastRow }, () => Array(COLUMN_COUNT).fill(''))
  const sheet = XLSX.utils.aoa_to_sheet(matrix)

  sheet['!merges'] = [
    XLSX.utils.decode_range('A1:M1'),
    XLSX.utils.decode_range('A2:M2'),
    XLSX.utils.decode_range(`A${totalRow}:M${totalRow}`),
    XLSX.utils.decode_range(`D${summaryStart}:E${summaryStart}`),
    XLSX.utils.decode_range(`D${summaryStart + 1}:E${summaryStart + 1}`),
    XLSX.utils.decode_range(`J${summaryStart}:M${summaryStart}`),
    XLSX.utils.decode_range(`J${summaryStart + 1}:M${summaryStart + 1}`),
    XLSX.utils.decode_range(`A${summaryStart + 3}:B${summaryStart + 3}`),
    XLSX.utils.decode_range(`C${summaryStart + 3}:E${summaryStart + 3}`),
    XLSX.utils.decode_range(`A${summaryStart + 4}:B${summaryStart + 4}`),
    XLSX.utils.decode_range(`C${summaryStart + 4}:E${summaryStart + 4}`),
    XLSX.utils.decode_range(`A${summaryStart + 5}:B${summaryStart + 5}`),
    XLSX.utils.decode_range(`C${summaryStart + 5}:E${summaryStart + 5}`),
    XLSX.utils.decode_range(`A${summaryStart + 6}:B${summaryStart + 6}`),
    XLSX.utils.decode_range(`C${summaryStart + 6}:E${summaryStart + 6}`),
  ]

  sheet['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 17 },
    { wch: 15 }, { wch: 17 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 19 }, { wch: 17 }, { wch: 17 },
  ]
  sheet['!rows'] = [{ hpt: 20 }, { hpt: 20 }, { hpt: 20 }]
  rows.forEach(() => sheet['!rows'].push({ hpt: 19 }))
  sheet['!rows'].push({ hpt: 20 })
  sheet['!margins'] = { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 }
  sheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

  setCell(sheet, 0, 0, employeeHeaderName(employee), { font: { name: 'Arial', sz: 12, bold: true, color: { rgb: COLORS.black } }, alignment: center })
  setCell(sheet, 1, 0, `${formatLongDate(String(generatedAt || '').slice(0, 10))} (${cutoffLabel})`, { font: { name: 'Arial', sz: 11, bold: true, color: { rgb: COLORS.black } }, alignment: center })

  const headers = [
    'Day', 'Date', 'Time IN', 'Time OUT', 'Total Hours Worked', 'Total Time Late',
    'Scheduled Time OUT', 'Break Time', 'Overtime', 'Regular Working Hour',
    'Regular Hours Attended', 'Scheduled Time IN', 'Remarks',
  ]
  headers.forEach((header, col) => setCell(sheet, 2, col, header, {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: COLORS.white } },
    fill: { patternType: 'solid', fgColor: { rgb: COLORS.header } },
    alignment: center,
    border: thinBorder,
  }))

  rows.forEach((row, index) => {
    const excelRow = 4 + index
    const values = workbookRowValues(row, schedule)
    const palette = rowPalette(row.state, index % 2 === 1)
    const style = dataStyle(palette.color, palette.fill)
    values.forEach((value, col) => setCell(sheet, excelRow - 1, col, value, style))
    applyDataNumberFormats(sheet, excelRow, values)
  })

  const totalStyle = {
    font: { name: 'Arial', sz: 11, bold: true, color: { rgb: COLORS.black } },
    fill: { patternType: 'solid', fgColor: { rgb: COLORS.total } },
    alignment: center,
    border: thinBorder,
  }
  applyRangeStyle(sheet, totalRow - 1, totalRow - 1, 0, 12, totalStyle)
  setCell(sheet, totalRow - 1, 0, 'TOTAL', totalStyle)

  const scheduledDays = rows.filter((row) => row.scheduledDay).length
  const absenceCount = rows.filter((row) => row.absence).length
  const totalWorked = rows.reduce((sum, row) => sum + Number(row.totalWorkedSeconds || 0), 0)
  const tardiness = rows.reduce((sum, row) => sum + Number(row.lateSeconds || 0), 0)
  const overtime = rows.reduce((sum, row) => sum + Number(row.overtimeSeconds || 0), 0)
  const regularAttended = rows.reduce((sum, row) => sum + Number(row.regularAttendedSeconds || 0), 0)
  const holidayWorked = rows.reduce((sum, row) => sum + Number(row.holidayWorkedSeconds || 0), 0)
  const requiredHours = scheduledDays * Number(schedule.regularWorkingMinutes || 600) * 60

  setCell(sheet, summaryStart - 1, 0, 'No. of Days', textStyle())
  setCell(sheet, summaryStart - 1, 1, scheduledDays, textStyle(COLORS.black, true, 'left'))
  setCell(sheet, summaryStart, 0, 'No. Hours', textStyle())
  setCell(sheet, summaryStart, 1, excelDuration(requiredHours), textStyle(COLORS.black, true, 'left'), '[h]:mm:ss')

  setCell(sheet, summaryStart - 1, 3, 'TOTAL HOURS WORKED INCLUDING OT', textStyle())
  setCell(sheet, summaryStart, 3, excelDuration(totalWorked), textStyle(COLORS.gray, true), '[h]:mm:ss')

  setCell(sheet, summaryStart - 1, 5, 'TARDINESS', textStyle())
  setCell(sheet, summaryStart, 5, excelDuration(tardiness), textStyle(COLORS.red, false), '[h]:mm:ss')

  setCell(sheet, summaryStart - 1, 6, 'ADJUSTMENTS / ABSENCES', textStyle())
  setCell(sheet, summaryStart, 6, absenceCount, textStyle(COLORS.red, false))
  setCell(sheet, summaryStart + 1, 5, 'UNDER TIME (MINS)', textStyle())
  setCell(sheet, summaryStart + 1, 6, 'OTHER LOST (MINS)', textStyle())
  setCell(sheet, summaryStart + 2, 5, 0, textStyle(COLORS.black, false))
  setCell(sheet, summaryStart + 2, 6, 0, textStyle(COLORS.black, false))

  setCell(sheet, summaryStart - 1, 8, 'OVERTIME', textStyle())
  setCell(sheet, summaryStart, 8, excelDuration(overtime), textStyle(COLORS.black, true), '[h]:mm:ss')

  setCell(sheet, summaryStart - 1, 9, 'HOURS ATTENDED LESS OT/RD OT & TOTAL DEDUCTION', textStyle())
  setCell(sheet, summaryStart, 9, excelDuration(regularAttended), textStyle(COLORS.black, true), '[h]:mm:ss')
  if (holidayWorked > 0) {
    setCell(sheet, summaryStart + 1, 9, 'HOLIDAY:', textStyle(COLORS.blue, true, 'right'))
    setCell(sheet, summaryStart + 1, 10, excelDuration(holidayWorked), textStyle(COLORS.blue, true, 'left'), '[h]:mm:ss')
  }

  const idRow = summaryStart + 3
  setCell(sheet, idRow - 1, 0, 'ID#:', textStyle(COLORS.black, true, 'right'))
  setCell(sheet, idRow - 1, 2, employee.employee_code || '', textStyle(COLORS.black, true, 'center'))
  setCell(sheet, idRow, 0, 'Signature:', textStyle(COLORS.black, true, 'right'))
  setCell(sheet, idRow, 2, '______________________________', textStyle(COLORS.black, false, 'left'))
  setCell(sheet, idRow + 1, 0, 'Name of Employee:', textStyle(COLORS.black, true, 'right'))
  setCell(sheet, idRow + 1, 2, displayEmployeeName(employee), textStyle(COLORS.black, true, 'left'))
  setCell(sheet, idRow + 2, 0, 'Date', textStyle(COLORS.black, true, 'right'))
  setCell(sheet, idRow + 2, 2, toUtcDate(String(generatedAt || '').slice(0, 10)), textStyle(COLORS.black, true, 'left'), 'mm/dd/yyyy')

  return sheet
}

export const buildAttendanceWorkbook = (payload, { cutoffLabel = '' } = {}) => {
  const data = payload?.data || payload || {}
  const employees = Array.isArray(data.employees) ? data.employees : []
  const dates = Array.isArray(data.dates) ? data.dates : []
  const assignments = Array.isArray(data.restDayAssignments) ? data.restDayAssignments : []

  if (!employees.length) throw new Error('There are no active employees to export.')
  if (!dates.length) throw new Error('The selected export range does not contain any dates.')

  const missingCoverage = employees.filter((employee) => !hasCompleteRestDayCoverage(employee, dates, assignments))
  if (missingCoverage.length) {
    const preview = missingCoverage.slice(0, 5).map((employee) => employee.full_name || displayEmployeeName(employee)).join(', ')
    throw new Error(`Set historical Rest Day(s) for ${preview}${missingCoverage.length > 5 ? ` and ${missingCoverage.length - 5} more employee(s)` : ''} before exporting this date range.`)
  }

  const workbook = XLSX.utils.book_new()
  const usedSheetNames = new Set()
  employees.forEach((employee) => {
    const sheet = buildEmployeeSheet(employee, data, cutoffLabel)
    const name = uniqueSheetName(`${employee.last_name || ''}, ${employee.first_name || ''}`, usedSheetNames)
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  })
  return workbook
}

export const downloadAttendanceWorkbook = (payload, { cutoffLabel = '' } = {}) => {
  const data = payload?.data || payload || {}
  const workbook = buildAttendanceWorkbook(data, { cutoffLabel })
  const safeFrom = dateOnly(data.dateFrom || 'attendance')
  const safeTo = dateOnly(data.dateTo || safeFrom)
  const filename = `D&C_Prime_Attendance_${safeFrom}_to_${safeTo}.xlsx`
  XLSX.writeFile(workbook, filename, { compression: true, cellStyles: true })
  return filename
}
