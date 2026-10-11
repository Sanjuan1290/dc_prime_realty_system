-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 1: Employment & Compensation History
-- Safe additive migration. Existing employee/payroll/attendance history is preserved.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS employee_employment_history (
  employee_employment_history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  change_type ENUM(
    'hired','promotion','salary_increase','position_change','department_transfer',
    'employment_status_change','allowance_adjustment','demotion','other'
  ) NOT NULL,
  position VARCHAR(120) NOT NULL,
  department VARCHAR(120) NOT NULL,
  employment_type ENUM('regular','probationary','contractual','part_time','intern') NOT NULL DEFAULT 'regular',
  monthly_basic_salary DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  rice_allowance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  transportation_allowance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  attendance_bonus DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  change_reason TEXT NULL,
  previous_history_id BIGINT UNSIGNED NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  corrected_by_user_id INT UNSIGNED NULL,
  corrected_at DATETIME NULL,
  correction_reason TEXT NULL,
  PRIMARY KEY (employee_employment_history_id),
  UNIQUE KEY uq_employee_employment_start (employee_id, effective_from),
  KEY idx_employee_employment_effective (employee_id, effective_from, effective_to),
  KEY idx_employee_employment_current (employee_id, effective_to),
  KEY idx_employee_employment_previous (previous_history_id),
  KEY idx_employee_employment_created_by (created_by_user_id),
  KEY idx_employee_employment_corrected_by (corrected_by_user_id),
  CONSTRAINT fk_employee_employment_employee
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_employee_employment_previous
    FOREIGN KEY (previous_history_id) REFERENCES employee_employment_history(employee_employment_history_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_employee_employment_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_employee_employment_corrected_by
    FOREIGN KEY (corrected_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Backfill one immutable starting record from every current employee that does not
-- have employment history yet. No employee or old payroll row is rewritten.
INSERT INTO employee_employment_history (
  employee_id,
  change_type,
  position,
  department,
  employment_type,
  monthly_basic_salary,
  rice_allowance,
  transportation_allowance,
  attendance_bonus,
  effective_from,
  effective_to,
  change_reason,
  previous_history_id,
  created_by_user_id,
  created_at
)
SELECT
  e.employee_id,
  'hired',
  COALESCE(NULLIF(TRIM(e.position), ''), 'Employee'),
  COALESCE(NULLIF(TRIM(e.department), ''), 'Unassigned'),
  e.employment_type,
  GREATEST(COALESCE(e.monthly_salary, 0.00), 0.00),
  GREATEST(COALESCE(e.rice_allowance, 0.00), 0.00),
  GREATEST(COALESCE(e.transportation_allowance, 0.00), 0.00),
  GREATEST(COALESCE(e.attendance_bonus_amount, 0.00), 0.00),
  COALESCE(e.hire_date, DATE(e.created_at), CURRENT_DATE),
  NULL,
  'Initial employment and compensation record backfilled from the employee profile.',
  NULL,
  e.created_by_user_id,
  COALESCE(e.created_at, CURRENT_TIMESTAMP)
FROM employees e
WHERE NOT EXISTS (
  SELECT 1
  FROM employee_employment_history h
  WHERE h.employee_id = e.employee_id
);

-- New RBAC keys. Salary/compensation access is intentionally separate from employees.view.
INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employees.compensation.manage', 1, NULL),
  ('admin', 'employees.employment_change.create', 1, NULL),
  ('admin', 'employees.employment_history.view', 1, NULL),
  ('accounting', 'employees.employment_history.view', 1, NULL),
  ('operations', 'employees.compensation.manage', 1, NULL),
  ('operations', 'employees.employment_change.create', 1, NULL),
  ('operations', 'employees.employment_history.view', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

-- Existing accounts keep their current permissions plus only the new Batch-1 keys
-- appropriate for their current role. This does not reset any custom permission.
INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, desired.permission_key, 1, NULL
FROM users u
INNER JOIN (
  SELECT 'admin' AS role, 'employees.compensation.manage' AS permission_key
  UNION ALL SELECT 'admin', 'employees.employment_change.create'
  UNION ALL SELECT 'admin', 'employees.employment_history.view'
  UNION ALL SELECT 'accounting', 'employees.employment_history.view'
  UNION ALL SELECT 'operations', 'employees.compensation.manage'
  UNION ALL SELECT 'operations', 'employees.employment_change.create'
  UNION ALL SELECT 'operations', 'employees.employment_history.view'
) desired ON desired.role = u.role
WHERE u.status = 'active'
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;

