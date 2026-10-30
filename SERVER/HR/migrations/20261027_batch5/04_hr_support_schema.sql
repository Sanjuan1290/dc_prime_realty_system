-- D&C Prime Realty / Batch 5 / 27 October 2026
-- NEW HR STAGING DATABASE ONLY. No ALTER, UPDATE or DROP on source database.
-- Stop if target DB exists; do not apply to existing Realty database.

USE `dc_prime_hr_db`;

CREATE TABLE `hr_settings` (
  `id` tinyint unsigned NOT NULL DEFAULT '1',
  `attendance_default_time_out` time NOT NULL DEFAULT '20:00:00',
  `attendance_scheduled_time_in` time NOT NULL DEFAULT '09:00:00',
  `attendance_scheduled_time_out` time NOT NULL DEFAULT '20:00:00',
  `attendance_break_start` time NOT NULL DEFAULT '12:00:00',
  `attendance_break_minutes` smallint unsigned NOT NULL DEFAULT '60',
  `attendance_regular_work_minutes` smallint unsigned NOT NULL DEFAULT '600',
  `attendance_late_after` time NOT NULL DEFAULT '09:00:00',
  `attendance_red_highlight_after` time NOT NULL DEFAULT '09:15:00',
  `employee_departments_json` text DEFAULT NULL,
  `employee_department_codes_json` text DEFAULT NULL,
  `source_realty_settings_id` tinyint unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_hr_settings_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `hr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hr_user_id` int unsigned DEFAULT NULL,
  `legacy_realty_user_id` int unsigned DEFAULT NULL,
  `legacy_realty_audit_id` bigint unsigned DEFAULT NULL,
  `actor_name_snapshot` varchar(255) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `module` varchar(100) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(120) DEFAULT NULL,
  `details_json` json DEFAULT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_hr_imported_audit_id` (`legacy_realty_audit_id`),
  KEY `idx_hr_audit_actor` (`hr_user_id`),
  KEY `idx_hr_audit_recorded` (`recorded_at`),
  CONSTRAINT `fk_hr_audit_user` FOREIGN KEY (`hr_user_id`) REFERENCES `hr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_outbox_events` (
  `event_id` char(36) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `aggregate_type` varchar(80) NOT NULL,
  `aggregate_id` varchar(120) NOT NULL,
  `event_revision` int unsigned NOT NULL DEFAULT '1',
  `payload_json` json NOT NULL,
  `delivery_state` enum('pending','delivering','delivered','failed') NOT NULL DEFAULT 'pending',
  `delivery_attempts` int unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_attempt_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  UNIQUE KEY `uq_hr_outbox_event_version` (`event_type`,`aggregate_type`,`aggregate_id`,`event_revision`),
  KEY `idx_hr_outbox_delivery` (`delivery_state`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_external_realty_user_links` (
  `employee_id` int unsigned NOT NULL,
  `realty_user_id` int unsigned NOT NULL,
  `link_status` enum('pending','verified','retired') NOT NULL DEFAULT 'pending',
  `verified_by_hr_user_id` int unsigned DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_id`,`realty_user_id`),
  KEY `idx_hr_external_realty_user` (`realty_user_id`,`link_status`),
  CONSTRAINT `fk_hr_external_link_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_hr_external_link_verifier` FOREIGN KEY (`verified_by_hr_user_id`) REFERENCES `hr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
