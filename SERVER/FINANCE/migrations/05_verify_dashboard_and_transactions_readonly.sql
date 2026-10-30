-- READ-ONLY FINANCE DIAGNOSTIC. Never run on another database.
USE dc_prime_finance_db;
SELECT DATABASE() AS active_database;
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = 'dc_prime_finance_db'
 AND TABLE_NAME IN ('finance_transactions','finance_categories','finance_audit_logs')
 ORDER BY TABLE_NAME, ORDINAL_POSITION;
SELECT COUNT(*) AS transaction_count FROM finance_transactions;
SELECT COUNT(*) AS category_count FROM finance_categories;
-- Reproduce transactions page's SQL without changing records:
SELECT t.id, DATE_FORMAT(t.transaction_date,'%Y-%m-%d') AS transaction_date,
 t.kind,t.amount,t.description,t.notes,t.status,t.source_system,
 t.source_transaction_id,t.corrected_from_transaction_id,t.void_reason,
 t.created_at,c.name AS category_name,c.id AS category_id
 FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id
 WHERE t.transaction_date BETWEEN '2026-10-01' AND '2026-10-30'
 AND t.status='posted'
 ORDER BY t.transaction_date DESC,t.id DESC LIMIT 50 OFFSET 0;
