-- Select dc_prime_finance_db in your SQL client first.
-- Read-only staging checks; never use on Realty production data.
SELECT DATABASE() AS selected_database;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'dc_prime_finance_db' AND table_name LIKE 'finance_%'
ORDER BY table_name;
SELECT COUNT(*) AS users_count FROM finance_users;
SELECT COUNT(*) AS transactions_count FROM finance_transactions;
SELECT COUNT(*) AS invalid_amounts FROM finance_transactions WHERE amount <= 0;
SELECT COUNT(*) AS external_sources FROM finance_transactions WHERE source_system <> 'manual';
SELECT COALESCE(SUM(CASE WHEN kind='income' THEN amount ELSE -amount END),0) AS closing_balance_php
FROM finance_transactions WHERE status='posted';
SELECT COUNT(*) AS invalid_categories FROM finance_transactions t
JOIN finance_categories c ON c.id=t.category_id WHERE c.kind <> t.kind;
