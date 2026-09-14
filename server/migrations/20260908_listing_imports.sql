-- Lot Project listing Excel import batches and reversible import history.
-- Apply this migration before enabling the Listings > Import Excel feature.

CREATE TABLE IF NOT EXISTS lot_project_listing_import_batches (
  lot_project_listing_import_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_reference VARCHAR(40) NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_sha256 CHAR(64) NULL,
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  valid_rows INT UNSIGNED NOT NULL DEFAULT 0,
  imported_rows INT UNSIGNED NOT NULL DEFAULT 0,
  removed_rows INT UNSIGNED NOT NULL DEFAULT 0,
  import_status ENUM('validated','imported','partially_reverted','reverted','failed') NOT NULL DEFAULT 'validated',
  imported_by_user_id INT UNSIGNED NULL,
  imported_at DATETIME NULL,
  reverted_by_user_id INT UNSIGNED NULL,
  reverted_at DATETIME NULL,
  revert_reason VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_listing_import_batch_id),
  UNIQUE KEY uq_listing_import_batch_reference (batch_reference),
  KEY idx_listing_import_project_created (lot_project_id, created_at),
  KEY idx_listing_import_status (import_status),
  CONSTRAINT fk_listing_import_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_listing_import_user
    FOREIGN KEY (imported_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_listing_import_reverted_user
    FOREIGN KEY (reverted_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE lot_project_listings
  ADD COLUMN IF NOT EXISTS created_from_import_batch_id BIGINT UNSIGNED NULL AFTER current_account_id;

CREATE INDEX IF NOT EXISTS idx_listing_import_batch
  ON lot_project_listings (created_from_import_batch_id);

CREATE TABLE IF NOT EXISTS lot_project_listing_import_rows (
  lot_project_listing_import_row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_listing_import_batch_id BIGINT UNSIGNED NOT NULL,
  excel_row_number INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  original_input_json JSON NULL,
  normalized_input_json JSON NULL,
  validation_status ENUM('valid','invalid','imported','removed') NOT NULL DEFAULT 'valid',
  validation_errors_json JSON NULL,
  imported_at DATETIME NULL,
  removed_at DATETIME NULL,
  removed_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_listing_import_row_id),
  UNIQUE KEY uq_listing_import_batch_excel_row (lot_project_listing_import_batch_id, excel_row_number),
  KEY idx_listing_import_row_listing (lot_project_listing_id),
  KEY idx_listing_import_row_status (lot_project_listing_import_batch_id, validation_status),
  CONSTRAINT fk_listing_import_row_batch
    FOREIGN KEY (lot_project_listing_import_batch_id)
    REFERENCES lot_project_listing_import_batches (lot_project_listing_import_batch_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_listing_import_row_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_listing_import_row_removed_user
    FOREIGN KEY (removed_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

