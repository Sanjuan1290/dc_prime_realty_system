-- Run against dc_prime_finance_db if the runtime account cannot alter tables.
-- Retain existing ZIP/Excel history and undo support; new imports accept CSV only.
ALTER TABLE finance_import_batches MODIFY COLUMN file_format ENUM('zip','xlsx','csv') NOT NULL;
