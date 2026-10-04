-- Cancellation settlement values and compatibility archives for financial reports.
-- The current account-retention flow keeps live rows; these archives remain for
-- SQL markers for review tools: ADD COLUMN refund_amount DECIMAL(14,2)
-- SQL markers for review tools: ADD COLUMN discontinued_amount DECIMAL(14,2)
-- installations that already use archived seller-income reports.

DELIMITER $$
DROP PROCEDURE IF EXISTS add_cancellation_column_if_missing$$
CREATE PROCEDURE add_cancellation_column_if_missing(IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lot_project_reservation_history'
      AND column_name = p_column
  ) THEN
    SET @statement = CONCAT('ALTER TABLE lot_project_reservation_history ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE migration_stmt FROM @statement;
    EXECUTE migration_stmt;
    DEALLOCATE PREPARE migration_stmt;
  END IF;
END$$
DELIMITER ;

CALL add_cancellation_column_if_missing('cancellation_refund_type', "ENUM('no_refund','partial_refund','full_refund') NULL");
CALL add_cancellation_column_if_missing('cash_collected_at_cancellation', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00');
CALL add_cancellation_column_if_missing('refund_amount', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00');
CALL add_cancellation_column_if_missing('discontinued_amount', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00');
CALL add_cancellation_column_if_missing('refund_date', 'DATE NULL');
CALL add_cancellation_column_if_missing('refund_reference', 'VARCHAR(150) NULL');
CALL add_cancellation_column_if_missing('cancellation_settlement_notes', 'TEXT NULL');
CALL add_cancellation_column_if_missing('released_commission_amount_at_cancellation', 'DECIMAL(14,2) NOT NULL DEFAULT 0.00');
CALL add_cancellation_column_if_missing('sale_data_archived_at', 'DATETIME NULL');
DROP PROCEDURE IF EXISTS add_cancellation_column_if_missing;

CREATE TABLE IF NOT EXISTS lot_project_cancelled_sale_archives (
  lot_project_cancelled_sale_archive_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_reservation_history_id BIGINT UNSIGNED NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  buyer_name_snapshot VARCHAR(255) DEFAULT NULL,
  cash_collected_at_cancellation DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discontinued_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  released_commission_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  buyer_profile_snapshot JSON DEFAULT NULL,
  payment_snapshot JSON DEFAULT NULL,
  payment_schedule_snapshot JSON DEFAULT NULL,
  payment_allocation_snapshot JSON DEFAULT NULL,
  payment_log_snapshot JSON DEFAULT NULL,
  penalty_relief_snapshot JSON DEFAULT NULL,
  client_document_snapshot JSON DEFAULT NULL,
  commission_snapshot JSON DEFAULT NULL,
  commission_release_snapshot JSON DEFAULT NULL,
  commission_receipt_snapshot JSON DEFAULT NULL,
  commission_receipt_item_snapshot JSON DEFAULT NULL,
  archived_by_user_id INT UNSIGNED DEFAULT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_cancelled_sale_archive_id),
  UNIQUE KEY uq_cancelled_sale_archive_history (lot_project_reservation_history_id),
  KEY idx_cancelled_sale_archive_project (lot_project_id, archived_at),
  KEY idx_cancelled_sale_archive_listing (lot_project_listing_id, archived_at),
  CONSTRAINT fk_cancelled_sale_archive_history FOREIGN KEY (lot_project_reservation_history_id)
    REFERENCES lot_project_reservation_history (lot_project_reservation_history_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cancelled_sale_archive_listing FOREIGN KEY (lot_project_listing_id)
    REFERENCES lot_project_listings (lot_project_listing_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cancelled_sale_archive_project FOREIGN KEY (lot_project_id)
    REFERENCES lot_projects (lot_project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cancelled_sale_archive_user FOREIGN KEY (archived_by_user_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lot_project_archived_commission_releases (
  lot_project_archived_commission_release_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_cancelled_sale_archive_id BIGINT UNSIGNED NOT NULL,
  lot_project_reservation_history_id BIGINT UNSIGNED NOT NULL,
  source_commission_release_id INT UNSIGNED NOT NULL,
  source_commission_id INT UNSIGNED NOT NULL,
  source_commission_receipt_id INT UNSIGNED DEFAULT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED DEFAULT NULL,
  accredited_seller_id INT UNSIGNED NOT NULL,
  sale_owner_accredited_seller_id INT UNSIGNED DEFAULT NULL,
  project_name_snapshot VARCHAR(255) NOT NULL,
  project_location_snapshot VARCHAR(255) DEFAULT NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  buyer_name_snapshot VARCHAR(255) DEFAULT NULL,
  commission_role VARCHAR(50) NOT NULL,
  commission_seller_type VARCHAR(50) NOT NULL,
  commission_rate_type VARCHAR(50) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  gross_commission_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  release_stage VARCHAR(50) NOT NULL,
  release_trigger_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  release_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  gross_release_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  deduction_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  net_release_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  actual_release_date DATE NOT NULL,
  receipt_date DATE DEFAULT NULL,
  receipt_reference_number VARCHAR(150) DEFAULT NULL,
  receipt_bank_name VARCHAR(150) DEFAULT NULL,
  receipt_account_number VARCHAR(100) DEFAULT NULL,
  receipt_witness_name VARCHAR(255) DEFAULT NULL,
  receipt_total_amount DECIMAL(14,2) DEFAULT NULL,
  receipt_status VARCHAR(20) DEFAULT NULL,
  receipt_created_by_name VARCHAR(255) DEFAULT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_archived_commission_release_id),
  UNIQUE KEY uq_archived_commission_source_release (source_commission_release_id),
  KEY idx_archived_commission_seller_date (accredited_seller_id, actual_release_date),
  CONSTRAINT fk_archived_commission_history FOREIGN KEY (lot_project_reservation_history_id)
    REFERENCES lot_project_reservation_history (lot_project_reservation_history_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_archived_commission_sale_archive FOREIGN KEY (lot_project_cancelled_sale_archive_id)
    REFERENCES lot_project_cancelled_sale_archives (lot_project_cancelled_sale_archive_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
