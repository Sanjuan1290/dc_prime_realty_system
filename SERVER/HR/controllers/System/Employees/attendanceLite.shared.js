import { ensureEmployeeModuleTables, timeOnly } from './employeeModule.shared.js';
import { normalizeDepartmentConfigs } from './departmentBarcode.shared.js';

export const ATTENDANCE_TIME_ZONE = 'Asia/Manila';
export const DEFAULT_AUTO_TIME_OUT = '20:00:00';
export const DEFAULT_SCHEDULED_TIME_IN = '09:00:00';
export const DEFAULT_SCHEDULED_TIME_OUT = '20:00:00';
export const DEFAULT_BREAK_START = '12:00:00';
export const DEFAULT_BREAK_MINUTES = 60;
export const DEFAULT_REGULAR_WORK_MINUTES = 10 * 60;
export const DEFAULT_LATE_AFTER = '09:00:00';
export const DEFAULT_RED_HIGHLIGHT_AFTER = '09:15:00';

let attendanceLiteSchemaReady = false;

const pad = (value) => String(value).padStart(2, '0');

export const getManilaDateTime = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${pad(hour)}:${parts.minute}:${parts.second}`,
  };
};

export const normalizeClockTime = (value, fallback = null) => timeOnly(value) || fallback;

export const enumerateDateRange = (start, end) => {
  const result = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end || ''))) return result;
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last && result.length < 62) {
    result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
};

// HR owns its settings. All schema changes belong to Batch 5 migrations.
export const ensureAttendanceLiteSchema = async (connection) => {
  await ensureEmployeeModuleTables(connection);
  await connection.query('SELECT id FROM hr_settings WHERE id = 1 LIMIT 0');
  await connection.query('SELECT attendance_date FROM attendance_day_settings LIMIT 0');
  await connection.query('SELECT attendance_event_id FROM attendance_events LIMIT 0');
};

export const getAttendanceRuntimeSettings = async (connection) => {
  await ensureAttendanceLiteSchema(connection);
  const [rows] = await connection.query(`
    SELECT
      attendance_default_time_out,
      attendance_scheduled_time_in,
      attendance_scheduled_time_out,
      attendance_break_start,
      attendance_break_minutes,
      attendance_regular_work_minutes,
      attendance_late_after,
      attendance_red_highlight_after,
      employee_departments_json,
      employee_department_codes_json
    FROM hr_settings
    WHERE id = 1
    LIMIT 1
  `);
  const row = rows[0] || {};
  const departmentConfigs = normalizeDepartmentConfigs(row.employee_department_codes_json, row.employee_departments_json);
  const automaticTimeOut = normalizeClockTime(row.attendance_default_time_out, DEFAULT_AUTO_TIME_OUT);
  return {
    defaultTimeOut: automaticTimeOut,
    automaticTimeOut,
    scheduledTimeIn: normalizeClockTime(row.attendance_scheduled_time_in, DEFAULT_SCHEDULED_TIME_IN),
    scheduledTimeOut: normalizeClockTime(row.attendance_scheduled_time_out, DEFAULT_SCHEDULED_TIME_OUT),
    breakStart: normalizeClockTime(row.attendance_break_start, DEFAULT_BREAK_START),
    breakMinutes: Number(row.attendance_break_minutes ?? DEFAULT_BREAK_MINUTES),
    regularWorkingMinutes: Number(row.attendance_regular_work_minutes ?? DEFAULT_REGULAR_WORK_MINUTES),
    lateAfter: normalizeClockTime(row.attendance_late_after, DEFAULT_LATE_AFTER),
    redHighlightAfter: normalizeClockTime(row.attendance_red_highlight_after, DEFAULT_RED_HIGHLIGHT_AFTER),
    departmentConfigs,
    departments: departmentConfigs.map((item) => item.name),
  };
};



