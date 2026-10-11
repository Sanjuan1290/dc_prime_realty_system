-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 2: Payroll Calculation Engine
-- Prerequisite: Batch 1 employee_employment_history migration.
-- Safe additive migration. Existing payroll rows are preserved.

START TRANSACTION;

ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS employment_history_id BIGINT UNSIGNED NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255) NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS position_snapshot VARCHAR(120) NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS department_snapshot VARCHAR(120) NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS employment_status_snapshot VARCHAR(40) NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS half_month_basic DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(14,6) NOT NULL DEFAULT 0.000000;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS minute_rate DECIMAL(14,6) NOT NULL DEFAULT 0.000000;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS regular_working_minutes_snapshot SMALLINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS attendance_calculated_through DATE NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS expected_regular_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS regular_attended_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS pto_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS regular_holiday_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS special_holiday_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS late_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS absence_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS tardiness_absence_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS overtime_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS rest_day_overtime_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS night_differential_minutes INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS attendance_deduction DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS rest_day_overtime_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS regular_holiday_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS special_holiday_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS manual_additions_total DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS manual_deductions_total DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS net_fund_release DECIMAL(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS calculation_version VARCHAR(80) NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS calculation_warnings_json JSON NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS attendance_breakdown_json JSON NULL;

-- Batch-2 permissions. Salary access remains separate from Employees access.
INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employee_salary.view', 1, NULL),
  ('admin', 'employee_salary.generate', 1, NULL),
  ('admin', 'employee_salary.recalculate_draft', 1, NULL),
  ('accounting', 'employee_salary.view', 1, NULL),
  ('accounting', 'employee_salary.generate', 1, NULL),
  ('accounting', 'employee_salary.recalculate_draft', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, desired.permission_key, 1, NULL
FROM users u
INNER JOIN (
  SELECT 'admin' AS role, 'employee_salary.view' AS permission_key
  UNION ALL SELECT 'admin', 'employee_salary.generate'
  UNION ALL SELECT 'admin', 'employee_salary.recalculate_draft'
  UNION ALL SELECT 'accounting', 'employee_salary.view'
  UNION ALL SELECT 'accounting', 'employee_salary.generate'
  UNION ALL SELECT 'accounting', 'employee_salary.recalculate_draft'
) desired ON desired.role = u.role
WHERE u.status = 'active'
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;

