-- 2026-09-06 — Multiple Rest Days with historical effective dates.
--
-- Purpose:
--   * Allow each employee to have one or more weekly Rest Days.
--   * Preserve historical Rest Day schedules when an employee's schedule changes.
--   * Give the Attendance Excel export a reliable RD / RD OT reference.
--
-- This migration does NOT add payroll, salary, shifts, or pay multipliers.
-- Existing employees are intentionally NOT backfilled because their Rest Days
-- cannot be inferred safely. Open each existing employee and set Rest Day(s)
-- before generating a historical Attendance export.

USE `dc_prime_realty_system_db`;

CREATE TABLE IF NOT EXISTS `employee_rest_day_assignments` (
  `employee_rest_day_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` INT UNSIGNED NOT NULL,
  `day_of_week` ENUM(
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ) NOT NULL,
  `effective_from` DATE NOT NULL,
  `effective_to` DATE NULL,
  `created_by_user_id` INT UNSIGNED NULL,
  `updated_by_user_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`employee_rest_day_id`),
  UNIQUE KEY `uq_employee_rest_day_period` (`employee_id`, `day_of_week`, `effective_from`),
  KEY `idx_employee_rest_day_employee_dates` (`employee_id`, `effective_from`, `effective_to`),
  KEY `idx_employee_rest_day_day` (`day_of_week`),
  KEY `fk_employee_rest_day_created_by` (`created_by_user_id`),
  KEY `fk_employee_rest_day_updated_by` (`updated_by_user_id`),

  CONSTRAINT `fk_employee_rest_day_employee`
    FOREIGN KEY (`employee_id`)
    REFERENCES `employees` (`employee_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT `fk_employee_rest_day_created_by`
    FOREIGN KEY (`created_by_user_id`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT `fk_employee_rest_day_updated_by`
    FOREIGN KEY (`updated_by_user_id`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verification
SELECT COUNT(*) AS `rest_day_assignment_rows`
FROM `employee_rest_day_assignments`;
