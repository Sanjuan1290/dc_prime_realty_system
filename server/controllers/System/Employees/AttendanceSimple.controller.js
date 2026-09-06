import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import { buildEmployeeNameSql, cleanText, dateOnly, nullableText, timeOnly } from './employeeModule.shared.js';
import {
  ensureAttendanceLiteSchema,
  enumerateDateRange,
  getAttendanceRuntimeSettings,
  getManilaDateTime,
  normalizeClockTime,
} from './attendanceLite.shared.js';

const dayTypes = new Set(['regular', 'double_pay', 'regular_holiday', 'special_holiday']);
const eventTreatments = new Set(['full_day', 'custom_time', 'record_only']);

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Attendance already exists for this employee and date.';
  return error?.message || 'Attendance operation failed.';
};

const normalizeDayType = (value) => dayTypes.has(String(value || '')) ? String(value) : 'regular';
const normalizeTreatment = (value) => eventTreatments.has(String(value || '')) ? String(value) : 'record_only';
const normalizeEmployeeIds = (value) => Array.from(new Set((Array.isArray(value) ? value : []).map(Number).filter(Boolean)));
const isTimeOutBeforeTimeIn = (timeIn, timeOut) => Boolean(timeIn && timeOut && timeOut < timeIn);

const getEmployeeByBarcode = async (connection, barcode) => {
  const [rows] = await connection.query(`
    SELECT e.*, ${buildEmployeeNameSql('e')} AS full_name
    FROM employees e
    WHERE UPPER(e.employee_code) = UPPER(?)
      AND e.employee_status = 'active'
    LIMIT 1
  `, [barcode]);

  return rows[0] || null;
};

const getEmployeeById = async (connection, employeeId) => {
  const [rows] = await connection.query(`
    SELECT e.*, ${buildEmployeeNameSql('e')} AS full_name
    FROM employees e
    WHERE e.employee_id = ?
      AND e.employee_status <> 'archived'
    LIMIT 1
  `, [employeeId]);

  return rows[0] || null;
};

const getAttendanceForUpdate = async (connection, employeeId, attendanceDate) => {
  const [rows] = await connection.query(`
    SELECT *
    FROM employee_attendance_records
    WHERE employee_id = ?
      AND attendance_date = ?
    LIMIT 1
    FOR UPDATE
  `, [employeeId, attendanceDate]);

  return rows[0] || null;
};

const mapAttendance = (row) => ({
  ...row,
  employee_attendance_id: Number(row.employee_attendance_id),
  employee_id: Number(row.employee_id),
  attendance_event_id: row.attendance_event_id
    ? Number(row.attendance_event_id)
    : null,
  event_name: row.event_name || null,
  day_type: row.day_type || 'regular',

  source_label: row.attendance_event_id
    ? 'Company Event'
    : row.time_out_source === 'automatic'
      ? 'Auto Time Out'
      : row.time_in_source === 'admin' || row.time_out_source === 'admin'
        ? 'Admin Correction'
        : row.time_in_source === 'manual' || row.time_out_source === 'manual'
          ? 'Manual Entry'
          : 'Barcode',
});

const setDaySetting = async (
  connection,
  {
    attendanceDate,
    dayType,
    notes = null,
    actorId = null,
    sourceEventId = null,
  }
) => {
  await connection.query(`
    INSERT INTO attendance_day_settings (
      attendance_date,
      day_type,
      notes,
      source_event_id,
      updated_by_user_id
    )
    VALUES (?, ?, ?, ?, ?)

    ON DUPLICATE KEY UPDATE
      day_type = VALUES(day_type),
      notes = VALUES(notes),
      source_event_id = VALUES(source_event_id),
      updated_by_user_id = VALUES(updated_by_user_id)
  `, [
    attendanceDate,
    dayType,
    notes,
    sourceEventId,
    actorId,
  ]);
};

const applyEventDaySetting = async (
  connection,
  {
    attendanceDate,
    dayType,
    eventName,
    actorId,
    eventId,
  }
) => {
  if (dayType === 'regular') return;

  const [rows] = await connection.query(
    `
      SELECT *
      FROM attendance_day_settings
      WHERE attendance_date = ?
      LIMIT 1
      FOR UPDATE
    `,
    [attendanceDate]
  );

  const current = rows[0] || null;

  if (
    current &&
    current.day_type !== 'regular' &&
    current.day_type !== dayType
  ) {
    const error = new Error(
      `${attendanceDate} is already classified as ${String(current.day_type).replaceAll('_', ' ')}. All events on the same date must use the same day classification.`
    );

    error.statusCode = 409;
    throw error;
  }

  if (!current || current.day_type === 'regular') {
    await setDaySetting(connection, {
      attendanceDate,
      dayType,
      notes: eventName,
      actorId,
      sourceEventId: eventId,
    });
  }
};

const restoreEventDaySettings = async (
  connection,
  {
    dates = [],
    eventId,
    actorId,
  }
) => {
  for (const attendanceDate of dates) {
    const [settingRows] = await connection.query(
      `
        SELECT source_event_id
        FROM attendance_day_settings
        WHERE attendance_date = ?
        LIMIT 1
        FOR UPDATE
      `,
      [attendanceDate]
    );

    if (
      Number(settingRows[0]?.source_event_id || 0) !== Number(eventId)
    ) {
      continue;
    }

    const [replacementRows] = await connection.query(`
      SELECT
        attendance_event_id,
        event_name,
        day_type
      FROM attendance_events
      WHERE attendance_event_id <> ?
        AND event_status = 'active'
        AND start_date <= ?
        AND end_date >= ?
        AND day_type <> 'regular'
      ORDER BY attendance_event_id ASC
      LIMIT 1
    `, [
      eventId,
      attendanceDate,
      attendanceDate,
    ]);

    const replacement = replacementRows[0] || null;

    if (replacement) {
      await setDaySetting(connection, {
        attendanceDate,
        dayType: replacement.day_type,
        notes: replacement.event_name,
        actorId,
        sourceEventId: replacement.attendance_event_id,
      });
    } else {
      await setDaySetting(connection, {
        attendanceDate,
        dayType: 'regular',
        notes: null,
        actorId,
        sourceEventId: null,
      });
    }
  }
};

