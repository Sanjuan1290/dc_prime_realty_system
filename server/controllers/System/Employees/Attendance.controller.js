import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import {
  buildEmployeeNameSql,
  calculateAttendanceMetrics,
  calculateCashAdvanceDeduction,
  cleanText,
  countScheduledWorkDays,
  dateOnly,
  ensureEmployeeModuleTables,
  enumerateDates,
  formatDuration,
  getEmployeeScheduleForDate,
  getEmployeeSchedules,
  getMonthBounds,
  getNextPayrollReleaseDate,
  getPayrollReleasePeriod,
  getPayrollAllowances,
  getSchedulePaidSeconds,
  getWeekday,
  nullableText,
  roundMoney,
  timeOnly,
} from './employeeModule.shared.js';

const attendanceStatuses = new Set([
  'present',
  'late',
  'absent',
  'paid_leave',
  'unpaid_leave',
  'rest_day',
  'holiday',
  'regular_holiday',
  'special_holiday',
  'half_day',
]);

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Attendance already exists for this employee and date.';
  return error?.message || 'Attendance operation failed.';
};

const normalizeAttendancePayload = (body = {}) => ({
  employeeId: Number(body.employee_id || 0),
  attendanceDate: dateOnly(body.attendance_date),
  actualTimeIn: timeOnly(body.actual_time_in),
  actualTimeOut: timeOnly(body.actual_time_out),
  status: attendanceStatuses.has(body.attendance_status) ? body.attendance_status : 'present',
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

const getSchedulesByEmployee = async (connection, employeeIds) => {
  const ids = employeeIds.map(Number).filter(Boolean);
  if (!ids.length) return new Map();

  const [rows] = await connection.query(
    `SELECT * FROM employee_work_schedules WHERE employee_id IN (${ids.map(() => '?').join(',')}) ORDER BY employee_id, weekday`,
    ids
  );

  const result = new Map();
  for (const row of rows) {
    const employeeId = Number(row.employee_id);
    if (!result.has(employeeId)) result.set(employeeId, []);
    result.get(employeeId).push({ ...row, is_work_day: Boolean(row.is_work_day) });
  }
  return result;
};

const getAttendanceByEmployee = async (connection, employeeIds, start, end) => {
  const ids = employeeIds.map(Number).filter(Boolean);
  if (!ids.length) return new Map();

  const [rows] = await connection.query(
    `
      SELECT *
      FROM employee_attendance_records
      WHERE employee_id IN (${ids.map(() => '?').join(',')})
        AND attendance_date BETWEEN ? AND ?
      ORDER BY employee_id, attendance_date
    `,
    [...ids, start, end]
  );

  const result = new Map();
  for (const row of rows) {
    const employeeId = Number(row.employee_id);
    if (!result.has(employeeId)) result.set(employeeId, []);
    result.get(employeeId).push(row);
  }
  return result;
};

const getEligibleAdvancesByEmployee = async (connection, releaseDate) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM employee_cash_advances
      WHERE cash_advance_status IN ('approved','active')
        AND remaining_balance > 0
        AND COALESCE(DATE(approved_at), request_date) <= ?
      ORDER BY employee_id, request_date, employee_cash_advance_id
    `,
    [releaseDate]
  );

  const result = new Map();
  for (const row of rows) {
    const employeeId = Number(row.employee_id);
    if (!result.has(employeeId)) result.set(employeeId, []);
    result.get(employeeId).push(row);
  }
  return result;
};

const getAttendanceMap = (rows = []) => new Map(rows.map((row) => [dateOnly(row.attendance_date), row]));
const getScheduleMap = (rows = []) => new Map(rows.map((row) => [Number(row.weekday), row]));

const isHolidayStatus = (status) => ['holiday', 'regular_holiday', 'special_holiday'].includes(status);

const getAttendanceBonusEligibility = ({ employee, schedules, attendanceRows, period }) => {
  if (!period.includesAttendanceBonus) {
    return { eligible: false, note: 'Attendance bonus is released only on the 7th.' };
  }

  const scheduleMap = getScheduleMap(schedules);
  const attendanceMap = getAttendanceMap(attendanceRows);
  const graceSeconds = Number(employee.attendance_grace_minutes ?? 15) * 60;
  const hireDate = dateOnly(employee.hire_date);
  let evaluatedWorkDays = 0;

  for (const attendanceDate of enumerateDates(period.bonusEvaluationStart, period.bonusEvaluationEnd)) {
    if (hireDate && attendanceDate < hireDate) continue;
    const schedule = scheduleMap.get(getWeekday(attendanceDate));
    if (!schedule?.is_work_day) continue;

    evaluatedWorkDays += 1;
    const record = attendanceMap.get(attendanceDate);

    if (!record) {
      return { eligible: false, note: `Missing attendance on ${attendanceDate}.` };
    }

    if (['absent', 'unpaid_leave', 'half_day'].includes(record.attendance_status)) {
      return { eligible: false, note: `Attendance status ${record.attendance_status.replaceAll('_', ' ')} on ${attendanceDate}.` };
    }

    // A late entry within the configured grace remains deductible, but it does not
    // remove the employee's attendance-bonus eligibility.
    if (Number(record.late_seconds || 0) > graceSeconds) {
      return {
        eligible: false,
        note: `Late beyond the ${Number(employee.attendance_grace_minutes ?? 15)}-minute bonus grace on ${attendanceDate}.`,
      };
    }
  }

  if (!evaluatedWorkDays) {
    return { eligible: false, note: 'No scheduled work days were available for attendance-bonus evaluation.' };
  }

  return {
    eligible: true,
    note: `Qualified for the ${Number(employee.attendance_grace_minutes ?? 15)}-minute attendance-bonus grace rule.`,
  };
};

const getRemarks = (status, lateSeconds, bonusGraceSeconds) => {
  if (status === 'not_employed') return 'Not Employed';
  if (status === 'rest_day') return 'RD';
  if (status === 'absent') return 'A';
  if (status === 'paid_leave') return 'Paid Leave';
  if (status === 'unpaid_leave') return 'Unpaid Leave';
  if (status === 'regular_holiday' || status === 'holiday') return 'Regular Holiday';
  if (status === 'special_holiday') return 'Special Holiday';
  if (status === 'half_day') return 'Half Day';
  if (lateSeconds > 0 && lateSeconds <= bonusGraceSeconds) return 'Late · Within Bonus Grace';
  if (lateSeconds > bonusGraceSeconds) return 'Late · Bonus Grace Exceeded';
  return 'On Time';
};

const formatLogbookTime = (value, fallback) => value ? String(value).slice(0, 8) : fallback;

const buildPayrollItem = ({ employee, schedules, attendanceRows, bonusAttendanceRows, period, advances }) => {
  const scheduleMap = getScheduleMap(schedules);
  const attendanceMap = getAttendanceMap(attendanceRows);
  const hireDate = dateOnly(employee.hire_date);
  const monthWorkDays = countScheduledWorkDays({
    schedules,
    start: period.salaryMonthStart,
    end: period.salaryMonthEnd,
    hireDate,
  });
  const dailyRate = roundMoney(Number(employee.monthly_salary || 0) / Math.max(monthWorkDays, 1));
  const bonusGraceSeconds = Number(employee.attendance_grace_minutes ?? 15) * 60;

  const logbookRows = [];
  let periodWorkDays = 0;
  let scheduledRegularSeconds = 0;
  let regularAttendedSeconds = 0;
  let paidTimeOffSeconds = 0;
  let regularHolidaySeconds = 0;
  let specialHolidaySeconds = 0;
  let lateSeconds = 0;
  let undertimeSeconds = 0;
  let overtimeSeconds = 0;
  let nightDifferentialSeconds = 0;
  let lateDeduction = 0;
  let undertimeDeduction = 0;
  let absenceDeduction = 0;
  let absentDays = 0;
  let overtimePay = 0;
  let nightDifferentialPay = 0;

  for (const attendanceDate of enumerateDates(period.start, period.end)) {
    const weekday = getWeekday(attendanceDate);
    const schedule = scheduleMap.get(weekday);
    const isWorkDay = Boolean(schedule?.is_work_day) && (!hireDate || attendanceDate >= hireDate);
    const scheduledSeconds = isWorkDay ? getSchedulePaidSeconds(schedule) : 0;
    const attendance = attendanceMap.get(attendanceDate);

    let status = attendance?.attendance_status || (isWorkDay ? 'absent' : (hireDate && attendanceDate < hireDate ? 'not_employed' : 'rest_day'));
    if (!isWorkDay && !attendance) status = hireDate && attendanceDate < hireDate ? 'not_employed' : 'rest_day';

    if (isWorkDay) {
      periodWorkDays += 1;
      scheduledRegularSeconds += scheduledSeconds;
    }

    const hourlyRate = scheduledSeconds > 0 ? dailyRate / (scheduledSeconds / 3600) : 0;
    const rowLateSeconds = Number(attendance?.late_seconds || 0);
    const rowUndertimeSeconds = Number(attendance?.undertime_seconds || 0);
    const rowOvertimeSeconds = Number(attendance?.overtime_seconds || 0);
    const rowNightSeconds = Number(attendance?.night_differential_seconds || 0);

    let rowRegularSeconds = 0;
    let rowPaidTimeOff = 0;
    let rowRegularHoliday = 0;
    let rowSpecialHoliday = 0;
    let rowAbsenceDeduction = 0;

    if (['present', 'late', 'half_day'].includes(status)) {
      rowRegularSeconds = Number(attendance?.regular_work_seconds || 0);
      if (!rowRegularSeconds && scheduledSeconds) {
        rowRegularSeconds = Math.max(scheduledSeconds - rowLateSeconds - rowUndertimeSeconds, 0);
      }
    } else if (status === 'paid_leave') {
      rowPaidTimeOff = scheduledSeconds;
    } else if (status === 'regular_holiday' || status === 'holiday') {
      rowRegularHoliday = scheduledSeconds;
    } else if (status === 'special_holiday') {
      rowSpecialHoliday = scheduledSeconds;
    } else if (['absent', 'unpaid_leave'].includes(status) && isWorkDay) {
      rowAbsenceDeduction = dailyRate;
      absentDays += 1;
    }

    const rowLateDeduction = roundMoney((rowLateSeconds / 3600) * hourlyRate);
    const rowUndertimeDeduction = roundMoney((rowUndertimeSeconds / 3600) * hourlyRate);
    const rowOvertimePay = roundMoney((rowOvertimeSeconds / 3600) * hourlyRate * Number(employee.overtime_multiplier ?? 2));
    const rowNightPay = roundMoney((rowNightSeconds / 3600) * hourlyRate * (Number(employee.night_differential_percent || 0) / 100));

    regularAttendedSeconds += rowRegularSeconds;
    paidTimeOffSeconds += rowPaidTimeOff;
    regularHolidaySeconds += rowRegularHoliday;
    specialHolidaySeconds += rowSpecialHoliday;
    lateSeconds += rowLateSeconds;
    undertimeSeconds += rowUndertimeSeconds;
    overtimeSeconds += rowOvertimeSeconds;
    nightDifferentialSeconds += rowNightSeconds;
    lateDeduction += rowLateDeduction;
    undertimeDeduction += rowUndertimeDeduction;
    absenceDeduction += rowAbsenceDeduction;
    overtimePay += rowOvertimePay;
    nightDifferentialPay += rowNightPay;

    const totalWorkedSeconds = rowRegularSeconds + rowOvertimeSeconds;
    logbookRows.push({
      day: new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${attendanceDate}T00:00:00Z`)).toUpperCase(),
      date: attendanceDate,
      timeIn: formatLogbookTime(attendance?.actual_time_in, status === 'rest_day' ? 'RD' : status === 'absent' ? 'A' : '-'),
      timeOut: formatLogbookTime(attendance?.actual_time_out, status === 'rest_day' ? 'RD' : status === 'absent' ? 'A' : '-'),
      totalHoursWorked: ['rest_day', 'not_employed'].includes(status) ? 'RD' : status === 'absent' ? 'A' : formatDuration(totalWorkedSeconds, { clock: true }),
      totalTimeLate: ['rest_day', 'not_employed'].includes(status) ? 'RD' : status === 'absent' ? 'A' : rowLateSeconds > 0 ? `-${formatDuration(rowLateSeconds, { clock: true })}` : '00:00:00',
      overtime: ['rest_day', 'not_employed'].includes(status) ? 'RD' : status === 'absent' ? 'A' : formatDuration(rowOvertimeSeconds, { clock: true }),
      regularHoursAttended: ['rest_day', 'not_employed'].includes(status) ? 'RD' : status === 'absent' ? 'A' : formatDuration(rowRegularSeconds, { clock: true }),
      remarks: getRemarks(status, rowLateSeconds, bonusGraceSeconds),
      status,
      lateSeconds: rowLateSeconds,
      overtimeSeconds: rowOvertimeSeconds,
      regularAttendedSeconds: rowRegularSeconds,
      totalWorkedSeconds,
    });
  }

  lateDeduction = roundMoney(lateDeduction);
  undertimeDeduction = roundMoney(undertimeDeduction);
  absenceDeduction = roundMoney(absenceDeduction);
  overtimePay = roundMoney(overtimePay);
  nightDifferentialPay = roundMoney(nightDifferentialPay);

  const baseSalary = roundMoney(dailyRate * periodWorkDays);
  const regularPayAfterAttendance = roundMoney(Math.max(baseSalary - lateDeduction - undertimeDeduction - absenceDeduction, 0));
  const { riceAllowance, transportationAllowance } = getPayrollAllowances({ employee, period });
  const bonusEligibility = getAttendanceBonusEligibility({
    employee,
    schedules,
    attendanceRows: bonusAttendanceRows,
    period,
  });
  const attendanceBonus = period.includesAttendanceBonus && bonusEligibility.eligible
    ? roundMoney(employee.attendance_bonus_amount ?? 3000)
    : 0;
  const otherAdjustments = 0;

  const grossPay = roundMoney(
    baseSalary
      + overtimePay
      + nightDifferentialPay
      + riceAllowance
      + transportationAllowance
      + attendanceBonus
      + otherAdjustments
  );

  const attendanceDeductions = roundMoney(lateDeduction + undertimeDeduction + absenceDeduction);
  const activeAdvances = advances || [];
  const cashAdvanceDeduction = calculateCashAdvanceDeduction({
    advances: activeAdvances,
    availableSalary: Math.max(grossPay - attendanceDeductions, 0),
  });
  const totalDeductions = roundMoney(attendanceDeductions + cashAdvanceDeduction);
  const netPay = roundMoney(Math.max(grossPay - totalDeductions, 0));
  const hourlyRate = scheduledRegularSeconds > 0 ? roundMoney(baseSalary / (scheduledRegularSeconds / 3600)) : 0;

  return {
    employeeId: Number(employee.employee_id),
    employeeCode: employee.employee_code,
    fullName: employee.full_name,
    department: employee.department,
    position: employee.position,
    employmentType: employee.employment_type,
    hireDate: employee.hire_date,
    monthlySalary: roundMoney(employee.monthly_salary),
    monthWorkDays,
    periodWorkDays,
    dailyRate,
    hourlyRate,
    scheduledRegularSeconds,
    regularAttendedSeconds,
    paidTimeOffSeconds,
    regularHolidaySeconds,
    specialHolidaySeconds,
    lateSeconds,
    undertimeSeconds,
    overtimeSeconds,
    nightDifferentialSeconds,
    lateDuration: formatDuration(lateSeconds),
    undertimeDuration: formatDuration(undertimeSeconds),
    overtimeDuration: formatDuration(overtimeSeconds),
    lateMinutes: roundMoney(lateSeconds / 60),
    lateDeduction,
    undertimeDeduction,
    absentDays,
    absenceDeduction,
    regularPayAfterAttendance,
    overtimePay,
    nightDifferentialPay,
    riceAllowance,
    transportationAllowance,
    attendanceBonus,
    attendanceBonusEligible: bonusEligibility.eligible,
    attendanceBonusNote: bonusEligibility.note,
    cashAdvanceDeduction,
    otherAdjustments,
    totalDeductions,
    grossPay,
    netPay,
    activeAdvances: activeAdvances.map((advance) => ({
      id: Number(advance.employee_cash_advance_id),
      referenceNumber: advance.reference_number,
      remainingBalance: Number(advance.remaining_balance || 0),
      suggestedDeduction: Number(advance.remaining_balance || 0),
    })),
    logbook: {
      rows: logbookRows,
      totals: {
        numberOfDays: periodWorkDays,
        numberOfHours: roundMoney(scheduledRegularSeconds / 3600),
        totalHoursWorkedWithOvertime: formatDuration(regularAttendedSeconds + overtimeSeconds, { clock: true }),
        late: lateSeconds > 0 ? `-${formatDuration(lateSeconds, { clock: true })}` : '00:00:00',
        overtime: formatDuration(overtimeSeconds, { clock: true }),
        hoursAttended: formatDuration(regularAttendedSeconds, { clock: true }),
      },
    },
  };
};

