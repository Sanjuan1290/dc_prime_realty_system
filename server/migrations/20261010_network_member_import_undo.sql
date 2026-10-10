-- 2026-10-10: reversible in-house Network Excel imports (new imports only).
-- Non-destructive. Apply before deploying the import/undo API.
CREATE TABLE IF NOT EXISTS network_member_import_batches (
  batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_group_id INT UNSIGNED NOT NULL,
  imported_by_user_id INT UNSIGNED NULL,
  member_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('committed','undone') NOT NULL DEFAULT 'committed',
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  undone_at DATETIME NULL,
  undone_by_user_id INT UNSIGNED NULL,
  INDEX idx_member_import_group (seller_group_id, imported_at),
  INDEX idx_member_import_status (seller_group_id, status),
  CONSTRAINT fk_member_import_actor FOREIGN KEY (imported_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_member_undo_actor FOREIGN KEY (undone_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS network_member_import_items (
  item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  accredited_seller_id INT UNSIGNED NOT NULL,
  member_email VARCHAR(150) NOT NULL,
  import_action VARCHAR(16) NOT NULL,
  user_created TINYINT(1) NOT NULL DEFAULT 0,
  seller_created TINYINT(1) NOT NULL DEFAULT 0,
  before_user_json JSON NULL,
  after_user_json JSON NOT NULL,
  before_seller_json JSON NULL,
  after_seller_json JSON NOT NULL,
  linked_employee_ids_json JSON NULL,
  before_managers_json JSON NULL,
  after_managers_json JSON NOT NULL,
  PRIMARY KEY (item_id),
  UNIQUE KEY uq_member_import_batch_row (batch_id, source_row),
  INDEX idx_member_import_user (user_id, batch_id),
  INDEX idx_member_import_seller (accredited_seller_id, batch_id),
  CONSTRAINT fk_member_import_item_batch FOREIGN KEY (batch_id) REFERENCES network_member_import_batches (batch_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
