-- READ ONLY: checks schema and actual row counts after fresh-start creation.
USE `dc_prime_finance_db`;
SELECT DATABASE() AS database_name;
SELECT COUNT(*) AS found_table_count, 8 AS expected_table_count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE';
SELECT
  (SELECT COUNT(*) FROM `finance_users`)
  + (SELECT COUNT(*) FROM `finance_sessions`)
  + (SELECT COUNT(*) FROM `finance_categories`)
  + (SELECT COUNT(*) FROM `finance_transactions`)
  + (SELECT COUNT(*) FROM `finance_audit_logs`)
  + (SELECT COUNT(*) FROM `finance_import_category_mappings`)
  + (SELECT COUNT(*) FROM `finance_import_batches`)
  + (SELECT COUNT(*) FROM `finance_import_items`)
  AS total_rows_across_all_tables;
