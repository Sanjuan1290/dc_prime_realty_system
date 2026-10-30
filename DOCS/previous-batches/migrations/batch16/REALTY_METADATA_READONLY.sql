-- Batch 16: READ-ONLY source inventory. Intended for the current Realty database.
-- This script makes no database changes. Review schema name in session before running.
SELECT DATABASE() AS current_database, VERSION() AS server_version, @@foreign_key_checks AS foreign_key_checks;
-- Exact table presence is reliable; TABLE_ROWS is an estimate in some engines, not a reconciliation count.
SELECT table_name, table_type, engine, table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
AND table_name IN (
 'attendance_day_settings','attendance_event_participants','attendance_events',
 'employee_attendance_corrections','employee_attendance_records','employee_barcode_sequences',
 'employee_cash_advance_deductions','employee_cash_advances','employee_employment_history',
 'employee_payroll_corrections','employee_payroll_periods','employee_payroll_settings',
 'employee_payroll_signed_receipts','employee_payrolls','employee_rest_day_assignments',
 'employee_work_schedules','employees')
ORDER BY table_name;
-- All declared incoming and outgoing references of HR candidate tables.
SELECT k.table_schema,k.table_name,k.constraint_name,k.column_name,
 k.referenced_table_schema,k.referenced_table_name,k.referenced_column_name
FROM information_schema.key_column_usage k
WHERE k.table_schema = DATABASE()
AND (k.table_name IN (
 'attendance_day_settings','attendance_event_participants','attendance_events',
 'employee_attendance_corrections','employee_attendance_records','employee_barcode_sequences',
 'employee_cash_advance_deductions','employee_cash_advances','employee_employment_history',
 'employee_payroll_corrections','employee_payroll_periods','employee_payroll_settings',
 'employee_payroll_signed_receipts','employee_payrolls','employee_rest_day_assignments',
 'employee_work_schedules','employees')
OR k.referenced_table_name IN (
 'attendance_day_settings','attendance_event_participants','attendance_events',
 'employee_attendance_corrections','employee_attendance_records','employee_barcode_sequences',
 'employee_cash_advance_deductions','employee_cash_advances','employee_employment_history',
 'employee_payroll_corrections','employee_payroll_periods','employee_payroll_settings',
 'employee_payroll_signed_receipts','employee_payrolls','employee_rest_day_assignments',
 'employee_work_schedules','employees'))
ORDER BY k.table_name,k.constraint_name,k.ordinal_position;
-- Confirm HR settings fields still present and keep them intact until proven unused.
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema = DATABASE() AND
 ((table_name='system_settings' AND column_name IN (
  'attendance_default_time_out','attendance_scheduled_time_in','attendance_scheduled_time_out',
  'attendance_break_start','attendance_break_minutes','attendance_regular_work_minutes',
  'attendance_late_after','attendance_red_highlight_after',
  'employee_departments_json','employee_department_codes_json'))
 OR (table_name='company_finance_settings' AND column_name='opening_balance'))
ORDER BY table_name,column_name;
