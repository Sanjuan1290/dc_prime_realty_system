import { backfillMissingAttendanceBarcodes } from './attendanceBarcode.shared.js';
let employeeModuleTablesReady = false;

export const cleanText = (value, fallback = '') => {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
};

export const nullableText = (value) => {
  const cleaned = cleanText(value);
  return cleaned || null;
};

export const dateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
};

export const timeOnly = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

export const buildEmployeeNameSql = (alias = 'employees') => (
  `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`
);

const employeesTableSql = `
  CREATE TABLE IF NOT EXISTS employees (
    employee_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    linked_user_id INT UNSIGNED NULL,
    employee_code VARCHAR(80) NOT NULL,
    barcode_code CHAR(10) NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    contact_number VARCHAR(60) NULL,
    address TEXT NULL,
    department VARCHAR(120) NULL,
    position VARCHAR(120) NOT NULL DEFAULT 'Employee',
    employment_type ENUM('regular','probationary','part_time') NOT NULL DEFAULT 'regular',
    hire_date DATE NULL,
    employee_status ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
    created_by_user_id INT UNSIGNED NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id),
    UNIQUE KEY uq_employees_code (employee_code),
    UNIQUE KEY uq_employees_barcode_code (barcode_code),
    UNIQUE KEY uq_employees_email (email),
    KEY idx_employees_status (employee_status),
    KEY idx_employees_department (department),
    CONSTRAINT fk_employees_linked_user FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employees_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employees_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const attendanceTableSql = `
  CREATE TABLE IF NOT EXISTS employee_attendance_records (
    employee_attendance_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id INT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    actual_time_in TIME NULL,
    actual_time_out TIME NULL,
    attendance_status ENUM('present','absent') NOT NULL DEFAULT 'present',
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;


const employeeRestDaysTableSql = `
  CREATE TABLE IF NOT EXISTS employee_rest_day_assignments (
    employee_rest_day_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id INT UNSIGNED NOT NULL,
    day_of_week ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_by_user_id INT UNSIGNED NULL,
    updated_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_rest_day_id),
    UNIQUE KEY uq_employee_rest_day_period (employee_id, day_of_week, effective_from),
    KEY idx_employee_rest_day_employee_dates (employee_id, effective_from, effective_to),
    KEY idx_employee_rest_day_day (day_of_week),
    KEY fk_employee_rest_day_created_by (created_by_user_id),
    KEY fk_employee_rest_day_updated_by (updated_by_user_id),
    CONSTRAINT fk_employee_rest_day_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_employee_rest_day_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employee_rest_day_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const addColumnIfMissing = async (connection, table, column, definition) => {
  await connection.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
};

export const ensureEmployeeModuleTables = async (connection) => {
  if (employeeModuleTablesReady) return;

  await connection.query(employeesTableSql);
  await connection.query(attendanceTableSql);
  await connection.query(employeeRestDaysTableSql);

  // Compatibility columns required by older employee tables remain populated internally.
  await addColumnIfMissing(connection, 'employees', 'barcode_code', `CHAR(10) NULL AFTER employee_code`);
  const [barcodeIndexRows] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'employees'
      AND index_name = 'uq_employees_barcode_code'
  `);
  if (!Number(barcodeIndexRows[0]?.total || 0)) {
    await connection.query('ALTER TABLE employees ADD UNIQUE KEY uq_employees_barcode_code (barcode_code)');
  }
  await backfillMissingAttendanceBarcodes(connection);

  await addColumnIfMissing(connection, 'employees', 'department', `VARCHAR(120) NULL AFTER address`);
  await addColumnIfMissing(connection, 'employees', 'position', `VARCHAR(120) NOT NULL DEFAULT 'Employee' AFTER department`);
  await addColumnIfMissing(connection, 'employees', 'employment_type', `ENUM('regular','probationary','part_time') NOT NULL DEFAULT 'regular' AFTER position`);
  await addColumnIfMissing(connection, 'employees', 'hire_date', `DATE NULL AFTER employment_type`);
  await addColumnIfMissing(connection, 'employees', 'employee_status', `ENUM('active','inactive','archived') NOT NULL DEFAULT 'active' AFTER hire_date`);
  await addColumnIfMissing(connection, 'employees', 'created_by_user_id', `INT UNSIGNED NULL AFTER employee_status`);
  await addColumnIfMissing(connection, 'employees', 'updated_by_user_id', `INT UNSIGNED NULL AFTER created_by_user_id`);

  employeeModuleTablesReady = true;
};

