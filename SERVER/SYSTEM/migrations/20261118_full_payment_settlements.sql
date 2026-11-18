-- Apply before deploying the Full Payment settlement code. NULL preserves the
-- original treatment of historical Full Payments; no old receipts are repriced.
SET @settlement_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_payments'
    AND COLUMN_NAME = 'lot_project_payment_settlement_json');
SET @settlement_ddl = IF(@settlement_column_exists = 0,
  'ALTER TABLE lot_project_payments ADD COLUMN lot_project_payment_settlement_json JSON NULL', 'SELECT 1');
PREPARE settlement_stmt FROM @settlement_ddl;
EXECUTE settlement_stmt;
DEALLOCATE PREPARE settlement_stmt;
