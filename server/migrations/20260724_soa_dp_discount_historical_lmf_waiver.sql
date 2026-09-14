-- Correct DP discount storage, permit controlled historical encoding, and add
-- an auditable waiver for Legal / Misc Fees that are separate SOA rows.

DELIMITER $$

DROP PROCEDURE IF EXISTS migration_20260724_add_column_if_missing$$
CREATE PROCEDURE migration_20260724_add_column_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_column_name VARCHAR(128),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'),
      '` ', p_definition
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CALL migration_20260724_add_column_if_missing(
  'lot_project_payment_schedules',
  'discount_amount',
  'DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER `monthly_amortization_amount`'
);

CALL migration_20260724_add_column_if_missing(
  'lot_project_client_profiles',
  'soa_is_historical_entry',
  'TINYINT(1) NOT NULL DEFAULT 0 AFTER `soa_first_due_date`'
);
CALL migration_20260724_add_column_if_missing(
  'lot_project_client_profiles',
  'soa_lmf_waived_amount',
  'DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER `soa_legal_misc_fee_amount`'
);
CALL migration_20260724_add_column_if_missing(
  'lot_project_client_profiles',
  'soa_lmf_waiver_reason',
  'TEXT NULL AFTER `soa_lmf_waived_amount`'
);
CALL migration_20260724_add_column_if_missing(
  'lot_project_client_profiles',
  'soa_lmf_waiver_reference',
  'VARCHAR(150) NULL AFTER `soa_lmf_waiver_reason`'
);
CALL migration_20260724_add_column_if_missing(
  'lot_project_client_profiles',
  'soa_lmf_waived_by_user_id',
  'INT UNSIGNED NULL AFTER `soa_lmf_waiver_reference`'
);
CALL migration_20260724_add_column_if_missing(
  'lot_project_client_profiles',
  'soa_lmf_waived_at',
  'DATETIME NULL AFTER `soa_lmf_waived_by_user_id`'
);

CREATE TABLE IF NOT EXISTS lot_project_contract_adjustments (
  lot_project_contract_adjustment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NOT NULL,
  lot_project_account_id BIGINT UNSIGNED NULL,
  lot_project_payment_schedule_id INT UNSIGNED NULL,
  adjustment_type ENUM('lmf_waiver') NOT NULL,
  original_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  adjustment_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  reason TEXT NOT NULL,
  approval_reference VARCHAR(150) NULL,
  internal_notes TEXT NULL,
  approved_by_user_id INT UNSIGNED NOT NULL,
  approved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','reversed') NOT NULL DEFAULT 'active',
  reversed_by_user_id INT UNSIGNED NULL,
  reversed_at DATETIME NULL,
  reversal_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_contract_adjustment_id),
  KEY idx_contract_adjustment_project (lot_project_id),
  KEY idx_contract_adjustment_listing (lot_project_listing_id),
  KEY idx_contract_adjustment_profile (lot_project_client_profile_id),
  KEY idx_contract_adjustment_account (lot_project_account_id),
  KEY idx_contract_adjustment_schedule (lot_project_payment_schedule_id),
  KEY idx_contract_adjustment_approved_by (approved_by_user_id),
  CONSTRAINT fk_contract_adjustment_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_contract_adjustment_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_contract_adjustment_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_contract_adjustment_account
    FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts (lot_project_account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_contract_adjustment_schedule
    FOREIGN KEY (lot_project_payment_schedule_id) REFERENCES lot_project_payment_schedules (lot_project_payment_schedule_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_contract_adjustment_approved_by
    FOREIGN KEY (approved_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_contract_adjustment_reversed_by
    FOREIGN KEY (reversed_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Mark existing accounts with past starting dates as historical so the Edit SOA
-- modal keeps accepting their saved date range.
UPDATE lot_project_client_profiles
SET soa_is_historical_entry = 1
WHERE soa_starting_date IS NOT NULL
  AND soa_starting_date < CURRENT_DATE();

DROP PROCEDURE IF EXISTS migration_20260724_add_column_if_missing;
