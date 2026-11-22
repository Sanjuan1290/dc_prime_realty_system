-- Finance import undo Admin Override verification.
-- Apply to dc_prime_finance_db if the Finance service cannot create tables at startup.
-- The table stores only a salted hash of the one-time code, never the plaintext code.
USE dc_prime_finance_db;

CREATE TABLE IF NOT EXISTS finance_import_undo_authorizations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  batch_id CHAR(36) NOT NULL,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  review_token_hash CHAR(64) NOT NULL,
  code_salt CHAR(32) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_finance_undo_auth_user_batch_created (admin_user_id,batch_id,created_at),
  KEY idx_finance_undo_auth_batch_actor (batch_id,admin_user_id,consumed_at,expires_at),
  CONSTRAINT fk_finance_undo_auth_batch FOREIGN KEY (batch_id) REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_finance_undo_auth_admin FOREIGN KEY (admin_user_id) REFERENCES finance_users(id) ON DELETE RESTRICT
);
