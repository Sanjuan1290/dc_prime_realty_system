-- Read-only baseline. Run ONLY using a read-only account on the original Realty database.
-- No INSERT, ALTER, DELETE, UPDATE or DROP. Run before Batch 9 sync.
USE `dc_prime_realty_system_db`;

SELECT 'source_settings_rows' AS metric, COUNT(*) AS value FROM `system_settings`;
SELECT 'source_user_rows' AS metric, COUNT(*) AS value FROM `users`;

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

-- Source IDs referenced by HR tables, including four user-ID columns without declared foreign keys:
SELECT COUNT(DISTINCT source_user_id) AS distinct_hr_actor_ids,
       SUM(CASE WHEN u.`id` IS NULL THEN 1 ELSE 0 END) AS unresolved_distinct_hr_actor_ids
FROM (
  SELECT DISTINCT source_user_id FROM (
    SELECT `updated_by_user_id` AS source_user_id FROM `attendance_day_settings`
    UNION ALL SELECT `created_by_user_id` AS source_user_id FROM `attendance_events`
    UNION ALL SELECT `updated_by_user_id` AS source_user_id FROM `attendance_events`
    UNION ALL SELECT `changed_by_user_id` AS source_user_id FROM `employee_attendance_corrections`
    UNION ALL SELECT `recorded_by_user_id` AS source_user_id FROM `employee_attendance_records`
    UNION ALL SELECT `updated_by_user_id` AS source_user_id FROM `employee_attendance_records`
    UNION ALL SELECT `created_by_user_id` AS source_user_id FROM `employee_cash_advance_deductions`
    UNION ALL SELECT `approved_by_user_id` AS source_user_id FROM `employee_cash_advances`
    UNION ALL SELECT `created_by_user_id` AS source_user_id FROM `employee_cash_advances`
    UNION ALL SELECT `updated_by_user_id` AS source_user_id FROM `employee_cash_advances`
    UNION ALL SELECT `created_by_user_id` AS source_user_id FROM `employee_employment_history`
    UNION ALL SELECT `corrected_by_user_id` AS source_user_id FROM `employee_employment_history`
    UNION ALL SELECT `created_by_user_id` AS source_user_id FROM `employee_payroll_corrections`
    UNION ALL SELECT `finalized_by_user_id` AS source_user_id FROM `employee_payroll_periods`
    UNION ALL SELECT `updated_by_user_id` AS source_user_id FROM `employee_payroll_settings`
    UNION ALL SELECT `uploaded_by_user_id` AS source_user_id FROM `employee_payroll_signed_receipts`
    UNION ALL SELECT `archived_by_user_id` AS source_user_id FROM `employee_payroll_signed_receipts`
    UNION ALL SELECT `finalized_by_user_id` AS source_user_id FROM `employee_payrolls`
    UNION ALL SELECT `released_by_user_id` AS source_user_id FROM `employee_payrolls`
    UNION ALL SELECT `created_by_user_id` AS source_user_id FROM `employee_rest_day_assignments`
    UNION ALL SELECT `updated_by_user_id` AS source_user_id FROM `employee_rest_day_assignments`
    UNION ALL SELECT `linked_user_id` AS source_user_id FROM `employees`
    UNION ALL SELECT `created_by_user_id` AS source_user_id FROM `employees`
    UNION ALL SELECT `updated_by_user_id` AS source_user_id FROM `employees`
  ) AS all_hr_actor_values WHERE source_user_id IS NOT NULL
) AS actor_keys LEFT JOIN `users` u ON u.`id` = actor_keys.source_user_id;

-- Capture effective 10 HR-owned settings values securely for later migration (do not post publicly).
SELECT `system_setting_id`,
  `attendance_default_time_out`,
  `attendance_scheduled_time_in`,
  `attendance_scheduled_time_out`,
  `attendance_break_start`,
  `attendance_break_minutes`,
  `attendance_regular_work_minutes`,
  `attendance_late_after`,
  `attendance_red_highlight_after`,
  `employee_departments_json`,
  `employee_department_codes_json`
FROM `system_settings`;
