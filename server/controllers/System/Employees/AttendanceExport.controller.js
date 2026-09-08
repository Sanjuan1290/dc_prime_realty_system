import { db } from '../../../db/connect.js';
import { buildEmployeeNameSql, dateOnly } from './employeeModule.shared.js';
import { ensureAttendanceLiteSchema, enumerateDateRange, getAttendanceRuntimeSettings, getManilaDateTime } from './attendanceLite.shared.js';
import { getRestDayAssignmentsForRange } from '../../../services/employeeRestDay.service.js';

const getErrorMessage = (error) => error?.message || 'Attendance export data could not be prepared.';

const normalizeExportRange = (req) => {
  const dateFrom = dateOnly(req.query.dateFrom);
  const dateTo = dateOnly(req.query.dateTo || req.query.dateFrom);
  if (!dateFrom || !dateTo) {
    throw Object.assign(new Error('Select a valid attendance export date range.'), { statusCode: 400 });
  }
  if (dateTo < dateFrom) {
    throw Object.assign(new Error('Export end date cannot be before the start date.'), { statusCode: 400 });
  }

  const dates = enumerateDateRange(dateFrom, dateTo);
  if (!dates.length || dates.length > 31) {
    throw Object.assign(new Error('Attendance Excel exports can include up to 31 days at a time.'), { statusCode: 400 });
  }

  return { dateFrom, dateTo, dates };
};

export const getAttendanceExportData = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);
    const { dateFrom, dateTo, dates } = normalizeExportRange(req);

    const [employees] = await connection.query(`
      SELECT
        e.employee_id,
        e.employee_code,
        e.first_name,
        e.middle_name,
        e.last_name,
        e.department,
        e.employment_type,
        e.hire_date,
        ${buildEmployeeNameSql('e')} AS full_name
      FROM employees e
      WHERE e.employee_status = 'active'
      ORDER BY e.last_name ASC, e.first_name ASC, e.middle_name ASC
    `);

    const employeeIds = employees.map((employee) => Number(employee.employee_id));
    const restDayAssignments = await getRestDayAssignmentsForRange(
      connection,
      employeeIds,
      dateFrom,
      dateTo
    );

    let attendance = [];
    if (employeeIds.length) {
      const placeholders = employeeIds.map(() => '?').join(',');
      const [rows] = await connection.query(`
        SELECT
          a.employee_attendance_id,
          a.employee_id,
          a.attendance_event_id,
          a.attendance_date,
          a.actual_time_in,
          a.time_in_source,
          a.actual_time_out,
          a.time_out_source,
          a.attendance_status,
          a.notes,
          a.source,
          ev.event_name,
          ev.attendance_treatment,
          ev.day_type AS event_day_type,
          COALESCE(ev.day_type, ds.day_type, 'regular') AS day_type,
          ds.notes AS day_notes
        FROM employee_attendance_records a
        LEFT JOIN attendance_events ev
          ON ev.attendance_event_id = a.attendance_event_id
        LEFT JOIN attendance_day_settings ds
          ON ds.attendance_date = a.attendance_date
        WHERE a.employee_id IN (${placeholders})
          AND a.attendance_date BETWEEN ? AND ?
        ORDER BY a.employee_id ASC, a.attendance_date ASC
      `, [...employeeIds, dateFrom, dateTo]);
      attendance = rows.map((row) => ({
        ...row,
        employee_attendance_id: Number(row.employee_attendance_id),
        employee_id: Number(row.employee_id),
        attendance_event_id: row.attendance_event_id ? Number(row.attendance_event_id) : null,
        attendance_date: dateOnly(row.attendance_date),
      }));
    }

    const [daySettings] = await connection.query(`
      SELECT attendance_date, day_type, notes, source_event_id
      FROM attendance_day_settings
      WHERE attendance_date BETWEEN ? AND ?
      ORDER BY attendance_date ASC
    `, [dateFrom, dateTo]);

    const [events] = await connection.query(`
      SELECT
        attendance_event_id,
        event_name,
        start_date,
        end_date,
        attendance_treatment,
        event_time_in,
        event_time_out,
        day_type,
        event_status
      FROM attendance_events
      WHERE event_status = 'active'
        AND end_date >= ?
        AND start_date <= ?
      ORDER BY start_date ASC, attendance_event_id ASC
    `, [dateFrom, dateTo]);

    const runtime = await getAttendanceRuntimeSettings(connection);
    const generated = getManilaDateTime();

    return res.json({
      success: true,
      data: {
        dateFrom,
        dateTo,
        dates,
        generatedAt: `${generated.date} ${generated.time}`,
        schedule: {
          scheduledTimeIn: runtime.scheduledTimeIn,
          scheduledTimeOut: runtime.scheduledTimeOut,
          breakStart: runtime.breakStart,
          breakMinutes: runtime.breakMinutes,
          regularWorkingMinutes: runtime.regularWorkingMinutes,
          lateAfter: runtime.lateAfter,
          redHighlightAfter: runtime.redHighlightAfter,
        },
        employees: employees.map((employee) => ({
          ...employee,
          employee_id: Number(employee.employee_id),
          hire_date: dateOnly(employee.hire_date),
        })),
        restDayAssignments,
        attendance,
        daySettings: daySettings.map((day) => ({
          ...day,
          attendance_date: dateOnly(day.attendance_date),
          source_event_id: day.source_event_id ? Number(day.source_event_id) : null,
        })),
        events: events.map((event) => ({
          ...event,
          attendance_event_id: Number(event.attendance_event_id),
          start_date: dateOnly(event.start_date),
          end_date: dateOnly(event.end_date),
        })),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

