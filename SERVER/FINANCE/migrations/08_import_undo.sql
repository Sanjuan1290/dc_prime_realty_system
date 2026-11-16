-- Additive upgrade for live Finance. Apply once if startup cannot ALTER tables.
-- Existing ledger records, imported source identities and audit history remain.
USE dc_prime_finance_db;
ALTER TABLE finance_import_batches
 MODIFY COLUMN status ENUM('preview','committed','rejected','undone') NOT NULL DEFAULT 'preview',
 ADD COLUMN undone_by BIGINT UNSIGNED NULL,
 ADD COLUMN undone_at DATETIME NULL,
 ADD COLUMN undo_reason VARCHAR(500) NULL,
 ADD COLUMN undo_result_json JSON NULL;
ALTER TABLE finance_import_items
 MODIFY COLUMN decision ENUM('new','restore','duplicate','conflict','unmapped','imported') NOT NULL;
ALTER TABLE finance_categories MODIFY COLUMN name VARCHAR(200) NOT NULL;
CREATE TABLE IF NOT EXISTS finance_import_mutex (id TINYINT UNSIGNED NOT NULL PRIMARY KEY);
INSERT IGNORE INTO finance_import_mutex(id) VALUES(1);
