-- D&C Prime Realty: Archive Management (apply to staging and validate BEFORE production).
-- The original audit archive remains immutable except when a separately authorized
-- application purge transaction sets @audit_archive_purge_operation=1.
-- Always back up and test rollback. Run this file as a MySQL/TiDB-compatible SQL script.
CREATE TABLE IF NOT EXISTS audit_archive_settings (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 archive_days SMALLINT UNSIGNED NOT NULL DEFAULT 180,
 auto_delete_enabled TINYINT(1) NOT NULL DEFAULT 0,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO audit_archive_settings(id,archive_days,auto_delete_enabled) VALUES(1,180,0);

CREATE TABLE IF NOT EXISTS audit_archive_holds (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 batch_id BIGINT UNSIGNED NOT NULL,
 reason TEXT NOT NULL,
 created_by INT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 released_at DATETIME NULL,
 released_by INT UNSIGNED NULL,
 release_reason TEXT NULL,
 KEY idx_archive_hold_batch (batch_id,released_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_archive_purge_codes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 batch_id BIGINT UNSIGNED NOT NULL,
 requested_by INT UNSIGNED NOT NULL,
 reason TEXT NOT NULL,
 code_hash CHAR(64) NOT NULL,
 attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
 status ENUM('pending','used','locked') NOT NULL DEFAULT 'pending',
 expires_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_purge_code_user (requested_by,created_at),
 KEY idx_purge_code_batch (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_archive_purge_receipts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 batch_id BIGINT UNSIGNED NOT NULL,
 record_count INT UNSIGNED NOT NULL,
 event_count INT UNSIGNED NOT NULL,
 file_hash CHAR(64) NOT NULL,
 archive_created_at DATETIME NOT NULL,
 deleted_by INT UNSIGNED NULL,
 reason TEXT NOT NULL,
 verification_id BIGINT UNSIGNED NULL,
 deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_archive_deleted_batch (batch_id),
 KEY idx_archive_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Preserve ordinary immutability: other updates/deletes are still prohibited.
-- This replaces only the three existing archive DELETE guards.
-- SQL clients that do not understand DELIMITER need to execute each CREATE TRIGGER separately.
DROP TRIGGER IF EXISTS trg_audit_logs_archive_no_delete;
DROP TRIGGER IF EXISTS trg_audit_archive_batches_no_delete;
DROP TRIGGER IF EXISTS trg_audit_archive_events_no_delete;
DELIMITER $$
CREATE TRIGGER trg_audit_logs_archive_no_delete BEFORE DELETE ON audit_logs_archive FOR EACH ROW
BEGIN
 IF COALESCE(@audit_archive_purge_operation,0) <> 1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Archived audit entries cannot be deleted outside approved cleanup.';
 END IF;
END$$
CREATE TRIGGER trg_audit_archive_batches_no_delete BEFORE DELETE ON audit_log_archive_batches FOR EACH ROW
BEGIN
 IF COALESCE(@audit_archive_purge_operation,0) <> 1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Archive files cannot be deleted outside approved cleanup.';
 END IF;
END$$
CREATE TRIGGER trg_audit_archive_events_no_delete BEFORE DELETE ON audit_log_archive_events FOR EACH ROW
BEGIN
 IF COALESCE(@audit_archive_purge_operation,0) <> 1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Archive history cannot be deleted outside approved cleanup.';
 END IF;
END$$
DELIMITER ;