const formatAttendanceClock = (value) => {
  if (!value) return '';

  const [hourRaw = '0', minute = '00'] = String(value)
    .slice(0, 5)
    .split(':');

  const hour24 = Number(hourRaw);

  if (!Number.isFinite(hour24)) {
    return String(value).slice(0, 5);
  }

  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${String(minute).padStart(2, '0')} ${
    hour24 >= 12 ? 'PM' : 'AM'
  }`;
};

const attendanceScanConflict = ({
  code,
  message,
  employee,
  action,
  time = null,
  date = null,
}) => Object.assign(
  new Error(message),
  {
    statusCode: 409,
    code,

    data: {
      employee,
      action,
      time: time
        ? String(time).slice(0, 8)
        : null,
      date,
    },
  }
);

export const scanAttendance = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const barcode = cleanText(
      req.body.barcode_code || req.body.employee_code
    ).toUpperCase();

    const action = String(req.body.action || '').toLowerCase();

    if (!barcode) {
      return res.status(400).json({
        message: 'Enter or scan a barcode code.',
      });
    }

    if (!['time_in', 'time_out'].includes(action)) {
      return res.status(400).json({
        message: 'Select Time In or Time Out first.',
      });
    }

    const now = getManilaDateTime();

    await connection.beginTransaction();

    const employee = await getEmployeeByBarcode(
      connection,
      barcode
    );

    if (!employee) {
      throw Object.assign(
        new Error('No active employee matches that barcode code.'),
        {
          statusCode: 404,
        }
      );
    }

    await connection.query(
      `
        SELECT employee_id
        FROM employees
        WHERE employee_id = ?
        FOR UPDATE
      `,
      [employee.employee_id]
    );

    const attendance = await getAttendanceForUpdate(
      connection,
      employee.employee_id,
      now.date
    );

    if (action === 'time_in') {
      if (attendance?.attendance_event_id) {
        throw Object.assign(
          new Error(
            `${employee.full_name} already has attendance recorded through a company event today.`
          ),
          {
            statusCode: 409,
          }
        );
      }

      if (attendance?.actual_time_in) {
        const previousTimeIn = String(
          attendance.actual_time_in
        ).slice(0, 8);

        throw attendanceScanConflict({
          code: 'ALREADY_TIMED_IN',
          message: `${employee.full_name} already timed in today at ${formatAttendanceClock(previousTimeIn)}. No action is needed.`,
          employee,
          action: 'time_in',
          time: previousTimeIn,
          date: now.date,
        });
      }

      let attendanceId = attendance?.employee_attendance_id;

      if (attendance) {
        await connection.query(`
          UPDATE employee_attendance_records
          SET
            actual_time_in = ?,
            time_in_source = 'barcode',
            attendance_status = 'present',
            source = 'device',
            updated_by_user_id = ?
          WHERE employee_attendance_id = ?
        `, [
          now.time,
          req.authUser?.id || null,
          attendanceId,
        ]);
      } else {
        const [result] = await connection.query(`
          INSERT INTO employee_attendance_records (
            employee_id,
            attendance_date,
            actual_time_in,
            time_in_source,
            attendance_status,
            source,
            recorded_by_user_id,
            updated_by_user_id
          )
          VALUES (
            ?,
            ?,
            ?,
            'barcode',
            'present',
            'device',
            ?,
            ?
          )
        `, [
          employee.employee_id,
          now.date,
          now.time,
          req.authUser?.id || null,
          req.authUser?.id || null,
        ]);

        attendanceId = result.insertId;
      }

      await writeAuditLog(connection, req, {
        actor: req.authUser,
        action: 'create',
        module: 'Attendance',
        entityType: 'employee_attendance',
        entityId: String(attendanceId),
        entityLabel: `${employee.employee_code} - ${now.date}`,
        title: 'Employee timed in',
        description: `${employee.full_name} timed in at ${now.time}.`,

        metadata: {
          employeeId: employee.employee_id,
          barcode: employee.employee_code,
          attendanceDate: now.date,
          timeIn: now.time,
        },
      });

      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Time In successful.',

        data: {
          employee,
          attendanceId,
          date: now.date,
          time: now.time,
          action,
        },
      });
    }

    if (!attendance?.actual_time_in) {
      throw attendanceScanConflict({
        code: 'TIME_IN_REQUIRED',
        message: `No Time In record was found for ${employee.full_name} today. Please Time In first or ask an administrator for help.`,
        employee,
        action: 'time_out',
        date: now.date,
      });
    }

    if (attendance.attendance_event_id) {
      throw Object.assign(
        new Error(
          `${employee.full_name}'s attendance is already recorded through a company event today.`
        ),
        {
          statusCode: 409,
        }
      );
    }

    if (attendance.actual_time_out) {
      const previousTimeOut = String(
        attendance.actual_time_out
      ).slice(0, 8);

      throw attendanceScanConflict({
        code: 'ALREADY_TIMED_OUT',
        message: `${employee.full_name} already timed out today at ${formatAttendanceClock(previousTimeOut)}. No action is needed.`,
        employee,
        action: 'time_out',
        time: previousTimeOut,
        date: now.date,
      });
    }

    await connection.query(`
      UPDATE employee_attendance_records
      SET
        actual_time_out = ?,
        time_out_source = 'barcode',
        source = 'device',
        updated_by_user_id = ?
      WHERE employee_attendance_id = ?
    `, [
      now.time,
      req.authUser?.id || null,
      attendance.employee_attendance_id,
    ]);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Attendance',
      entityType: 'employee_attendance',
      entityId: String(attendance.employee_attendance_id),
      entityLabel: `${employee.employee_code} - ${now.date}`,
      title: 'Employee timed out',
      description: `${employee.full_name} timed out at ${now.time}.`,

      metadata: {
        employeeId: employee.employee_id,
        barcode: employee.employee_code,
        attendanceDate: now.date,
        timeOut: now.time,
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: 'Time Out successful.',

      data: {
        employee,
        attendanceId: attendance.employee_attendance_id,
        date: now.date,
        time: now.time,
        action,
      },
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || '',
      message: getErrorMessage(error),
      data: error.data || null,
    });
  } finally {
    connection.release();
  }
};

