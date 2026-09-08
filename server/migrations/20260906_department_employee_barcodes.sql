-- 2026-09-06 — Department-generated employee attendance barcodes.
-- New employee codes are allocated by the server as PREFIX-001 through PREFIX-999.

ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `employee_department_codes_json` TEXT NULL AFTER `employee_departments_json`;

UPDATE `system_settings`
SET `employee_department_codes_json` = '[{"name":"Administration","prefix":"ADM"},{"name":"Accounting","prefix":"ACC"},{"name":"IT","prefix":"IT"},{"name":"Sales","prefix":"SLS"},{"name":"Marketing","prefix":"MKT"},{"name":"Operations","prefix":"OPS"}]'
WHERE `system_setting_id` = 1
  AND (`employee_department_codes_json` IS NULL OR TRIM(`employee_department_codes_json`) = '');

CREATE TABLE IF NOT EXISTS `employee_barcode_sequences` (
  `department` VARCHAR(120) NOT NULL,
  `prefix` VARCHAR(8) NOT NULL,
  `last_number` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`department`),
  KEY `idx_employee_barcode_sequence_prefix` (`prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

