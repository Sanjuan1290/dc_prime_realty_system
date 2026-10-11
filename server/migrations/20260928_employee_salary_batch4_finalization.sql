-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 4: Payroll Finalization / Immutable Snapshot
-- Prerequisite: Batch 1 employment history + Batch 2 payroll engine + Batch 3 salary UI.
-- Safe additive migration. Existing Draft/finalized payroll rows are not recalculated.

START TRANSACTION;

ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS finalized_snapshot_json JSON NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS finalized_attendance_fingerprint CHAR(64) NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS finalized_by_user_id INT UNSIGNED NULL;
ALTER TABLE employee_payrolls ADD COLUMN IF NOT EXISTS finalized_at DATETIME NULL;

-- Batch-4 permission. Finalization stays separate from view/generate/recalculate.
INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employee_salary.finalize', 1, NULL),
  ('accounting', 'employee_salary.finalize', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, 'employee_salary.finalize', 1, NULL
FROM users u
WHERE u.status = 'active' AND u.role IN ('admin', 'accounting')
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;

