-- Review Center batch relationships: TiDB and MySQL, safe to rerun.
-- Select the SYSTEM database first (for example, USE dc_prime_realty_system_db).
-- Run this whole file, in order, in one SQL connection.
-- TiDB validates each ALTER against the starting table definition. New columns,
-- indexes and foreign keys must therefore be created in SEPARATE statements.
-- Metadata guards allow resuming an interrupted or partially applied migration.
-- Existing reviews, cases, decisions and historical snapshots are never rewritten.
-- No stored procedures, DELIMITER directives, or disabled foreign-key checks.

-- 1. Create every column before any new index or foreign key references it.

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_batches'
      AND COLUMN_NAME = 'operational_review_id'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_batches ADD COLUMN operational_review_id BIGINT UNSIGNED NULL'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_batches'
      AND COLUMN_NAME = 'changed_field_count'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_batches ADD COLUMN changed_field_count INT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_batches'
      AND COLUMN_NAME = 'submission_key'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_batches ADD COLUMN submission_key VARCHAR(64) NULL'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND COLUMN_NAME = 'review_status'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD COLUMN review_status VARCHAR(32) NOT NULL DEFAULT ''pending'''
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND COLUMN_NAME = 'reviewed_by_user_id'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD COLUMN reviewed_by_user_id INT UNSIGNED NULL'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND COLUMN_NAME = 'reviewed_at'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD COLUMN reviewed_at DATETIME NULL'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND COLUMN_NAME = 'review_note'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD COLUMN review_note TEXT NULL'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND COLUMN_NAME = 'operational_review_id'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD COLUMN operational_review_id BIGINT UNSIGNED NULL'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND COLUMN_NAME = 'audit_case_id'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD COLUMN audit_case_id BIGINT UNSIGNED NULL'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

-- 2. Index only columns that now exist. Preserve existing indexes on retries.

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_batches'
      AND INDEX_NAME = 'uq_listing_bulk_review'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_batches ADD UNIQUE KEY uq_listing_bulk_review (operational_review_id)'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_batches'
      AND INDEX_NAME = 'uq_listing_bulk_submission'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_batches ADD UNIQUE KEY uq_listing_bulk_submission (lot_project_id,changed_by_user_id,submission_key)'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND INDEX_NAME = 'uq_listing_bulk_row_review'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD UNIQUE KEY uq_listing_bulk_row_review (operational_review_id)'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND INDEX_NAME = 'uq_listing_bulk_row_case'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD UNIQUE KEY uq_listing_bulk_row_case (audit_case_id)'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND INDEX_NAME = 'idx_listing_bulk_review_queue'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD KEY idx_listing_bulk_review_queue (batch_id,review_status,row_id)'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

-- 3. Add each relationship separately, after its column and index exist.

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_batches'
      AND CONSTRAINT_NAME = 'fk_listing_bulk_review' AND CONSTRAINT_TYPE = 'FOREIGN KEY'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_batches ADD CONSTRAINT fk_listing_bulk_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE RESTRICT'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND CONSTRAINT_NAME = 'fk_listing_bulk_row_review' AND CONSTRAINT_TYPE = 'FOREIGN KEY'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD CONSTRAINT fk_listing_bulk_row_review FOREIGN KEY (operational_review_id) REFERENCES operational_reviews(operational_review_id) ON DELETE RESTRICT'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'lot_project_listing_bulk_rows'
      AND CONSTRAINT_NAME = 'fk_listing_bulk_row_case' AND CONSTRAINT_TYPE = 'FOREIGN KEY'),
  'SELECT 1',
  'ALTER TABLE lot_project_listing_bulk_rows ADD CONSTRAINT fk_listing_bulk_row_case FOREIGN KEY (audit_case_id) REFERENCES audit_cases(audit_case_id) ON DELETE RESTRICT'
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

-- 4. Append the new approval state only if it has not already been enabled.

SET @review_batch_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'protected_change_requests'
      AND COLUMN_NAME = 'status' AND LOCATE('''returned''', COLUMN_TYPE) > 0),
  'SELECT 1',
  'ALTER TABLE protected_change_requests MODIFY COLUMN status ENUM(''pending'',''approved'',''rejected'',''used'',''expired'',''cancelled'',''returned'') NOT NULL DEFAULT ''pending'''
);
PREPARE review_batch_stmt FROM @review_batch_ddl;
EXECUTE review_batch_stmt;
DEALLOCATE PREPARE review_batch_stmt;

-- Completion checks: expect 9 columns, 5 named indexes and 3 foreign keys.
SELECT 'review_batch_columns' AS migration_check, COUNT(*) AS installed, 9 AS expected
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND (
  (TABLE_NAME = 'lot_project_listing_bulk_batches' AND COLUMN_NAME IN ('operational_review_id','changed_field_count','submission_key')) OR
  (TABLE_NAME = 'lot_project_listing_bulk_rows' AND COLUMN_NAME IN ('review_status','reviewed_by_user_id','reviewed_at','review_note','operational_review_id','audit_case_id'))
);
SELECT 'review_batch_indexes' AS migration_check, COUNT(DISTINCT TABLE_NAME, INDEX_NAME) AS installed, 5 AS expected
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND (
  (TABLE_NAME = 'lot_project_listing_bulk_batches' AND INDEX_NAME IN ('uq_listing_bulk_review','uq_listing_bulk_submission')) OR
  (TABLE_NAME = 'lot_project_listing_bulk_rows' AND INDEX_NAME IN ('uq_listing_bulk_row_review','uq_listing_bulk_row_case','idx_listing_bulk_review_queue'))
);
SELECT 'review_batch_foreign_keys' AS migration_check, COUNT(*) AS installed, 3 AS expected
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND (
  (TABLE_NAME = 'lot_project_listing_bulk_batches' AND CONSTRAINT_NAME = 'fk_listing_bulk_review') OR
  (TABLE_NAME = 'lot_project_listing_bulk_rows' AND CONSTRAINT_NAME IN ('fk_listing_bulk_row_review','fk_listing_bulk_row_case'))
);
SELECT 'review_batch_returned_state' AS migration_check, COUNT(*) AS installed, 1 AS expected
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'protected_change_requests'
  AND COLUMN_NAME = 'status' AND LOCATE('''returned''', COLUMN_TYPE) > 0;
