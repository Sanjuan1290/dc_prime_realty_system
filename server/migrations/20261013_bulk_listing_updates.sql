-- D&C Prime Realty: non-destructive bulk listing edits and re-survey history.
-- Apply after reviewing a backup; existing buyer contracts are never modified by this migration.
CREATE TABLE IF NOT EXISTS lot_project_listing_bulk_batches (
  batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lot_project_id INT UNSIGNED NOT NULL,
  changed_by_user_id INT UNSIGNED NULL,
  source_filename VARCHAR(255) NULL,
  adjustment_reason VARCHAR(1000) NOT NULL,
  changed_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_listing_bulk_project (lot_project_id, created_at),
  CONSTRAINT fk_listing_bulk_project FOREIGN KEY (lot_project_id) REFERENCES lot_projects(lot_project_id) ON DELETE RESTRICT,
  CONSTRAINT fk_listing_bulk_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lot_project_listing_bulk_rows (
  row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  before_snapshot_json JSON NOT NULL,
  after_snapshot_json JSON NOT NULL,
  changed_fields_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_listing_bulk_listing (lot_project_listing_id, created_at),
  CONSTRAINT fk_listing_bulk_row_batch FOREIGN KEY (batch_id) REFERENCES lot_project_listing_bulk_batches(batch_id) ON DELETE RESTRICT,
  CONSTRAINT fk_listing_bulk_row_listing FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings(lot_project_listing_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
