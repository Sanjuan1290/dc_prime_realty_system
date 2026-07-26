import { db } from '../../../db/connect.js';

export const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
export const cleanText = (value, fallback = '') => String(value ?? fallback).trim();
export const nullableText = (value) => cleanText(value) || null;
export const positiveNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
};

// Employee cash advances are deducted from the next salary release as one outstanding balance.
// The deduction is capped so attendance deductions can never push net salary below zero.
export const calculateCashAdvanceDeduction = ({ advances = [], availableSalary = 0 } = {}) => {
  const outstandingBalance = advances.reduce(
    (sum, advance) => sum + positiveNumber(advance?.remaining_balance ?? advance?.remainingBalance),
    0
  );

  return roundMoney(Math.min(outstandingBalance, positiveNumber(availableSalary)));
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
    attendance_grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
    rice_allowance DECIMAL(14,2) NOT NULL DEFAULT 500.00,
    transportation_allowance DECIMAL(14,2) NOT NULL DEFAULT 500.00,
    attendance_bonus_amount DECIMAL(14,2) NOT NULL DEFAULT 3000.00,
    overtime_multiplier DECIMAL(6,2) NOT NULL DEFAULT 2.00,
    night_differential_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
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
    CONSTRAINT chk_employees_salary CHECK (monthly_salary >= 0)
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
    regular_work_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    late_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    undertime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    overtime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    night_differential_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    bonus_late_violation TINYINT(1) NOT NULL DEFAULT 0,
    late_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    undertime_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    absence_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    attendance_status ENUM('present','late','absent','paid_leave','unpaid_leave','rest_day','holiday','regular_holiday','special_holiday','half_day') NOT NULL DEFAULT 'present',
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
    -- Legacy compatibility columns. The application now deducts the outstanding balance on the next salary release.
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
    CONSTRAINT fk_employee_cash_advance_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const payrollPeriodTableSql = `
  CREATE TABLE IF NOT EXISTS employee_payroll_periods (
    employee_payroll_period_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    period_label VARCHAR(120) NOT NULL,
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
    UNIQUE KEY uq_employee_payroll_period (period_start, period_end),
    UNIQUE KEY uq_employee_payroll_release_date (release_date),
    CONSTRAINT fk_employee_payroll_finalized_by FOREIGN KEY (finalized_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const payrollTableSql = `
  CREATE TABLE IF NOT EXISTS employee_payrolls (
    employee_payroll_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_payroll_period_id INT UNSIGNED NOT NULL,
    employee_id INT UNSIGNED NOT NULL,
    monthly_salary_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    payroll_divisor_snapshot DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    month_work_days_snapshot DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    period_work_days DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    hourly_rate_snapshot DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
    base_salary DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    scheduled_regular_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    regular_attended_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    paid_time_off_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    regular_holiday_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    special_holiday_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    late_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    late_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    undertime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    undertime_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    absent_days DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    absence_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    overtime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    overtime_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    night_differential_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    night_differential_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    rice_allowance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    transportation_allowance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    attendance_bonus DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    attendance_bonus_eligible TINYINT(1) NOT NULL DEFAULT 0,
    attendance_bonus_note VARCHAR(255) NULL,
    cash_advance_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    other_adjustments DECIMAL(14,2) NOT NULL DEFAULT 0.00,
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

const columnExists = async (connection, tableName, columnName) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [tableName, columnName]
  );
  return Boolean(rows.length);
};

