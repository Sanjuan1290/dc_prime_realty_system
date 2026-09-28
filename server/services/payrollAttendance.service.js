import { dateOnly } from '../controllers/System/Employees/employeeModule.shared.js';
import { enumerateDateRange, getAttendanceRuntimeSettings } from '../controllers/System/Employees/attendanceLite.shared.js';
import { getEmployeeRestDaysAsOf, getRestDayAssignmentsForRange } from './employeeRestDay.service.js';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const validDayTypes = new Set(['regular', 'double_pay', 'regular_holiday', 'special_holiday']);

const secondsFromTime = (value) => {
  if (!value) return null;
  const match = String(value).slice(0, 8).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
};

const breakOverlapSeconds = ({ timeInSeconds, timeOutSeconds, breakStart, breakMinutes }) => {
  if (timeInSeconds === null || timeOutSeconds === null || timeOutSeconds <= timeInSeconds) return 0;
  const breakStartSeconds = secondsFromTime(breakStart);
  if (breakStartSeconds === null) return 0;
  const breakEndSeconds = breakStartSeconds + Number(breakMinutes || 0) * 60;
  return Math.max(Math.min(timeOutSeconds, breakEndSeconds) - Math.max(timeInSeconds, breakStartSeconds), 0);
};

const normalizeDayType = (value) => validDayTypes.has(String(value || '')) ? String(value) : 'regular';

const activeRestDaysForDate = (employeeId, date, assignments, fallback = []) => {
  const historical = assignments
    .filter((row) => Number(row.employee_id) === Number(employeeId)
      && row.effective_from <= date
      && (!row.effective_to || row.effective_to >= date))
    .map((row) => String(row.day_of_week || '').toLowerCase());
  return historical.length ? historical : fallback;
};

export const calculateAttendancePayrollRow = ({ date, attendance, restDays, daySetting, schedule }) => {
  const weekdayKey = DAY_KEYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const dayType = normalizeDayType(attendance?.day_type || daySetting?.day_type || 'regular');
  const hasEvent = Boolean(attendance?.attendance_event_id);
  const isHoliday = !hasEvent && dayType !== 'regular';
  const isRestDay = !hasEvent && !isHoliday && restDays.includes(weekdayKey);
  const timeIn = attendance?.actual_time_in || null;
  const timeOut = attendance?.actual_time_out || null;
  const isExplicitAbsent = String(attendance?.attendance_status || '').toLowerCase() === 'absent';
  const regularWorkingSeconds = Number(schedule.regularWorkingMinutes || 600) * 60;

  const base = {
    date,
    dayType,
    timeIn,
    timeOut,
    scheduledDay: false,
    absence: false,
    totalWorkedSeconds: 0,
    regularAttendedSeconds: 0,
    lateSeconds: 0,
    overtimeSeconds: 0,
    restDayOvertimeSeconds: 0,
    regularHolidaySeconds: 0,
    specialHolidaySeconds: 0,
    doublePaySeconds: 0,
    nightDifferentialSeconds: Number(attendance?.night_differential_seconds || 0),
  };

  if (isRestDay && !timeIn && !timeOut) return { ...base, state: 'rest_day' };
  if (isExplicitAbsent && !timeIn && !timeOut) return { ...base, state: 'absent', scheduledDay: true, absence: true };
  if (isHoliday && !timeIn && !timeOut) return { ...base, state: 'holiday' };
  if (hasEvent && !timeIn && !timeOut) return { ...base, state: 'company_event', scheduledDay: true };
  if (!timeIn && !timeOut) return { ...base, state: 'absent', scheduledDay: true, absence: true };

  const timeInSeconds = secondsFromTime(timeIn);
  const timeOutSeconds = secondsFromTime(timeOut);
  const scheduledOut = secondsFromTime(schedule.scheduledTimeOut);
  const lateAfter = secondsFromTime(schedule.lateAfter || schedule.scheduledTimeIn || '09:00:00');
  let totalWorkedSeconds = 0;
  if (timeInSeconds !== null && timeOutSeconds !== null && timeOutSeconds >= timeInSeconds) {
    totalWorkedSeconds = Math.max(
      (timeOutSeconds - timeInSeconds) - breakOverlapSeconds({
        timeInSeconds,
        timeOutSeconds,
        breakStart: schedule.breakStart || '12:00:00',
        breakMinutes: schedule.breakMinutes ?? 60,
      }),
      0
    );
  }

  if (isRestDay) {
    return {
      ...base,
      state: 'rest_day_work',
      totalWorkedSeconds,
      restDayOvertimeSeconds: totalWorkedSeconds,
    };
  }

  if (isHoliday) {
    const lateSeconds = timeInSeconds !== null && lateAfter !== null ? Math.max(timeInSeconds - lateAfter, 0) : 0;
    return {
      ...base,
      state: 'holiday_work',
      totalWorkedSeconds,
      lateSeconds,
      regularHolidaySeconds: dayType === 'regular_holiday' ? totalWorkedSeconds : 0,
      specialHolidaySeconds: dayType === 'special_holiday' ? totalWorkedSeconds : 0,
      doublePaySeconds: dayType === 'double_pay' ? totalWorkedSeconds : 0,
    };
  }

  if (hasEvent) {
    const overtimeSeconds = timeOutSeconds !== null && scheduledOut !== null
      ? Math.min(Math.max(timeOutSeconds - scheduledOut, 0), totalWorkedSeconds)
      : 0;
    return {
      ...base,
      state: 'company_event_work',
      scheduledDay: true,
      totalWorkedSeconds,
      overtimeSeconds,
      regularAttendedSeconds: Math.min(Math.max(totalWorkedSeconds - overtimeSeconds, 0), regularWorkingSeconds),
    };
  }

  const lateSeconds = timeInSeconds !== null && lateAfter !== null ? Math.max(timeInSeconds - lateAfter, 0) : 0;
  const rawOvertime = timeOutSeconds !== null && scheduledOut !== null ? Math.max(timeOutSeconds - scheduledOut, 0) : 0;
  const overtimeSeconds = Math.min(rawOvertime, totalWorkedSeconds);
  return {
    ...base,
    state: 'regular_work',
    scheduledDay: true,
    totalWorkedSeconds,
    lateSeconds,
    overtimeSeconds,
    regularAttendedSeconds: Math.min(Math.max(totalWorkedSeconds - overtimeSeconds, 0), regularWorkingSeconds),
  };
};

