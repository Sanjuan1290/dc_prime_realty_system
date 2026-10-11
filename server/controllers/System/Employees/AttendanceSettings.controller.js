import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import { validateDepartmentConfigs } from './departmentBarcode.shared.js';
import {
  DEFAULT_AUTO_TIME_OUT,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_BREAK_START,
  DEFAULT_LATE_AFTER,
  DEFAULT_RED_HIGHLIGHT_AFTER,
  DEFAULT_REGULAR_WORK_MINUTES,
  DEFAULT_SCHEDULED_TIME_IN,
  DEFAULT_SCHEDULED_TIME_OUT,
  ensureAttendanceLiteSchema,
  getAttendanceRuntimeSettings,
  normalizeClockTime,
} from './attendanceLite.shared.js';

const clockSeconds = (value) => {
  const clean = normalizeClockTime(value);
  if (!clean) return null;
  const [hour, minute, second] = clean.split(':').map(Number);
  return (hour * 3600) + (minute * 60) + second;
};

const normalizeUnsigned = (value, fallback, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(Math.round(numeric), min), max);
};

const normalizePayload = (body = {}, current = {}) => ({
  scheduledTimeIn: normalizeClockTime(body.scheduledTimeIn, current.scheduledTimeIn || DEFAULT_SCHEDULED_TIME_IN),
  scheduledTimeOut: normalizeClockTime(body.scheduledTimeOut, current.scheduledTimeOut || DEFAULT_SCHEDULED_TIME_OUT),
  automaticTimeOut: normalizeClockTime(body.automaticTimeOut, current.automaticTimeOut || DEFAULT_AUTO_TIME_OUT),
  breakStart: normalizeClockTime(body.breakStart, current.breakStart || DEFAULT_BREAK_START),
  breakMinutes: normalizeUnsigned(body.breakMinutes, current.breakMinutes ?? DEFAULT_BREAK_MINUTES, 0, 240),
  regularWorkingMinutes: normalizeUnsigned(body.regularWorkingMinutes, current.regularWorkingMinutes ?? DEFAULT_REGULAR_WORK_MINUTES, 1, 1440),
  lateAfter: normalizeClockTime(body.lateAfter, current.lateAfter || DEFAULT_LATE_AFTER),
  redHighlightAfter: normalizeClockTime(body.redHighlightAfter, current.redHighlightAfter || DEFAULT_RED_HIGHLIGHT_AFTER),
  departmentConfigs: validateDepartmentConfigs(
    Array.isArray(body.departmentConfigs) && body.departmentConfigs.length
      ? body.departmentConfigs
      : current.departmentConfigs || []
  ),
});

const validateAttendanceRules = (payload) => {
  const scheduledIn = clockSeconds(payload.scheduledTimeIn);
  const scheduledOut = clockSeconds(payload.scheduledTimeOut);
  const automaticOut = clockSeconds(payload.automaticTimeOut);
  const breakStart = clockSeconds(payload.breakStart);
  const lateAfter = clockSeconds(payload.lateAfter);
  const redAfter = clockSeconds(payload.redHighlightAfter);

  if ([scheduledIn, scheduledOut, automaticOut, breakStart, lateAfter, redAfter].some((value) => value === null)) {
    throw Object.assign(new Error('Complete all Attendance Settings time fields.'), { statusCode: 400 });
  }
  if (scheduledOut <= scheduledIn) {
    throw Object.assign(new Error('Scheduled Time Out must be later than Scheduled Time In.'), { statusCode: 400 });
  }
  if (automaticOut < scheduledOut) {
    throw Object.assign(new Error('Automatic Time Out cannot be earlier than Scheduled Time Out.'), { statusCode: 400 });
  }
  if (breakStart < scheduledIn || breakStart > scheduledOut) {
    throw Object.assign(new Error('Break Start must fall within the scheduled attendance window.'), { statusCode: 400 });
  }
  if (breakStart + (payload.breakMinutes * 60) > scheduledOut) {
    throw Object.assign(new Error('The configured break cannot extend past Scheduled Time Out.'), { statusCode: 400 });
  }
  if (lateAfter < scheduledIn || lateAfter > scheduledOut) {
    throw Object.assign(new Error('Late After must fall within the scheduled attendance window.'), { statusCode: 400 });
  }
  if (redAfter < lateAfter) {
    throw Object.assign(new Error('Highlight Row Red After cannot be earlier than Late After.'), { statusCode: 400 });
  }
  if (redAfter > scheduledOut) {
    throw Object.assign(new Error('Highlight Row Red After cannot be later than Scheduled Time Out.'), { statusCode: 400 });
  }
};

