import { ensureEmployeeModuleTables, timeOnly } from './employeeModule.shared.js';

export const ATTENDANCE_TIME_ZONE = 'Asia/Manila';
export const DEFAULT_AUTO_TIME_OUT = '20:00:00';

let attendanceLiteSchemaReady = false;

const pad = (value) => String(value).padStart(2, '0');

export const getManilaDateTime = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${pad(hour)}:${parts.minute}:${parts.second}`,
  };
};

export const normalizeClockTime = (value, fallback = null) => timeOnly(value) || fallback;

export const enumerateDateRange = (start, end) => {
  const result = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end || ''))) return result;
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last && result.length < 62) {
    result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
};

const systemSettingsColumns = async (connection) => {
  await connection.query(`
    ALTER TABLE system_settings
      ADD COLUMN IF NOT EXISTS attendance_default_time_out TIME NOT NULL DEFAULT '20:00:00' AFTER default_release_day_two
  `);
  await connection.query(`
    ALTER TABLE system_settings
      ADD COLUMN IF NOT EXISTS employee_departments_json TEXT NULL AFTER attendance_default_time_out
  `);
};

export const ensureAttendanceLiteSchema = async (connection) => {
  if (attendanceLiteSchemaReady) return;

  await ensureEmployeeModuleTables(connection);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      system_setting_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
      company_name VARCHAR(150) NOT NULL DEFAULT 'D&C Prime Realty',
      company_email VARCHAR(150) NULL,
      company_contact_number VARCHAR(60) NULL,
      company_address TEXT NULL,
      company_tin VARCHAR(80) NULL,
      system_status ENUM('active','maintenance') NOT NULL DEFAULT 'active',
      maintenance_message TEXT NULL,
      reservation_contact_name VARCHAR(150) NULL,
      reservation_contact_email VARCHAR(150) NULL,
      reservation_contact_number VARCHAR(60) NULL,
      default_release_day_one TINYINT UNSIGNED NOT NULL DEFAULT 7,
      default_release_day_two TINYINT UNSIGNED NOT NULL DEFAULT 22,
      attendance_default_time_out TIME NOT NULL DEFAULT '20:00:00',
      employee_departments_json TEXT NULL,
      updated_by_user_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (system_setting_id),
      KEY fk_system_settings_updated_by (updated_by_user_id),
      CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await systemSettingsColumns(connection);
  await connection.query(`INSERT INTO system_settings (system_setting_id) VALUES (1) ON DUPLICATE KEY UPDATE system_setting_id = VALUES(system_setting_id)`);

  await connection.query(`ALTER TABLE employee_attendance_records ADD COLUMN IF NOT EXISTS attendance_event_id BIGINT UNSIGNED NULL AFTER employee_id`);
  await connection.query(`ALTER TABLE employee_attendance_records ADD COLUMN IF NOT EXISTS time_in_source ENUM('barcode','manual','event','admin') NULL AFTER actual_time_in`);
  await connection.query(`ALTER TABLE employee_attendance_records ADD COLUMN IF NOT EXISTS time_out_source ENUM('barcode','manual','event','admin','automatic') NULL AFTER actual_time_out`);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance_day_settings (
      attendance_date DATE NOT NULL,
      day_type ENUM('regular','double_pay','regular_holiday','special_holiday') NOT NULL DEFAULT 'regular',
      notes TEXT NULL,
      source_event_id BIGINT UNSIGNED NULL,
      updated_by_user_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (attendance_date),
      KEY idx_attendance_day_type (day_type),
      CONSTRAINT fk_attendance_day_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance_events (
      attendance_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_name VARCHAR(180) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      location VARCHAR(255) NULL,
      attendance_treatment ENUM('full_day','custom_time','record_only') NOT NULL DEFAULT 'record_only',
      event_time_in TIME NULL,
      event_time_out TIME NULL,
      day_type ENUM('regular','double_pay','regular_holiday','special_holiday') NOT NULL DEFAULT 'regular',
      notes TEXT NULL,
      event_status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
      created_by_user_id INT UNSIGNED NULL,
      updated_by_user_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (attendance_event_id),
      KEY idx_attendance_event_dates (start_date, end_date),
      CONSTRAINT fk_attendance_event_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_attendance_event_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance_event_participants (
      attendance_event_participant_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      attendance_event_id BIGINT UNSIGNED NOT NULL,
      employee_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (attendance_event_participant_id),
      UNIQUE KEY uq_attendance_event_employee (attendance_event_id, employee_id),
      CONSTRAINT fk_attendance_event_participant_event FOREIGN KEY (attendance_event_id) REFERENCES attendance_events(attendance_event_id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_attendance_event_participant_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS employee_attendance_corrections (
      employee_attendance_correction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      employee_attendance_id INT UNSIGNED NOT NULL,
      previous_time_in TIME NULL,
      new_time_in TIME NULL,
      previous_time_out TIME NULL,
      new_time_out TIME NULL,
      reason TEXT NOT NULL,
      changed_by_user_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_attendance_correction_id),
      KEY idx_attendance_correction_attendance (employee_attendance_id),
      CONSTRAINT fk_attendance_correction_attendance FOREIGN KEY (employee_attendance_id) REFERENCES employee_attendance_records(employee_attendance_id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_attendance_correction_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  attendanceLiteSchemaReady = true;
};

export const getAttendanceRuntimeSettings = async (connection) => {
  await ensureAttendanceLiteSchema(connection);
  const [rows] = await connection.query(`
    SELECT attendance_default_time_out, employee_departments_json
    FROM system_settings
    WHERE system_setting_id = 1
    LIMIT 1
  `);
  const row = rows[0] || {};
  let departments = [];
  try {
    const parsed = JSON.parse(String(row.employee_departments_json || '[]'));
    if (Array.isArray(parsed)) departments = parsed.map((value) => String(value || '').trim()).filter(Boolean);
  } catch {}
  if (!departments.length) departments = ['Administration', 'Sales', 'Accounting'];
  return {
    defaultTimeOut: normalizeClockTime(row.attendance_default_time_out, DEFAULT_AUTO_TIME_OUT),
    departments,
  };
};
