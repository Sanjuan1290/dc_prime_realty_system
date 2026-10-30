-- Apply once to TiDB Cloud after reviewing on staging. No existing records are removed.
CREATE TABLE IF NOT EXISTS network_member_bulk_edit_batches (
 batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 seller_group_id INT UNSIGNED NOT NULL,
 actor_user_id INT UNSIGNED NOT NULL,
 reason VARCHAR(500) NOT NULL,
 request_key CHAR(36) NOT NULL,
 snapshot_hash CHAR(64) NOT NULL,
 changed_count INT UNSIGNED NOT NULL,
 operational_review_id BIGINT UNSIGNED DEFAULT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(batch_id), UNIQUE KEY uq_bulk_request_key(request_key),
 KEY idx_bulk_network(seller_group_id,created_at),
 CONSTRAINT fk_bulk_network FOREIGN KEY(seller_group_id) REFERENCES seller_groups(seller_group_id) ON DELETE RESTRICT,
 CONSTRAINT fk_bulk_actor FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS network_member_bulk_edit_items (
 item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 batch_id BIGINT UNSIGNED NOT NULL,
 accredited_seller_id INT UNSIGNED NOT NULL,
 previous_manager_user_id INT UNSIGNED DEFAULT NULL,
 new_manager_user_id INT UNSIGNED NOT NULL,
 PRIMARY KEY(item_id), UNIQUE KEY uq_bulk_member(batch_id,accredited_seller_id),
 KEY idx_bulk_seller(accredited_seller_id),
 CONSTRAINT fk_bulk_item_batch FOREIGN KEY(batch_id) REFERENCES network_member_bulk_edit_batches(batch_id) ON DELETE RESTRICT,
 CONSTRAINT fk_bulk_item_seller FOREIGN KEY(accredited_seller_id) REFERENCES accredited_sellers(accredited_seller_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS seller_manager_replacement_reversals (
 reversal_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 replacement_id BIGINT UNSIGNED NOT NULL,
 seller_group_id INT UNSIGNED NOT NULL,
 actor_user_id INT UNSIGNED NOT NULL,
 reason VARCHAR(500) NOT NULL,
 request_key CHAR(36) NOT NULL,
 snapshot_hash CHAR(64) NOT NULL,
 restored_count INT UNSIGNED NOT NULL,
 operational_review_id BIGINT UNSIGNED DEFAULT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(reversal_id), UNIQUE KEY uq_reversed_replacement(replacement_id),
 UNIQUE KEY uq_reversal_request(request_key), KEY idx_restore_group(seller_group_id,created_at),
 CONSTRAINT fk_restore_replacement FOREIGN KEY(replacement_id) REFERENCES seller_manager_replacements(replacement_id) ON DELETE RESTRICT,
 CONSTRAINT fk_restore_network FOREIGN KEY(seller_group_id) REFERENCES seller_groups(seller_group_id) ON DELETE RESTRICT,
 CONSTRAINT fk_restore_actor FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

