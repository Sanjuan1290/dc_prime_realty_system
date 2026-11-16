-- Manual rollout alternative when the service account has no ALTER privilege.
-- Run once before deployment. Existing passwords are preserved.
USE dc_prime_finance_db;
ALTER TABLE finance_users
 ADD COLUMN must_change_password TINYINT NOT NULL DEFAULT 0,
 ADD COLUMN temporary_password_expires_at DATETIME NULL,
 ADD COLUMN invitation_sent_at DATETIME NULL;
