-- Apply to the Finance database using its migration credentials if the runtime
-- account lacks CREATE privileges. Startup skips DDL when this table exists.
CREATE TABLE IF NOT EXISTS finance_password_resets (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_finance_password_reset_user FOREIGN KEY (user_id) REFERENCES finance_users(id) ON DELETE CASCADE
);
