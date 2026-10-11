import { buildEmployeeNameSql, dateOnly } from '../controllers/System/Employees/employeeModule.shared.js';
import { ensureAttendanceLiteSchema, getManilaDateTime } from '../controllers/System/Employees/attendanceLite.shared.js';
import { calculateDraftPayrollMoney } from './payrollCalculation.service.js';
import { getPayrollAttendanceSummary } from './payrollAttendance.service.js';
import { getEffectiveCompensationForPeriod } from './payrollCompensation.service.js';
import { clampPayrollAttendanceThrough, payrollPeriodFromDates, resolvePayrollPeriod } from './payrollPeriod.service.js';
import { getPayrollSettingsSnapshot } from './payrollSettings.service.js';

export const PAYROLL_CALCULATION_VERSION = 'employee-salary-batch9-v1';
let payrollSchemaReady = false;

const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
};

const overlayFinalizedSnapshot = (row = {}, snapshot = null) => {
  if (!snapshot) return row;
  const employee = snapshot.employee || {};
  const compensation = snapshot.compensation || {};
  const attendance = snapshot.attendance || {};
  const earnings = snapshot.earnings || {};
  const allowances = snapshot.allowances || {};
  const adjustments = snapshot.adjustments || {};
  const deductions = snapshot.deductions || {};
  return {
    ...row,
    employee_name_snapshot: employee.name ?? row.employee_name_snapshot,
    position_snapshot: employee.position ?? row.position_snapshot,
    department_snapshot: employee.department ?? row.department_snapshot,
    employment_status_snapshot: employee.employment_status ?? row.employment_status_snapshot,
    monthly_salary_snapshot: Number(compensation.monthly_basic ?? row.monthly_salary_snapshot ?? 0),
    half_month_basic: Number(compensation.half_month_basic ?? row.half_month_basic ?? 0),
    daily_rate: Number(compensation.daily_rate ?? row.daily_rate ?? 0),
    hourly_rate_snapshot: Number(compensation.hourly_rate ?? row.hourly_rate_snapshot ?? 0),
    minute_rate: Number(compensation.minute_rate ?? row.minute_rate ?? 0),
    regular_working_minutes_snapshot: Number(snapshot.attendance_settings?.regular_working_minutes ?? row.regular_working_minutes_snapshot ?? 0),
    attendance_calculated_through: attendance.attendance_calculated_through ?? row.attendance_calculated_through,
    expected_regular_minutes: Number(attendance.expected_regular_minutes ?? row.expected_regular_minutes ?? 0),
    regular_attended_minutes: Number(attendance.regular_attended_minutes ?? row.regular_attended_minutes ?? 0),
    pto_minutes: Number(attendance.pto_minutes ?? row.pto_minutes ?? 0),
    regular_holiday_minutes: Number(attendance.regular_holiday_minutes ?? row.regular_holiday_minutes ?? 0),
    special_holiday_minutes: Number(attendance.special_holiday_minutes ?? row.special_holiday_minutes ?? 0),
    late_minutes: Number(attendance.late_minutes ?? row.late_minutes ?? 0),
    absence_minutes: Number(attendance.absence_minutes ?? row.absence_minutes ?? 0),
    tardiness_absence_minutes: Number(attendance.tardiness_absence_minutes ?? row.tardiness_absence_minutes ?? 0),
    overtime_minutes: Number(attendance.overtime_minutes ?? row.overtime_minutes ?? 0),
    rest_day_overtime_minutes: Number(attendance.rest_day_overtime_minutes ?? row.rest_day_overtime_minutes ?? 0),
    night_differential_minutes: Number(attendance.night_differential_minutes ?? row.night_differential_minutes ?? 0),
    attendance_breakdown: snapshot.attendance_breakdown || row.attendance_breakdown || [],
    attendance_deduction: Number(deductions.attendance_deduction ?? row.attendance_deduction ?? 0),
    overtime_pay: Number(earnings.overtime_pay ?? row.overtime_pay ?? 0),
    rest_day_overtime_pay: Number(earnings.rest_day_overtime_pay ?? row.rest_day_overtime_pay ?? 0),
    regular_holiday_pay: Number(earnings.regular_holiday_pay ?? row.regular_holiday_pay ?? 0),
    special_holiday_pay: Number(earnings.special_holiday_pay ?? row.special_holiday_pay ?? 0),
    night_differential_pay: Number(earnings.night_differential_pay ?? row.night_differential_pay ?? 0),
    rice_allowance: Number(allowances.rice_allowance ?? row.rice_allowance ?? 0),
    transportation_allowance: Number(allowances.transportation_allowance ?? row.transportation_allowance ?? 0),
    attendance_bonus: Number(allowances.attendance_bonus ?? row.attendance_bonus ?? 0),
    manual_additions_total: Number(adjustments.manual_additions_total ?? row.manual_additions_total ?? 0),
    manual_deductions_total: Number(adjustments.manual_deductions_total ?? row.manual_deductions_total ?? 0),
    net_fund_release: Number(snapshot.net_fund_release ?? row.net_fund_release ?? 0),
    calculation_version: snapshot.calculation_version ?? row.calculation_version,
    payroll_settings_snapshot: snapshot.payroll_multipliers || row.payroll_settings_snapshot || null,
    calculation_warnings: snapshot.calculation_warnings || row.calculation_warnings || [],
  };
};

