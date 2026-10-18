-- D&C Prime Realty | Manager Replacement History (TiDB Cloud)
-- BACK UP FIRST. Creates tables only; does not alter sellers, reservations or commissions.
-- Run once on staging and confirm permissions before production.
CREATE TABLE IF NOT EXISTS seller_manager_replacements (
  replacement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seller_group_id INT UNSIGNED NOT NULL,
  outgoing_user_id INT UNSIGNED NOT NULL,
  replacement_user_id INT UNSIGNED NOT NULL,
  outgoing_role VARCHAR(40) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_by_user_id INT UNSIGNED NOT NULL,
  verification_id BIGINT UNSIGNED NOT NULL,
  direct_reports_moved INT UNSIGNED NOT NULL,
  impact_snapshot_json JSON NOT NULL,
  operational_review_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_manager_replacement_group (seller_group_id,created_at),
  KEY idx_manager_replacement_outgoing (outgoing_user_id,created_at),
  KEY idx_manager_replacement_incoming (replacement_user_id,created_at),
  CONSTRAINT fk_manager_replace_network FOREIGN KEY (seller_group_id) REFERENCES seller_groups(seller_group_id) ON DELETE RESTRICT,
  CONSTRAINT fk_manager_replace_old FOREIGN KEY (outgoing_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_manager_replace_new FOREIGN KEY (replacement_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_manager_replace_actor FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_manager_replace_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seller_manager_replacement_items (
  replacement_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  replacement_id BIGINT UNSIGNED NOT NULL,
  affected_accredited_seller_id INT UNSIGNED NOT NULL,
  previous_manager_user_id INT UNSIGNED NOT NULL,
  new_manager_user_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_manager_replacement_item (replacement_id,affected_accredited_seller_id),
  KEY idx_manager_replacement_seller (affected_accredited_seller_id),
  CONSTRAINT fk_replacement_item_batch FOREIGN KEY (replacement_id) REFERENCES seller_manager_replacements(replacement_id) ON DELETE RESTRICT,
  CONSTRAINT fk_replacement_item_seller FOREIGN KEY (affected_accredited_seller_id) REFERENCES accredited_sellers(accredited_seller_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
