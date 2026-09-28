-- D&C Prime Realty
-- Employee Salary / Payroll Master Plan
-- Batch 8: Formal Finalized Payroll Corrections
-- Prerequisite: Batches 1-7.
-- Corrections preserve Before/After snapshots and require a dedicated permission.

START TRANSACTION;

ALTER TABLE employee_payrolls
  MODIFY COLUMN payroll_status ENUM('draft','finalized','corrected','released','cancelled') NOT NULL DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS employee_payroll_corrections (
  employee_payroll_correction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_payroll_id INT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  before_snapshot_json JSON NOT NULL,
  after_snapshot_json JSON NOT NULL,
  review_hash CHAR(64) NOT NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_payroll_correction_id),
  KEY idx_employee_payroll_correction_payroll (employee_payroll_id, created_at),
  CONSTRAINT fk_employee_payroll_correction_payroll
    FOREIGN KEY (employee_payroll_id) REFERENCES employee_payrolls (employee_payroll_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_employee_payroll_correction_user
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('admin', 'employee_salary.correct_finalized', 1, NULL),
  ('accounting', 'employee_salary.correct_finalized', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, 'employee_salary.correct_finalized', 1, NULL
FROM users u
WHERE u.status = 'active'
  AND u.role IN ('admin', 'accounting')
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

COMMIT;