const mapSavedPayrollRow = (row) => {
  const baseSalary = Number(row.base_salary || 0);
  const lateDeduction = Number(row.late_deduction || 0);
  const undertimeDeduction = Number(row.undertime_deduction || 0);
  const absenceDeduction = Number(row.absence_deduction || 0);
  const cashAdvanceDeduction = Number(row.cash_advance_deduction || 0);

  return {
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code,
    fullName: row.full_name,
    department: row.department,
    position: row.position,
    employmentType: row.employment_type,
    monthlySalary: Number(row.monthly_salary_snapshot || 0),
    monthWorkDays: Number(row.month_work_days_snapshot || 0),
    periodWorkDays: Number(row.period_work_days || 0),
    dailyRate: Number(row.month_work_days_snapshot || 0) > 0
      ? roundMoney(Number(row.monthly_salary_snapshot || 0) / Number(row.month_work_days_snapshot || 1))
      : 0,
    hourlyRate: Number(row.hourly_rate_snapshot || 0),
    scheduledRegularSeconds: Number(row.scheduled_regular_seconds || 0),
    regularAttendedSeconds: Number(row.regular_attended_seconds || 0),
    paidTimeOffSeconds: Number(row.paid_time_off_seconds || 0),
    regularHolidaySeconds: Number(row.regular_holiday_seconds || 0),
    specialHolidaySeconds: Number(row.special_holiday_seconds || 0),
    lateSeconds: Number(row.late_seconds || 0),
    undertimeSeconds: Number(row.undertime_seconds || 0),
    overtimeSeconds: Number(row.overtime_seconds || 0),
    nightDifferentialSeconds: Number(row.night_differential_seconds || 0),
    lateDuration: formatDuration(row.late_seconds),
    undertimeDuration: formatDuration(row.undertime_seconds),
    overtimeDuration: formatDuration(row.overtime_seconds),
    lateMinutes: roundMoney(Number(row.late_seconds || 0) / 60),
    lateDeduction,
    undertimeDeduction,
    absentDays: Number(row.absent_days || 0),
    absenceDeduction,
    regularPayAfterAttendance: roundMoney(Math.max(baseSalary - lateDeduction - undertimeDeduction - absenceDeduction, 0)),
    overtimePay: Number(row.overtime_pay || 0),
    nightDifferentialPay: Number(row.night_differential_pay || 0),
    riceAllowance: Number(row.rice_allowance || 0),
    transportationAllowance: Number(row.transportation_allowance || 0),
    attendanceBonus: Number(row.attendance_bonus || 0),
    attendanceBonusEligible: Boolean(row.attendance_bonus_eligible),
    attendanceBonusNote: row.attendance_bonus_note,
    cashAdvanceDeduction,
    otherAdjustments: Number(row.other_adjustments || 0),
    totalDeductions: roundMoney(lateDeduction + undertimeDeduction + absenceDeduction + cashAdvanceDeduction),
    grossPay: Number(row.gross_pay || 0),
    netPay: Number(row.net_pay || 0),
    isFinalized: true,
    payrollId: Number(row.employee_payroll_id),
  };
};

