-- Buyer account retention, cancellation commission settlement, signed Cloudinary files,
-- and Super Admin verified permanent account deletion.
-- Rerunnable and compatible with MySQL safe update mode because backfills use keyed joins.

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DELIMITER $$

DROP PROCEDURE IF EXISTS migration_add_column_if_missing$$
CREATE PROCEDURE migration_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_index_if_missing$$
CREATE PROCEDURE migration_add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND index_name = p_index_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD INDEX `', p_index_name, '` (', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_unique_index_if_missing$$
CREATE PROCEDURE migration_add_unique_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND index_name = p_index_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD UNIQUE INDEX `', p_index_name, '` (', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_drop_index_if_exists$$
CREATE PROCEDURE migration_drop_index_if_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND index_name = p_index_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` DROP INDEX `', p_index_name, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_fk_if_missing$$
CREATE PROCEDURE migration_add_fk_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_constraint_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_reference_table VARCHAR(64),
  IN p_reference_column VARCHAR(64),
  IN p_delete_rule VARCHAR(20)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_reference_table
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = p_table_name
      AND constraint_name = p_constraint_name
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table_name, '` ADD CONSTRAINT `', p_constraint_name,
      '` FOREIGN KEY (`', p_column_name, '`) REFERENCES `', p_reference_table,
      '` (`', p_reference_column, '`) ON DELETE ', p_delete_rule, ' ON UPDATE CASCADE'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_modify_commission_release_status$$
CREATE PROCEDURE migration_modify_commission_release_status()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'lot_project_commission_releases'
  ) THEN
    ALTER TABLE lot_project_commission_releases
      MODIFY COLUMN release_status ENUM(
        'Pending',
        'Eligible',
        'Earned on Cancellation',
        'Released',
        'On Hold',
        'Forfeited on Cancellation',
        'Cancelled'
      ) NOT NULL DEFAULT 'Pending';
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS lot_project_accounts (
  lot_project_account_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_reference VARCHAR(40) NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED DEFAULT NULL,
  lot_project_reservation_history_id BIGINT UNSIGNED DEFAULT NULL,
  buyer_name_snapshot VARCHAR(255) DEFAULT NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  account_status ENUM(
    'active',
    'pending_cancellation',
    'cancelled',
    'closed_fully_paid',
    'deletion_pending'
  ) NOT NULL DEFAULT 'active',
  reservation_date DATETIME DEFAULT NULL,
  cancellation_date DATETIME DEFAULT NULL,
  closed_at DATETIME DEFAULT NULL,
  cash_collected_at_cancellation DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discontinued_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  commissionable_retained_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  commissionable_retained_percent DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  cancellation_reason TEXT,
  settlement_notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_account_id),
  UNIQUE KEY uq_lot_project_account_reference (account_reference),
  UNIQUE KEY uq_lot_project_account_profile (lot_project_client_profile_id),
  KEY idx_lot_project_account_listing_status (lot_project_listing_id, account_status),
  KEY idx_lot_project_account_project_status (lot_project_id, account_status),
  CONSTRAINT fk_lot_project_account_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_lot_project_account_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_lot_project_account_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Keep the migration rerunnable after an earlier draft created this column as NOT NULL.
ALTER TABLE lot_project_accounts
  MODIFY COLUMN lot_project_client_profile_id INT UNSIGNED NULL;

CALL migration_drop_index_if_exists('lot_project_client_profiles', 'uq_listing_client_profile');
CALL migration_add_index_if_missing('lot_project_client_profiles', 'idx_client_profile_listing_status', '`lot_project_listing_id`, `lot_project_client_profile_status`');
CALL migration_drop_index_if_exists('lot_project_commissions', 'uq_commission_seller_per_listing');
CALL migration_add_unique_index_if_missing('lot_project_commissions', 'uq_commission_seller_per_profile', '`lot_project_client_profile_id`, `accredited_seller_id`');

CALL migration_add_column_if_missing('lot_project_listings', 'current_account_id', 'BIGINT UNSIGNED NULL');
CALL migration_add_index_if_missing('lot_project_listings', 'idx_listing_current_account', '`current_account_id`');

CALL migration_add_column_if_missing('lot_project_reservation_history', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_payments', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_payment_schedules', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_client_documents', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_commissions', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_commission_receipts', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_penalty_reliefs', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_soa_statements', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_notification_logs', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_archived_commission_releases', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_buyer_form_links', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_listing_id`');
CALL migration_add_column_if_missing('lot_project_buyer_form_submissions', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_listing_id`');
CALL migration_add_column_if_missing('lot_project_cancelled_sale_archives', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_listing_id`');

CALL migration_add_index_if_missing('lot_project_reservation_history', 'idx_reservation_history_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_payments', 'idx_payment_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_payment_schedules', 'idx_payment_schedule_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_client_documents', 'idx_client_document_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_commissions', 'idx_commission_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_commission_receipts', 'idx_commission_receipt_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_penalty_reliefs', 'idx_penalty_relief_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_soa_statements', 'idx_soa_statement_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_notification_logs', 'idx_notification_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_archived_commission_releases', 'idx_archived_commission_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_buyer_form_links', 'idx_buyer_form_link_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_buyer_form_submissions', 'idx_buyer_form_submission_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_cancelled_sale_archives', 'idx_cancelled_sale_archive_account', '`lot_project_account_id`');

CALL migration_modify_commission_release_status();
CALL migration_add_column_if_missing('lot_project_commission_releases', 'cancellation_earning_reason', 'VARCHAR(255) NULL AFTER `release_status`');
CALL migration_add_column_if_missing('lot_project_commission_releases', 'cancellation_settled_at', 'DATETIME NULL AFTER `cancellation_earning_reason`');

CREATE TABLE IF NOT EXISTS lot_project_client_document_files (
  lot_project_client_document_file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_account_id BIGINT UNSIGNED NOT NULL,
  lot_project_client_document_id INT UNSIGNED NOT NULL,
  cloudinary_asset_id VARCHAR(255) DEFAULT NULL,
  cloudinary_public_id VARCHAR(500) NOT NULL,
  cloudinary_resource_type ENUM('image','raw','video') NOT NULL DEFAULT 'image',
  cloudinary_delivery_type VARCHAR(40) NOT NULL DEFAULT 'authenticated',
  cloudinary_version BIGINT UNSIGNED DEFAULT NULL,
  cloudinary_asset_folder VARCHAR(700) DEFAULT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) DEFAULT NULL,
  file_format VARCHAR(50) DEFAULT NULL,
  file_mime_type VARCHAR(150) DEFAULT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_status ENUM('active','superseded','removed') NOT NULL DEFAULT 'active',
  uploaded_by_user_id INT UNSIGNED DEFAULT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME DEFAULT NULL,
  removal_reason VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (lot_project_client_document_file_id),
  UNIQUE KEY uq_client_document_cloudinary_asset (cloudinary_asset_id),
  KEY idx_client_document_file_account (lot_project_account_id, file_status),
  KEY idx_client_document_file_document (lot_project_client_document_id, file_status),
  CONSTRAINT fk_client_document_file_account
    FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts (lot_project_account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_client_document_file_document
    FOREIGN KEY (lot_project_client_document_id) REFERENCES lot_project_client_documents (lot_project_client_document_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_client_document_file_user
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS destructive_action_verifications (
  destructive_action_verification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  reason TEXT,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  status ENUM('pending','verified','used','expired','locked','cancelled') NOT NULL DEFAULT 'pending',
  request_ip VARCHAR(100) DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (destructive_action_verification_id),
  KEY idx_destructive_verification_user_status (user_id, status, created_at),
  KEY idx_destructive_verification_entity (entity_type, entity_id, status),
  CONSTRAINT fk_destructive_verification_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lot_project_account_purge_events (
  lot_project_account_purge_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  deletion_reference VARCHAR(50) NOT NULL,
  account_id_snapshot BIGINT UNSIGNED NOT NULL,
  account_reference_snapshot VARCHAR(40) NOT NULL,
  lot_project_id_snapshot INT UNSIGNED NOT NULL,
  lot_project_listing_id_snapshot INT UNSIGNED NOT NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  buyer_name_snapshot VARCHAR(255) DEFAULT NULL,
  deletion_reason TEXT NOT NULL,
  requested_by_user_id INT UNSIGNED NOT NULL,
  destructive_action_verification_id BIGINT UNSIGNED NOT NULL,
  deleted_row_counts_json JSON DEFAULT NULL,
  cloudinary_asset_count INT UNSIGNED NOT NULL DEFAULT 0,
  deletion_manifest_hash CHAR(64) DEFAULT NULL,
  purge_status ENUM('requested','processing','completed','failed') NOT NULL DEFAULT 'requested',
  error_message TEXT,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (lot_project_account_purge_event_id),
  UNIQUE KEY uq_account_purge_deletion_reference (deletion_reference),
  KEY idx_account_purge_account_snapshot (account_id_snapshot),
  KEY idx_account_purge_status (purge_status, requested_at),
  CONSTRAINT fk_account_purge_requested_by
    FOREIGN KEY (requested_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_account_purge_verification
    FOREIGN KEY (destructive_action_verification_id) REFERENCES destructive_action_verifications (destructive_action_verification_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One permanent account per existing buyer profile.
INSERT INTO lot_project_accounts (
  account_reference,
  lot_project_id,
  lot_project_listing_id,
  lot_project_client_profile_id,
  lot_project_reservation_history_id,
  buyer_name_snapshot,
  unit_id_snapshot,
  account_status,
  reservation_date,
  cancellation_date,
  closed_at,
  cash_collected_at_cancellation,
  refund_amount,
  discontinued_amount,
  commissionable_retained_amount,
  commissionable_retained_percent,
  cancellation_reason,
  settlement_notes
)
SELECT
  CONCAT('ACC-', YEAR(COALESCE(cp.lot_project_client_profile_created_at, NOW())), '-', LPAD(cp.lot_project_client_profile_id, 6, '0')),
  cp.lot_project_id,
  cp.lot_project_listing_id,
  cp.lot_project_client_profile_id,
  history.lot_project_reservation_history_id,
  cp.buyer_full_name,
  listing.lot_project_listing_unit_id,
  CASE
    WHEN cp.lot_project_client_profile_status = 'cancelled' OR history.reservation_status = 'cancelled' THEN 'cancelled'
    WHEN history.reservation_status = 'pending_for_cancellation' THEN 'pending_cancellation'
    WHEN cp.lot_project_client_profile_status = 'closed' OR listing.lot_project_listing_sold_substatus = 'fully_paid' THEN 'closed_fully_paid'
    ELSE 'active'
  END,
  COALESCE(history.reserved_at, cp.lot_project_client_profile_created_at),
  history.cancelled_at,
  CASE WHEN history.reservation_status = 'cancelled' THEN COALESCE(history.cancelled_at, history.updated_at) ELSE NULL END,
  COALESCE(history.cash_collected_at_cancellation, 0),
  COALESCE(history.refund_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  CASE
    WHEN COALESCE(history.tcp_snapshot, 0) > 0
      THEN LEAST(100, GREATEST(0, ROUND((COALESCE(history.discontinued_amount, 0) / history.tcp_snapshot) * 100, 4)))
    ELSE 0
  END,
  history.cancellation_reason,
  history.cancellation_settlement_notes
FROM lot_project_client_profiles cp
INNER JOIN lot_project_listings listing
  ON listing.lot_project_listing_id = cp.lot_project_listing_id
LEFT JOIN lot_project_reservation_history history
  ON history.lot_project_reservation_history_id = (
    SELECT history2.lot_project_reservation_history_id
    FROM lot_project_reservation_history history2
    WHERE history2.lot_project_client_profile_id = cp.lot_project_client_profile_id
    ORDER BY history2.lot_project_reservation_history_id DESC
    LIMIT 1
  )
LEFT JOIN lot_project_accounts existing
  ON existing.lot_project_client_profile_id = cp.lot_project_client_profile_id
WHERE existing.lot_project_account_id IS NULL;

-- Older database versions deleted live buyer rows after returning a cancelled unit
-- to Available. Keep those surviving reservation/archive snapshots visible as
-- history-only accounts even when the original client profile no longer exists.
INSERT INTO lot_project_accounts (
  account_reference,
  lot_project_id,
  lot_project_listing_id,
  lot_project_client_profile_id,
  lot_project_reservation_history_id,
  buyer_name_snapshot,
  unit_id_snapshot,
  account_status,
  reservation_date,
  cancellation_date,
  closed_at,
  cash_collected_at_cancellation,
  refund_amount,
  discontinued_amount,
  commissionable_retained_amount,
  commissionable_retained_percent,
  cancellation_reason,
  settlement_notes
)
SELECT
  CONCAT('ACC-', YEAR(COALESCE(history.reserved_at, history.created_at, NOW())), '-H', LPAD(history.lot_project_reservation_history_id, 6, '0')),
  history.lot_project_id,
  history.lot_project_listing_id,
  NULL,
  history.lot_project_reservation_history_id,
  history.buyer_name_snapshot,
  history.unit_id_snapshot,
  'cancelled',
  history.reserved_at,
  history.cancelled_at,
  COALESCE(history.sale_data_archived_at, history.cancelled_at, history.updated_at),
  COALESCE(history.cash_collected_at_cancellation, 0),
  COALESCE(history.refund_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  CASE
    WHEN COALESCE(history.tcp_snapshot, 0) > 0
      THEN LEAST(100, GREATEST(0, ROUND((COALESCE(history.discontinued_amount, 0) / history.tcp_snapshot) * 100, 4)))
    ELSE 0
  END,
  history.cancellation_reason,
  history.cancellation_settlement_notes
FROM lot_project_reservation_history history
LEFT JOIN lot_project_accounts existing
  ON existing.lot_project_reservation_history_id = history.lot_project_reservation_history_id
WHERE history.reservation_status = 'cancelled'
  AND existing.lot_project_account_id IS NULL;

UPDATE lot_project_reservation_history history
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = history.lot_project_client_profile_id
SET history.lot_project_account_id = account.lot_project_account_id
WHERE history.lot_project_account_id IS NULL;

UPDATE lot_project_reservation_history history
INNER JOIN lot_project_accounts account
  ON account.lot_project_reservation_history_id = history.lot_project_reservation_history_id
SET history.lot_project_account_id = account.lot_project_account_id
WHERE history.lot_project_account_id IS NULL;

UPDATE lot_project_payments row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_payment_schedules row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_client_documents row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_commissions row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_commission_receipts row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_penalty_reliefs row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_soa_statements row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_notification_logs row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_cancelled_sale_archives archive_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_reservation_history_id = archive_row.lot_project_reservation_history_id
SET archive_row.lot_project_account_id = account.lot_project_account_id
WHERE archive_row.lot_project_account_id IS NULL;

UPDATE lot_project_archived_commission_releases release_row
INNER JOIN lot_project_cancelled_sale_archives archive_row
  ON archive_row.lot_project_cancelled_sale_archive_id = release_row.lot_project_cancelled_sale_archive_id
SET release_row.lot_project_account_id = archive_row.lot_project_account_id
WHERE release_row.lot_project_account_id IS NULL
  AND archive_row.lot_project_account_id IS NOT NULL;

-- Buyer-form records created before account support are attached only when the
-- listing still points to the same active account. Historical unmatched forms
-- stay NULL rather than being assigned to the wrong buyer.
UPDATE lot_project_buyer_form_links form_link
INNER JOIN lot_project_accounts account
  ON account.lot_project_listing_id = form_link.lot_project_listing_id
 AND account.account_status IN ('active', 'pending_cancellation', 'closed_fully_paid')
SET form_link.lot_project_account_id = account.lot_project_account_id
WHERE form_link.lot_project_account_id IS NULL;

UPDATE lot_project_buyer_form_submissions submission
INNER JOIN lot_project_buyer_form_links form_link
  ON form_link.lot_project_buyer_form_link_id = submission.lot_project_buyer_form_link_id
SET submission.lot_project_account_id = form_link.lot_project_account_id
WHERE submission.lot_project_account_id IS NULL
  AND form_link.lot_project_account_id IS NOT NULL;

UPDATE lot_project_listings listing
INNER JOIN lot_project_accounts account
  ON account.lot_project_listing_id = listing.lot_project_listing_id
 AND account.account_status IN ('active', 'pending_cancellation', 'closed_fully_paid')
SET listing.current_account_id = account.lot_project_account_id
WHERE listing.current_account_id IS NULL
  AND listing.lot_project_listing_status <> 'available';

-- Guard retained history from accidental parent deletion. The verified purge
-- removes account-owned rows in child-to-parent order before deleting an account.
CALL migration_add_fk_if_missing('lot_project_listings', 'fk_listing_current_account', 'current_account_id', 'lot_project_accounts', 'lot_project_account_id', 'SET NULL');
CALL migration_add_fk_if_missing('lot_project_reservation_history', 'fk_reservation_history_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_payments', 'fk_payment_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_payment_schedules', 'fk_payment_schedule_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_client_documents', 'fk_client_document_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_commissions', 'fk_commission_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_commission_receipts', 'fk_commission_receipt_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_penalty_reliefs', 'fk_penalty_relief_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_soa_statements', 'fk_soa_statement_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_notification_logs', 'fk_notification_log_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_archived_commission_releases', 'fk_archived_commission_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_buyer_form_links', 'fk_buyer_form_link_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_buyer_form_submissions', 'fk_buyer_form_submission_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_cancelled_sale_archives', 'fk_cancelled_sale_archive_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');

DROP PROCEDURE IF EXISTS migration_add_column_if_missing;
DROP PROCEDURE IF EXISTS migration_add_index_if_missing;
DROP PROCEDURE IF EXISTS migration_add_unique_index_if_missing;
DROP PROCEDURE IF EXISTS migration_drop_index_if_exists;
DROP PROCEDURE IF EXISTS migration_add_fk_if_missing;
DROP PROCEDURE IF EXISTS migration_modify_commission_release_status;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