const addColumnIfMissing = async (connection, tableName, columnName, definition) => {
  if (!(await columnExists(connection, tableName, columnName))) {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
};

const indexExists = async (connection, tableName, indexName) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [tableName, indexName]
  );
  return Boolean(rows.length);
};

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

  // Upgrade databases created by the first employee-payroll migration.
  await addColumnIfMissing(connection, 'employees', 'rice_allowance', `DECIMAL(14,2) NOT NULL DEFAULT 500.00 AFTER attendance_grace_minutes`);
  await addColumnIfMissing(connection, 'employees', 'transportation_allowance', `DECIMAL(14,2) NOT NULL DEFAULT 500.00 AFTER rice_allowance`);
  await addColumnIfMissing(connection, 'employees', 'attendance_bonus_amount', `DECIMAL(14,2) NOT NULL DEFAULT 3000.00 AFTER transportation_allowance`);
  await addColumnIfMissing(connection, 'employees', 'overtime_multiplier', `DECIMAL(6,2) NOT NULL DEFAULT 2.00 AFTER attendance_bonus_amount`);
  await addColumnIfMissing(connection, 'employees', 'night_differential_percent', `DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER overtime_multiplier`);
  await connection.query(`ALTER TABLE employees MODIFY attendance_grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15`);

  await addColumnIfMissing(connection, 'employee_attendance_records', 'regular_work_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER actual_time_out`);
  await addColumnIfMissing(connection, 'employee_attendance_records', 'night_differential_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER overtime_seconds`);
  await addColumnIfMissing(connection, 'employee_attendance_records', 'bonus_late_violation', `TINYINT(1) NOT NULL DEFAULT 0 AFTER night_differential_seconds`);
  await connection.query(`
    ALTER TABLE employee_attendance_records
    MODIFY attendance_status ENUM('present','late','absent','paid_leave','unpaid_leave','rest_day','holiday','regular_holiday','special_holiday','half_day') NOT NULL DEFAULT 'present'
  `);

  await addColumnIfMissing(connection, 'employee_payroll_periods', 'release_date', `DATE NULL AFTER period_end`);
  await addColumnIfMissing(connection, 'employee_payroll_periods', 'release_day', `TINYINT UNSIGNED NULL AFTER release_date`);
  await addColumnIfMissing(connection, 'employee_payroll_periods', 'period_type', `ENUM('first_half','second_half') NULL AFTER release_day`);
  await addColumnIfMissing(connection, 'employee_payroll_periods', 'witness_name', `VARCHAR(180) NULL AFTER period_type`);
  await addColumnIfMissing(connection, 'employee_payroll_periods', 'release_notes', `TEXT NULL AFTER witness_name`);
  if (!(await indexExists(connection, 'employee_payroll_periods', 'uq_employee_payroll_release_date'))) {
    await connection.query(`ALTER TABLE employee_payroll_periods ADD UNIQUE KEY uq_employee_payroll_release_date (release_date)`);
  }

  const payrollColumns = [
    ['month_work_days_snapshot', `DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER payroll_divisor_snapshot`],
    ['period_work_days', `DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER month_work_days_snapshot`],
    ['hourly_rate_snapshot', `DECIMAL(14,4) NOT NULL DEFAULT 0.0000 AFTER period_work_days`],
    ['scheduled_regular_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER base_salary`],
    ['regular_attended_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER scheduled_regular_seconds`],
    ['paid_time_off_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER regular_attended_seconds`],
    ['regular_holiday_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER paid_time_off_seconds`],
    ['special_holiday_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER regular_holiday_seconds`],
    ['overtime_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER absence_deduction`],
    ['overtime_pay', `DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER overtime_seconds`],
    ['night_differential_seconds', `INT UNSIGNED NOT NULL DEFAULT 0 AFTER overtime_pay`],
    ['night_differential_pay', `DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER night_differential_seconds`],
    ['rice_allowance', `DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER night_differential_pay`],
    ['transportation_allowance', `DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER rice_allowance`],
    ['attendance_bonus', `DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER transportation_allowance`],
    ['attendance_bonus_eligible', `TINYINT(1) NOT NULL DEFAULT 0 AFTER attendance_bonus`],
    ['attendance_bonus_note', `VARCHAR(255) NULL AFTER attendance_bonus_eligible`],
    ['other_adjustments', `DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER cash_advance_deduction`],
  ];

  for (const [columnName, definition] of payrollColumns) {
    await addColumnIfMissing(connection, 'employee_payrolls', columnName, definition);
  }

  initialized = true;
};

const toUtcDate = (value) => {
  const cleanDate = dateOnly(value);
  if (!cleanDate) return null;
  const [year, month, day] = cleanDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatUtcDate = (date) => date.toISOString().slice(0, 10);

export const addDays = (value, days) => {
  const date = toUtcDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return formatUtcDate(date);
};

export const getWeekday = (dateValue) => toUtcDate(dateValue)?.getUTCDay() ?? null;

export const enumerateDates = (startValue, endValue) => {
  const start = toUtcDate(startValue);
  const end = toUtcDate(endValue);
  if (!start || !end || start > end) return [];

  const dates = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(formatUtcDate(cursor));
  }
  return dates;
};

export const getMonthBounds = (dateValue) => {
  const date = toUtcDate(dateValue);
  if (!date) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    start: formatUtcDate(new Date(Date.UTC(year, month, 1))),
    end: formatUtcDate(new Date(Date.UTC(year, month + 1, 0))),
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
  };
};

export const getPayrollReleasePeriod = (releaseDateValue) => {
  const releaseDate = dateOnly(releaseDateValue);
  const date = toUtcDate(releaseDate);

  if (!date) throw new Error('A valid payroll release date is required.');

  const releaseDay = date.getUTCDate();
  if (![7, 22].includes(releaseDay)) {
    throw new Error('Salary releases are only allowed on the 7th and 22nd day of the month.');
  }

  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  let periodStart;
  let periodEnd;
  let salaryMonthStart;
  let salaryMonthEnd;
  let periodType;

  if (releaseDay === 7) {
    salaryMonthStart = new Date(Date.UTC(year, monthIndex - 1, 1));
    salaryMonthEnd = new Date(Date.UTC(year, monthIndex, 0));
    periodStart = new Date(Date.UTC(salaryMonthStart.getUTCFullYear(), salaryMonthStart.getUTCMonth(), 16));
    periodEnd = salaryMonthEnd;
    periodType = 'second_half';
  } else {
    salaryMonthStart = new Date(Date.UTC(year, monthIndex, 1));
    salaryMonthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));
    periodStart = salaryMonthStart;
    periodEnd = new Date(Date.UTC(year, monthIndex, 15));
    periodType = 'first_half';
  }

  const displayDate = (input) => new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(input);

  const salaryMonthLabel = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(salaryMonthStart);

  return {
    releaseDate,
    releaseDay,
    periodType,
    start: formatUtcDate(periodStart),
    end: formatUtcDate(periodEnd),
    salaryMonthStart: formatUtcDate(salaryMonthStart),
    salaryMonthEnd: formatUtcDate(salaryMonthEnd),
    bonusEvaluationStart: formatUtcDate(salaryMonthStart),
    bonusEvaluationEnd: formatUtcDate(salaryMonthEnd),
    label: `${displayDate(periodStart)} – ${displayDate(periodEnd)}`,
    shortLabel: `${periodStart.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${periodStart.getUTCDate()} – ${periodEnd.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${periodEnd.getUTCDate()}, ${periodEnd.getUTCFullYear()}`,
    salaryMonthLabel,
    releaseLabel: displayDate(date),
    includesAttendanceBonus: releaseDay === 7,
    includesRiceAllowance: true,
    includesTransportationAllowance: releaseDay === 7,
  };
};


export const getPayrollAllowances = ({ employee = {}, period = {} }) => ({
  // Rice allowance is included in both salary releases.
  riceAllowance: period.includesRiceAllowance === false
    ? 0
    : roundMoney(employee.rice_allowance ?? 500),
  // Transportation allowance is included only in the salary release dated on the 7th.
  transportationAllowance: period.includesTransportationAllowance
    ? roundMoney(employee.transportation_allowance ?? 500)
    : 0,
});

export const getNextPayrollReleaseDate = (referenceDateValue = new Date().toISOString().slice(0, 10)) => {
  const date = toUtcDate(referenceDateValue) || new Date();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (day <= 7) return formatUtcDate(new Date(Date.UTC(year, month, 7)));
  if (day <= 22) return formatUtcDate(new Date(Date.UTC(year, month, 22)));
  return formatUtcDate(new Date(Date.UTC(year, month + 1, 7)));
};

const secondsFromTime = (value) => {
  const cleanTime = timeOnly(value);
  if (!cleanTime) return null;
  const [hour, minute, second] = cleanTime.split(':').map(Number);
  return hour * 3600 + minute * 60 + second;
};

const normalizeEndSeconds = (start, end) => {
  if (start === null || end === null) return null;
  return end <= start ? end + 86400 : end;
};

const intersectionSeconds = (startA, endA, startB, endB) => Math.max(Math.min(endA, endB) - Math.max(startA, startB), 0);

export const getSchedulePaidSeconds = (schedule) => {
  const start = secondsFromTime(schedule?.shift_start);
  const endRaw = secondsFromTime(schedule?.shift_end);
  if (start === null || endRaw === null || !schedule?.is_work_day) return 0;
  const end = normalizeEndSeconds(start, endRaw);
  return Math.max(end - start - positiveNumber(schedule?.break_minutes, 60) * 60, 0);
};

const calculateNightDifferentialSeconds = (actualStart, actualEnd) => {
  if (actualStart === null || actualEnd === null) return 0;

  // Night work is kept configurable through the employee percentage. This only measures
  // actual work overlapping 10:00 PM–6:00 AM so the receipt can show the hours.
  return Math.trunc(
    intersectionSeconds(actualStart, actualEnd, 0, 6 * 3600)
      + intersectionSeconds(actualStart, actualEnd, 22 * 3600, 30 * 3600)
  );
};

export const calculateAttendanceMetrics = ({
  employee,
  schedule,
  status,
  actualTimeIn,
  actualTimeOut,
  monthWorkDays,
}) => {
  const normalizedStatus = cleanText(status, 'present');
  const divisor = Math.max(positiveNumber(monthWorkDays, employee?.payroll_divisor || 1), 1);
  const dailyRate = roundMoney(positiveNumber(employee?.monthly_salary) / divisor);
  const scheduledStart = secondsFromTime(schedule?.shift_start);
  const scheduledEndRaw = secondsFromTime(schedule?.shift_end);
  const actualStart = secondsFromTime(actualTimeIn);
  const actualEndRaw = secondsFromTime(actualTimeOut);
  const breakSeconds = positiveNumber(schedule?.break_minutes, 60) * 60;
  const graceSeconds = positiveNumber(employee?.attendance_grace_minutes, 15) * 60;

  const emptyResult = {
    regularWorkSeconds: 0,
    lateSeconds: 0,
    undertimeSeconds: 0,
    overtimeSeconds: 0,
    nightDifferentialSeconds: 0,
    bonusLateViolation: false,
    lateDeduction: 0,
    undertimeDeduction: 0,
    absenceDeduction: 0,
    dailyRate,
    hourlyRate: 0,
    paidShiftSeconds: 0,
  };

  if (['rest_day', 'holiday', 'regular_holiday', 'special_holiday', 'paid_leave'].includes(normalizedStatus)) {
    return emptyResult;
  }

  if (['absent', 'unpaid_leave'].includes(normalizedStatus)) {
    return { ...emptyResult, absenceDeduction: dailyRate };
  }

  if (scheduledStart === null || scheduledEndRaw === null || !schedule?.is_work_day) {
    return emptyResult;
  }

  const scheduledEnd = normalizeEndSeconds(scheduledStart, scheduledEndRaw);
  const paidShiftSeconds = Math.max(scheduledEnd - scheduledStart - breakSeconds, 1);
  const ratePerSecond = dailyRate / paidShiftSeconds;
  const normalizedActualEnd = actualEndRaw === null || actualStart === null
    ? null
    : normalizeEndSeconds(actualStart, actualEndRaw);

  // All late time reduces salary. The grace period is used only for the attendance bonus.
  const lateSeconds = actualStart === null ? 0 : Math.max(actualStart - scheduledStart, 0);
  let undertimeSeconds = normalizedActualEnd === null ? 0 : Math.max(scheduledEnd - normalizedActualEnd, 0);
  const overtimeSeconds = normalizedActualEnd === null ? 0 : Math.max(normalizedActualEnd - scheduledEnd, 0);

  if (normalizedStatus === 'half_day') {
    undertimeSeconds = Math.max(undertimeSeconds, Math.floor(paidShiftSeconds / 2));
  }

  const actualPaidSeconds = normalizedActualEnd === null || actualStart === null
    ? 0
    : Math.max(normalizedActualEnd - actualStart - breakSeconds, 0);
  const regularWorkSeconds = Math.max(Math.min(actualPaidSeconds - overtimeSeconds, paidShiftSeconds), 0);
  const nightDifferentialSeconds = calculateNightDifferentialSeconds(actualStart, normalizedActualEnd);

  return {
    regularWorkSeconds: Math.trunc(regularWorkSeconds),
    lateSeconds: Math.trunc(lateSeconds),
    undertimeSeconds: Math.trunc(undertimeSeconds),
    overtimeSeconds: Math.trunc(overtimeSeconds),
    nightDifferentialSeconds,
    bonusLateViolation: lateSeconds > graceSeconds,
    lateDeduction: roundMoney(lateSeconds * ratePerSecond),
    undertimeDeduction: roundMoney(undertimeSeconds * ratePerSecond),
    absenceDeduction: 0,
    dailyRate,
    hourlyRate: roundMoney(ratePerSecond * 3600),
    paidShiftSeconds,
  };
};

export const formatDuration = (seconds = 0, { clock = false } = {}) => {
  const total = Math.max(Math.trunc(Number(seconds || 0)), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;

  if (clock) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${hours ? `${hours}h ` : ''}${minutes ? `${minutes}m ` : ''}${remainingSeconds}s`.trim();
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

export const getEmployeeSchedules = async (connection, employeeId) => {
  const [rows] = await connection.query(
    `SELECT * FROM employee_work_schedules WHERE employee_id = ? ORDER BY weekday`,
    [employeeId]
  );
  return rows.map((row) => ({ ...row, is_work_day: Boolean(row.is_work_day) }));
};

export const countScheduledWorkDays = ({ schedules = [], start, end, hireDate }) => {
  const scheduleMap = new Map(schedules.map((schedule) => [Number(schedule.weekday), schedule]));
  const cleanHireDate = dateOnly(hireDate);

  return enumerateDates(start, end).filter((date) => {
    if (cleanHireDate && date < cleanHireDate) return false;
    return Boolean(scheduleMap.get(getWeekday(date))?.is_work_day);
  }).length;
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

// Kept for older callers. New payroll screens use getPayrollReleasePeriod(releaseDate).
export const getMonthRange = (monthValue) => {
  const month = /^\d{4}-\d{2}$/.test(cleanText(monthValue))
    ? cleanText(monthValue)
    : new Date().toISOString().slice(0, 7);
  const bounds = getMonthBounds(`${month}-01`);
  return {
    month,
    start: bounds.start,
    end: bounds.end,
    label: new Intl.DateTimeFormat('en-PH', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(toUtcDate(bounds.start)),
  };
};

