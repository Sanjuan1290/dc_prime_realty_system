-- Read-only staging verification after 01..04. Must show 17 original HR tables + support tables.
USE `dc_prime_hr_db`;

SELECT VERSION() AS db_version;
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'dc_prime_hr_db' ORDER BY TABLE_NAME;
SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_TABLE_SCHEMA
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'dc_prime_hr_db' AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- This should return zero rows: any reference outside the HR schema is a migration error.
SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA='dc_prime_hr_db' AND REFERENCED_TABLE_NAME IS NOT NULL
  AND REFERENCED_TABLE_SCHEMA <> 'dc_prime_hr_db';

-- Every FK should be effective on the target engine/version: inspect SHOW CREATE TABLE output.
SHOW CREATE TABLE `employees`;
SHOW CREATE TABLE `employee_payrolls`;
SHOW CREATE TABLE `employee_payroll_signed_receipts`;

-- Batch 5 creates EMPTY HR business tables. Source data copy occurs in Batch 9.
SELECT 'attendance_day_settings' AS table_name, COUNT(*) AS row_count FROM `attendance_day_settings`;
SELECT 'attendance_event_participants' AS table_name, COUNT(*) AS row_count FROM `attendance_event_participants`;
SELECT 'attendance_events' AS table_name, COUNT(*) AS row_count FROM `attendance_events`;
SELECT 'employee_attendance_corrections' AS table_name, COUNT(*) AS row_count FROM `employee_attendance_corrections`;
SELECT 'employee_attendance_records' AS table_name, COUNT(*) AS row_count FROM `employee_attendance_records`;
SELECT 'employee_barcode_sequences' AS table_name, COUNT(*) AS row_count FROM `employee_barcode_sequences`;
SELECT 'employee_cash_advance_deductions' AS table_name, COUNT(*) AS row_count FROM `employee_cash_advance_deductions`;
SELECT 'employee_cash_advances' AS table_name, COUNT(*) AS row_count FROM `employee_cash_advances`;
SELECT 'employee_employment_history' AS table_name, COUNT(*) AS row_count FROM `employee_employment_history`;
SELECT 'employee_payroll_corrections' AS table_name, COUNT(*) AS row_count FROM `employee_payroll_corrections`;
SELECT 'employee_payroll_periods' AS table_name, COUNT(*) AS row_count FROM `employee_payroll_periods`;
SELECT 'employee_payroll_settings' AS table_name, COUNT(*) AS row_count FROM `employee_payroll_settings`;
SELECT 'employee_payroll_signed_receipts' AS table_name, COUNT(*) AS row_count FROM `employee_payroll_signed_receipts`;
SELECT 'employee_payrolls' AS table_name, COUNT(*) AS row_count FROM `employee_payrolls`;
SELECT 'employee_rest_day_assignments' AS table_name, COUNT(*) AS row_count FROM `employee_rest_day_assignments`;
SELECT 'employee_work_schedules' AS table_name, COUNT(*) AS row_count FROM `employee_work_schedules`;
SELECT 'employees' AS table_name, COUNT(*) AS row_count FROM `employees`;
