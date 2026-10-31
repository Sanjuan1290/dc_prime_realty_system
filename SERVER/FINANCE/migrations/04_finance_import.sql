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
