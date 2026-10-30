-- READ ONLY: checks schema and actual row counts after fresh-start creation.
USE `dc_prime_hr_db`;
SELECT DATABASE() AS database_name;
SELECT COUNT(*) AS found_table_count, 28 AS expected_table_count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE';
SELECT
  (SELECT COUNT(*) FROM `hr_users`)
  + (SELECT COUNT(*) FROM `hr_legacy_user_map`)
  + (SELECT COUNT(*) FROM `hr_login_identities`)
  + (SELECT COUNT(*) FROM `hr_roles`)
  + (SELECT COUNT(*) FROM `hr_permissions`)
  + (SELECT COUNT(*) FROM `hr_role_permissions`)
  + (SELECT COUNT(*) FROM `hr_user_roles`)
  + (SELECT COUNT(*) FROM `attendance_day_settings`)
  + (SELECT COUNT(*) FROM `attendance_events`)
  + (SELECT COUNT(*) FROM `employee_barcode_sequences`)
  + (SELECT COUNT(*) FROM `employee_payroll_periods`)
  + (SELECT COUNT(*) FROM `employee_payroll_settings`)
  + (SELECT COUNT(*) FROM `employees`)
  + (SELECT COUNT(*) FROM `attendance_event_participants`)
  + (SELECT COUNT(*) FROM `employee_attendance_records`)
  + (SELECT COUNT(*) FROM `employee_cash_advances`)
  + (SELECT COUNT(*) FROM `employee_employment_history`)
  + (SELECT COUNT(*) FROM `employee_payrolls`)
  + (SELECT COUNT(*) FROM `employee_rest_day_assignments`)
  + (SELECT COUNT(*) FROM `employee_work_schedules`)
  + (SELECT COUNT(*) FROM `employee_attendance_corrections`)
  + (SELECT COUNT(*) FROM `employee_cash_advance_deductions`)
  + (SELECT COUNT(*) FROM `employee_payroll_corrections`)
  + (SELECT COUNT(*) FROM `employee_payroll_signed_receipts`)
  + (SELECT COUNT(*) FROM `hr_settings`)
  + (SELECT COUNT(*) FROM `hr_audit_logs`)
  + (SELECT COUNT(*) FROM `hr_outbox_events`)
  + (SELECT COUNT(*) FROM `hr_external_realty_user_links`)
  AS total_rows_across_all_tables;