export const summarizeAttendancePayrollRows = ({ rows, regularWorkingMinutes }) => {
  const regularWorkingSeconds = Number(regularWorkingMinutes || 600) * 60;
  const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const scheduledDays = rows.filter((row) => row.scheduledDay).length;
  const absenceDays = rows.filter((row) => row.absence).length;
  const lateSeconds = sum('lateSeconds');
  const absenceSeconds = absenceDays * regularWorkingSeconds;
  const tardinessAbsenceSeconds = lateSeconds + absenceSeconds;

  return {
    scheduledDays,
    absenceDays,
    expectedRegularMinutes: Math.round((scheduledDays * regularWorkingSeconds) / 60),
    regularAttendedMinutes: Math.round(sum('regularAttendedSeconds') / 60),
    ptoMinutes: 0,
    regularHolidayMinutes: Math.round(sum('regularHolidaySeconds') / 60),
    specialHolidayMinutes: Math.round(sum('specialHolidaySeconds') / 60),
    doublePayMinutes: Math.round(sum('doublePaySeconds') / 60),
    lateMinutes: Math.round(lateSeconds / 60),
    absenceMinutes: Math.round(absenceSeconds / 60),
    tardinessAbsenceMinutes: Math.round(tardinessAbsenceSeconds / 60),
    overtimeMinutes: Math.round(sum('overtimeSeconds') / 60),
    restDayOvertimeMinutes: Math.round(sum('restDayOvertimeSeconds') / 60),
    nightDifferentialMinutes: Math.round(sum('nightDifferentialSeconds') / 60),
    totalWorkedMinutes: Math.round(sum('totalWorkedSeconds') / 60),
  };
};

export const getPayrollAttendanceSummary = async (connection, { employeeId, dateFrom, dateTo }) => {
  const dates = enumerateDateRange(dateFrom, dateTo);
  if (!dates.length) throw Object.assign(new Error('Attendance range is invalid.'), { statusCode: 400 });

  const runtime = await getAttendanceRuntimeSettings(connection);
  const schedule = {
    scheduledTimeIn: runtime.scheduledTimeIn,
    scheduledTimeOut: runtime.scheduledTimeOut,
    breakStart: runtime.breakStart,
    breakMinutes: runtime.breakMinutes,
    regularWorkingMinutes: runtime.regularWorkingMinutes,
    lateAfter: runtime.lateAfter,
  };

  const assignments = await getRestDayAssignmentsForRange(connection, [employeeId], dateFrom, dateTo);
  const fallbackMap = await getEmployeeRestDaysAsOf(connection, [employeeId], dateTo);
  const fallbackRestDays = fallbackMap.get(Number(employeeId)) || [];

  const [attendanceRows] = await connection.query(`
    SELECT
      a.employee_attendance_id, a.employee_id, a.attendance_event_id, a.attendance_date,
      a.actual_time_in, a.actual_time_out, a.attendance_status,
      a.night_differential_seconds,
      ev.event_name,
      COALESCE(ev.day_type, ds.day_type, 'regular') AS day_type
    FROM employee_attendance_records a
    LEFT JOIN attendance_events ev ON ev.attendance_event_id = a.attendance_event_id
    LEFT JOIN attendance_day_settings ds ON ds.attendance_date = a.attendance_date
    WHERE a.employee_id = ? AND a.attendance_date BETWEEN ? AND ?
    ORDER BY a.attendance_date ASC
  `, [employeeId, dateFrom, dateTo]);

  const [daySettingRows] = await connection.query(`
    SELECT attendance_date, day_type
    FROM attendance_day_settings
    WHERE attendance_date BETWEEN ? AND ?
  `, [dateFrom, dateTo]);

  const attendanceByDate = new Map(attendanceRows.map((row) => [dateOnly(row.attendance_date), {
    ...row,
    attendance_date: dateOnly(row.attendance_date),
  }]));
  const daySettingByDate = new Map(daySettingRows.map((row) => [dateOnly(row.attendance_date), {
    ...row,
    attendance_date: dateOnly(row.attendance_date),
  }]));

  const rows = dates.map((date) => calculateAttendancePayrollRow({
    date,
    attendance: attendanceByDate.get(date) || null,
    restDays: activeRestDaysForDate(employeeId, date, assignments, fallbackRestDays),
    daySetting: daySettingByDate.get(date) || null,
    schedule,
  }));

  return {
    schedule,
    rows,
    summary: summarizeAttendancePayrollRows({ rows, regularWorkingMinutes: runtime.regularWorkingMinutes }),
  };
};
