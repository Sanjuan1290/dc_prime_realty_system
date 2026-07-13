import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import {
  buildEmployeeNameSql,
  calculateAttendanceMetrics,
  cleanText,
  dateOnly,
  ensureEmployeeModuleTables,
  getEmployeeScheduleForDate,
  getMonthRange,
  nullableText,
  roundMoney,
  timeOnly,
} from './employeeModule.shared.js';

const statuses = new Set(['present', 'late', 'absent', 'paid_leave', 'unpaid_leave', 'rest_day', 'holiday', 'half_day']);
const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Attendance already exists for this employee and date.';
  return error?.message || 'Attendance operation failed.';
};

const formatDuration = (seconds = 0) => {
  const total = Math.max(Number(seconds || 0), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return `${hours ? `${hours}h ` : ''}${minutes ? `${minutes}m ` : ''}${remainingSeconds}s`.trim();
};

const normalizeAttendancePayload = (body = {}) => ({
  employeeId: Number(body.employee_id || 0),
  attendanceDate: dateOnly(body.attendance_date),
  actualTimeIn: timeOnly(body.actual_time_in),
  actualTimeOut: timeOnly(body.actual_time_out),
  status: statuses.has(body.attendance_status) ? body.attendance_status : 'present',
  notes: nullableText(body.notes),
  source: ['manual', 'import', 'device'].includes(body.source) ? body.source : 'manual',
});

const getEmployeeForAttendance = async (connection, employeeId) => {
  const [rows] = await connection.query('SELECT * FROM employees WHERE employee_id = ? LIMIT 1', [employeeId]);
  return rows[0] || null;
};

const resolveStatus = (status, metrics, schedule) => {
  if (!schedule?.is_work_day && ['present', 'late'].includes(status)) return 'rest_day';
  if (status === 'present' && metrics.lateSeconds > 0) return 'late';
  if (status === 'late' && metrics.lateSeconds === 0) return 'present';
  return status;
};

const calculatePayrollPreview = async (connection, monthValue) => {
  const range = getMonthRange(monthValue);
  const [employees] = await connection.query(`
    SELECT e.*, ${buildEmployeeNameSql('e')} AS full_name
    FROM employees e
    WHERE e.employee_status = 'active'
    ORDER BY e.last_name, e.first_name
  `);
  const [attendanceRows] = await connection.query(
    `
      SELECT employee_id,
        COALESCE(SUM(late_seconds), 0) AS late_seconds,
        COALESCE(SUM(undertime_seconds), 0) AS undertime_seconds,
        COALESCE(SUM(late_deduction), 0) AS late_deduction,
        COALESCE(SUM(undertime_deduction), 0) AS undertime_deduction,
        COALESCE(SUM(absence_deduction), 0) AS absence_deduction,
        COALESCE(SUM(attendance_status IN ('absent','unpaid_leave')), 0) AS absent_days,
        COALESCE(SUM(attendance_status = 'present'), 0) AS present_days,
        COALESCE(SUM(attendance_status = 'late'), 0) AS late_days
      FROM employee_attendance_records
      WHERE attendance_date BETWEEN ? AND ?
      GROUP BY employee_id
    `,
    [range.start, range.end]
  );
  const [advanceRows] = await connection.query(
    `
      SELECT * FROM employee_cash_advances
      WHERE cash_advance_status IN ('approved','active')
        AND remaining_balance > 0
        AND start_deduction_date <= ?
      ORDER BY employee_id, request_date, employee_cash_advance_id
    `,
    [range.end]
  );
  const attendanceByEmployee = new Map(attendanceRows.map((row) => [Number(row.employee_id), row]));
  const advancesByEmployee = new Map();
  for (const advance of advanceRows) {
    const employeeId = Number(advance.employee_id);
    if (!advancesByEmployee.has(employeeId)) advancesByEmployee.set(employeeId, []);
    advancesByEmployee.get(employeeId).push(advance);
  }

  const data = employees.map((employee) => {
    const attendance = attendanceByEmployee.get(Number(employee.employee_id)) || {};
    const activeAdvances = advancesByEmployee.get(Number(employee.employee_id)) || [];
    const lateDeduction = roundMoney(attendance.late_deduction);
    const undertimeDeduction = roundMoney(attendance.undertime_deduction);
    const absenceDeduction = roundMoney(attendance.absence_deduction);
    const baseSalary = roundMoney(employee.monthly_salary);
    const availableForCashAdvance = Math.max(baseSalary - lateDeduction - undertimeDeduction - absenceDeduction, 0);
    const suggestedCashAdvanceDeduction = roundMoney(activeAdvances.reduce((sum, advance) =>
      sum + Math.min(Number(advance.deduction_per_payroll || 0), Number(advance.remaining_balance || 0)), 0));
    const cashAdvanceDeduction = roundMoney(Math.min(suggestedCashAdvanceDeduction, availableForCashAdvance));
    const totalDeductions = roundMoney(lateDeduction + undertimeDeduction + absenceDeduction + cashAdvanceDeduction);
    return {
      employeeId: Number(employee.employee_id),
      employeeCode: employee.employee_code,
      fullName: employee.full_name,
      department: employee.department,
      position: employee.position,
      monthlySalary: baseSalary,
      payrollDivisor: Number(employee.payroll_divisor || 26),
      presentDays: Number(attendance.present_days || 0),
      lateDays: Number(attendance.late_days || 0),
      absentDays: Number(attendance.absent_days || 0),
      lateSeconds: Number(attendance.late_seconds || 0),
      undertimeSeconds: Number(attendance.undertime_seconds || 0),
      lateDuration: formatDuration(attendance.late_seconds),
      undertimeDuration: formatDuration(attendance.undertime_seconds),
      lateDeduction,
      undertimeDeduction,
      absenceDeduction,
      cashAdvanceDeduction,
      totalDeductions,
      grossPay: baseSalary,
      netPay: roundMoney(Math.max(baseSalary - totalDeductions, 0)),
      activeAdvances: activeAdvances.map((advance) => ({
        id: Number(advance.employee_cash_advance_id),
        referenceNumber: advance.reference_number,
        remainingBalance: Number(advance.remaining_balance || 0),
        suggestedDeduction: Math.min(Number(advance.deduction_per_payroll || 0), Number(advance.remaining_balance || 0)),
      })),
    };
  });

  return {
    range,
    data,
    summary: {
      employeeCount: data.length,
      grossPayroll: roundMoney(data.reduce((sum, item) => sum + item.grossPay, 0)),
      attendanceDeductions: roundMoney(data.reduce((sum, item) => sum + item.lateDeduction + item.undertimeDeduction + item.absenceDeduction, 0)),
      cashAdvanceDeductions: roundMoney(data.reduce((sum, item) => sum + item.cashAdvanceDeduction, 0)),
      netPayroll: roundMoney(data.reduce((sum, item) => sum + item.netPay, 0)),
    },
  };
};

export const getAttendanceRecords = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 15), 1), 100);
    const offset = (page - 1) * limit;
    const search = cleanText(req.query.search);
    const status = cleanText(req.query.status, 'all');
    const dateFrom = dateOnly(req.query.dateFrom) || dateOnly(req.query.date) || new Date().toISOString().slice(0, 10);
    const dateTo = dateOnly(req.query.dateTo) || dateFrom;
    const employeeId = Number(req.query.employeeId || 0);

    const where = ['a.attendance_date BETWEEN ? AND ?'];
    const params = [dateFrom, dateTo];
    if (search) {
      const keyword = `%${search}%`;
      where.push(`(${buildEmployeeNameSql('e')} LIKE ? OR e.employee_code LIKE ? OR e.department LIKE ?)`);
      params.push(keyword, keyword, keyword);
    }
    if (status !== 'all') {
      where.push('a.attendance_status = ?');
      params.push(status);
    }
    if (employeeId) {
      where.push('a.employee_id = ?');
      params.push(employeeId);
    }

    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM employee_attendance_records a INNER JOIN employees e ON e.employee_id = a.employee_id WHERE ${where.join(' AND ')}`, params);
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await connection.query(
      `
        SELECT a.*, e.employee_code, ${buildEmployeeNameSql('e')} AS full_name,
          e.department, e.position, e.monthly_salary, e.payroll_divisor,
          TRIM(CONCAT_WS(' ', recorder.first_name, recorder.middle_name, recorder.last_name)) AS recorded_by_name
        FROM employee_attendance_records a
        INNER JOIN employees e ON e.employee_id = a.employee_id
        LEFT JOIN users recorder ON recorder.id = a.recorded_by_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY a.attendance_date DESC, e.last_name, e.first_name
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [summaryRows] = await connection.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(attendance_status IN ('present','late')) AS present,
          SUM(attendance_status = 'late') AS late,
          SUM(attendance_status = 'absent') AS absent,
          SUM(attendance_status IN ('paid_leave','unpaid_leave')) AS on_leave,
          COALESCE(SUM(late_seconds), 0) AS late_seconds,
          COALESCE(SUM(late_deduction + undertime_deduction + absence_deduction), 0) AS estimated_deductions
        FROM employee_attendance_records
        WHERE attendance_date BETWEEN ? AND ?
      `,
      [dateFrom, dateTo]
    );

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        late_seconds: Number(row.late_seconds || 0),
        undertime_seconds: Number(row.undertime_seconds || 0),
        overtime_seconds: Number(row.overtime_seconds || 0),
        late_deduction: Number(row.late_deduction || 0),
        undertime_deduction: Number(row.undertime_deduction || 0),
        absence_deduction: Number(row.absence_deduction || 0),
        late_duration: formatDuration(row.late_seconds),
        undertime_duration: formatDuration(row.undertime_seconds),
      })),
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        present: Number(summaryRows[0]?.present || 0),
        late: Number(summaryRows[0]?.late || 0),
        absent: Number(summaryRows[0]?.absent || 0),
        onLeave: Number(summaryRows[0]?.on_leave || 0),
        lateSeconds: Number(summaryRows[0]?.late_seconds || 0),
        lateDuration: formatDuration(summaryRows[0]?.late_seconds),
        estimatedDeductions: Number(summaryRows[0]?.estimated_deductions || 0),
      },
      filters: { dateFrom, dateTo },
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

const saveAttendance = async ({ req, res, isUpdate }) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const attendanceId = Number(req.params.attendanceId || 0);
    const payload = normalizeAttendancePayload(req.body);
    if (!payload.employeeId || !payload.attendanceDate) return res.status(400).json({ message: 'Employee and attendance date are required.' });
    if (['present', 'late', 'half_day'].includes(payload.status) && !payload.actualTimeIn) {
      return res.status(400).json({ message: 'Time in is required for present, late, and half-day records.' });
    }
    const employee = await getEmployeeForAttendance(connection, payload.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });
    const schedule = await getEmployeeScheduleForDate(connection, payload.employeeId, payload.attendanceDate);
    const metrics = calculateAttendanceMetrics({
      employee,
      schedule,
      status: payload.status,
      actualTimeIn: payload.actualTimeIn,
      actualTimeOut: payload.actualTimeOut,
    });
    const resolvedStatus = resolveStatus(payload.status, metrics, schedule);

    await connection.beginTransaction();
    let savedId = attendanceId;
    if (isUpdate) {
      const [result] = await connection.query(
        `
          UPDATE employee_attendance_records SET
            employee_id = ?, attendance_date = ?, scheduled_time_in = ?, scheduled_time_out = ?,
            actual_time_in = ?, actual_time_out = ?, late_seconds = ?, undertime_seconds = ?, overtime_seconds = ?,
            late_deduction = ?, undertime_deduction = ?, absence_deduction = ?, attendance_status = ?,
            notes = ?, source = ?, updated_by_user_id = ?
          WHERE employee_attendance_id = ?
        `,
        [
          payload.employeeId, payload.attendanceDate, schedule?.shift_start || null, schedule?.shift_end || null,
          payload.actualTimeIn, payload.actualTimeOut, metrics.lateSeconds, metrics.undertimeSeconds, metrics.overtimeSeconds,
          metrics.lateDeduction, metrics.undertimeDeduction, metrics.absenceDeduction, resolvedStatus,
          payload.notes, payload.source, req.authUser?.id || null, attendanceId,
        ]
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return res.status(404).json({ message: 'Attendance record not found.' });
      }
    } else {
      const [result] = await connection.query(
        `
          INSERT INTO employee_attendance_records (
            employee_id, attendance_date, scheduled_time_in, scheduled_time_out, actual_time_in, actual_time_out,
            late_seconds, undertime_seconds, overtime_seconds, late_deduction, undertime_deduction,
            absence_deduction, attendance_status, notes, source, recorded_by_user_id, updated_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.employeeId, payload.attendanceDate, schedule?.shift_start || null, schedule?.shift_end || null,
          payload.actualTimeIn, payload.actualTimeOut, metrics.lateSeconds, metrics.undertimeSeconds, metrics.overtimeSeconds,
          metrics.lateDeduction, metrics.undertimeDeduction, metrics.absenceDeduction, resolvedStatus,
          payload.notes, payload.source, req.authUser?.id || null, req.authUser?.id || null,
        ]
      );
      savedId = result.insertId;
    }
    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: isUpdate ? 'update' : 'create', module: 'Attendance', entityType: 'employee_attendance', entityId: String(savedId),
      entityLabel: `${employee.employee_code} - ${payload.attendanceDate}`, title: isUpdate ? 'Updated attendance' : 'Recorded attendance',
      description: `${employee.employee_code} attendance saved as ${resolvedStatus}.`,
      metadata: { employeeId: payload.employeeId, attendanceDate: payload.attendanceDate, lateSeconds: metrics.lateSeconds, undertimeSeconds: metrics.undertimeSeconds },
    });
    await connection.commit();
    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate ? 'Attendance updated successfully.' : 'Attendance recorded successfully.',
      data: { id: savedId, status: resolvedStatus, ...metrics },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createAttendanceRecord = (req, res) => saveAttendance({ req, res, isUpdate: false });
