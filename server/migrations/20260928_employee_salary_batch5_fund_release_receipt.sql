-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 5: Acknowledgement Receipt for Fund Release
-- Prerequisite: Batches 1-4.
-- No payroll-data schema change is required; this migration adds receipt permissions.

START TRANSACTION;

INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employee_salary.receipt.print', 1, NULL),
  ('admin', 'employee_salary.receipt.export', 1, NULL),
  ('accounting', 'employee_salary.receipt.print', 1, NULL),
  ('accounting', 'employee_salary.receipt.export', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, desired.permission_key, 1, NULL
FROM users u
INNER JOIN (
  SELECT 'admin' AS role, 'employee_salary.receipt.print' AS permission_key
  UNION ALL SELECT 'admin', 'employee_salary.receipt.export'
  UNION ALL SELECT 'accounting', 'employee_salary.receipt.print'
  UNION ALL SELECT 'accounting', 'employee_salary.receipt.export'
) desired ON desired.role = u.role
WHERE u.status = 'active'
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;