const payrollError = (message, code = 'PAYROLL_ERROR', statusCode = 400, data = null) =>
  Object.assign(new Error(message), { code, statusCode, data });

export const ensureEmployeePayrollSchema = async (connection) => {
  if (payrollSchemaReady) return;
  await ensureAttendanceLiteSchema(connection);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS employee_payroll_periods (
      employee_payroll_period_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      period_label VARCHAR(80) NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      release_date DATE NULL,
      release_day TINYINT UNSIGNED NULL,
      period_type ENUM('first_half','second_half') NULL,
      witness_name VARCHAR(180) NULL,
      release_notes TEXT NULL,
      payroll_status ENUM('draft','finalized','cancelled') NOT NULL DEFAULT 'draft',
      finalized_by_user_id INT UNSIGNED NULL,
      finalized_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_payroll_period_id),
      UNIQUE KEY uq_employee_payroll_period (period_start, period_end)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS employee_payrolls (
      employee_payroll_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_payroll_period_id INT UNSIGNED NOT NULL,
      employee_id INT UNSIGNED NOT NULL,
      monthly_salary_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      hourly_rate_snapshot DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
      base_salary DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      rice_allowance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      transportation_allowance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      attendance_bonus DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      gross_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      net_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      payroll_status ENUM('draft','finalized','cancelled') NOT NULL DEFAULT 'draft',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_payroll_id),
      UNIQUE KEY uq_employee_payroll_employee (employee_payroll_period_id, employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const additions = [
    ['employment_history_id', 'BIGINT UNSIGNED NULL'],
    ['employee_name_snapshot', 'VARCHAR(255) NULL'],
    ['position_snapshot', 'VARCHAR(120) NULL'],
    ['department_snapshot', 'VARCHAR(120) NULL'],
    ['employment_status_snapshot', 'VARCHAR(40) NULL'],
    ['half_month_basic', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['daily_rate', 'DECIMAL(14,6) NOT NULL DEFAULT 0.000000'],
    ['minute_rate', 'DECIMAL(14,6) NOT NULL DEFAULT 0.000000'],
    ['regular_working_minutes_snapshot', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0'],
    ['attendance_calculated_through', 'DATE NULL'],
    ['expected_regular_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['regular_attended_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['pto_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['regular_holiday_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['special_holiday_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['late_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['absence_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['tardiness_absence_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['overtime_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['rest_day_overtime_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['night_differential_minutes', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['attendance_deduction', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['rest_day_overtime_pay', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['regular_holiday_pay', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['special_holiday_pay', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['manual_additions_total', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['manual_deductions_total', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['net_fund_release', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['calculation_version', 'VARCHAR(80) NULL'],
    ['payroll_settings_snapshot_json', 'JSON NULL'],
    ['calculation_warnings_json', 'JSON NULL'],
    ['attendance_breakdown_json', 'JSON NULL'],
    ['finalized_snapshot_json', 'JSON NULL'],
    ['finalized_attendance_fingerprint', 'CHAR(64) NULL'],
    ['finalized_by_user_id', 'INT UNSIGNED NULL'],
    ['finalized_at', 'DATETIME NULL'],
    ['released_date', 'DATE NULL'],
    ['released_at', 'DATETIME NULL'],
    ['released_by_user_id', 'INT UNSIGNED NULL'],
    ['release_reference', 'VARCHAR(180) NULL'],
    ['release_notes', 'TEXT NULL'],
  ];
  for (const [column, definition] of additions) {
    await connection.query(`ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }

  await connection.query(`
    ALTER TABLE employee_payrolls
    MODIFY COLUMN payroll_status ENUM('draft','finalized','corrected','released','cancelled') NOT NULL DEFAULT 'draft'
  `);

  // Legacy columns exist in the production backup. These ADD COLUMN operations
  // make the Batch-2 engine safe on fresh/dev schemas without changing their meaning.
  const legacyAdditions = [
    ['payroll_divisor_snapshot', 'DECIMAL(8,2) NOT NULL DEFAULT 26.00'],
    ['month_work_days_snapshot', 'DECIMAL(8,2) NOT NULL DEFAULT 0.00'],
    ['period_work_days', 'DECIMAL(8,2) NOT NULL DEFAULT 0.00'],
    ['scheduled_regular_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['regular_attended_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['paid_time_off_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['regular_holiday_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['special_holiday_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['late_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['late_deduction', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['undertime_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['undertime_deduction', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['absent_days', 'DECIMAL(6,2) NOT NULL DEFAULT 0.00'],
    ['absence_deduction', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['overtime_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['overtime_pay', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['night_differential_seconds', 'INT UNSIGNED NOT NULL DEFAULT 0'],
    ['night_differential_pay', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['attendance_bonus_eligible', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['attendance_bonus_note', 'VARCHAR(255) NULL'],
    ['cash_advance_deduction', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
    ['other_adjustments', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00'],
  ];
  for (const [column, definition] of legacyAdditions) {
    await connection.query(`ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS employee_payroll_corrections (
      employee_payroll_correction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_payroll_id INT UNSIGNED NOT NULL,
      reason TEXT NOT NULL,
      before_snapshot_json JSON NOT NULL,
      after_snapshot_json JSON NOT NULL,
      review_hash CHAR(64) NOT NULL,
      created_by_user_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_payroll_correction_id),
      KEY idx_employee_payroll_correction_payroll (employee_payroll_id, created_at),
      CONSTRAINT fk_employee_payroll_correction_payroll FOREIGN KEY (employee_payroll_id) REFERENCES employee_payrolls (employee_payroll_id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_employee_payroll_correction_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  payrollSchemaReady = true;
};

const ensurePeriodRow = async (connection, period) => {
  await connection.query(`
    INSERT INTO employee_payroll_periods (period_label, period_start, period_end, period_type, payroll_status)
    VALUES (?, ?, ?, ?, 'draft')
    ON DUPLICATE KEY UPDATE
      period_label = VALUES(period_label),
      period_type = VALUES(period_type)
  `, [period.periodLabel, period.periodStart, period.periodEnd, period.periodType]);

  const [rows] = await connection.query(`
    SELECT * FROM employee_payroll_periods
    WHERE period_start = ? AND period_end = ?
    LIMIT 1
  `, [period.periodStart, period.periodEnd]);
  const row = rows[0];
  if (!row) throw payrollError('Unable to create the payroll period.', 'PAYROLL_PERIOD_CREATE_FAILED', 500);
  if (row.payroll_status !== 'draft') {
    throw payrollError('This payroll period is no longer Draft and cannot generate or recalculate Draft payroll.', 'PAYROLL_PERIOD_NOT_DRAFT', 409);
  }
  return row;
};

const getEmployee = async (connection, employeeId) => {
  const [rows] = await connection.query(`
    SELECT e.*, ${buildEmployeeNameSql('e')} AS full_name
    FROM employees e
    WHERE e.employee_id = ? AND e.employee_status <> 'archived'
    LIMIT 1
  `, [employeeId]);
  if (!rows[0]) throw payrollError('Employee not found.', 'EMPLOYEE_NOT_FOUND', 404);
  return rows[0];
};

const warningList = ({ period, attendanceThrough, attendance, compensation, payrollSettings }) => {
  const warnings = [];
  if (attendanceThrough < period.periodEnd) {
    warnings.push(`Draft attendance is provisional through ${attendanceThrough}. Recalculate after later attendance is recorded.`);
  }
  const missing = [];
  if (attendance.overtimeMinutes && payrollSettings.regular_ot_multiplier === null) missing.push('Regular OT Multiplier');
  if (attendance.restDayOvertimeMinutes && payrollSettings.rest_day_ot_multiplier === null) missing.push('Rest Day OT Multiplier');
  if (attendance.regularHolidayMinutes && payrollSettings.regular_holiday_multiplier === null) missing.push('Regular Holiday Multiplier');
  if (attendance.specialHolidayMinutes && payrollSettings.special_holiday_multiplier === null) missing.push('Special Holiday Multiplier');
  if (attendance.nightDifferentialMinutes && payrollSettings.night_differential_percentage === null) missing.push('Night Differential Percentage');
  if (missing.length) {
    warnings.push(`Payroll Settings are incomplete for recorded premium hours: ${missing.join(', ')}. Unconfigured money rules remain ₱0.00 until the Draft is recalculated after settings are completed.`);
  }
  if ((attendance.regularHolidayMinutes || attendance.specialHolidayMinutes) && (payrollSettings.regular_holiday_ot_multiplier !== null || payrollSettings.special_holiday_ot_multiplier !== null)) {
    warnings.push('Holiday OT multipliers are stored in Payroll Settings but are not applied yet because Attendance does not expose separate Regular-Holiday-OT or Special-Holiday-OT minutes.');
  }
  if (attendance.doublePayMinutes) {
    warnings.push('Double-pay attendance is present. Its hours are preserved in the attendance breakdown, but no payroll money rule is applied because the master plan does not define a double-pay multiplier.');
  }
  if (Number(compensation.attendance_bonus || 0) > 0) {
    warnings.push('Attendance Bonus is configured but is not applied because the eligibility/timing rule is not defined in the approved master plan.');
  }
  return warnings;
};

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const upsertDraftPayroll = async (connection, payload) => {
  const [existingRows] = await connection.query(`
    SELECT employee_payroll_id, payroll_status
    FROM employee_payrolls
    WHERE employee_payroll_period_id = ? AND employee_id = ?
    LIMIT 1 FOR UPDATE
  `, [payload.periodId, payload.employeeId]);
  const existing = existingRows[0] || null;
  if (existing && existing.payroll_status !== 'draft') {
    throw payrollError('This employee payroll is no longer Draft and cannot be recalculated.', 'EMPLOYEE_PAYROLL_NOT_DRAFT', 409);
  }

  const legacyLateDeduction = roundMoney(payload.lateMinutes * payload.minuteRate);
  const legacyAbsenceDeduction = roundMoney(payload.absenceMinutes * payload.minuteRate);
  const grossPay = roundMoney(
    payload.halfMonthBasic
      + payload.overtimePay
      + payload.restDayOvertimePay
      + payload.regularHolidayPay
      + payload.specialHolidayPay
      + payload.nightDifferentialPay
      + payload.riceAllowance
      + payload.transportationAllowance
      + payload.attendanceBonus
      + payload.manualAdditionsTotal
  );
  const commonValues = [
    payload.employmentHistoryId,
    payload.employeeName,
    payload.position,
    payload.department,
    payload.employmentStatus,
    payload.monthlyBasic,
    payload.hourlyRate,
    payload.halfMonthBasic,
    payload.halfMonthBasic,
    payload.dailyRate,
    payload.minuteRate,
    payload.regularWorkingMinutes,
    payload.attendanceCalculatedThrough,
    payload.expectedRegularMinutes,
    payload.regularAttendedMinutes,
    payload.ptoMinutes,
    payload.regularHolidayMinutes,
    payload.specialHolidayMinutes,
    payload.lateMinutes,
    payload.absenceMinutes,
    payload.tardinessAbsenceMinutes,
    payload.overtimeMinutes,
    payload.restDayOvertimeMinutes,
    payload.nightDifferentialMinutes,
    payload.attendanceDeduction,
    payload.overtimePay,
    payload.restDayOvertimePay,
    payload.regularHolidayPay,
    payload.specialHolidayPay,
    payload.nightDifferentialPay,
    payload.riceAllowance,
    payload.transportationAllowance,
    payload.attendanceBonus,
    payload.manualAdditionsTotal,
    payload.manualDeductionsTotal,
    payload.netFundRelease,
    JSON.stringify(payload.payrollSettingsSnapshot || null),
    payload.calculationVersion,
    JSON.stringify(payload.warnings || []),
    JSON.stringify(payload.attendanceBreakdown || []),
    payload.expectedRegularMinutes * 60,
    payload.regularAttendedMinutes * 60,
    payload.ptoMinutes * 60,
    payload.regularHolidayMinutes * 60,
    payload.specialHolidayMinutes * 60,
    payload.lateMinutes * 60,
    legacyLateDeduction,
    payload.absenceDays,
    legacyAbsenceDeduction,
    payload.overtimeMinutes * 60,
    payload.nightDifferentialMinutes * 60,
    grossPay,
    payload.netFundRelease,
  ];

  if (existing) {
    await connection.query(`
      UPDATE employee_payrolls SET
        employment_history_id = ?, employee_name_snapshot = ?, position_snapshot = ?, department_snapshot = ?, employment_status_snapshot = ?,
        monthly_salary_snapshot = ?, hourly_rate_snapshot = ?, base_salary = ?, half_month_basic = ?, daily_rate = ?, minute_rate = ?,
        regular_working_minutes_snapshot = ?, attendance_calculated_through = ?, expected_regular_minutes = ?, regular_attended_minutes = ?, pto_minutes = ?,
        regular_holiday_minutes = ?, special_holiday_minutes = ?, late_minutes = ?, absence_minutes = ?, tardiness_absence_minutes = ?,
        overtime_minutes = ?, rest_day_overtime_minutes = ?, night_differential_minutes = ?, attendance_deduction = ?,
        overtime_pay = ?, rest_day_overtime_pay = ?, regular_holiday_pay = ?, special_holiday_pay = ?, night_differential_pay = ?,
        rice_allowance = ?, transportation_allowance = ?, attendance_bonus = ?, manual_additions_total = ?, manual_deductions_total = ?, net_fund_release = ?,
        payroll_settings_snapshot_json = ?, calculation_version = ?, calculation_warnings_json = ?, attendance_breakdown_json = ?,
        scheduled_regular_seconds = ?, regular_attended_seconds = ?, paid_time_off_seconds = ?, regular_holiday_seconds = ?, special_holiday_seconds = ?,
        late_seconds = ?, late_deduction = ?, absent_days = ?, absence_deduction = ?, overtime_seconds = ?,
        night_differential_seconds = ?, gross_pay = ?, net_pay = ?, undertime_seconds = 0, undertime_deduction = 0,
        cash_advance_deduction = 0, other_adjustments = 0, attendance_bonus_eligible = 0,
        attendance_bonus_note = 'Eligibility/timing rule pending approved Payroll Settings', payroll_status = 'draft'
      WHERE employee_payroll_id = ?
    `, [...commonValues, existing.employee_payroll_id]);
    return Number(existing.employee_payroll_id);
  }

  const [result] = await connection.query(`
    INSERT INTO employee_payrolls (
      employee_payroll_period_id, employee_id,
      employment_history_id, employee_name_snapshot, position_snapshot, department_snapshot, employment_status_snapshot,
      monthly_salary_snapshot, hourly_rate_snapshot, base_salary, half_month_basic, daily_rate, minute_rate,
      regular_working_minutes_snapshot, attendance_calculated_through, expected_regular_minutes, regular_attended_minutes, pto_minutes,
      regular_holiday_minutes, special_holiday_minutes, late_minutes, absence_minutes, tardiness_absence_minutes,
      overtime_minutes, rest_day_overtime_minutes, night_differential_minutes, attendance_deduction,
      overtime_pay, rest_day_overtime_pay, regular_holiday_pay, special_holiday_pay, night_differential_pay,
      rice_allowance, transportation_allowance, attendance_bonus, manual_additions_total, manual_deductions_total, net_fund_release,
      payroll_settings_snapshot_json, calculation_version, calculation_warnings_json, attendance_breakdown_json,
      scheduled_regular_seconds, regular_attended_seconds, paid_time_off_seconds, regular_holiday_seconds, special_holiday_seconds,
      late_seconds, late_deduction, absent_days, absence_deduction, overtime_seconds,
      night_differential_seconds, gross_pay, net_pay,
      undertime_seconds, undertime_deduction, cash_advance_deduction, other_adjustments,
      attendance_bonus_eligible, attendance_bonus_note, payroll_status
    ) VALUES (
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      0, 0, 0, 0,
      0, 'Eligibility/timing rule pending approved Payroll Settings', 'draft'
    )
  `, [payload.periodId, payload.employeeId, ...commonValues]);
  return Number(result.insertId);
};

export const calculateAndStoreDraftPayroll = async (connection, {
  employeeId,
  period,
  today = getManilaDateTime().date,
}) => {
  await ensureEmployeePayrollSchema(connection);
  const normalizedPeriod = period.periodStart
    ? payrollPeriodFromDates(period)
    : resolvePayrollPeriod({ month: period.month, periodType: period.periodType });
  const attendanceThrough = clampPayrollAttendanceThrough({ ...normalizedPeriod, today });
  const periodRow = await ensurePeriodRow(connection, normalizedPeriod);
  const employee = await getEmployee(connection, employeeId);
  const payrollSettings = await getPayrollSettingsSnapshot(connection);
  const compensation = await getEffectiveCompensationForPeriod(connection, {
    employeeId,
    periodStart: normalizedPeriod.periodStart,
    periodEnd: normalizedPeriod.periodEnd,
    midPeriodChangeRule: payrollSettings.mid_period_change_rule,
  });
  const attendance = await getPayrollAttendanceSummary(connection, {
    employeeId,
    dateFrom: normalizedPeriod.periodStart,
    dateTo: attendanceThrough,
  });
  const money = calculateDraftPayrollMoney({
    monthlyBasicSalary: compensation.monthly_basic_salary,
    regularWorkingMinutes: attendance.schedule.regularWorkingMinutes,
    tardinessAbsenceMinutes: attendance.summary.tardinessAbsenceMinutes,
    periodType: normalizedPeriod.periodType,
    riceAllowance: compensation.rice_allowance,
    transportationAllowance: compensation.transportation_allowance,
    overtimeMinutes: attendance.summary.overtimeMinutes,
    restDayOvertimeMinutes: attendance.summary.restDayOvertimeMinutes,
    regularHolidayMinutes: attendance.summary.regularHolidayMinutes,
    specialHolidayMinutes: attendance.summary.specialHolidayMinutes,
    nightDifferentialMinutes: attendance.summary.nightDifferentialMinutes,
    payrollSettings,
  });
  const warnings = warningList({
    period: normalizedPeriod,
    attendanceThrough,
    attendance: attendance.summary,
    compensation,
    payrollSettings,
  });

  const payload = {
    periodId: Number(periodRow.employee_payroll_period_id),
    employeeId: Number(employee.employee_id),
    employmentHistoryId: Number(compensation.employee_employment_history_id),
    employeeName: employee.full_name,
    position: compensation.position,
    department: compensation.department,
    employmentStatus: compensation.employment_type,
    monthlyBasic: Number(compensation.monthly_basic_salary || 0),
    halfMonthBasic: money.halfMonthBasic,
    dailyRate: money.dailyRate,
    hourlyRate: money.hourlyRate,
    minuteRate: money.minuteRate,
    regularWorkingMinutes: Number(attendance.schedule.regularWorkingMinutes || 0),
    attendanceCalculatedThrough: attendanceThrough,
    ...attendance.summary,
    attendanceDeduction: money.attendanceDeduction,
    overtimePay: money.overtimePay,
    restDayOvertimePay: money.restDayOvertimePay,
    regularHolidayPay: money.regularHolidayPay,
    specialHolidayPay: money.specialHolidayPay,
    nightDifferentialPay: money.nightDifferentialPay,
    riceAllowance: money.riceAllowance,
    transportationAllowance: money.transportationAllowance,
    attendanceBonus: money.attendanceBonus,
    manualAdditionsTotal: money.manualAdditionsTotal,
    manualDeductionsTotal: money.manualDeductionsTotal,
    netFundRelease: money.netFundRelease,
    payrollSettingsSnapshot: payrollSettings,
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    warnings,
    attendanceBreakdown: attendance.rows.map((row) => ({
      date: row.date,
      state: row.state,
      day_type: row.dayType,
      time_in: row.timeIn,
      time_out: row.timeOut,
      scheduled_day: row.scheduledDay,
      absence: row.absence,
      regular_attended_minutes: Math.round(Number(row.regularAttendedSeconds || 0) / 60),
      late_minutes: Math.round(Number(row.lateSeconds || 0) / 60),
      overtime_minutes: Math.round(Number(row.overtimeSeconds || 0) / 60),
      rest_day_overtime_minutes: Math.round(Number(row.restDayOvertimeSeconds || 0) / 60),
      regular_holiday_minutes: Math.round(Number(row.regularHolidaySeconds || 0) / 60),
      special_holiday_minutes: Math.round(Number(row.specialHolidaySeconds || 0) / 60),
    })),
  };

  const payrollId = await upsertDraftPayroll(connection, payload);
  return { payrollId, period: normalizedPeriod, payload };
};

export const getPayrollDraftById = async (connection, employeePayrollId, { forUpdate = false } = {}) => {
  await ensureEmployeePayrollSchema(connection);
  const [rows] = await connection.query(`
    SELECT p.*, pp.period_label, pp.period_start, pp.period_end, pp.period_type,
      pp.release_date AS period_release_date, pp.witness_name, pp.release_notes AS period_release_notes,
      h.change_type AS employment_change_type, h.change_reason AS employment_change_reason,
      TRIM(CONCAT_WS(' ', finalized_user.first_name, finalized_user.middle_name, finalized_user.last_name)) AS finalized_by_name,
      TRIM(CONCAT_WS(' ', released_user.first_name, released_user.middle_name, released_user.last_name)) AS released_by_name
    FROM employee_payrolls p
    INNER JOIN employee_payroll_periods pp ON pp.employee_payroll_period_id = p.employee_payroll_period_id
    LEFT JOIN employee_employment_history h ON h.employee_employment_history_id = p.employment_history_id
    LEFT JOIN users finalized_user ON finalized_user.id = p.finalized_by_user_id
    LEFT JOIN users released_user ON released_user.id = p.released_by_user_id
    WHERE p.employee_payroll_id = ?
    LIMIT 1 ${forUpdate ? 'FOR UPDATE' : ''}
  `, [employeePayrollId]);
  if (!rows[0]) throw payrollError('Employee payroll not found.', 'EMPLOYEE_PAYROLL_NOT_FOUND', 404);
  const row = rows[0];
  const finalizedSnapshot = parseJson(row.finalized_snapshot_json, null);
  const normalized = {
    ...row,
    employee_payroll_id: Number(row.employee_payroll_id),
    employee_payroll_period_id: Number(row.employee_payroll_period_id),
    employee_id: Number(row.employee_id),
    period_start: dateOnly(row.period_start),
    period_end: dateOnly(row.period_end),
    attendance_calculated_through: dateOnly(row.attendance_calculated_through),
    released_date: dateOnly(row.released_date),
    period_release_date: dateOnly(row.period_release_date),
    calculation_warnings: parseJson(row.calculation_warnings_json, []),
    payroll_settings_snapshot: parseJson(row.payroll_settings_snapshot_json, null),
    attendance_breakdown: parseJson(row.attendance_breakdown_json, []),
    finalized_snapshot: finalizedSnapshot,
  };
  return ['finalized', 'corrected', 'released'].includes(String(row.payroll_status || '').toLowerCase())
    ? overlayFinalizedSnapshot(normalized, finalizedSnapshot)
    : normalized;
};

export const recalculateDraftPayrollById = async (connection, employeePayrollId, today = getManilaDateTime().date) => {
  const current = await getPayrollDraftById(connection, employeePayrollId);
  if (current.payroll_status !== 'draft') {
    throw payrollError('Only Draft payroll can be recalculated.', 'EMPLOYEE_PAYROLL_NOT_DRAFT', 409);
  }
  return calculateAndStoreDraftPayroll(connection, {
    employeeId: current.employee_id,
    period: { periodStart: current.period_start, periodEnd: current.period_end },
    today,
  });
};

export const listPayrollDrafts = async (connection, {
  month,
  periodType,
  department = '',
  payrollStatus = '',
  search = '',
}) => {
  await ensureEmployeePayrollSchema(connection);
  const period = resolvePayrollPeriod({ month, periodType });
  const where = ['pp.period_start = ?', 'pp.period_end = ?'];
  const params = [period.periodStart, period.periodEnd];

  const normalizedDepartment = String(department || '').trim();
  if (normalizedDepartment && normalizedDepartment !== 'all') {
    where.push('p.department_snapshot = ?');
    params.push(normalizedDepartment);
  }

  const normalizedStatus = String(payrollStatus || '').trim().toLowerCase();
  if (normalizedStatus && normalizedStatus !== 'all') {
    if (!['draft', 'finalized', 'corrected', 'released', 'cancelled'].includes(normalizedStatus)) {
      throw payrollError('Select a valid payroll status.', 'INVALID_PAYROLL_STATUS');
    }
    where.push('p.payroll_status = ?');
    params.push(normalizedStatus);
  }

  const normalizedSearch = String(search || '').trim();
  if (normalizedSearch) {
    where.push('(p.employee_name_snapshot LIKE ? OR e.employee_code LIKE ? OR p.position_snapshot LIKE ?)');
    const like = `%${normalizedSearch}%`;
    params.push(like, like, like);
  }

  const [rows] = await connection.query(`
    SELECT p.employee_payroll_id, p.employee_id, e.employee_code,
      p.employee_name_snapshot, p.position_snapshot,
      p.department_snapshot, p.employment_status_snapshot, p.monthly_salary_snapshot,
      p.half_month_basic, p.attendance_deduction, p.overtime_pay, p.rest_day_overtime_pay,
      p.regular_holiday_pay, p.special_holiday_pay, p.night_differential_pay,
      p.rice_allowance, p.transportation_allowance, p.attendance_bonus,
      p.manual_additions_total, p.manual_deductions_total,
      p.net_fund_release, p.payroll_status,
      p.attendance_calculated_through, p.calculation_warnings_json,
      p.finalized_at, p.finalized_by_user_id,
      p.released_date, p.released_at, p.released_by_user_id, p.release_reference, p.release_notes,
      p.finalized_snapshot_json,
      pp.period_label, pp.period_start, pp.period_end, pp.period_type
    FROM employee_payrolls p
    INNER JOIN employee_payroll_periods pp ON pp.employee_payroll_period_id = p.employee_payroll_period_id
    INNER JOIN employees e ON e.employee_id = p.employee_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.employee_name_snapshot ASC, p.employee_payroll_id ASC
  `, params);
  return rows.map((row) => {
    const snapshot = parseJson(row.finalized_snapshot_json, null);
    const normalized = {
      ...row,
      employee_payroll_id: Number(row.employee_payroll_id),
      employee_id: Number(row.employee_id),
      period_start: dateOnly(row.period_start),
      period_end: dateOnly(row.period_end),
      attendance_calculated_through: dateOnly(row.attendance_calculated_through),
      released_date: dateOnly(row.released_date),
      calculation_warnings: parseJson(row.calculation_warnings_json, []),
      finalized_snapshot: snapshot,
    };
    return ['finalized', 'corrected', 'released'].includes(String(row.payroll_status || '').toLowerCase())
      ? overlayFinalizedSnapshot(normalized, snapshot)
      : normalized;
  });
};

export const listPayrollEligibleEmployees = async (connection, employeeId = null) => {
  const params = [];
  let where = "e.employee_status = 'active'";
  if (employeeId) {
    where += ' AND e.employee_id = ?';
    params.push(Number(employeeId));
  }
  const [rows] = await connection.query(`
    SELECT e.employee_id, e.employee_code, ${buildEmployeeNameSql('e')} AS full_name,
      e.position, e.department, e.employment_type
    FROM employees e
    WHERE ${where}
    ORDER BY e.last_name ASC, e.first_name ASC, e.employee_id ASC
  `, params);
  if (employeeId && !rows.length) throw payrollError('Employee not found or is not active.', 'EMPLOYEE_NOT_FOUND', 404);
  return rows;
};

export const listEmployeePayrollHistory = async (connection, employeeId) => {
  await ensureEmployeePayrollSchema(connection);
  const normalizedEmployeeId = Number(employeeId || 0);
  if (!Number.isInteger(normalizedEmployeeId) || normalizedEmployeeId <= 0) {
    throw payrollError('Select a valid employee.', 'INVALID_EMPLOYEE_ID', 400);
  }

  const [employeeRows] = await connection.query(`
    SELECT e.employee_id, e.employee_code, ${buildEmployeeNameSql('e')} AS current_employee_name,
      e.employee_status, e.department AS current_department, e.position AS current_position,
      e.employment_type AS current_employment_status
    FROM employees e
    WHERE e.employee_id = ? AND e.employee_status <> 'archived'
    LIMIT 1
  `, [normalizedEmployeeId]);
  if (!employeeRows[0]) throw payrollError('Employee not found.', 'EMPLOYEE_NOT_FOUND', 404);

  const [rows] = await connection.query(`
    SELECT p.employee_payroll_id, p.employee_payroll_period_id, p.employee_id,
      p.employee_name_snapshot, p.position_snapshot, p.department_snapshot, p.employment_status_snapshot,
      p.monthly_salary_snapshot, p.half_month_basic,
      p.attendance_deduction, p.overtime_pay, p.rest_day_overtime_pay,
      p.regular_holiday_pay, p.special_holiday_pay, p.night_differential_pay,
      p.rice_allowance, p.transportation_allowance, p.attendance_bonus,
      p.manual_additions_total, p.manual_deductions_total, p.net_fund_release,
      p.payroll_status, p.finalized_snapshot_json, p.finalized_at, p.finalized_by_user_id,
      p.released_date, p.released_at, p.released_by_user_id, p.release_reference, p.release_notes,
      p.finalized_snapshot_json,
      pp.period_label, pp.period_start, pp.period_end, pp.period_type, pp.release_date AS period_release_date,
      TRIM(CONCAT_WS(' ', finalized_user.first_name, finalized_user.middle_name, finalized_user.last_name)) AS finalized_by_name,
      TRIM(CONCAT_WS(' ', released_user.first_name, released_user.middle_name, released_user.last_name)) AS released_by_name
    FROM employee_payrolls p
    INNER JOIN employee_payroll_periods pp ON pp.employee_payroll_period_id = p.employee_payroll_period_id
    LEFT JOIN users finalized_user ON finalized_user.id = p.finalized_by_user_id
    LEFT JOIN users released_user ON released_user.id = p.released_by_user_id
    WHERE p.employee_id = ?
    ORDER BY pp.period_start DESC, pp.period_end DESC, p.employee_payroll_id DESC
  `, [normalizedEmployeeId]);

  const history = rows.map((row) => {
    const snapshot = parseJson(row.finalized_snapshot_json, null);
    const employee = snapshot?.employee || {};
    const compensation = snapshot?.compensation || {};
    const earnings = snapshot?.earnings || {};
    const allowances = snapshot?.allowances || {};
    const adjustments = snapshot?.adjustments || {};
    const deductions = snapshot?.deductions || {};
    const period = snapshot?.period || {};
    const status = String(row.payroll_status || 'draft').toLowerCase();
    const officialStatus = ['finalized', 'released', 'corrected'].includes(status);

    const item = {
      employee_payroll_id: Number(row.employee_payroll_id),
      employee_payroll_period_id: Number(row.employee_payroll_period_id),
      employee_id: Number(row.employee_id),
      employee_name_snapshot: employee.name || row.employee_name_snapshot,
      position_snapshot: employee.position || row.position_snapshot,
      department_snapshot: employee.department || row.department_snapshot,
      employment_status_snapshot: employee.employment_status || row.employment_status_snapshot,
      monthly_salary_snapshot: Number(compensation.monthly_basic ?? row.monthly_salary_snapshot ?? 0),
      half_month_basic: Number(compensation.half_month_basic ?? row.half_month_basic ?? 0),
      attendance_deduction: Number(deductions.attendance_deduction ?? row.attendance_deduction ?? 0),
      overtime_pay: Number(earnings.overtime_pay ?? row.overtime_pay ?? 0),
      rest_day_overtime_pay: Number(earnings.rest_day_overtime_pay ?? row.rest_day_overtime_pay ?? 0),
      regular_holiday_pay: Number(earnings.regular_holiday_pay ?? row.regular_holiday_pay ?? 0),
      special_holiday_pay: Number(earnings.special_holiday_pay ?? row.special_holiday_pay ?? 0),
      night_differential_pay: Number(earnings.night_differential_pay ?? row.night_differential_pay ?? 0),
      rice_allowance: Number(allowances.rice_allowance ?? row.rice_allowance ?? 0),
      transportation_allowance: Number(allowances.transportation_allowance ?? row.transportation_allowance ?? 0),
      attendance_bonus: Number(allowances.attendance_bonus ?? row.attendance_bonus ?? 0),
      manual_additions_total: Number(adjustments.manual_additions_total ?? row.manual_additions_total ?? 0),
      manual_deductions_total: Number(adjustments.manual_deductions_total ?? row.manual_deductions_total ?? 0),
      net_fund_release: Number(snapshot?.net_fund_release ?? row.net_fund_release ?? 0),
      payroll_status: status,
      period_label: period.label || row.period_label,
      period_start: dateOnly(period.start || row.period_start),
      period_end: dateOnly(period.end || row.period_end),
      period_type: period.type || row.period_type,
      finalized_at: row.finalized_at || null,
      finalized_by_user_id: row.finalized_by_user_id ? Number(row.finalized_by_user_id) : null,
      finalized_by_name: row.finalized_by_name || null,
      release_date: dateOnly(row.released_date || row.period_release_date),
      released_date: dateOnly(row.released_date),
      released_at: row.released_at || null,
      released_by_user_id: row.released_by_user_id ? Number(row.released_by_user_id) : null,
      released_by_name: row.released_by_name || null,
      release_reference: row.release_reference || null,
      release_notes: row.release_notes || null,
      snapshot_source: snapshot ? 'finalized_snapshot' : 'stored_payroll_record',
      official_receipt_available: Boolean(officialStatus && snapshot),
    };
    return item;
  });

  const totals = history.reduce((summary, row) => ({
    payroll_count: summary.payroll_count + 1,
    finalized_count: summary.finalized_count + (['finalized', 'released', 'corrected'].includes(row.payroll_status) ? 1 : 0),
    total_basic: summary.total_basic + Number(row.half_month_basic || 0),
    total_deductions: summary.total_deductions + Number(row.attendance_deduction || 0) + Number(row.manual_deductions_total || 0),
    total_net_fund_release: summary.total_net_fund_release + Number(row.net_fund_release || 0),
  }), { payroll_count: 0, finalized_count: 0, total_basic: 0, total_deductions: 0, total_net_fund_release: 0 });

  return {
    employee: {
      employee_id: Number(employeeRows[0].employee_id),
      employee_code: employeeRows[0].employee_code,
      current_employee_name: employeeRows[0].current_employee_name,
      employee_status: employeeRows[0].employee_status,
      current_department: employeeRows[0].current_department,
      current_position: employeeRows[0].current_position,
      current_employment_status: employeeRows[0].current_employment_status,
    },
    summary: totals,
    history,
  };
};

