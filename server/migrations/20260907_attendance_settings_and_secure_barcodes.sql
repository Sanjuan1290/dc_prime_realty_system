-- 2026-09-07 — Attendance Settings + secure attendance barcodes.
-- TiDB/MySQL compatible.
--
-- Human Employee Codes (IT-001, MKT-001, etc.) remain unchanged and are used for admin reference.
-- Attendance scanning now uses a separate immutable 10-digit barcode_code with a check digit.
-- Existing rows with NULL barcode_code are backfilled securely by the application server when the Employee/Attendance schema initializes.

USE `dc_prime_realty_system_db`;

ALTER TABLE `employees`
  ADD COLUMN IF NOT EXISTS `barcode_code` CHAR(10) NULL AFTER `employee_code`;

CREATE UNIQUE INDEX IF NOT EXISTS `uq_employees_barcode_code`
  ON `employees` (`barcode_code`);

ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `attendance_scheduled_time_in` TIME NOT NULL DEFAULT '09:00:00' AFTER `attendance_default_time_out`,
  ADD COLUMN IF NOT EXISTS `attendance_scheduled_time_out` TIME NOT NULL DEFAULT '20:00:00' AFTER `attendance_scheduled_time_in`,
  ADD COLUMN IF NOT EXISTS `attendance_break_start` TIME NOT NULL DEFAULT '12:00:00' AFTER `attendance_scheduled_time_out`,
  ADD COLUMN IF NOT EXISTS `attendance_break_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER `attendance_break_start`,
  ADD COLUMN IF NOT EXISTS `attendance_regular_work_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 660 AFTER `attendance_break_minutes`,
  ADD COLUMN IF NOT EXISTS `attendance_late_after` TIME NOT NULL DEFAULT '09:00:00' AFTER `attendance_regular_work_minutes`,
  ADD COLUMN IF NOT EXISTS `attendance_red_highlight_after` TIME NOT NULL DEFAULT '09:15:00' AFTER `attendance_late_after`;

-- Read-only verification.
SELECT
  `attendance_default_time_out`,
  `attendance_scheduled_time_in`,
  `attendance_scheduled_time_out`,
  `attendance_break_start`,
  `attendance_break_minutes`,
  `attendance_regular_work_minutes`,
  `attendance_late_after`,
  `attendance_red_highlight_after`
FROM `system_settings`
WHERE `system_setting_id` = 1;

SELECT
  `employee_id`,
  `employee_code`,
  `barcode_code`,
  `department`,
  `employee_status`
FROM `employees`
ORDER BY `employee_id`;
