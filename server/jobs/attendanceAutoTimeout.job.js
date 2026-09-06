import { db } from '../db/connect.js';
import { writeAuditLog } from '../controllers/System/auditLogs.controller.js';
import {
  ensureAttendanceLiteSchema,
  getAttendanceRuntimeSettings,
  getManilaDateTime,
} from '../controllers/System/Employees/attendanceLite.shared.js';
import { buildEmployeeNameSql, dateOnly } from '../controllers/System/Employees/employeeModule.shared.js';

const CHECK_INTERVAL_MS = 60 * 1000;
const STARTUP_DELAY_MS = 8_000;

const clockToSeconds = (value) => {
  const [h = 0, m = 0, s = 0] = String(value || '00:00:00').slice(0, 8).split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

export const applyAutomaticAttendanceTimeouts = async ({ now = new Date() } = {}) => {
  const connection = await db.getConnection();
  let transactionStarted = false;
  try {
    await ensureAttendanceLiteSchema(connection);
    const runtime = await getAttendanceRuntimeSettings(connection);
    const current = getManilaDateTime(now);
    const currentSeconds = clockToSeconds(current.time);
    const timeoutSeconds = clockToSeconds(runtime.defaultTimeOut);
    const includeToday = currentSeconds >= timeoutSeconds;

    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query(`
      SELECT a.employee_attendance_id, a.employee_id, a.attendance_date, a.actual_time_in,
             e.employee_code, ${buildEmployeeNameSql('e')} AS full_name
      FROM employee_attendance_records a
      INNER JOIN employees e ON e.employee_id = a.employee_id
      WHERE a.actual_time_in IS NOT NULL
        AND a.actual_time_out IS NULL
        AND a.attendance_event_id IS NULL
        AND a.actual_time_in <= ?
        AND (a.attendance_date < ? ${includeToday ? 'OR a.attendance_date = ?' : ''})
      ORDER BY a.attendance_date, a.employee_attendance_id
      FOR UPDATE
    `, includeToday ? [runtime.defaultTimeOut, current.date, current.date] : [runtime.defaultTimeOut, current.date]);

    for (const row of rows) {
      await connection.query(`
        UPDATE employee_attendance_records
        SET actual_time_out = ?, time_out_source = 'automatic', updated_by_user_id = NULL
        WHERE employee_attendance_id = ? AND actual_time_out IS NULL
      `, [runtime.defaultTimeOut, row.employee_attendance_id]);

      await writeAuditLog(connection, null, {
        actorName: 'System',
        action: 'update',
        module: 'Attendance',
        entityType: 'employee_attendance',
        entityId: String(row.employee_attendance_id),
        entityLabel: `${row.employee_code} - ${dateOnly(row.attendance_date)}`,
        title: 'Automatic Time Out',
        description: `${row.full_name} was automatically timed out at ${runtime.defaultTimeOut}.`,
        metadata: { employeeId: row.employee_id, attendanceDate: dateOnly(row.attendance_date), timeOut: runtime.defaultTimeOut },
      });
    }

    await connection.commit();
    transactionStarted = false;
    return { updated: rows.length, date: current.date, defaultTimeOut: runtime.defaultTimeOut };
  } catch (error) {
    if (transactionStarted) {
      try { await connection.rollback(); } catch {}
    }
    throw error;
  } finally {
    connection.release();
  }
};

export const startAttendanceAutoTimeoutScheduler = () => {
  let stopped = false;
  let running = false;
  let interval = null;
  let startup = null;

  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await applyAutomaticAttendanceTimeouts();
      if (result.updated > 0) console.log(`Attendance auto-timeout closed ${result.updated} record(s) at ${result.defaultTimeOut}.`);
    } catch (error) {
      console.error('Attendance auto-timeout check failed:', error.message);
    } finally {
      running = false;
    }
  };

  startup = setTimeout(() => void run(), STARTUP_DELAY_MS);
  startup.unref?.();
  interval = setInterval(() => void run(), CHECK_INTERVAL_MS);
  interval.unref?.();

  return {
    stop() {
      stopped = true;
      if (startup) clearTimeout(startup);
      if (interval) clearInterval(interval);
    },
  };
};
