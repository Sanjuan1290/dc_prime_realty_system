-- Batch 4 — Financial Transaction Hardening
-- Safe for an existing database. This migration does NOT drop or reset data.
--
-- Adds:
--   1) manual cash-advance deduction idempotency key
--   2) one automatic deduction per cash advance per payroll row
--   3) one release row per commission + release stage
--
-- If historical duplicate payroll deductions or commission stages exist, the
-- corresponding UNIQUE KEY statement will fail instead of deleting or merging
-- financial history automatically. Review those duplicates before retrying.

DELIMITER $$

DROP PROCEDURE IF EXISTS batch4_add_column_if_missing$$
CREATE PROCEDURE batch4_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @batch4_sql = CONCAT(
      'ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_definition
    );
    PREPARE batch4_stmt FROM @batch4_sql;
    EXECUTE batch4_stmt;
    DEALLOCATE PREPARE batch4_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS batch4_add_unique_index_if_missing$$
CREATE PROCEDURE batch4_add_unique_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @batch4_sql = CONCAT(
      'ALTER TABLE `', p_table_name, '` ADD UNIQUE KEY `', p_index_name, '` (', p_columns, ')'
    );
    PREPARE batch4_stmt FROM @batch4_sql;
    EXECUTE batch4_stmt;
    DEALLOCATE PREPARE batch4_stmt;
  END IF;
END$$

DELIMITER ;

CALL batch4_add_column_if_missing(
  'employee_cash_advance_deductions',
  'request_key',
  'VARCHAR(80) NULL AFTER `notes`'
);

-- Safe for existing rows because request_key is nullable and historical rows
-- are left NULL.
CALL batch4_add_unique_index_if_missing(
  'employee_cash_advance_deductions',
  'uq_employee_cash_advance_request_key',
  '`employee_cash_advance_id`, `request_key`'
);

-- Preflight: this should return zero rows. If it returns rows, inspect the
-- duplicate automatic payroll deductions before adding the unique key.
SELECT
  employee_cash_advance_id,
  employee_payroll_id,
  COUNT(*) AS duplicate_count
FROM employee_cash_advance_deductions
WHERE employee_payroll_id IS NOT NULL
GROUP BY employee_cash_advance_id, employee_payroll_id
HAVING COUNT(*) > 1;

CALL batch4_add_unique_index_if_missing(
  'employee_cash_advance_deductions',
  'uq_employee_cash_advance_payroll_deduction',
  '`employee_cash_advance_id`, `employee_payroll_id`'
);

-- Preflight: this should return zero rows. If it returns rows, do not delete
-- financial history blindly; review which release row is authoritative.
SELECT
  lot_project_commission_id,
  release_stage,
  COUNT(*) AS duplicate_count
FROM lot_project_commission_releases
GROUP BY lot_project_commission_id, release_stage
HAVING COUNT(*) > 1;

CALL batch4_add_unique_index_if_missing(
  'lot_project_commission_releases',
  'uq_commission_release_stage',
  '`lot_project_commission_id`, `release_stage`'
);

DROP PROCEDURE IF EXISTS batch4_add_column_if_missing;
DROP PROCEDURE IF EXISTS batch4_add_unique_index_if_missing;
