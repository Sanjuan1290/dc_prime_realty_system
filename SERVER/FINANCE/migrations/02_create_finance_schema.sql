-- Batch 12 v1: run with USE dc_prime_finance_db; zero-opening-balance ledger.
-- This migration creates new objects only. Never run it on the Realty database.
CREATE TABLE IF NOT EXISTS finance_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','accountant','viewer') NOT NULL DEFAULT 'viewer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_user_email (email)
);
CREATE TABLE IF NOT EXISTS finance_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_finance_session_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES finance_users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS finance_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('income','expense') NOT NULL,
  name VARCHAR(90) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_category (kind,name),
  FOREIGN KEY (created_by) REFERENCES finance_users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS finance_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_date DATE NOT NULL,
  kind ENUM('income','expense') NOT NULL,
  amount DECIMAL(16,2) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(240) NOT NULL,
  notes VARCHAR(1000) NULL,
  status ENUM('posted','void') NOT NULL DEFAULT 'posted',
  source_system VARCHAR(64) NOT NULL DEFAULT 'manual',
  source_transaction_id VARCHAR(180) NULL,
  source_revision_sha256 CHAR(64) NULL,
  corrected_from_transaction_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  voided_by BIGINT UNSIGNED NULL,
  voided_at DATETIME NULL,
  void_reason VARCHAR(500) NULL,
  KEY idx_finance_date (transaction_date,status,kind),
  KEY idx_finance_category (category_id),
  UNIQUE KEY uq_finance_source (source_system,source_transaction_id),
  UNIQUE KEY uq_finance_correction (corrected_from_transaction_id),
  CONSTRAINT chk_finance_amount_positive CHECK (amount > 0),
  FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES finance_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (voided_by) REFERENCES finance_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (corrected_from_transaction_id) REFERENCES finance_transactions(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS finance_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(180) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_finance_audit_date (created_at),
  FOREIGN KEY (actor_user_id) REFERENCES finance_users(id) ON DELETE SET NULL
);
-- Opening balance is fixed at PHP 0.00, calculated from posted transactions only.
-- Batch 13 will add an import batch table and import preview workflow.
