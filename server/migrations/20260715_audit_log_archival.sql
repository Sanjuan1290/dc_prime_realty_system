-- Replaces permanent audit-log delete-all with export-first archival.
-- Run this once against the existing D&C Prime database.

START TRANSACTION;

DROP TABLE IF EXISTS audit_log_deletion_verifications;

CREATE TABLE IF NOT EXISTS audit_log_archive_policy (
  policy_id TINYINT UNSIGNED NOT NULL,
  retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 365,
  updated_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (policy_id),
  CONSTRAINT fk_audit_archive_policy_user
    FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO audit_log_archive_policy (policy_id, retention_days)
VALUES (1, 365);

CREATE TABLE IF NOT EXISTS audit_log_archive_verifications (
  audit_log_archive_verification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  retention_days SMALLINT UNSIGNED NOT NULL,
  cutoff_at DATETIME NOT NULL,
  eligible_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending','used','expired','locked') NOT NULL DEFAULT 'pending',
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  request_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_verification_id),
  KEY idx_audit_archive_verification_user (user_id),
  KEY idx_audit_archive_verification_status (status, expires_at),
  CONSTRAINT fk_audit_archive_verification_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_log_archive_batches (
  audit_log_archive_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  retention_days SMALLINT UNSIGNED NOT NULL,
  cutoff_at DATETIME NOT NULL,
  record_count INT UNSIGNED NOT NULL,
  export_filename VARCHAR(255) NOT NULL,
  export_sha256 CHAR(64) NOT NULL,
  export_csv LONGBLOB NOT NULL,
  archived_by_user_id INT UNSIGNED NULL,
  archived_by_name VARCHAR(255) NULL,
  archived_by_email VARCHAR(150) NULL,
  request_ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_batch_id),
  KEY idx_audit_archive_batch_created (created_at),
  KEY idx_audit_archive_batch_cutoff (cutoff_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs_archive (
  audit_log_archive_record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_log_archive_batch_id BIGINT UNSIGNED NOT NULL,
  original_audit_log_id BIGINT UNSIGNED NOT NULL,
  actor_user_id INT UNSIGNED NULL,
  actor_name VARCHAR(255) NULL,
  actor_email VARCHAR(150) NULL,
  actor_role VARCHAR(80) NULL,
  action VARCHAR(40) NOT NULL,
  module VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id VARCHAR(120) NULL,
  entity_label VARCHAR(255) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  metadata_json JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  audit_log_created_at DATETIME NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_record_id),
  UNIQUE KEY uq_archived_original_audit_log (original_audit_log_id),
  KEY idx_archived_audit_batch (audit_log_archive_batch_id),
  KEY idx_archived_audit_created (audit_log_created_at),
  KEY idx_archived_audit_module (module),
  CONSTRAINT fk_archived_audit_batch
    FOREIGN KEY (audit_log_archive_batch_id) REFERENCES audit_log_archive_batches (audit_log_archive_batch_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_log_archive_events (
  audit_log_archive_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_log_archive_batch_id BIGINT UNSIGNED NULL,
  actor_user_id INT UNSIGNED NULL,
  actor_name VARCHAR(255) NULL,
  actor_email VARCHAR(150) NULL,
  event_type ENUM('archive_created','export_downloaded') NOT NULL,
  record_count INT UNSIGNED NOT NULL DEFAULT 0,
  retention_days SMALLINT UNSIGNED NULL,
  cutoff_at DATETIME NULL,
  export_sha256 CHAR(64) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  event_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_event_id),
  KEY idx_audit_archive_event_batch (audit_log_archive_batch_id),
  KEY idx_audit_archive_event_created (event_created_at),
  CONSTRAINT fk_audit_archive_event_batch
    FOREIGN KEY (audit_log_archive_batch_id) REFERENCES audit_log_archive_batches (audit_log_archive_batch_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

COMMIT;

-- Database guard: active audit rows can only be removed by the archive transaction.
DROP TRIGGER IF EXISTS trg_audit_logs_archive_only_delete;
DELIMITER $$
CREATE TRIGGER trg_audit_logs_archive_only_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  IF COALESCE(@audit_archive_operation, 0) <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Audit logs cannot be deleted. Use the archive workflow.';
  END IF;
END$$
DELIMITER ;

-- Archive records, archive batches, and archive events are append-only.
DROP TRIGGER IF EXISTS trg_audit_logs_archive_no_update;
DROP TRIGGER IF EXISTS trg_audit_logs_archive_no_delete;
DROP TRIGGER IF EXISTS trg_audit_archive_batches_no_update;
DROP TRIGGER IF EXISTS trg_audit_archive_batches_no_delete;
DROP TRIGGER IF EXISTS trg_audit_archive_events_no_update;
DROP TRIGGER IF EXISTS trg_audit_archive_events_no_delete;

DELIMITER $$
CREATE TRIGGER trg_audit_logs_archive_no_update
BEFORE UPDATE ON audit_logs_archive
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Archived audit records are append-only.';
END$$

CREATE TRIGGER trg_audit_logs_archive_no_delete
BEFORE DELETE ON audit_logs_archive
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Archived audit records are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_batches_no_update
BEFORE UPDATE ON audit_log_archive_batches
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive batches are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_batches_no_delete
BEFORE DELETE ON audit_log_archive_batches
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive batches are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_events_no_update
BEFORE UPDATE ON audit_log_archive_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive events are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_events_no_delete
BEFORE DELETE ON audit_log_archive_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive events are append-only.';
END$$
DELIMITER ;

