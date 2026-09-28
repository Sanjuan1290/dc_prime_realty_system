const SETTINGS_ID = 1;
export const SUPPORTED_MID_PERIOD_CHANGE_RULE = 'period_boundary_only';

const payrollError = (message, code = 'PAYROLL_SETTINGS_ERROR', statusCode = 400, data = null) =>
  Object.assign(new Error(message), { code, statusCode, data });

const nullableNumber = (value, field) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 9999.9999) {
    throw payrollError(`${field} must be a non-negative number within the supported range.`, 'INVALID_PAYROLL_SETTING');
  }
  return number;
};

const nullablePercentage = (value, field) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw payrollError(`${field} must be between 0 and 100.`, 'INVALID_PAYROLL_SETTING');
  }
  return number;
};

export const normalizePayrollSettingsSnapshot = (row = {}) => ({
  settings_revision: Number(row.settings_revision || 1),
  regular_ot_multiplier: row.regular_ot_multiplier === null || row.regular_ot_multiplier === undefined ? null : Number(row.regular_ot_multiplier),
  rest_day_ot_multiplier: row.rest_day_ot_multiplier === null || row.rest_day_ot_multiplier === undefined ? null : Number(row.rest_day_ot_multiplier),
  regular_holiday_multiplier: row.regular_holiday_multiplier === null || row.regular_holiday_multiplier === undefined ? null : Number(row.regular_holiday_multiplier),
  regular_holiday_ot_multiplier: row.regular_holiday_ot_multiplier === null || row.regular_holiday_ot_multiplier === undefined ? null : Number(row.regular_holiday_ot_multiplier),
  special_holiday_multiplier: row.special_holiday_multiplier === null || row.special_holiday_multiplier === undefined ? null : Number(row.special_holiday_multiplier),
  special_holiday_ot_multiplier: row.special_holiday_ot_multiplier === null || row.special_holiday_ot_multiplier === undefined ? null : Number(row.special_holiday_ot_multiplier),
  night_differential_percentage: row.night_differential_percentage === null || row.night_differential_percentage === undefined ? null : Number(row.night_differential_percentage),
  mid_period_change_rule: String(row.mid_period_change_rule || SUPPORTED_MID_PERIOD_CHANGE_RULE),
});

export const payrollSettingsEqual = (left, right) =>
  JSON.stringify(normalizePayrollSettingsSnapshot(left || {})) === JSON.stringify(normalizePayrollSettingsSnapshot(right || {}));

export const ensurePayrollSettingsSchema = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS employee_payroll_settings (
      employee_payroll_settings_id TINYINT UNSIGNED NOT NULL,
      regular_ot_multiplier DECIMAL(8,4) NULL,
      rest_day_ot_multiplier DECIMAL(8,4) NULL,
      regular_holiday_multiplier DECIMAL(8,4) NULL,
      regular_holiday_ot_multiplier DECIMAL(8,4) NULL,
      special_holiday_multiplier DECIMAL(8,4) NULL,
      special_holiday_ot_multiplier DECIMAL(8,4) NULL,
      night_differential_percentage DECIMAL(6,3) NULL,
      mid_period_change_rule VARCHAR(40) NOT NULL DEFAULT 'period_boundary_only',
      settings_revision INT UNSIGNED NOT NULL DEFAULT 1,
      updated_by_user_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (employee_payroll_settings_id),
      CONSTRAINT fk_employee_payroll_settings_user FOREIGN KEY (updated_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await connection.query(`
    INSERT INTO employee_payroll_settings (
      employee_payroll_settings_id, mid_period_change_rule, settings_revision
    ) VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE employee_payroll_settings_id = employee_payroll_settings_id
  `, [SETTINGS_ID, SUPPORTED_MID_PERIOD_CHANGE_RULE]);
};

export const getPayrollSettings = async (connection, { forUpdate = false } = {}) => {
  await ensurePayrollSettingsSchema(connection);
  const [rows] = await connection.query(`
    SELECT s.*,
      TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS updated_by_name
    FROM employee_payroll_settings s
    LEFT JOIN users u ON u.id = s.updated_by_user_id
    WHERE s.employee_payroll_settings_id = ?
    LIMIT 1 ${forUpdate ? 'FOR UPDATE' : ''}
  `, [SETTINGS_ID]);
  const row = rows[0];
  if (!row) throw payrollError('Payroll Settings could not be loaded.', 'PAYROLL_SETTINGS_NOT_FOUND', 500);
  return {
    ...normalizePayrollSettingsSnapshot(row),
    updated_by_user_id: row.updated_by_user_id ? Number(row.updated_by_user_id) : null,
    updated_by_name: row.updated_by_name || null,
    updated_at: row.updated_at || null,
    created_at: row.created_at || null,
  };
};

export const getPayrollSettingsSnapshot = async (connection) =>
  normalizePayrollSettingsSnapshot(await getPayrollSettings(connection));

export const validatePayrollSettingsPayload = (body = {}) => {
  const midPeriodRule = String(body.mid_period_change_rule || SUPPORTED_MID_PERIOD_CHANGE_RULE).trim();
  if (midPeriodRule !== SUPPORTED_MID_PERIOD_CHANGE_RULE) {
    throw payrollError(
      'No approved mid-period proration formula is configured. Use Period Boundary Only (effective dates must be the 1st or 16th).',
      'MID_PERIOD_RULE_NOT_APPROVED',
      409
    );
  }
  return {
    regular_ot_multiplier: nullableNumber(body.regular_ot_multiplier, 'Regular OT Multiplier'),
    rest_day_ot_multiplier: nullableNumber(body.rest_day_ot_multiplier, 'Rest Day OT Multiplier'),
    regular_holiday_multiplier: nullableNumber(body.regular_holiday_multiplier, 'Regular Holiday Multiplier'),
    regular_holiday_ot_multiplier: nullableNumber(body.regular_holiday_ot_multiplier, 'Regular Holiday OT Multiplier'),
    special_holiday_multiplier: nullableNumber(body.special_holiday_multiplier, 'Special Holiday Multiplier'),
    special_holiday_ot_multiplier: nullableNumber(body.special_holiday_ot_multiplier, 'Special Holiday OT Multiplier'),
    night_differential_percentage: nullablePercentage(body.night_differential_percentage, 'Night Differential Percentage'),
    mid_period_change_rule: SUPPORTED_MID_PERIOD_CHANGE_RULE,
  };
};

export const updatePayrollSettings = async (connection, { body, updatedByUserId }) => {
  const next = validatePayrollSettingsPayload(body);
  const before = await getPayrollSettings(connection, { forUpdate: true });
  await connection.query(`
    UPDATE employee_payroll_settings
    SET regular_ot_multiplier = ?,
        rest_day_ot_multiplier = ?,
        regular_holiday_multiplier = ?,
        regular_holiday_ot_multiplier = ?,
        special_holiday_multiplier = ?,
        special_holiday_ot_multiplier = ?,
        night_differential_percentage = ?,
        mid_period_change_rule = ?,
        settings_revision = settings_revision + 1,
        updated_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_payroll_settings_id = ?
  `, [
    next.regular_ot_multiplier,
    next.rest_day_ot_multiplier,
    next.regular_holiday_multiplier,
    next.regular_holiday_ot_multiplier,
    next.special_holiday_multiplier,
    next.special_holiday_ot_multiplier,
    next.night_differential_percentage,
    next.mid_period_change_rule,
    Number(updatedByUserId || 0) || null,
    SETTINGS_ID,
  ]);
  const after = await getPayrollSettings(connection);
  return { before, after };
};