const responseSettings = (runtime) => ({
  scheduledTimeIn: runtime.scheduledTimeIn,
  scheduledTimeOut: runtime.scheduledTimeOut,
  automaticTimeOut: runtime.automaticTimeOut,
  breakStart: runtime.breakStart,
  breakMinutes: runtime.breakMinutes,
  regularWorkingMinutes: runtime.regularWorkingMinutes,
  lateAfter: runtime.lateAfter,
  redHighlightAfter: runtime.redHighlightAfter,
  departmentConfigs: runtime.departmentConfigs,
  departments: runtime.departments,
});

export const getAttendanceSettings = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const runtime = await getAttendanceRuntimeSettings(connection);
    return res.json({ success: true, data: responseSettings(runtime) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error?.message || 'Attendance settings could not be loaded.' });
  } finally {
    connection.release();
  }
};

export const updateAttendanceSettings = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureAttendanceLiteSchema(connection);
    const current = await getAttendanceRuntimeSettings(connection);
    const payload = normalizePayload(req.body, current);
    validateAttendanceRules(payload);
    const actorId = req.authUser?.id || null;

    await connection.beginTransaction();
    await connection.query(`
      UPDATE system_settings
      SET
        attendance_scheduled_time_in = ?,
        attendance_scheduled_time_out = ?,
        attendance_default_time_out = ?,
        attendance_break_start = ?,
        attendance_break_minutes = ?,
        attendance_regular_work_minutes = ?,
        attendance_late_after = ?,
        attendance_red_highlight_after = ?,
        employee_departments_json = ?,
        employee_department_codes_json = ?,
        updated_by_user_id = ?
      WHERE system_setting_id = 1
    `, [
      payload.scheduledTimeIn,
      payload.scheduledTimeOut,
      payload.automaticTimeOut,
      payload.breakStart,
      payload.breakMinutes,
      payload.regularWorkingMinutes,
      payload.lateAfter,
      payload.redHighlightAfter,
      JSON.stringify(payload.departmentConfigs.map((item) => item.name)),
      JSON.stringify(payload.departmentConfigs),
      actorId,
    ]);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Attendance',
      entityType: 'attendance_settings',
      entityId: '1',
      entityLabel: 'Attendance Settings',
      title: 'Updated attendance settings',
      description: 'Updated attendance schedule, Excel defaults, automatic Time Out, and employee department code prefixes.',
      metadata: {
        previous: responseSettings(current),
        current: {
          scheduledTimeIn: payload.scheduledTimeIn,
          scheduledTimeOut: payload.scheduledTimeOut,
          automaticTimeOut: payload.automaticTimeOut,
          breakStart: payload.breakStart,
          breakMinutes: payload.breakMinutes,
          regularWorkingMinutes: payload.regularWorkingMinutes,
          lateAfter: payload.lateAfter,
          redHighlightAfter: payload.redHighlightAfter,
          departmentConfigs: payload.departmentConfigs,
        },
      },
    });

    await connection.commit();
    const runtime = await getAttendanceRuntimeSettings(connection);
    return res.json({
      success: true,
      message: 'Attendance settings saved successfully.',
      data: responseSettings(runtime),
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ message: error?.message || 'Attendance settings could not be saved.' });
  } finally {
    connection.release();
  }
};