const summarizePayroll = (data) => ({
  employeeCount: data.length,
  grossPayroll: roundMoney(data.reduce((sum, item) => sum + Number(item.grossPay || 0), 0)),
  attendanceDeductions: roundMoney(data.reduce(
    (sum, item) => sum + Number(item.lateDeduction || 0) + Number(item.undertimeDeduction || 0) + Number(item.absenceDeduction || 0),
    0
  )),
  cashAdvanceDeductions: roundMoney(data.reduce((sum, item) => sum + Number(item.cashAdvanceDeduction || 0), 0)),
  allowances: roundMoney(data.reduce((sum, item) => sum + Number(item.riceAllowance || 0) + Number(item.transportationAllowance || 0), 0)),
  attendanceBonuses: roundMoney(data.reduce((sum, item) => sum + Number(item.attendanceBonus || 0), 0)),
  overtimePay: roundMoney(data.reduce((sum, item) => sum + Number(item.overtimePay || 0), 0)),
  netPayroll: roundMoney(data.reduce((sum, item) => sum + Number(item.netPay || 0), 0)),
});

const getPayrollPeriodRow = async (connection, period) => {
  const [rows] = await connection.query(
    `
      SELECT pp.*, ${buildEmployeeNameSql('u')} AS finalized_by_name
      FROM employee_payroll_periods pp
      LEFT JOIN users u ON u.id = pp.finalized_by_user_id
      WHERE pp.release_date = ? OR (pp.period_start = ? AND pp.period_end = ?)
      LIMIT 1
    `,
    [period.releaseDate, period.start, period.end]
  );
  return rows[0] || null;
};

