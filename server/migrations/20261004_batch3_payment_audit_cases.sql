-- D&C Prime Realty — Approval/Audit Redesign
-- Batch 3 of 4: Audit Cases and Accounting Payment review pilot.
-- Prerequisite: Batch 1 + Batch 2.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS audit_cases (
  audit_case_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_number VARCHAR(40) NULL,
  operational_review_id BIGINT UNSIGNED NOT NULL,
  opened_by_auditor_user_id INT UNSIGNED NOT NULL,
  finding TEXT NOT NULL,
  status ENUM('awaiting_head_response','under_auditor_review','finding_invalid','pending_system_admin_correction','pending_auditor_recheck','closed') NOT NULL DEFAULT 'awaiting_head_response',
  head_response TEXT NULL,
  head_responded_by_user_id INT UNSIGNED NULL,
  head_responded_at DATETIME NULL,
  auditor_resolution TEXT NULL,
  auditor_resolved_by_user_id INT UNSIGNED NULL,
  auditor_resolved_at DATETIME NULL,
  system_admin_user_id INT UNSIGNED NULL,
  correction_summary TEXT NULL,
  correction_applied_at DATETIME NULL,
  final_verified_by_auditor_user_id INT UNSIGNED NULL,
  final_verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_case_id),
  UNIQUE KEY uq_audit_case_number (case_number),
  KEY idx_audit_case_review (operational_review_id,status),
  KEY idx_audit_case_status (status,created_at),
  CONSTRAINT fk_audit_case_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_audit_case_opened_by FOREIGN KEY (opened_by_auditor_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_audit_case_head FOREIGN KEY (head_responded_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_audit_case_resolved_by FOREIGN KEY (auditor_resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_audit_case_system_admin FOREIGN KEY (system_admin_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_audit_case_final_auditor FOREIGN KEY (final_verified_by_auditor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

ALTER TABLE internal_notifications
  ADD CONSTRAINT fk_internal_notification_case FOREIGN KEY (audit_case_id) REFERENCES audit_cases(audit_case_id) ON DELETE CASCADE ON UPDATE CASCADE;

