-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 7: Payroll Release Workflow
-- Prerequisite: Batches 1-6.
-- Adds per-employee release metadata and the Mark Payroll as Released permission.

START TRANSACTION;

ALTER TABLE employee_payrolls
  MODIFY COLUMN payroll_status ENUM('draft','finalized','released','cancelled') NOT NULL DEFAULT 'draft';

ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS released_date DATE NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS released_at DATETIME NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS released_by_user_id INT UNSIGNED NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS release_reference VARCHAR(180) NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS release_notes TEXT NULL;

INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employee_salary.release', 1, NULL),
  ('accounting', 'employee_salary.release', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, 'employee_salary.release', 1, NULL
FROM users u
WHERE u.status = 'active'
  AND u.role IN ('admin', 'accounting')
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;