const calculateLivePayroll = async (connection, releaseDateValue) => {
  const period = getPayrollReleasePeriod(releaseDateValue);
  const [employees] = await connection.query(
    `
      SELECT e.*, ${buildEmployeeNameSql('e')} AS full_name
      FROM employees e
      WHERE e.employee_status <> 'archived'
        AND e.hire_date <= ?
      ORDER BY e.last_name, e.first_name
    `,
    [period.end]
  );

  const employeeIds = employees.map((employee) => Number(employee.employee_id));
  const schedulesByEmployee = await getSchedulesByEmployee(connection, employeeIds);
  const attendanceStart = period.includesAttendanceBonus ? period.bonusEvaluationStart : period.start;
  const attendanceByEmployee = await getAttendanceByEmployee(connection, employeeIds, attendanceStart, period.end);
  const advancesByEmployee = await getEligibleAdvancesByEmployee(connection, period.releaseDate);

  const data = employees.map((employee) => {
    const allAttendance = attendanceByEmployee.get(Number(employee.employee_id)) || [];
    const periodAttendance = allAttendance.filter((row) => row.attendance_date >= period.start && row.attendance_date <= period.end);

    return buildPayrollItem({
      employee,
      schedules: schedulesByEmployee.get(Number(employee.employee_id)) || [],
      attendanceRows: periodAttendance,
      bonusAttendanceRows: allAttendance,
      period,
      advances: advancesByEmployee.get(Number(employee.employee_id)) || [],
    });
  });

  return { period, data, summary: summarizePayroll(data) };
};

