-- Adds bank/payment-provider details used by non-cash payment receipts.
-- Safe to run more than once.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_payment_bank_column_if_missing$$
CREATE PROCEDURE add_payment_bank_column_if_missing(
  IN p_column_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'lot_project_payments'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lot_project_payments'
      AND column_name = p_column_name
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `lot_project_payments` ADD COLUMN `',
      p_column_name,
      '` ',
      p_definition
    );
    PREPARE migration_stmt FROM @migration_sql;
    EXECUTE migration_stmt;
    DEALLOCATE PREPARE migration_stmt;
  END IF;
END$$

DELIMITER ;

CALL add_payment_bank_column_if_missing(
  'lot_project_payment_bank_name',
  'VARCHAR(150) NULL AFTER `lot_project_payment_method`'
);

CALL add_payment_bank_column_if_missing(
  'lot_project_payment_account_number',
  'VARCHAR(100) NULL AFTER `lot_project_payment_bank_name`'
);

DROP PROCEDURE IF EXISTS add_payment_bank_column_if_missing;
