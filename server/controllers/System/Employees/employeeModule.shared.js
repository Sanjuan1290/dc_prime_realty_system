import { db } from '../../../db/connect.js';

export const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
export const cleanText = (value, fallback = '') => String(value ?? fallback).trim();
export const nullableText = (value) => cleanText(value) || null;
export const positiveNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
};
export const dateOnly = (value) => {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};
export const timeOnly = (value) => {
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

const employeeTableSql = `
  CREATE TABLE IF NOT EXISTS employees (
    employee_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    linked_user_id INT UNSIGNED NULL,
    employee_code VARCHAR(40) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    contact_number VARCHAR(60) NULL,
    address TEXT NULL,
    department VARCHAR(120) NULL,
    position VARCHAR(120) NOT NULL,
    employment_type ENUM('regular','probationary','contractual','part_time','intern') NOT NULL DEFAULT 'regular',
    hire_date DATE NOT NULL,
    monthly_salary DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    payroll_divisor DECIMAL(8,2) NOT NULL DEFAULT 26.00,
    attendance_grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    employee_status ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
    created_by_user_id INT UNSIGNED NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id),
    UNIQUE KEY uq_employees_code (employee_code),
    UNIQUE KEY uq_employees_email (email),
    KEY idx_employees_status (employee_status),
    KEY idx_employees_department (department),
    CONSTRAINT fk_employees_linked_user FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employees_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employees_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_employees_salary CHECK (monthly_salary >= 0),
    CONSTRAINT chk_employees_divisor CHECK (payroll_divisor > 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const scheduleTableSql = `
  CREATE TABLE IF NOT EXISTS employee_work_schedules (
    employee_work_schedule_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id INT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    is_work_day TINYINT(1) NOT NULL DEFAULT 0,
    shift_start TIME NULL,
    shift_end TIME NULL,
    break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_work_schedule_id),
    UNIQUE KEY uq_employee_weekday (employee_id, weekday),
    CONSTRAINT fk_employee_schedule_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_employee_schedule_weekday CHECK (weekday BETWEEN 0 AND 6)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const attendanceTableSql = `
  CREATE TABLE IF NOT EXISTS employee_attendance_records (
    employee_attendance_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id INT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    scheduled_time_in TIME NULL,
    scheduled_time_out TIME NULL,
    actual_time_in TIME NULL,
    actual_time_out TIME NULL,
    late_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    undertime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    overtime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    late_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    undertime_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    absence_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    attendance_status ENUM('present','late','absent','paid_leave','unpaid_leave','rest_day','holiday','half_day') NOT NULL DEFAULT 'present',
    notes TEXT NULL,
    source ENUM('manual','import','device') NOT NULL DEFAULT 'manual',
    recorded_by_user_id INT UNSIGNED NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_attendance_id),
    UNIQUE KEY uq_employee_attendance_date (employee_id, attendance_date),
    KEY idx_attendance_date (attendance_date),
    KEY idx_attendance_status (attendance_status),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_attendance_recorded_by FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_attendance_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const cashAdvanceTableSql = `
  CREATE TABLE IF NOT EXISTS employee_cash_advances (
    employee_cash_advance_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id INT UNSIGNED NOT NULL,
    reference_number VARCHAR(60) NOT NULL,
    request_date DATE NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    installment_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    deduction_per_payroll DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    start_deduction_date DATE NOT NULL,
    remaining_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    cash_advance_status ENUM('pending','approved','active','paid','rejected','cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT NULL,
    approved_by_user_id INT UNSIGNED NULL,
    approved_at DATETIME NULL,
    created_by_user_id INT UNSIGNED NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_cash_advance_id),
    UNIQUE KEY uq_employee_cash_advance_reference (reference_number),
    KEY idx_employee_cash_advance_employee (employee_id),
    KEY idx_employee_cash_advance_status (cash_advance_status),
    CONSTRAINT fk_employee_cash_advance_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_employee_cash_advance_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employee_cash_advance_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employee_cash_advance_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_employee_cash_advance_amount CHECK (amount > 0),
    CONSTRAINT chk_employee_cash_advance_remaining CHECK (remaining_balance >= 0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const payrollPeriodTableSql = `
  CREATE TABLE IF NOT EXISTS employee_payroll_periods (
    employee_payroll_period_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    period_label VARCHAR(80) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payroll_status ENUM('draft','finalized','cancelled') NOT NULL DEFAULT 'draft',
    finalized_by_user_id INT UNSIGNED NULL,
    finalized_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_payroll_period_id),
    UNIQUE KEY uq_employee_payroll_period (period_start, period_end),
    CONSTRAINT fk_employee_payroll_finalized_by FOREIGN KEY (finalized_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const payrollTableSql = `
  CREATE TABLE IF NOT EXISTS employee_payrolls (
    employee_payroll_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_payroll_period_id INT UNSIGNED NOT NULL,
    employee_id INT UNSIGNED NOT NULL,
    monthly_salary_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    payroll_divisor_snapshot DECIMAL(8,2) NOT NULL DEFAULT 26.00,
    base_salary DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    late_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    late_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    undertime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    undertime_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    absent_days DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    absence_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    cash_advance_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    gross_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    net_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    payroll_status ENUM('draft','finalized','cancelled') NOT NULL DEFAULT 'draft',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_payroll_id),
    UNIQUE KEY uq_employee_payroll_employee (employee_payroll_period_id, employee_id),
    CONSTRAINT fk_employee_payroll_period FOREIGN KEY (employee_payroll_period_id) REFERENCES employee_payroll_periods(employee_payroll_period_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_employee_payroll_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const cashAdvanceDeductionTableSql = `
  CREATE TABLE IF NOT EXISTS employee_cash_advance_deductions (
    employee_cash_advance_deduction_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_cash_advance_id INT UNSIGNED NOT NULL,
    employee_payroll_id INT UNSIGNED NULL,
    deduction_date DATE NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    remaining_balance_after DECIMAL(14,2) NOT NULL,
    notes VARCHAR(255) NULL,
    created_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_cash_advance_deduction_id),
    KEY idx_employee_cash_advance_deduction_advance (employee_cash_advance_id),
    CONSTRAINT fk_employee_cash_advance_deduction_advance FOREIGN KEY (employee_cash_advance_id) REFERENCES employee_cash_advances(employee_cash_advance_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_employee_cash_advance_deduction_payroll FOREIGN KEY (employee_payroll_id) REFERENCES employee_payrolls(employee_payroll_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employee_cash_advance_deduction_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

let initialized = false;
export const ensureEmployeeModuleTables = async (connection = db) => {
  if (initialized) return;
  for (const statement of [
    employeeTableSql,
    scheduleTableSql,
    attendanceTableSql,
    cashAdvanceTableSql,
    payrollPeriodTableSql,
    payrollTableSql,
    cashAdvanceDeductionTableSql,
  ]) {
    await connection.query(statement);
  }
  initialized = true;
};

export const getWeekday = (dateValue) => {
  const cleanDate = dateOnly(dateValue);
  if (!cleanDate) return null;
  const [year, month, day] = cleanDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const secondsFromTime = (value) => {
  const cleanTime = timeOnly(value);
  if (!cleanTime) return null;
  const [hour, minute, second] = cleanTime.split(':').map(Number);
  return hour * 3600 + minute * 60 + second;
};

export const calculateAttendanceMetrics = ({ employee, schedule, status, actualTimeIn, actualTimeOut }) => {
  const normalizedStatus = cleanText(status, 'present');
  const dailyRate = roundMoney(positiveNumber(employee.monthly_salary) / Math.max(positiveNumber(employee.payroll_divisor, 26), 1));
  const scheduledStart = secondsFromTime(schedule?.shift_start);
  const scheduledEndRaw = secondsFromTime(schedule?.shift_end);
  const actualStart = secondsFromTime(actualTimeIn);
  const actualEndRaw = secondsFromTime(actualTimeOut);
  const breakSeconds = positiveNumber(schedule?.break_minutes, 60) * 60;

  if (['rest_day', 'holiday', 'paid_leave'].includes(normalizedStatus)) {
    return { lateSeconds: 0, undertimeSeconds: 0, overtimeSeconds: 0, lateDeduction: 0, undertimeDeduction: 0, absenceDeduction: 0, dailyRate };
  }

  if (['absent', 'unpaid_leave'].includes(normalizedStatus)) {
    return { lateSeconds: 0, undertimeSeconds: 0, overtimeSeconds: 0, lateDeduction: 0, undertimeDeduction: 0, absenceDeduction: dailyRate, dailyRate };
  }

  if (scheduledStart === null || scheduledEndRaw === null) {
    return { lateSeconds: 0, undertimeSeconds: 0, overtimeSeconds: 0, lateDeduction: 0, undertimeDeduction: 0, absenceDeduction: 0, dailyRate };
  }

  const scheduledEnd = scheduledEndRaw <= scheduledStart ? scheduledEndRaw + 86400 : scheduledEndRaw;
  const paidShiftSeconds = Math.max(scheduledEnd - scheduledStart - breakSeconds, 1);
  const ratePerSecond = dailyRate / paidShiftSeconds;
  const graceSeconds = positiveNumber(employee.attendance_grace_minutes) * 60;
  const normalizedActualStart = actualStart;
  const normalizedActualEnd = actualEndRaw === null || actualStart === null
    ? null
    : (actualEndRaw <= actualStart ? actualEndRaw + 86400 : actualEndRaw);

  let lateSeconds = normalizedActualStart === null ? 0 : Math.max(normalizedActualStart - scheduledStart - graceSeconds, 0);
  let undertimeSeconds = normalizedActualEnd === null ? 0 : Math.max(scheduledEnd - normalizedActualEnd, 0);
  let overtimeSeconds = normalizedActualEnd === null ? 0 : Math.max(normalizedActualEnd - scheduledEnd, 0);

  if (normalizedStatus === 'half_day') {
    const halfDaySeconds = Math.floor(paidShiftSeconds / 2);
    undertimeSeconds = Math.max(undertimeSeconds, halfDaySeconds);
  }

  return {
    lateSeconds: Math.trunc(lateSeconds),
    undertimeSeconds: Math.trunc(undertimeSeconds),
    overtimeSeconds: Math.trunc(overtimeSeconds),
    lateDeduction: roundMoney(lateSeconds * ratePerSecond),
    undertimeDeduction: roundMoney(undertimeSeconds * ratePerSecond),
    absenceDeduction: 0,
    dailyRate,
  };
};

export const getEmployeeScheduleForDate = async (connection, employeeId, attendanceDate) => {
  const weekday = getWeekday(attendanceDate);
  if (weekday === null) return null;
  const [rows] = await connection.query(
    `SELECT * FROM employee_work_schedules WHERE employee_id = ? AND weekday = ? LIMIT 1`,
    [employeeId, weekday]
  );
  return rows[0] || null;
};

export const upsertEmployeeSchedules = async (connection, employeeId, payload = {}) => {
  const workDays = new Set((Array.isArray(payload.work_days) ? payload.work_days : [1, 2, 3, 4, 5]).map(Number));
  const customSchedules = Array.isArray(payload.schedules) ? payload.schedules : [];
  const defaultStart = timeOnly(payload.shift_start) || '08:00:00';
  const defaultEnd = timeOnly(payload.shift_end) || '17:00:00';
  const defaultBreak = Math.min(Math.max(Math.trunc(positiveNumber(payload.break_minutes, 60)), 0), 480);

  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const custom = customSchedules.find((item) => Number(item.weekday) === weekday) || {};
    const isWorkDay = custom.is_work_day === undefined ? workDays.has(weekday) : Boolean(custom.is_work_day);
    const start = isWorkDay ? (timeOnly(custom.shift_start) || defaultStart) : null;
    const end = isWorkDay ? (timeOnly(custom.shift_end) || defaultEnd) : null;
    const breakMinutes = Math.min(Math.max(Math.trunc(positiveNumber(custom.break_minutes, defaultBreak)), 0), 480);

    await connection.query(
      `
        INSERT INTO employee_work_schedules (employee_id, weekday, is_work_day, shift_start, shift_end, break_minutes)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          is_work_day = VALUES(is_work_day),
          shift_start = VALUES(shift_start),
          shift_end = VALUES(shift_end),
          break_minutes = VALUES(break_minutes)
      `,
      [employeeId, weekday, isWorkDay ? 1 : 0, start, end, breakMinutes]
    );
  }
};

export const buildEmployeeNameSql = (alias = 'e') =>
  `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;

export const getMonthRange = (monthValue) => {
  const month = /^\d{4}-\d{2}$/.test(cleanText(monthValue)) ? cleanText(monthValue) : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return { month, start, end, label: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1))) };
};
