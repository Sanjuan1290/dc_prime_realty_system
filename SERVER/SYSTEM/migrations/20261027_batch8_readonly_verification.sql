-- Execute against restored Realty staging after additive migration, before cutover.
SELECT COUNT(*) AS received_event_count FROM finance_external_salary_event_inbox;
SELECT COUNT(*) AS projected_salary_count,COALESCE(SUM(amount),0) AS projected_salary_total FROM finance_external_salary_entries;
SELECT COUNT(*) AS original_released_salary_count,COALESCE(SUM(net_fund_release),0) AS original_released_salary_total
FROM employee_payrolls WHERE payroll_status='released' AND released_date IS NOT NULL AND net_fund_release > 0;
SELECT reconciled_through_date,reconciled_at,cash_advances_to_review,notes FROM finance_hr_sync_state WHERE id=1;
SELECT COUNT(*) AS orphaned_projection_count FROM finance_external_salary_entries e LEFT JOIN finance_external_salary_event_inbox i ON i.event_id=e.event_id WHERE i.event_id IS NULL;
-- Manually compare per-date and per-ID counts, posted dates and totals. Do not auto-toggle to external mode.
