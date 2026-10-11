-- D&C Prime Realty — Approval/Audit Redesign
-- Batch 4 of 4: exact-payload Department Head approvals for protected changes.
-- Prerequisite: Batches 1-3.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS protected_change_requests (
  protected_change_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_number VARCHAR(40) NULL,
  action_key VARCHAR(120) NOT NULL,
  department ENUM('marketing','sales','accounting','operations') NOT NULL,
  lot_project_id INT UNSIGNED NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  entity_label VARCHAR(255) NULL,
  requested_by_user_id INT UNSIGNED NOT NULL,
  request_payload_json JSON NOT NULL,
  request_payload_hash CHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending','approved','rejected','used','expired','cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by_head_user_id INT UNSIGNED NULL,
  head_note TEXT NULL,
  reviewed_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (protected_change_request_id),
  UNIQUE KEY uq_protected_change_request_number (request_number),
  KEY idx_protected_change_queue (department,status,lot_project_id,created_at),
  KEY idx_protected_change_entity (entity_type,entity_id,status),
  KEY idx_protected_change_requester (requested_by_user_id,status,created_at),
  CONSTRAINT fk_protected_change_project FOREIGN KEY (lot_project_id) REFERENCES lot_projects(lot_project_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_protected_change_requester FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_protected_change_head FOREIGN KEY (reviewed_by_head_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Batch 4 governed business-action permissions. These are deliberately narrow:
-- Staff use them only through exact-payload Head approval; System Admin uses them
-- only when a matching Auditor-approved correction case is supplied.
INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('sales_staff', 'lot_project.reservation.correct', 1, NULL),
  ('accounting_staff', 'lot_project.commissions.adjust', 1, NULL),
  ('accounting_staff', 'lot_project.penalties.correct', 1, NULL),
  ('operations_staff', 'lot_project.settings.manage', 1, NULL),
  ('system_admin', 'lot_project.reservation.correct', 1, NULL),
  ('system_admin', 'lot_project.commissions.adjust', 1, NULL),
  ('system_admin', 'lot_project.penalties.correct', 1, NULL),
  ('system_admin', 'lot_project.settings.manage', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

-- Existing Staff/System Admin accounts keep their other per-account overrides,
-- but receive the newly governed Batch 4 capabilities so the migration is usable
-- without requiring a manual "Reset to Role Default" on every account.
INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, governed.permission_key, 1, NULL
FROM users u
JOIN (
  SELECT 'sales_staff' AS role, 'lot_project.reservation.correct' AS permission_key
  UNION ALL SELECT 'accounting_staff', 'lot_project.commissions.adjust'
  UNION ALL SELECT 'accounting_staff', 'lot_project.penalties.correct'
  UNION ALL SELECT 'operations_staff', 'lot_project.settings.manage'
  UNION ALL SELECT 'system_admin', 'lot_project.reservation.correct'
  UNION ALL SELECT 'system_admin', 'lot_project.commissions.adjust'
  UNION ALL SELECT 'system_admin', 'lot_project.penalties.correct'
  UNION ALL SELECT 'system_admin', 'lot_project.settings.manage'
) governed ON governed.role = u.role
WHERE u.status = 'active'
ON DUPLICATE KEY UPDATE allowed = 1, updated_at = CURRENT_TIMESTAMP;

