-- Apply to the HR database using its migration credentials before deployment.
-- The HR runtime does not change schema or require DDL privileges.
CREATE TABLE IF NOT EXISTS hr_password_resets (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hr_password_reset_user FOREIGN KEY (user_id) REFERENCES hr_users(id) ON DELETE CASCADE
);
