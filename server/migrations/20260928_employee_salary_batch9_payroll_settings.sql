-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 9: Payroll Settings
-- Prerequisite: Batches 1-8.
-- Adds configurable premium-pay rules without hardcoding company rates.

START TRANSACTION;

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
  CONSTRAINT fk_employee_payroll_settings_user
    FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO employee_payroll_settings (
  employee_payroll_settings_id,
  mid_period_change_rule,
  settings_revision
) VALUES (1, 'period_boundary_only', 1)
ON DUPLICATE KEY UPDATE employee_payroll_settings_id = employee_payroll_settings_id;

ALTER TABLE employee_payrolls
  ADD COLUMN IF NOT EXISTS payroll_settings_snapshot_json JSON NULL;

INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employee_salary.settings.manage', 1, NULL),
  ('accounting', 'employee_salary.settings.manage', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, 'employee_salary.settings.manage', 1, NULL
FROM users u
WHERE u.status = 'active'
  AND u.role IN ('admin', 'accounting')
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;
