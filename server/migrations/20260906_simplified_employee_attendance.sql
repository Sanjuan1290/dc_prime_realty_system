-- Simplified Employee + Attendance module for D&C Prime Realty.
-- Safe for TiDB/MySQL-compatible deployments. Legacy payroll/cash-advance tables are intentionally retained
-- for backward compatibility, but the application no longer exposes those workflows.

ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `attendance_default_time_out` TIME NOT NULL DEFAULT '20:00:00' AFTER `default_release_day_two`;

ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `employee_departments_json` TEXT NULL AFTER `attendance_default_time_out`;

ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `employee_department_codes_json` TEXT NULL AFTER `employee_departments_json`;

UPDATE `system_settings`
SET `employee_departments_json` = '["Administration","Sales","Accounting","IT"]'
WHERE `system_setting_id` = 1
  AND (`employee_departments_json` IS NULL OR TRIM(`employee_departments_json`) = '');

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

ALTER TABLE `employee_attendance_records`
  ADD COLUMN IF NOT EXISTS `attendance_event_id` BIGINT UNSIGNED NULL AFTER `employee_id`;

ALTER TABLE `employee_attendance_records`
  ADD COLUMN IF NOT EXISTS `time_in_source`
    ENUM('barcode','manual','event','admin') NULL
    AFTER `actual_time_in`;

ALTER TABLE `employee_attendance_records`
  ADD COLUMN IF NOT EXISTS `time_out_source`
    ENUM('barcode','manual','event','admin','automatic') NULL
    AFTER `actual_time_out`;

CREATE TABLE IF NOT EXISTS `attendance_day_settings` (
  `attendance_date` DATE NOT NULL,
  `day_type` ENUM('regular','double_pay','regular_holiday','special_holiday') NOT NULL DEFAULT 'regular',
  `notes` TEXT NULL,
  `source_event_id` BIGINT UNSIGNED NULL,
  `updated_by_user_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_date`),
  KEY `idx_attendance_day_type` (`day_type`),
  CONSTRAINT `fk_attendance_day_updated_by`
    FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `attendance_events` (
  `attendance_event_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_name` VARCHAR(180) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `location` VARCHAR(255) NULL,
  `attendance_treatment` ENUM('full_day','custom_time','record_only') NOT NULL DEFAULT 'record_only',
  `event_time_in` TIME NULL,
  `event_time_out` TIME NULL,
  `day_type` ENUM('regular','double_pay','regular_holiday','special_holiday') NOT NULL DEFAULT 'regular',
  `notes` TEXT NULL,
  `event_status` ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  `created_by_user_id` INT UNSIGNED NULL,
  `updated_by_user_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_event_id`),
  KEY `idx_attendance_event_dates` (`start_date`, `end_date`),
  CONSTRAINT `fk_attendance_event_created_by`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_event_updated_by`
    FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `attendance_event_participants` (
  `attendance_event_participant_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `attendance_event_id` BIGINT UNSIGNED NOT NULL,
  `employee_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_event_participant_id`),
  UNIQUE KEY `uq_attendance_event_employee` (`attendance_event_id`, `employee_id`),
  CONSTRAINT `fk_attendance_event_participant_event`
    FOREIGN KEY (`attendance_event_id`) REFERENCES `attendance_events` (`attendance_event_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_event_participant_employee`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `employee_attendance_corrections` (
  `employee_attendance_correction_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_attendance_id` INT UNSIGNED NOT NULL,
  `previous_time_in` TIME NULL,
  `new_time_in` TIME NULL,
  `previous_time_out` TIME NULL,
  `new_time_out` TIME NULL,
  `reason` TEXT NOT NULL,
  `changed_by_user_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_attendance_correction_id`),
  KEY `idx_attendance_correction_attendance` (`employee_attendance_id`),
  CONSTRAINT `fk_attendance_correction_attendance`
    FOREIGN KEY (`employee_attendance_id`) REFERENCES `employee_attendance_records` (`employee_attendance_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_correction_user`
    FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
