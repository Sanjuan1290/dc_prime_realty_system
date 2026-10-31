-- STAGING ONLY. Finance schema, no financial records or accounts.
-- Runs on a NEW EMPTY TiDB DATABASE; do not run on Realty or HR.

-- Section: 01_create_finance_db.sql
-- Run as DB administrator only on a dedicated staging instance.
CREATE DATABASE `dc_prime_finance_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
USE `dc_prime_finance_db`;


-- Section: 02_create_finance_schema.sql
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


-- Section: 04_finance_import.sql
-- Batch 13 additive migration. Select dc_prime_finance_db first.
-- Run with Finance APIs stopped in isolated staging, after Batch 12 migration.
-- IMPORTANT: importer accepts up to 1500-character Realty descriptions.
ALTER TABLE finance_transactions MODIFY COLUMN description VARCHAR(1500) NOT NULL;

CREATE TABLE IF NOT EXISTS finance_import_category_mappings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_system VARCHAR(64) NOT NULL,
  source_kind ENUM('income','expense') NOT NULL,
  source_category VARCHAR(200) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NOT NULL,
  approved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_import_category (source_system,source_kind,source_category),
  FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES finance_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_import_batches (
  id CHAR(36) PRIMARY KEY,
  source_system VARCHAR(64) NOT NULL,
  export_id VARCHAR(180) NOT NULL,
  file_name VARCHAR(180) NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  file_format ENUM('zip','xlsx') NOT NULL,
  status ENUM('preview','committed','rejected') NOT NULL DEFAULT 'preview',
  source_from DATE NOT NULL,
  source_to DATE NOT NULL,
  source_generated_at VARCHAR(40) NOT NULL,
  manifest_json JSON NOT NULL,
  total_rows INT UNSIGNED NOT NULL,
  selected_money_in DECIMAL(16,2) NOT NULL,
  selected_money_out DECIMAL(16,2) NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  committed_by BIGINT UNSIGNED NULL,
  committed_at DATETIME NULL,
  result_json JSON NULL,
  KEY idx_finance_import_file_hash (file_sha256),
  KEY idx_finance_import_status (status,created_at),
  FOREIGN KEY (created_by) REFERENCES finance_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (committed_by) REFERENCES finance_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS finance_import_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id CHAR(36) NOT NULL,
  `row_number` INT UNSIGNED NOT NULL,
  source_system VARCHAR(64) NOT NULL,
  source_transaction_id VARCHAR(180) NOT NULL,
  source_revision_sha256 CHAR(64) NOT NULL,
  source_category VARCHAR(200) NOT NULL,
  source_kind ENUM('income','expense') NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  decision ENUM('new','duplicate','conflict','unmapped','imported') NOT NULL,
  transaction_id BIGINT UNSIGNED NULL,
  source_row_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_import_row (batch_id,`row_number`),
  KEY idx_finance_import_source (source_system,source_transaction_id),
  FOREIGN KEY (batch_id) REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE RESTRICT
);
-- finance_transactions.uq_finance_source guarantees at most one ledger entry per source identity.
-- finance_import_items keeps the full source row, mapping, and per-file decision.