const getPayrollData = async (connection, releaseDateValue) => {
  const period = getPayrollReleasePeriod(releaseDateValue);
  const periodRow = await getPayrollPeriodRow(connection, period);

  if (periodRow?.payroll_status === 'finalized') {
    const [rows] = await connection.query(
      `
        SELECT p.*, e.employee_code, e.department, e.position, e.employment_type,
          ${buildEmployeeNameSql('e')} AS full_name
        FROM employee_payrolls p
        INNER JOIN employees e ON e.employee_id = p.employee_id
        WHERE p.employee_payroll_period_id = ?
        ORDER BY e.last_name, e.first_name
      `,
      [periodRow.employee_payroll_period_id]
    );
    const data = rows.map(mapSavedPayrollRow);
    return { period, periodRow, data, summary: summarizePayroll(data), isFinalized: true };
  }

  const live = await calculateLivePayroll(connection, period.releaseDate);
  return { ...live, periodRow, isFinalized: false };
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

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM employee_attendance_records a INNER JOIN employees e ON e.employee_id = a.employee_id WHERE ${where.join(' AND ')}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await connection.query(
      `
        SELECT a.*, e.employee_code, ${buildEmployeeNameSql('e')} AS full_name,
          e.department, e.position, e.monthly_salary, e.attendance_grace_minutes,
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
        regular_work_seconds: Number(row.regular_work_seconds || 0),
        late_seconds: Number(row.late_seconds || 0),
        undertime_seconds: Number(row.undertime_seconds || 0),
        overtime_seconds: Number(row.overtime_seconds || 0),
        night_differential_seconds: Number(row.night_differential_seconds || 0),
        bonus_late_violation: Boolean(row.bonus_late_violation),
        late_deduction: Number(row.late_deduction || 0),
        undertime_deduction: Number(row.undertime_deduction || 0),
        absence_deduction: Number(row.absence_deduction || 0),
        late_duration: formatDuration(row.late_seconds),
        undertime_duration: formatDuration(row.undertime_seconds),
        overtime_duration: formatDuration(row.overtime_seconds),
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
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

    if (!payload.employeeId || !payload.attendanceDate) {
      return res.status(400).json({ message: 'Employee and attendance date are required.' });
    }
    if (['present', 'late', 'half_day'].includes(payload.status) && !payload.actualTimeIn) {
      return res.status(400).json({ message: 'Time in is required for present, late, and half-day records.' });
    }

    const employee = await getEmployeeForAttendance(connection, payload.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });

    const schedule = await getEmployeeScheduleForDate(connection, payload.employeeId, payload.attendanceDate);
    const schedules = await getEmployeeSchedules(connection, payload.employeeId);
    const monthBounds = getMonthBounds(payload.attendanceDate);
    const monthWorkDays = countScheduledWorkDays({
      schedules,
      start: monthBounds.start,
      end: monthBounds.end,
      hireDate: employee.hire_date,
    });
    const metrics = calculateAttendanceMetrics({
      employee,
      schedule,
      status: payload.status,
      actualTimeIn: payload.actualTimeIn,
      actualTimeOut: payload.actualTimeOut,
      monthWorkDays,
    });
    const resolvedStatus = resolveStatus(payload.status, metrics, schedule);

    await connection.beginTransaction();
    let savedId = attendanceId;

    const values = [
      payload.employeeId,
      payload.attendanceDate,
      schedule?.shift_start || null,
      schedule?.shift_end || null,
      payload.actualTimeIn,
      payload.actualTimeOut,
      metrics.regularWorkSeconds,
      metrics.lateSeconds,
      metrics.undertimeSeconds,
      metrics.overtimeSeconds,
      metrics.nightDifferentialSeconds,
      metrics.bonusLateViolation ? 1 : 0,
      metrics.lateDeduction,
      metrics.undertimeDeduction,
      metrics.absenceDeduction,
      resolvedStatus,
      payload.notes,
      payload.source,
    ];

    if (isUpdate) {
      const [result] = await connection.query(
        `
          UPDATE employee_attendance_records SET
            employee_id = ?, attendance_date = ?, scheduled_time_in = ?, scheduled_time_out = ?,
            actual_time_in = ?, actual_time_out = ?, regular_work_seconds = ?, late_seconds = ?,
            undertime_seconds = ?, overtime_seconds = ?, night_differential_seconds = ?,
            bonus_late_violation = ?, late_deduction = ?, undertime_deduction = ?, absence_deduction = ?,
            attendance_status = ?, notes = ?, source = ?, updated_by_user_id = ?
          WHERE employee_attendance_id = ?
        `,
        [...values, req.authUser?.id || null, attendanceId]
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
            regular_work_seconds, late_seconds, undertime_seconds, overtime_seconds, night_differential_seconds,
            bonus_late_violation, late_deduction, undertime_deduction, absence_deduction, attendance_status,
            notes, source, recorded_by_user_id, updated_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [...values, req.authUser?.id || null, req.authUser?.id || null]
      );
      savedId = result.insertId;
    }

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: isUpdate ? 'update' : 'create',
      module: 'Attendance',
      entityType: 'employee_attendance',
      entityId: String(savedId),
      entityLabel: `${employee.employee_code} - ${payload.attendanceDate}`,
      title: isUpdate ? 'Updated attendance' : 'Recorded attendance',
      description: `${employee.employee_code} attendance saved as ${resolvedStatus}.`,
      metadata: {
        employeeId: payload.employeeId,
        attendanceDate: payload.attendanceDate,
        lateSeconds: metrics.lateSeconds,
        undertimeSeconds: metrics.undertimeSeconds,
        overtimeSeconds: metrics.overtimeSeconds,
        bonusLateViolation: metrics.bonusLateViolation,
      },
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
      action: 'delete',
      module: 'Attendance',
      entityType: 'employee_attendance',
      entityId: String(attendanceId),
      entityLabel: `${rows[0].employee_code} - ${rows[0].attendance_date}`,
      title: 'Deleted attendance record',
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
    const releaseDate = dateOnly(req.query.releaseDate)
      || (cleanText(req.query.month) ? `${cleanText(req.query.month)}-22` : null)
      || getNextPayrollReleaseDate();
    const payroll = await getPayrollData(connection, releaseDate);

    return res.json({
      success: true,
      range: payroll.period,
      data: payroll.data,
      summary: payroll.summary,
      period: payroll.periodRow,
      isFinalized: payroll.isFinalized,
    });
  } catch (error) {
    return res.status(400).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getPayrollPeriods = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 100);
    const [rows] = await connection.query(
      `
        SELECT pp.*, ${buildEmployeeNameSql('u')} AS finalized_by_name,
          COUNT(p.employee_payroll_id) AS employee_count,
          COALESCE(SUM(p.net_pay), 0) AS net_payroll
        FROM employee_payroll_periods pp
        LEFT JOIN users u ON u.id = pp.finalized_by_user_id
        LEFT JOIN employee_payrolls p ON p.employee_payroll_period_id = pp.employee_payroll_period_id
        GROUP BY pp.employee_payroll_period_id
        ORDER BY COALESCE(pp.release_date, pp.period_end) DESC
        LIMIT ?
      `,
      [limit]
    );

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        employee_count: Number(row.employee_count || 0),
        net_payroll: Number(row.net_payroll || 0),
      })),
      nextReleaseDate: getNextPayrollReleaseDate(),
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getEmployeeLogbook = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const employeeId = Number(req.query.employeeId || 0);
    const releaseDate = dateOnly(req.query.releaseDate) || getNextPayrollReleaseDate();
    if (!employeeId) return res.status(400).json({ message: 'Select an employee to view the logbook.' });

    const payroll = await calculateLivePayroll(connection, releaseDate);
    const item = payroll.data.find((row) => row.employeeId === employeeId);
    if (!item) return res.status(404).json({ message: 'Employee payroll logbook was not found for this release.' });

    return res.json({
      success: true,
      range: payroll.period,
      employee: {
        employeeId: item.employeeId,
        employeeCode: item.employeeCode,
        fullName: item.fullName,
        department: item.department,
        position: item.position,
      },
      data: item.logbook.rows,
      totals: item.logbook.totals,
      payroll: {
        dailyRate: item.dailyRate,
        hourlyRate: item.hourlyRate,
        lateDeduction: item.lateDeduction,
        attendanceBonusEligible: item.attendanceBonusEligible,
        attendanceBonusNote: item.attendanceBonusNote,
      },
    });
  } catch (error) {
    return res.status(400).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getEmployeePayrollRelease = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const employeeId = Number(req.query.employeeId || 0);
    const releaseDate = dateOnly(req.query.releaseDate) || getNextPayrollReleaseDate();
    if (!employeeId) return res.status(400).json({ message: 'Select an employee to print the salary release.' });

    const payroll = await getPayrollData(connection, releaseDate);
    const item = payroll.data.find((row) => row.employeeId === employeeId);
    if (!item) return res.status(404).json({ message: 'Employee salary release was not found.' });

    return res.json({
      success: true,
      range: payroll.period,
      period: payroll.periodRow,
      data: item,
      isFinalized: payroll.isFinalized,
    });
  } catch (error) {
    return res.status(400).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const finalizePayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const releaseDate = dateOnly(req.body.releaseDate || req.body.release_date);
    if (!releaseDate) return res.status(400).json({ message: 'Payroll release date is required.' });

    const preview = await calculateLivePayroll(connection, releaseDate);
    const witnessName = nullableText(req.body.witnessName || req.body.witness_name);
    const releaseNotes = nullableText(req.body.releaseNotes || req.body.release_notes);

    await connection.beginTransaction();
    const existingPeriod = await getPayrollPeriodRow(connection, preview.period);
    if (existingPeriod?.payroll_status === 'finalized') {
      await connection.rollback();
      return res.status(409).json({ message: `${preview.period.releaseLabel} payroll is already finalized.` });
    }

    let periodId = existingPeriod?.employee_payroll_period_id;
    if (!periodId) {
      const [periodResult] = await connection.query(
        `
          INSERT INTO employee_payroll_periods (
            period_label, period_start, period_end, release_date, release_day, period_type,
            witness_name, release_notes, payroll_status, finalized_by_user_id, finalized_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'finalized', ?, NOW())
        `,
        [
          preview.period.shortLabel,
          preview.period.start,
          preview.period.end,
          preview.period.releaseDate,
          preview.period.releaseDay,
          preview.period.periodType,
          witnessName,
          releaseNotes,
          req.authUser?.id || null,
        ]
      );
      periodId = periodResult.insertId;
    } else {
      await connection.query(
        `
          UPDATE employee_payroll_periods SET
            period_label = ?, release_date = ?, release_day = ?, period_type = ?, witness_name = ?,
            release_notes = ?, payroll_status = 'finalized', finalized_by_user_id = ?, finalized_at = NOW()
          WHERE employee_payroll_period_id = ?
        `,
        [
          preview.period.shortLabel,
          preview.period.releaseDate,
          preview.period.releaseDay,
          preview.period.periodType,
          witnessName,
          releaseNotes,
          req.authUser?.id || null,
          periodId,
        ]
      );
      await connection.query('DELETE FROM employee_payrolls WHERE employee_payroll_period_id = ?', [periodId]);
    }

    for (const item of preview.data) {
      const [payrollResult] = await connection.query(
        `
          INSERT INTO employee_payrolls (
            employee_payroll_period_id, employee_id, monthly_salary_snapshot, payroll_divisor_snapshot,
            month_work_days_snapshot, period_work_days, hourly_rate_snapshot, base_salary,
            scheduled_regular_seconds, regular_attended_seconds, paid_time_off_seconds,
            regular_holiday_seconds, special_holiday_seconds, late_seconds, late_deduction,
            undertime_seconds, undertime_deduction, absent_days, absence_deduction,
            overtime_seconds, overtime_pay, night_differential_seconds, night_differential_pay,
            rice_allowance, transportation_allowance, attendance_bonus, attendance_bonus_eligible,
            attendance_bonus_note, cash_advance_deduction, other_adjustments, gross_pay, net_pay,
            payroll_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalized')
        `,
        [
          periodId,
          item.employeeId,
          item.monthlySalary,
          0,
          item.monthWorkDays,
          item.periodWorkDays,
          item.hourlyRate,
          item.regularPayAfterAttendance + item.lateDeduction + item.undertimeDeduction + item.absenceDeduction,
          item.scheduledRegularSeconds,
          item.regularAttendedSeconds,
          item.paidTimeOffSeconds,
          item.regularHolidaySeconds,
          item.specialHolidaySeconds,
          item.lateSeconds,
          item.lateDeduction,
          item.undertimeSeconds,
          item.undertimeDeduction,
          item.absentDays,
          item.absenceDeduction,
          item.overtimeSeconds,
          item.overtimePay,
          item.nightDifferentialSeconds,
          item.nightDifferentialPay,
          item.riceAllowance,
          item.transportationAllowance,
          item.attendanceBonus,
          item.attendanceBonusEligible ? 1 : 0,
          item.attendanceBonusNote,
          item.cashAdvanceDeduction,
          item.otherAdjustments,
          item.grossPay,
          item.netPay,
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
          `
            INSERT INTO employee_cash_advance_deductions (
              employee_cash_advance_id, employee_payroll_id, deduction_date, amount,
              remaining_balance_after, notes, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            advance.id,
            payrollResult.insertId,
            preview.period.releaseDate,
            amount,
            newBalance,
            `${preview.period.shortLabel} salary release deduction`,
            req.authUser?.id || null,
          ]
        );
        remainingDeduction = roundMoney(remainingDeduction - amount);
      }
    }

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'create',
      module: 'Payroll',
      entityType: 'employee_payroll_period',
      entityId: String(periodId),
      entityLabel: preview.period.releaseLabel,
      title: 'Finalized employee salary release',
      description: `Finalized the ${preview.period.shortLabel} payroll for release on ${preview.period.releaseLabel}.`,
      metadata: { ...preview.summary, releaseDate: preview.period.releaseDate, periodStart: preview.period.start, periodEnd: preview.period.end },
    });

    await connection.commit();
    return res.json({
      success: true,
      message: `${preview.period.releaseLabel} salary release finalized successfully.`,
      periodId,
      range: preview.period,
      summary: preview.summary,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(400).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
