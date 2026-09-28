-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 6: Employee Salary History
-- Prerequisite: Batches 1-5.
-- Payroll records already contain the historical snapshot data; this migration
-- only introduces the dedicated View Payroll History permission.

START TRANSACTION;

INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employee_salary.history.view', 1, NULL),
  ('accounting', 'employee_salary.history.view', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, 'employee_salary.history.view', 1, NULL
FROM users u
WHERE u.status = 'active'
  AND u.role IN ('admin', 'accounting')
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;
