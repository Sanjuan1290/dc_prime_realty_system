-- Read-only target HR validation, run against dc_prime_hr_db with SELECT-only user.
SELECT 'employees' AS source,COUNT(*) AS rows FROM employees
UNION ALL SELECT 'employee_payrolls',COUNT(*) FROM employee_payrolls
UNION ALL SELECT 'employee_payroll_periods',COUNT(*) FROM employee_payroll_periods
UNION ALL SELECT 'employee_payroll_signed_receipts',COUNT(*) FROM employee_payroll_signed_receipts
UNION ALL SELECT 'hr_legacy_user_map',COUNT(*) FROM hr_legacy_user_map
UNION ALL SELECT 'hr_audit_logs',COUNT(*) FROM hr_audit_logs
UNION ALL SELECT 'hr_external_realty_user_links',COUNT(*) FROM hr_external_realty_user_links;
SELECT employee_payroll_id,released_date,net_fund_release
FROM employee_payrolls
WHERE payroll_status='released' AND (released_date IS NULL OR released_at IS NULL);
SELECT DATE_FORMAT(released_date,'%Y-%m-%d') AS released_day,
       COUNT(*) AS count_paid, CAST(COALESCE(SUM(net_fund_release),0) AS DECIMAL(18,2)) AS total_paid
FROM employee_payrolls
WHERE payroll_status='released' AND released_date IS NOT NULL AND net_fund_release > 0
GROUP BY released_day ORDER BY released_day;
SELECT malware_scan_status,COUNT(*) AS receipt_count
FROM employee_payroll_signed_receipts GROUP BY malware_scan_status;
SELECT p.employee_payroll_id FROM employee_payroll_signed_receipts r
LEFT JOIN employee_payrolls p ON p.employee_payroll_id=r.employee_payroll_id
WHERE p.employee_payroll_id IS NULL;
SELECT COUNT(*) AS hr_outbox_events FROM hr_outbox_events;
