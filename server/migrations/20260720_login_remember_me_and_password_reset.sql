-- Remember-me session invalidation and secure password-reset codes.
-- Run once on an existing database. The migration is rerunnable.

DELIMITER $$
DROP PROCEDURE IF EXISTS add_auth_version_if_missing$$
CREATE PROCEDURE add_auth_version_if_missing()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'auth_version'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0;
  END IF;
END$$
DELIMITER ;

CALL add_auth_version_if_missing();
DROP PROCEDURE IF EXISTS add_auth_version_if_missing;

CREATE TABLE IF NOT EXISTS user_password_reset_codes (
  user_password_reset_code_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  reset_token_hash CHAR(64) DEFAULT NULL,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME DEFAULT NULL,
  used_at DATETIME DEFAULT NULL,
  status ENUM('pending','verified','used','expired','locked','cancelled') NOT NULL DEFAULT 'pending',
  request_ip VARCHAR(100) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_password_reset_code_id),
  KEY idx_password_reset_user_status (user_id, status, created_at),
  KEY idx_password_reset_expiry (status, expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