export const updateAttendanceRecord = (req, res) => saveAttendance({ req, res, isUpdate: true });

export const deleteAttendanceRecord = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const attendanceId = Number(req.params.attendanceId);
    const [rows] = await connection.query(
      `SELECT a.*, e.employee_code, ${buildEmployeeNameSql('e')} AS full_name FROM employee_attendance_records a INNER JOIN employees e ON e.employee_id = a.employee_id WHERE a.employee_attendance_id = ? LIMIT 1`,
      [attendanceId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Attendance record not found.' });
    await connection.query('DELETE FROM employee_attendance_records WHERE employee_attendance_id = ?', [attendanceId]);
    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'delete', module: 'Attendance', entityType: 'employee_attendance', entityId: String(attendanceId),
      entityLabel: `${rows[0].employee_code} - ${rows[0].attendance_date}`, title: 'Deleted attendance record',
      description: `Deleted attendance for ${rows[0].full_name} on ${rows[0].attendance_date}.`,
    });
    return res.json({ success: true, message: 'Attendance record deleted.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getPayrollPreview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const preview = await calculatePayrollPreview(connection, req.query.month);
    const [periodRows] = await connection.query(
      `SELECT * FROM employee_payroll_periods WHERE period_start = ? AND period_end = ? LIMIT 1`,
      [preview.range.start, preview.range.end]
    );
    return res.json({ success: true, ...preview, period: periodRows[0] || null });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const finalizePayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const preview = await calculatePayrollPreview(connection, req.body.month);
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      `SELECT * FROM employee_payroll_periods WHERE period_start = ? AND period_end = ? LIMIT 1`,
      [preview.range.start, preview.range.end]
    );
    if (existingRows[0]?.payroll_status === 'finalized') {
      await connection.rollback();
      return res.status(409).json({ message: `${preview.range.label} payroll is already finalized.` });
    }
    let periodId = existingRows[0]?.employee_payroll_period_id;
    if (!periodId) {
      const [periodResult] = await connection.query(
        `INSERT INTO employee_payroll_periods (period_label, period_start, period_end, payroll_status, finalized_by_user_id, finalized_at) VALUES (?, ?, ?, 'finalized', ?, NOW())`,
        [preview.range.label, preview.range.start, preview.range.end, req.authUser?.id || null]
      );
      periodId = periodResult.insertId;
    } else {
      await connection.query(`UPDATE employee_payroll_periods SET payroll_status = 'finalized', finalized_by_user_id = ?, finalized_at = NOW() WHERE employee_payroll_period_id = ?`, [req.authUser?.id || null, periodId]);
      await connection.query('DELETE FROM employee_payrolls WHERE employee_payroll_period_id = ?', [periodId]);
    }

    for (const item of preview.data) {
      const [payrollResult] = await connection.query(
        `
          INSERT INTO employee_payrolls (
            employee_payroll_period_id, employee_id, monthly_salary_snapshot, payroll_divisor_snapshot,
            base_salary, late_seconds, late_deduction, undertime_seconds, undertime_deduction,
            absent_days, absence_deduction, cash_advance_deduction, gross_pay, net_pay, payroll_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalized')
        `,
        [
          periodId, item.employeeId, item.monthlySalary, item.payrollDivisor, item.monthlySalary,
          item.lateSeconds, item.lateDeduction, item.undertimeSeconds, item.undertimeDeduction,
          item.absentDays, item.absenceDeduction, item.cashAdvanceDeduction, item.grossPay, item.netPay,
        ]
      );
      let remainingDeduction = item.cashAdvanceDeduction;
      for (const advance of item.activeAdvances) {
        if (remainingDeduction <= 0) break;
        const amount = roundMoney(Math.min(advance.suggestedDeduction, remainingDeduction, advance.remainingBalance));
        if (amount <= 0) continue;
        const newBalance = roundMoney(advance.remainingBalance - amount);
        await connection.query(
          `UPDATE employee_cash_advances SET remaining_balance = ?, cash_advance_status = ?, updated_by_user_id = ? WHERE employee_cash_advance_id = ?`,
          [newBalance, newBalance <= 0 ? 'paid' : 'active', req.authUser?.id || null, advance.id]
        );
        await connection.query(
          `INSERT INTO employee_cash_advance_deductions (employee_cash_advance_id, employee_payroll_id, deduction_date, amount, remaining_balance_after, notes, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [advance.id, payrollResult.insertId, preview.range.end, amount, newBalance, `${preview.range.label} payroll deduction`, req.authUser?.id || null]
        );
        remainingDeduction = roundMoney(remainingDeduction - amount);
      }
    }

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'create', module: 'Payroll', entityType: 'employee_payroll_period', entityId: String(periodId),
      entityLabel: preview.range.label, title: 'Finalized employee payroll',
      description: `Finalized payroll for ${preview.range.label}.`,
      metadata: preview.summary,
    });
    await connection.commit();
    return res.json({ success: true, message: `${preview.range.label} payroll finalized successfully.`, periodId, summary: preview.summary });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