export const getAttendanceRecords = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const today = getManilaDateTime().date;

    const dateFrom =
      dateOnly(req.query.dateFrom) || today;

    const dateTo =
      dateOnly(req.query.dateTo) || dateFrom;

    const page = Math.max(
      Number(req.query.page || 1),
      1
    );

    const limit = Math.min(
      Math.max(
        Number(req.query.limit || 50),
        1
      ),
      100
    );

    const offset = (page - 1) * limit;

    const search = cleanText(req.query.search);

    const status = cleanText(
      req.query.status,
      'all'
    );

    const params = [
      dateFrom,
      dateTo,
    ];

    const where = [
      'a.attendance_date BETWEEN ? AND ?',
    ];

    if (search) {
      const keyword = `%${search}%`;

      where.push(`
        (
          ${buildEmployeeNameSql('e')} LIKE ?
          OR e.employee_code LIKE ?
          OR e.department LIKE ?
        )
      `);

      params.push(
        keyword,
        keyword,
        keyword
      );
    }

    if (status === 'in_office') {
      where.push(`
        a.actual_time_in IS NOT NULL
        AND a.actual_time_out IS NULL
      `);
    }

    if (status === 'timed_out') {
      where.push(`
        a.actual_time_out IS NOT NULL
        AND COALESCE(
          a.time_out_source,
          ""
        ) <> "automatic"
      `);
    }

    if (status === 'automatic') {
      where.push(`
        a.time_out_source = "automatic"
      `);
    }

    if (status === 'event') {
      where.push(`
        a.attendance_event_id IS NOT NULL
      `);
    }

    const [countRows] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM employee_attendance_records a
      INNER JOIN employees e
        ON e.employee_id = a.employee_id
      WHERE ${where.join(' AND ')}
    `, params);

    const total = Number(
      countRows[0]?.total || 0
    );

    const [rows] = await connection.query(`
      SELECT
        a.*,
        e.employee_code,
        ${buildEmployeeNameSql('e')} AS full_name,
        e.department,
        e.employment_type,
        ev.event_name,
        COALESCE(
          ds.day_type,
          'regular'
        ) AS day_type,
        TRIM(
          CONCAT_WS(
            ' ',
            updater.first_name,
            updater.middle_name,
            updater.last_name
          )
        ) AS updated_by_name

      FROM employee_attendance_records a

      INNER JOIN employees e
        ON e.employee_id = a.employee_id

      LEFT JOIN attendance_events ev
        ON ev.attendance_event_id =
          a.attendance_event_id

      LEFT JOIN attendance_day_settings ds
        ON ds.attendance_date =
          a.attendance_date

      LEFT JOIN users updater
        ON updater.id =
          a.updated_by_user_id

      WHERE ${where.join(' AND ')}

      ORDER BY
        a.attendance_date DESC,
        COALESCE(
          a.actual_time_out,
          a.actual_time_in,
          '00:00:00'
        ) DESC,
        a.employee_attendance_id DESC,
        e.last_name ASC,
        e.first_name ASC

      LIMIT ?
      OFFSET ?
    `, [
      ...params,
      limit,
      offset,
    ]);

    const [summaryRows] = await connection.query(`
      SELECT
        COUNT(*) AS present,

        SUM(
          actual_time_in IS NOT NULL
          AND actual_time_out IS NULL
        ) AS in_office,

        SUM(
          actual_time_out IS NOT NULL
        ) AS timed_out,

        SUM(
          attendance_event_id IS NOT NULL
        ) AS event_participants,

        SUM(
          time_out_source = 'automatic'
        ) AS automatic_time_outs

      FROM employee_attendance_records
      WHERE attendance_date = ?
    `, [
      dateFrom === dateTo
        ? dateFrom
        : today,
    ]);

    const [dayRows] = await connection.query(`
      SELECT *
      FROM attendance_day_settings
      WHERE attendance_date = ?
      LIMIT 1
    `, [
      dateFrom === dateTo
        ? dateFrom
        : today,
    ]);

    const runtime =
      await getAttendanceRuntimeSettings(
        connection
      );

    return res.json({
      success: true,

      data: rows.map(mapAttendance),

      summary: {
        present: Number(
          summaryRows[0]?.present || 0
        ),

        inOffice: Number(
          summaryRows[0]?.in_office || 0
        ),

        timedOut: Number(
          summaryRows[0]?.timed_out || 0
        ),

        eventParticipants: Number(
          summaryRows[0]?.event_participants || 0
        ),

        automaticTimeOuts: Number(
          summaryRows[0]?.automatic_time_outs || 0
        ),
      },

      day: dayRows[0] || {
        attendance_date: dateFrom,
        day_type: 'regular',
        notes: null,
      },

      settings: {
        defaultTimeOut:
          runtime.defaultTimeOut,
      },

      pagination: {
        page,
        limit,
        total,

        totalPages: Math.max(
          Math.ceil(total / limit),
          1
        ),

        hasNext:
          page * limit < total,

        hasPrev:
          page > 1,
      },
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const getAttendanceCalendar = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const currentMonth =
      getManilaDateTime()
        .date
        .slice(0, 7);

    const requestedMonth =
      cleanText(req.query.month);

    const month =
      /^\d{4}-\d{2}$/.test(requestedMonth)
        ? requestedMonth
        : currentMonth;

    const [
      year,
      monthNumber,
    ] = month
      .split('-')
      .map(Number);

    const start =
      `${month}-01`;

    const lastDay =
      new Date(
        Date.UTC(
          year,
          monthNumber,
          0
        )
      ).getUTCDate();

    const end =
      `${month}-${String(lastDay).padStart(2, '0')}`;

    const [dayRows] =
      await connection.query(`
        SELECT
          attendance_date,
          day_type,
          notes,
          source_event_id,
          updated_at
        FROM attendance_day_settings
        WHERE attendance_date
          BETWEEN ? AND ?
        ORDER BY attendance_date
      `, [
        start,
        end,
      ]);

    const [eventRows] =
      await connection.query(`
        SELECT
          ev.attendance_event_id,
          ev.event_name,
          ev.start_date,
          ev.end_date,
          ev.location,
          ev.attendance_treatment,
          ev.event_time_in,
          ev.event_time_out,
          ev.day_type,
          ev.notes,
          COUNT(
            DISTINCT p.employee_id
          ) AS participant_count

        FROM attendance_events ev

        LEFT JOIN attendance_event_participants p
          ON p.attendance_event_id =
            ev.attendance_event_id

        WHERE
          ev.event_status = 'active'
          AND ev.end_date >= ?
          AND ev.start_date <= ?

        GROUP BY
          ev.attendance_event_id

        ORDER BY
          ev.start_date,
          ev.attendance_event_id
      `, [
        start,
        end,
      ]);

    return res.json({
      success: true,
      month,
      dateFrom: start,
      dateTo: end,

      days: dayRows.map(
        (row) => ({
          ...row,

          attendance_date:
            dateOnly(
              row.attendance_date
            ),

          source_event_id:
            row.source_event_id
              ? Number(
                  row.source_event_id
                )
              : null,
        })
      ),

      events: eventRows.map(
        (row) => ({
          ...row,

          attendance_event_id:
            Number(
              row.attendance_event_id
            ),

          start_date:
            dateOnly(
              row.start_date
            ),

          end_date:
            dateOnly(
              row.end_date
            ),

          participant_count:
            Number(
              row.participant_count || 0
            ),
        })
      ),
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const createManualAttendance = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const employeeId =
      Number(
        req.body.employee_id || 0
      );

    const attendanceDate =
      dateOnly(
        req.body.attendance_date
      );

    const actualTimeIn =
      timeOnly(
        req.body.actual_time_in
      );

    const actualTimeOut =
      timeOnly(
        req.body.actual_time_out
      );

    const reason =
      cleanText(req.body.reason);

    if (
      !employeeId ||
      !attendanceDate
    ) {
      return res.status(400).json({
        message:
          'Employee and attendance date are required.',
      });
    }

    if (!reason) {
      return res.status(400).json({
        message:
          'A reason is required for manual attendance.',
      });
    }

    if (!actualTimeIn) {
      return res.status(400).json({
        message:
          'Time In is required for manual attendance. Use Company Event when exact times are intentionally not recorded.',
      });
    }

    if (
      isTimeOutBeforeTimeIn(
        actualTimeIn,
        actualTimeOut
      )
    ) {
      return res.status(400).json({
        message:
          'Time Out cannot be earlier than Time In.',
      });
    }

    await connection.beginTransaction();

    const employee =
      await getEmployeeById(
        connection,
        employeeId
      );

    if (!employee) {
      throw Object.assign(
        new Error(
          'Employee not found.'
        ),
        {
          statusCode: 404,
        }
      );
    }

    const existing =
      await getAttendanceForUpdate(
        connection,
        employeeId,
        attendanceDate
      );

    if (existing) {
      throw Object.assign(
        new Error(
          'Attendance already exists for this employee and date. Edit the existing record instead.'
        ),
        {
          statusCode: 409,
        }
      );
    }

    const [result] =
      await connection.query(`
        INSERT INTO employee_attendance_records (
          employee_id,
          attendance_date,
          actual_time_in,
          time_in_source,
          actual_time_out,
          time_out_source,
          attendance_status,
          notes,
          source,
          recorded_by_user_id,
          updated_by_user_id
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'present',
          ?,
          'manual',
          ?,
          ?
        )
      `, [
        employeeId,
        attendanceDate,
        actualTimeIn,
        actualTimeIn
          ? 'manual'
          : null,
        actualTimeOut,
        actualTimeOut
          ? 'manual'
          : null,
        reason,
        req.authUser?.id || null,
        req.authUser?.id || null,
      ]);

    await connection.query(`
      INSERT INTO employee_attendance_corrections (
        employee_attendance_id,
        previous_time_in,
        new_time_in,
        previous_time_out,
        new_time_out,
        reason,
        changed_by_user_id
      )
      VALUES (
        ?,
        NULL,
        ?,
        NULL,
        ?,
        ?,
        ?
      )
    `, [
      result.insertId,
      actualTimeIn,
      actualTimeOut,
      reason,
      req.authUser?.id || null,
    ]);

    await writeAuditLog(
      connection,
      req,
      {
        actor: req.authUser,
        action: 'create',
        module: 'Attendance',
        entityType:
          'employee_attendance',
        entityId:
          String(result.insertId),
        entityLabel:
          `${employee.employee_code} - ${attendanceDate}`,
        title:
          'Added manual attendance',
        description:
          `Manual attendance was added for ${employee.full_name}.`,

        metadata: {
          employeeId,
          attendanceDate,
          actualTimeIn,
          actualTimeOut,
          reason,
        },
      }
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message:
        'Manual attendance added successfully.',

      data: {
        id: result.insertId,
      },
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const correctAttendanceRecord = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const attendanceId =
      Number(
        req.params.attendanceId
      );

    const actualTimeIn =
      timeOnly(
        req.body.actual_time_in
      );

    const actualTimeOut =
      timeOnly(
        req.body.actual_time_out
      );

    const reason =
      cleanText(
        req.body.reason
      );

    if (!attendanceId) {
      return res.status(400).json({
        message:
          'Invalid attendance record.',
      });
    }

    if (!reason) {
      return res.status(400).json({
        message:
          'A reason is required when correcting attendance.',
      });
    }

    if (
      !actualTimeIn &&
      actualTimeOut
    ) {
      return res.status(400).json({
        message:
          'Time Out cannot be saved without a Time In.',
      });
    }

    if (
      isTimeOutBeforeTimeIn(
        actualTimeIn,
        actualTimeOut
      )
    ) {
      return res.status(400).json({
        message:
          'Time Out cannot be earlier than Time In.',
      });
    }

    await connection.beginTransaction();

    const [rows] =
      await connection.query(`
        SELECT
          a.*,
          e.employee_code,
          ${buildEmployeeNameSql('e')} AS full_name

        FROM employee_attendance_records a

        INNER JOIN employees e
          ON e.employee_id =
            a.employee_id

        WHERE
          a.employee_attendance_id = ?

        LIMIT 1
        FOR UPDATE
      `, [
        attendanceId,
      ]);

    const attendance =
      rows[0];

    if (!attendance) {
      throw Object.assign(
        new Error(
          'Attendance record not found.'
        ),
        {
          statusCode: 404,
        }
      );
    }

    if (
      !attendance.attendance_event_id &&
      !actualTimeIn
    ) {
      throw Object.assign(
        new Error(
          'Time In is required for non-event attendance records.'
        ),
        {
          statusCode: 400,
        }
      );
    }

    const previousTimeIn =
      timeOnly(
        attendance.actual_time_in
      );

    const previousTimeOut =
      timeOnly(
        attendance.actual_time_out
      );

    const timeInChanged =
      previousTimeIn !==
      actualTimeIn;

    const timeOutChanged =
      previousTimeOut !==
      actualTimeOut;

    if (
      !timeInChanged &&
      !timeOutChanged
    ) {
      throw Object.assign(
        new Error(
          'No attendance time changes were made.'
        ),
        {
          statusCode: 400,
        }
      );
    }

    await connection.query(`
      UPDATE employee_attendance_records
      SET
        actual_time_in = ?,

        time_in_source =
          CASE
            WHEN ?
              THEN 'admin'
            ELSE time_in_source
          END,

        actual_time_out = ?,

        time_out_source =
          CASE
            WHEN ?
              THEN 'admin'
            ELSE time_out_source
          END,

        notes = ?,
        source = 'manual',
        updated_by_user_id = ?

      WHERE employee_attendance_id = ?
    `, [
      actualTimeIn,
      timeInChanged ? 1 : 0,
      actualTimeOut,
      timeOutChanged ? 1 : 0,
      reason,
      req.authUser?.id || null,
      attendanceId,
    ]);

    await connection.query(`
      INSERT INTO employee_attendance_corrections (
        employee_attendance_id,
        previous_time_in,
        new_time_in,
        previous_time_out,
        new_time_out,
        reason,
        changed_by_user_id
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
    `, [
      attendanceId,
      previousTimeIn,
      actualTimeIn,
      previousTimeOut,
      actualTimeOut,
      reason,
      req.authUser?.id || null,
    ]);

    await writeAuditLog(
      connection,
      req,
      {
        actor: req.authUser,
        action: 'update',
        module: 'Attendance',
        entityType:
          'employee_attendance',
        entityId:
          String(attendanceId),

        entityLabel:
          `${attendance.employee_code} - ${dateOnly(attendance.attendance_date)}`,

        title:
          'Corrected attendance time',

        description:
          `Attendance time was corrected for ${attendance.full_name}.`,

        metadata: {
          previousTimeIn,
          actualTimeIn,
          previousTimeOut,
          actualTimeOut,
          reason,
        },
      }
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Attendance corrected successfully.',
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const deleteAttendanceRecord = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const attendanceId =
      Number(
        req.params.attendanceId
      );

    await connection.beginTransaction();

    const [rows] =
      await connection.query(`
        SELECT
          a.*,
          e.employee_code,
          ${buildEmployeeNameSql('e')} AS full_name

        FROM employee_attendance_records a

        INNER JOIN employees e
          ON e.employee_id =
            a.employee_id

        WHERE
          a.employee_attendance_id = ?

        LIMIT 1
        FOR UPDATE
      `, [
        attendanceId,
      ]);

    const attendance =
      rows[0];

    if (!attendance) {
      throw Object.assign(
        new Error(
          'Attendance record not found.'
        ),
        {
          statusCode: 404,
        }
      );
    }

    if (
      attendance.attendance_event_id
    ) {
      throw Object.assign(
        new Error(
          'Event attendance must be managed from the Company Event record.'
        ),
        {
          statusCode: 409,
        }
      );
    }

    await connection.query(
      `
        DELETE FROM employee_attendance_records
        WHERE employee_attendance_id = ?
      `,
      [
        attendanceId,
      ]
    );

    await writeAuditLog(
      connection,
      req,
      {
        actor: req.authUser,
        action: 'delete',
        module: 'Attendance',
        entityType:
          'employee_attendance',
        entityId:
          String(attendanceId),

        entityLabel:
          `${attendance.employee_code} - ${dateOnly(attendance.attendance_date)}`,

        title:
          'Deleted attendance record',

        description:
          `Deleted attendance for ${attendance.full_name}.`,
      }
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Attendance record deleted.',
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const updateAttendanceDay = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const attendanceDate =
      dateOnly(
        req.params.date ||
        req.body.attendance_date
      );

    const dayType =
      normalizeDayType(
        req.body.day_type
      );

    const notes =
      nullableText(
        req.body.notes
      );

    if (!attendanceDate) {
      return res.status(400).json({
        message:
          'Select a valid attendance date.',
      });
    }

    await setDaySetting(connection, {
      attendanceDate,
      dayType,
      notes,
      actorId:
        req.authUser?.id || null,
      sourceEventId:
        null,
    });

    await writeAuditLog(
      connection,
      req,
      {
        actor: req.authUser,
        action: 'update',
        module: 'Attendance',
        entityType:
          'attendance_day',
        entityId:
          attendanceDate,
        entityLabel:
          attendanceDate,

        title:
          'Updated attendance day classification',

        description:
          `${attendanceDate} was marked as ${dayType.replaceAll('_', ' ')}.`,

        metadata: {
          dayType,
          notes,
        },
      }
    );

    return res.json({
      success: true,
      message:
        'Day classification updated.',

      data: {
        attendance_date:
          attendanceDate,
        day_type:
          dayType,
        notes,
      },
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

const validateEventPayload = (body = {}) => {
  const payload = {
    eventName:
      cleanText(
        body.event_name
      ),

    startDate:
      dateOnly(
        body.start_date
      ),

    endDate:
      dateOnly(
        body.end_date ||
        body.start_date
      ),

    location:
      nullableText(
        body.location
      ),

    treatment:
      normalizeTreatment(
        body.attendance_treatment
      ),

    timeIn:
      normalizeClockTime(
        body.event_time_in
      ),

    timeOut:
      normalizeClockTime(
        body.event_time_out
      ),

    dayType:
      normalizeDayType(
        body.day_type
      ),

    notes:
      nullableText(
        body.notes
      ),

    employeeIds:
      normalizeEmployeeIds(
        body.employee_ids
      ),
  };

  if (
    !payload.eventName ||
    !payload.startDate ||
    !payload.endDate
  ) {
    throw Object.assign(
      new Error(
        'Event name and date are required.'
      ),
      {
        statusCode: 400,
      }
    );
  }

  if (
    payload.endDate <
    payload.startDate
  ) {
    throw Object.assign(
      new Error(
        'Event end date cannot be before the start date.'
      ),
      {
        statusCode: 400,
      }
    );
  }

  const dates =
    enumerateDateRange(
      payload.startDate,
      payload.endDate
    );

  if (
    !dates.length ||
    dates.length > 31
  ) {
    throw Object.assign(
      new Error(
        'Company events can cover up to 31 days at a time.'
      ),
      {
        statusCode: 400,
      }
    );
  }

  if (
    !payload.employeeIds.length
  ) {
    throw Object.assign(
      new Error(
        'Select at least one participating employee.'
      ),
      {
        statusCode: 400,
      }
    );
  }

  if (
    payload.treatment !==
      'record_only' &&
    (
      !payload.timeIn ||
      !payload.timeOut
    )
  ) {
    throw Object.assign(
      new Error(
        'Time In and Time Out are required for Full Day and Custom Time events.'
      ),
      {
        statusCode: 400,
      }
    );
  }

  if (
    payload.timeOut &&
    !payload.timeIn
  ) {
    throw Object.assign(
      new Error(
        'Event Time Out cannot be saved without a Time In.'
      ),
      {
        statusCode: 400,
      }
    );
  }

  if (
    isTimeOutBeforeTimeIn(
      payload.timeIn,
      payload.timeOut
    )
  ) {
    throw Object.assign(
      new Error(
        'Event Time Out cannot be earlier than Event Time In.'
      ),
      {
        statusCode: 400,
      }
    );
  }

  return {
    ...payload,
    dates,
  };
};

const getEventConflictRows = async (
  connection,
  employeeIds,
  startDate,
  endDate,
  eventId = null
) => {
  if (!employeeIds.length) {
    return [];
  }

  const placeholders =
    employeeIds
      .map(() => '?')
      .join(',');

  const params = [
    ...employeeIds,
    startDate,
    endDate,
  ];

  let extra = '';

  if (eventId) {
    extra = `
      AND (
        a.attendance_event_id IS NULL
        OR a.attendance_event_id <> ?
      )
    `;

    params.push(eventId);
  }

  const [rows] =
    await connection.query(`
      SELECT
        a.employee_id,
        a.attendance_date,
        e.employee_code,
        ${buildEmployeeNameSql('e')} AS full_name

      FROM employee_attendance_records a

      INNER JOIN employees e
        ON e.employee_id =
          a.employee_id

      WHERE
        a.employee_id IN (
          ${placeholders}
        )

        AND a.attendance_date
          BETWEEN ? AND ?

        ${extra}

      ORDER BY
        a.attendance_date,
        e.last_name

      LIMIT 20
    `, params);

  return rows;
};

const insertEventAttendance = async (
  connection,
  eventId,
  payload,
  actorId
) => {
  for (
    const employeeId of
    payload.employeeIds
  ) {
    await connection.query(`
      INSERT INTO attendance_event_participants (
        attendance_event_id,
        employee_id
      )
      VALUES (?, ?)
    `, [
      eventId,
      employeeId,
    ]);
  }

  const timeIn =
    payload.treatment ===
      'record_only'
      ? null
      : payload.timeIn;

  const timeOut =
    payload.treatment ===
      'record_only'
      ? null
      : payload.timeOut;

  for (
    const attendanceDate of
    payload.dates
  ) {
    for (
      const employeeId of
      payload.employeeIds
    ) {
      await connection.query(`
        INSERT INTO employee_attendance_records (
          employee_id,
          attendance_event_id,
          attendance_date,
          actual_time_in,
          time_in_source,
          actual_time_out,
          time_out_source,
          attendance_status,
          notes,
          source,
          recorded_by_user_id,
          updated_by_user_id
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'present',
          ?,
          'manual',
          ?,
          ?
        )
      `, [
        employeeId,
        eventId,
        attendanceDate,
        timeIn,
        timeIn
          ? 'event'
          : null,
        timeOut,
        timeOut
          ? 'event'
          : null,
        payload.eventName,
        actorId,
        actorId,
      ]);
    }

    await applyEventDaySetting(
      connection,
      {
        attendanceDate,
        dayType:
          payload.dayType,
        eventName:
          payload.eventName,
        actorId,
        eventId,
      }
    );
  }
};

export const createAttendanceEvent = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const payload =
      validateEventPayload(
        req.body
      );

    const actorId =
      req.authUser?.id || null;

    await connection.beginTransaction();

    const conflicts =
      await getEventConflictRows(
        connection,
        payload.employeeIds,
        payload.startDate,
        payload.endDate
      );

    if (conflicts.length) {
      const preview =
        conflicts
          .slice(0, 3)
          .map(
            (row) =>
              `${row.full_name} (${dateOnly(row.attendance_date)})`
          )
          .join(', ');

      throw Object.assign(
        new Error(
          `Event attendance conflicts with existing attendance: ${preview}${conflicts.length > 3 ? '…' : ''}.`
        ),
        {
          statusCode: 409,
        }
      );
    }

    const [result] =
      await connection.query(`
        INSERT INTO attendance_events (
          event_name,
          start_date,
          end_date,
          location,
          attendance_treatment,
          event_time_in,
          event_time_out,
          day_type,
          notes,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `, [
        payload.eventName,
        payload.startDate,
        payload.endDate,
        payload.location,
        payload.treatment,
        payload.timeIn,
        payload.timeOut,
        payload.dayType,
        payload.notes,
        actorId,
        actorId,
      ]);

    await insertEventAttendance(
      connection,
      result.insertId,
      payload,
      actorId
    );

    await writeAuditLog(
      connection,
      req,
      {
        actor: req.authUser,
        action: 'create',
        module: 'Attendance',
        entityType:
          'attendance_event',
        entityId:
          String(
            result.insertId
          ),
        entityLabel:
          payload.eventName,

        title:
          'Created company event attendance',

        description:
          `Created attendance event ${payload.eventName} for ${payload.employeeIds.length} participant(s).`,

        metadata: {
          startDate:
            payload.startDate,
          endDate:
            payload.endDate,
          location:
            payload.location,
          treatment:
            payload.treatment,
          dayType:
            payload.dayType,
          employeeIds:
            payload.employeeIds,
        },
      }
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message:
        'Company event created and attendance recorded.',
      event_id:
        result.insertId,
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const getAttendanceEvents = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const today =
      getManilaDateTime().date;

    const dateFrom =
      dateOnly(req.query.dateFrom) ||
      today.slice(0, 7) + '-01';

    const dateTo =
      dateOnly(req.query.dateTo) ||
      today;

    const [rows] =
      await connection.query(`
        SELECT
          ev.*,

          COUNT(
            DISTINCT p.employee_id
          ) AS participant_count,

          TRIM(
            CONCAT_WS(
              ' ',
              creator.first_name,
              creator.middle_name,
              creator.last_name
            )
          ) AS created_by_name

        FROM attendance_events ev

        LEFT JOIN attendance_event_participants p
          ON p.attendance_event_id =
            ev.attendance_event_id

        LEFT JOIN users creator
          ON creator.id =
            ev.created_by_user_id

        WHERE
          ev.event_status = 'active'
          AND ev.end_date >= ?
          AND ev.start_date <= ?

        GROUP BY
          ev.attendance_event_id

        ORDER BY
          ev.start_date DESC,
          ev.attendance_event_id DESC
      `, [
        dateFrom,
        dateTo,
      ]);

    const eventIds =
      rows.map(
        (row) =>
          Number(
            row.attendance_event_id
          )
      );

    let participants = [];

    if (eventIds.length) {
      const [participantRows] =
        await connection.query(`
          SELECT
            p.attendance_event_id,
            e.employee_id,
            e.employee_code,
            ${buildEmployeeNameSql('e')} AS full_name,
            e.department

          FROM attendance_event_participants p

          INNER JOIN employees e
            ON e.employee_id =
              p.employee_id

          WHERE
            p.attendance_event_id
            IN (
              ${eventIds.map(() => '?').join(',')}
            )

          ORDER BY
            e.department,
            e.last_name,
            e.first_name
        `, eventIds);

      participants =
        participantRows;
    }

    return res.json({
      success: true,

      data: rows.map(
        (row) => ({
          ...row,

          participant_count:
            Number(
              row.participant_count || 0
            ),

          participants:
            participants.filter(
              (participant) =>
                Number(
                  participant.attendance_event_id
                ) ===
                Number(
                  row.attendance_event_id
                )
            ),
        })
      ),
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const updateAttendanceEvent = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const eventId =
      Number(
        req.params.eventId
      );

    const payload =
      validateEventPayload(
        req.body
      );

    const actorId =
      req.authUser?.id || null;

    await connection.beginTransaction();

    const [eventRows] =
      await connection.query(`
        SELECT *
        FROM attendance_events
        WHERE
          attendance_event_id = ?
          AND event_status = 'active'
        LIMIT 1
        FOR UPDATE
      `, [
        eventId,
      ]);

    if (!eventRows[0]) {
      throw Object.assign(
        new Error(
          'Company event not found.'
        ),
        {
          statusCode: 404,
        }
      );
    }

    const previousEventDates =
      enumerateDateRange(
        dateOnly(
          eventRows[0].start_date
        ),
        dateOnly(
          eventRows[0].end_date
        )
      );

    const [correctedRows] =
      await connection.query(`
        SELECT employee_attendance_id
        FROM employee_attendance_records
        WHERE
          attendance_event_id = ?
          AND (
            time_in_source = 'admin'
            OR time_out_source = 'admin'
          )
        LIMIT 1
      `, [
        eventId,
      ]);

    if (correctedRows.length) {
      throw Object.assign(
        new Error(
          'This event has attendance records manually corrected by an admin. Event dates, times, or participants can no longer be rebuilt automatically.'
        ),
        {
          statusCode: 409,
        }
      );
    }

    const conflicts =
      await getEventConflictRows(
        connection,
        payload.employeeIds,
        payload.startDate,
        payload.endDate,
        eventId
      );

    if (conflicts.length) {
      const preview =
        conflicts
          .slice(0, 3)
          .map(
            (row) =>
              `${row.full_name} (${dateOnly(row.attendance_date)})`
          )
          .join(', ');

      throw Object.assign(
        new Error(
          `Updated event conflicts with existing attendance: ${preview}${conflicts.length > 3 ? '…' : ''}.`
        ),
        {
          statusCode: 409,
        }
      );
    }

    await connection.query(
      `
        DELETE FROM employee_attendance_records
        WHERE attendance_event_id = ?
      `,
      [
        eventId,
      ]
    );

    await connection.query(
      `
        DELETE FROM attendance_event_participants
        WHERE attendance_event_id = ?
      `,
      [
        eventId,
      ]
    );

    await restoreEventDaySettings(
      connection,
      {
        dates:
          previousEventDates,
        eventId,
        actorId,
      }
    );

    await connection.query(`
      UPDATE attendance_events
      SET
        event_name = ?,
        start_date = ?,
        end_date = ?,
        location = ?,
        attendance_treatment = ?,
        event_time_in = ?,
        event_time_out = ?,
        day_type = ?,
        notes = ?,
        updated_by_user_id = ?
      WHERE attendance_event_id = ?
    `, [
      payload.eventName,
      payload.startDate,
      payload.endDate,
      payload.location,
      payload.treatment,
      payload.timeIn,
      payload.timeOut,
      payload.dayType,
      payload.notes,
      actorId,
      eventId,
    ]);

    await insertEventAttendance(
      connection,
      eventId,
      payload,
      actorId
    );

    await writeAuditLog(
      connection,
      req,
      {
        actor: req.authUser,
        action: 'update',
        module: 'Attendance',
        entityType:
          'attendance_event',
        entityId:
          String(eventId),
        entityLabel:
          payload.eventName,

        title:
          'Updated company event attendance',

        description:
          `Updated attendance event ${payload.eventName}.`,

        metadata: {
          startDate:
            payload.startDate,
          endDate:
            payload.endDate,
          employeeIds:
            payload.employeeIds,
          dayType:
            payload.dayType,
        },
      }
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Company event updated successfully.',
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const deleteAttendanceEvent = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const eventId =
      Number(
        req.params.eventId
      );

    await connection.beginTransaction();

    const [eventRows] =
      await connection.query(`
        SELECT *
        FROM attendance_events
        WHERE
          attendance_event_id = ?
          AND event_status = 'active'
        LIMIT 1
        FOR UPDATE
      `, [
        eventId,
      ]);

    const event =
      eventRows[0];

    if (!event) {
      throw Object.assign(
        new Error(
          'Company event not found.'
        ),
        {
          statusCode: 404,
        }
      );
    }

    const eventDates =
      enumerateDateRange(
        dateOnly(
          event.start_date
        ),
        dateOnly(
          event.end_date
        )
      );

    const [correctedRows] =
      await connection.query(`
        SELECT employee_attendance_id
        FROM employee_attendance_records
        WHERE
          attendance_event_id = ?
          AND (
            time_in_source = 'admin'
            OR time_out_source = 'admin'
          )
        LIMIT 1
      `, [
        eventId,
      ]);

    if (correctedRows.length) {
      throw Object.assign(
        new Error(
          'This event has manually corrected attendance. Remove or resolve those corrections before deleting the event.'
        ),
        {
          statusCode: 409,
        }
      );
    }

    await connection.query(
      `
        DELETE FROM employee_attendance_records
        WHERE attendance_event_id = ?
      `,
      [
        eventId,
      ]
    );

    await connection.query(
      `
        DELETE FROM attendance_event_participants
        WHERE attendance_event_id = ?
      `,
      [
        eventId,
      ]
    );

    await restoreEventDaySettings(
      connection,
      {
        dates:
          eventDates,
        eventId,
        actorId:
          req.authUser?.id || null,
      }
    );

    await connection.query(`
      UPDATE attendance_events
      SET
        event_status = 'cancelled',
        updated_by_user_id = ?
      WHERE attendance_event_id = ?
    `, [
      req.authUser?.id || null,
      eventId,
    ]);

    await writeAuditLog(
      connection,
      req,
      {
        actor:
          req.authUser,
        action:
          'delete',
        module:
          'Attendance',
        entityType:
          'attendance_event',
        entityId:
          String(eventId),
        entityLabel:
          event.event_name,

        title:
          'Cancelled company event attendance',

        description:
          `Cancelled attendance event ${event.event_name}.`,
      }
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Company event removed from attendance.',
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};

export const getAttendanceCorrections = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureAttendanceLiteSchema(connection);

    const attendanceId =
      Number(
        req.params.attendanceId
      );

    const [rows] =
      await connection.query(`
        SELECT
          c.*,

          TRIM(
            CONCAT_WS(
              ' ',
              u.first_name,
              u.middle_name,
              u.last_name
            )
          ) AS changed_by_name

        FROM employee_attendance_corrections c

        LEFT JOIN users u
          ON u.id =
            c.changed_by_user_id

        WHERE
          c.employee_attendance_id = ?

        ORDER BY
          c.created_at DESC
      `, [
        attendanceId,
      ]);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({
        message: getErrorMessage(error),
      });
  } finally {
    connection.release();
  }
};