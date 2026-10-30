-- SCHEMA ONLY: use only on empty isolated test target.
/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE DATABASE `dc_prime_realty_system_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;
USE `dc_prime_realty_system_db`;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `accredited_seller_documents` (
  `accredited_seller_document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `accredited_seller_id` int unsigned NOT NULL,
  `document_type` varchar(100) NOT NULL DEFAULT 'proof_of_income',
  `file_name` varchar(255) DEFAULT NULL,
  `file_url` longtext NOT NULL,
  `file_mime_type` varchar(150) DEFAULT NULL,
  `file_size_bytes` int unsigned DEFAULT NULL,
  `uploaded_by_user_id` int unsigned DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `document_status` enum('active','archived') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accredited_seller_document_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_accredited_seller_documents_seller` (`accredited_seller_id`),
  KEY `idx_accredited_seller_documents_type` (`document_type`),
  KEY `idx_accredited_seller_documents_uploader` (`uploaded_by_user_id`),
  CONSTRAINT `fk_accredited_seller_documents_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_documents_uploader` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `accredited_seller_lot_project_rates` (
  `accredited_seller_lot_project_rate_id` int unsigned NOT NULL AUTO_INCREMENT,
  `accredited_seller_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `accredited_seller_project_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `accredited_seller_lot_project_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `accredited_seller_lot_project_rate_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accredited_seller_lot_project_rate_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accredited_seller_lot_project_rate_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_seller_project_rate` (`accredited_seller_id`,`lot_project_id`),
  KEY `fk_seller_project_rate_project` (`lot_project_id`),
  CONSTRAINT `fk_seller_project_rate_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_seller_project_rate_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `accredited_seller_managed_sellers` (
  `accredited_seller_managed_seller_id` int unsigned NOT NULL AUTO_INCREMENT,
  `manager_accredited_seller_id` int unsigned NOT NULL,
  `managed_accredited_seller_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accredited_seller_managed_seller_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_manager_managed_seller` (`manager_accredited_seller_id`,`managed_accredited_seller_id`),
  KEY `fk_managed_seller_managed` (`managed_accredited_seller_id`),
  CONSTRAINT `fk_managed_seller_managed` FOREIGN KEY (`managed_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_managed_seller_manager` FOREIGN KEY (`manager_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `accredited_sellers` (
  `accredited_seller_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `seller_group_id` int unsigned DEFAULT NULL,
  `accredited_seller_reports_under_user_id` int unsigned DEFAULT NULL,
  `is_system_dummy` tinyint(1) NOT NULL DEFAULT '0',
  `dummy_owner_accredited_seller_id` int unsigned DEFAULT NULL,
  `accredited_seller_accreditation_date` date DEFAULT NULL,
  `accredited_seller_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `accredited_seller_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accredited_seller_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accredited_seller_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_accredited_seller_user` (`user_id`),
  UNIQUE KEY `uq_accredited_seller_dummy_owner` (`dummy_owner_accredited_seller_id`),
  KEY `fk_accredited_seller_group` (`seller_group_id`),
  KEY `fk_accredited_seller_reports_under_user` (`accredited_seller_reports_under_user_id`),
  KEY `idx_accredited_seller_system_dummy` (`is_system_dummy`),
  CONSTRAINT `fk_accredited_seller_dummy_owner` FOREIGN KEY (`dummy_owner_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_group` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_reports_under_user` FOREIGN KEY (`accredited_seller_reports_under_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `admin_project_access` (
  `admin_project_access_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`admin_project_access_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_admin_project_access` (`user_id`,`lot_project_id`),
  KEY `idx_admin_project_access_project` (`lot_project_id`),
  KEY `idx_admin_project_access_created_by` (`created_by_user_id`),
  CONSTRAINT `fk_admin_project_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_admin_project_access_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_admin_project_access_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `agent_lot_project_direct_rates` (
  `agent_lot_project_direct_rate_id` int unsigned NOT NULL AUTO_INCREMENT,
  `accredited_seller_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `direct_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `direct_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`agent_lot_project_direct_rate_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_agent_project_direct_rate` (`accredited_seller_id`,`lot_project_id`),
  KEY `idx_agent_direct_rate_project` (`lot_project_id`,`direct_rate_status`),
  CONSTRAINT `fk_agent_direct_rate_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_agent_direct_rate_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `attendance_day_settings` (
  `attendance_date` date NOT NULL,
  `day_type` enum('regular','double_pay','regular_holiday','special_holiday') NOT NULL DEFAULT 'regular',
  `notes` text DEFAULT NULL,
  `source_event_id` bigint unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_date`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_attendance_day_type` (`day_type`),
  KEY `fk_attendance_day_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_attendance_day_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `attendance_event_participants` (
  `attendance_event_participant_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `attendance_event_id` bigint unsigned NOT NULL,
  `employee_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_event_participant_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_attendance_event_employee` (`attendance_event_id`,`employee_id`),
  KEY `fk_attendance_event_participant_employee` (`employee_id`),
  CONSTRAINT `fk_attendance_event_participant_event` FOREIGN KEY (`attendance_event_id`) REFERENCES `attendance_events` (`attendance_event_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_event_participant_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `attendance_events` (
  `attendance_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_name` varchar(180) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `attendance_treatment` enum('full_day','custom_time','record_only') NOT NULL DEFAULT 'record_only',
  `event_time_in` time DEFAULT NULL,
  `event_time_out` time DEFAULT NULL,
  `day_type` enum('regular','double_pay','regular_holiday','special_holiday') NOT NULL DEFAULT 'regular',
  `notes` text DEFAULT NULL,
  `event_status` enum('active','cancelled') NOT NULL DEFAULT 'active',
  `created_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_event_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_attendance_event_dates` (`start_date`,`end_date`),
  KEY `fk_attendance_event_created_by` (`created_by_user_id`),
  KEY `fk_attendance_event_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_attendance_event_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_event_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_archive_holds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `reason` text NOT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `released_at` datetime DEFAULT NULL,
  `released_by` int unsigned DEFAULT NULL,
  `release_reason` text DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_archive_hold_batch` (`batch_id`,`released_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_archive_purge_codes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `requested_by` int unsigned NOT NULL,
  `reason` text NOT NULL,
  `code_hash` char(64) NOT NULL,
  `attempt_count` tinyint unsigned NOT NULL DEFAULT '0',
  `status` enum('pending','used','locked') NOT NULL DEFAULT 'pending',
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_purge_code_user` (`requested_by`,`created_at`),
  KEY `idx_purge_code_batch` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_archive_purge_receipts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `record_count` int unsigned NOT NULL,
  `event_count` int unsigned NOT NULL,
  `file_hash` char(64) NOT NULL,
  `archive_created_at` datetime NOT NULL,
  `deleted_by` int unsigned DEFAULT NULL,
  `reason` text NOT NULL,
  `verification_id` bigint unsigned DEFAULT NULL,
  `deleted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_archive_deleted_batch` (`batch_id`),
  KEY `idx_archive_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_archive_settings` (
  `id` tinyint unsigned NOT NULL,
  `archive_days` smallint unsigned NOT NULL DEFAULT '180',
  `auto_delete_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_cases` (
  `audit_case_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `case_number` varchar(40) DEFAULT NULL,
  `operational_review_id` bigint unsigned NOT NULL,
  `opened_by_auditor_user_id` int unsigned NOT NULL,
  `assigned_responder_user_id` int unsigned DEFAULT NULL,
  `responder_reassigned_by_user_id` int unsigned DEFAULT NULL,
  `responder_reassigned_at` datetime DEFAULT NULL,
  `finding` text NOT NULL,
  `status` enum('awaiting_head_response','under_auditor_review','finding_invalid','pending_system_admin_correction','pending_auditor_recheck','closed') NOT NULL DEFAULT 'awaiting_head_response',
  `head_response` text DEFAULT NULL,
  `head_responded_by_user_id` int unsigned DEFAULT NULL,
  `head_responded_at` datetime DEFAULT NULL,
  `auditor_resolution` text DEFAULT NULL,
  `auditor_resolved_by_user_id` int unsigned DEFAULT NULL,
  `auditor_resolved_at` datetime DEFAULT NULL,
  `system_admin_user_id` int unsigned DEFAULT NULL,
  `correction_summary` text DEFAULT NULL,
  `correction_applied_at` datetime DEFAULT NULL,
  `final_verified_by_auditor_user_id` int unsigned DEFAULT NULL,
  `final_verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_case_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_audit_case_number` (`case_number`),
  KEY `idx_audit_case_review` (`operational_review_id`,`status`),
  KEY `idx_audit_case_status` (`status`,`created_at`),
  KEY `fk_audit_case_opened_by` (`opened_by_auditor_user_id`),
  KEY `fk_audit_case_head` (`head_responded_by_user_id`),
  KEY `fk_audit_case_resolved_by` (`auditor_resolved_by_user_id`),
  KEY `fk_audit_case_system_admin` (`system_admin_user_id`),
  KEY `fk_audit_case_final_auditor` (`final_verified_by_auditor_user_id`),
  KEY `idx_audit_case_assigned_responder` (`assigned_responder_user_id`),
  KEY `idx_audit_case_reassigned_by` (`responder_reassigned_by_user_id`),
  CONSTRAINT `fk_audit_case_review` FOREIGN KEY (`operational_review_id`) REFERENCES `operational_reviews` (`operational_review_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_case_opened_by` FOREIGN KEY (`opened_by_auditor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_case_head` FOREIGN KEY (`head_responded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_case_resolved_by` FOREIGN KEY (`auditor_resolved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_case_system_admin` FOREIGN KEY (`system_admin_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_case_final_auditor` FOREIGN KEY (`final_verified_by_auditor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_case_assigned_responder` FOREIGN KEY (`assigned_responder_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_audit_case_reassigned_by` FOREIGN KEY (`responder_reassigned_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_log_archive_batches` (
  `audit_log_archive_batch_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `retention_days` smallint unsigned NOT NULL,
  `cutoff_at` datetime NOT NULL,
  `record_count` int unsigned NOT NULL,
  `export_filename` varchar(255) NOT NULL,
  `export_sha256` char(64) NOT NULL,
  `export_csv` longblob NOT NULL,
  `archived_by_user_id` int unsigned DEFAULT NULL,
  `archived_by_name` varchar(255) DEFAULT NULL,
  `archived_by_email` varchar(150) DEFAULT NULL,
  `request_ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_archive_batch_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_audit_archive_batch_created` (`created_at`),
  KEY `idx_audit_archive_batch_cutoff` (`cutoff_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_log_archive_events` (
  `audit_log_archive_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `audit_log_archive_batch_id` bigint unsigned DEFAULT NULL,
  `actor_user_id` int unsigned DEFAULT NULL,
  `actor_name` varchar(255) DEFAULT NULL,
  `actor_email` varchar(150) DEFAULT NULL,
  `event_type` enum('archive_created','export_downloaded') NOT NULL,
  `record_count` int unsigned NOT NULL DEFAULT '0',
  `retention_days` smallint unsigned DEFAULT NULL,
  `cutoff_at` datetime DEFAULT NULL,
  `export_sha256` char(64) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `event_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_archive_event_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_audit_archive_event_batch` (`audit_log_archive_batch_id`),
  KEY `idx_audit_archive_event_created` (`event_created_at`),
  CONSTRAINT `fk_audit_archive_event_batch` FOREIGN KEY (`audit_log_archive_batch_id`) REFERENCES `audit_log_archive_batches` (`audit_log_archive_batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_log_archive_policy` (
  `policy_id` tinyint unsigned NOT NULL,
  `retention_days` smallint unsigned NOT NULL DEFAULT '365',
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`policy_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_audit_archive_policy_user` (`updated_by_user_id`),
  CONSTRAINT `fk_audit_archive_policy_user` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_log_archive_verifications` (
  `audit_log_archive_verification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `code_hash` char(64) NOT NULL,
  `retention_days` smallint unsigned NOT NULL,
  `cutoff_at` datetime NOT NULL,
  `eligible_count` int unsigned NOT NULL DEFAULT '0',
  `status` enum('pending','used','expired','locked') NOT NULL DEFAULT 'pending',
  `attempt_count` tinyint unsigned NOT NULL DEFAULT '0',
  `max_attempts` tinyint unsigned NOT NULL DEFAULT '5',
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  `request_ip` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_archive_verification_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_audit_archive_verification_user` (`user_id`),
  KEY `idx_audit_archive_verification_status` (`status`,`expires_at`),
  CONSTRAINT `fk_audit_archive_verification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_logs_archive` (
  `audit_log_archive_record_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `audit_log_archive_batch_id` bigint unsigned NOT NULL,
  `original_audit_log_id` bigint unsigned NOT NULL,
  `actor_user_id` int unsigned DEFAULT NULL,
  `actor_name` varchar(255) DEFAULT NULL,
  `actor_email` varchar(150) DEFAULT NULL,
  `actor_role` varchar(80) DEFAULT NULL,
  `action` varchar(40) NOT NULL,
  `module` varchar(100) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(120) DEFAULT NULL,
  `entity_label` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `audit_log_created_at` datetime NOT NULL,
  `archived_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_archive_record_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_archived_original_audit_log` (`original_audit_log_id`),
  KEY `idx_archived_audit_batch` (`audit_log_archive_batch_id`),
  KEY `idx_archived_audit_created` (`audit_log_created_at`),
  KEY `idx_archived_audit_module` (`module`),
  CONSTRAINT `fk_archived_audit_batch` FOREIGN KEY (`audit_log_archive_batch_id`) REFERENCES `audit_log_archive_batches` (`audit_log_archive_batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `audit_logs` (
  `audit_log_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_user_id` int unsigned DEFAULT NULL,
  `actor_name` varchar(255) DEFAULT NULL,
  `actor_email` varchar(150) DEFAULT NULL,
  `actor_role` varchar(80) DEFAULT NULL,
  `action` enum('create','update','delete','login','logout','send','approve','reject','release','system','view','import','export','correct') NOT NULL DEFAULT 'system',
  `module` varchar(100) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(120) DEFAULT NULL,
  `entity_label` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `audit_log_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_module` (`module`),
  KEY `idx_audit_actor` (`actor_user_id`),
  KEY `idx_audit_created` (`audit_log_created_at`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_module_action` (`module`,`action`),
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=90001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `company_finance_categories` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `kind` enum('income','expense') NOT NULL,
  `name` varchar(90) NOT NULL,
  `protected` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_company_finance_category_kind_name` (`kind`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `company_finance_settings` (
  `id` tinyint unsigned NOT NULL,
  `start_date` date DEFAULT NULL,
  `opening_balance` decimal(16,2) DEFAULT NULL,
  `includes_property_collections` tinyint(1) NOT NULL DEFAULT '1',
  `set_by_user_id` int unsigned DEFAULT NULL,
  `set_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `company_finance_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int unsigned NOT NULL,
  `kind` enum('income','expense') NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `transaction_date` date NOT NULL,
  `description` varchar(240) NOT NULL,
  `notes` varchar(1000) DEFAULT NULL,
  `status` enum('posted','void') NOT NULL DEFAULT 'posted',
  `created_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `voided_by_user_id` int unsigned DEFAULT NULL,
  `void_reason` varchar(500) DEFAULT NULL,
  `voided_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_company_finance_tx_date` (`transaction_date`,`status`),
  KEY `idx_company_finance_tx_category` (`category_id`,`transaction_date`),
  CONSTRAINT `fk_company_finance_tx_category` FOREIGN KEY (`category_id`) REFERENCES `company_finance_categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `destructive_action_verifications` (
  `destructive_action_verification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `action_type` varchar(80) NOT NULL,
  `entity_type` varchar(80) NOT NULL,
  `entity_id` varchar(100) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `payload_hash` char(64) NOT NULL,
  `reason` text DEFAULT NULL,
  `attempt_count` smallint unsigned NOT NULL DEFAULT '0',
  `max_attempts` smallint unsigned NOT NULL DEFAULT '5',
  `expires_at` datetime NOT NULL,
  `status` enum('pending','verified','used','expired','locked','cancelled') NOT NULL DEFAULT 'pending',
  `request_ip` varchar(100) DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`destructive_action_verification_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_destructive_verification_user_status` (`user_id`,`status`,`created_at`),
  KEY `idx_destructive_verification_entity` (`entity_type`,`entity_id`,`status`),
  CONSTRAINT `fk_destructive_verification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `document_templates` (
  `template_id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_name` varchar(150) NOT NULL,
  `template_description` text DEFAULT NULL,
  `template_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `template_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `template_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `documents` (
  `document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `document_name` varchar(150) NOT NULL,
  `document_code` varchar(80) DEFAULT NULL,
  `document_description` text DEFAULT NULL,
  `document_is_reusable` tinyint(1) NOT NULL DEFAULT '1',
  `document_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `document_responsible_party` enum('client','internal','seller') NOT NULL DEFAULT 'client',
  `document_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_documents_document_code` (`document_code`),
  UNIQUE KEY `uq_documents_document_name` (`document_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_attendance_corrections` (
  `employee_attendance_correction_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employee_attendance_id` int unsigned NOT NULL,
  `previous_time_in` time DEFAULT NULL,
  `new_time_in` time DEFAULT NULL,
  `previous_time_out` time DEFAULT NULL,
  `new_time_out` time DEFAULT NULL,
  `reason` text NOT NULL,
  `changed_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_attendance_correction_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_attendance_correction_attendance` (`employee_attendance_id`),
  KEY `fk_attendance_correction_user` (`changed_by_user_id`),
  CONSTRAINT `fk_attendance_correction_attendance` FOREIGN KEY (`employee_attendance_id`) REFERENCES `employee_attendance_records` (`employee_attendance_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_correction_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_attendance_records` (
  `employee_attendance_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int unsigned NOT NULL,
  `attendance_event_id` bigint unsigned DEFAULT NULL,
  `attendance_date` date NOT NULL,
  `scheduled_time_in` time DEFAULT NULL,
  `scheduled_time_out` time DEFAULT NULL,
  `actual_time_in` time DEFAULT NULL,
  `time_in_source` enum('barcode','manual','event','admin') DEFAULT NULL,
  `actual_time_out` time DEFAULT NULL,
  `time_out_source` enum('barcode','manual','event','admin','automatic') DEFAULT NULL,
  `regular_work_seconds` int unsigned NOT NULL DEFAULT '0',
  `late_seconds` int unsigned NOT NULL DEFAULT '0',
  `undertime_seconds` int unsigned NOT NULL DEFAULT '0',
  `overtime_seconds` int unsigned NOT NULL DEFAULT '0',
  `night_differential_seconds` int unsigned NOT NULL DEFAULT '0',
  `bonus_late_violation` tinyint(1) NOT NULL DEFAULT '0',
  `late_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `undertime_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `absence_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `attendance_status` enum('present','late','absent','paid_leave','unpaid_leave','rest_day','holiday','regular_holiday','special_holiday','half_day') NOT NULL DEFAULT 'present',
  `notes` text DEFAULT NULL,
  `source` enum('manual','import','device') NOT NULL DEFAULT 'manual',
  `recorded_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_attendance_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_attendance_date` (`employee_id`,`attendance_date`),
  KEY `fk_attendance_recorded_by` (`recorded_by_user_id`),
  KEY `fk_attendance_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_recorded_by` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_barcode_sequences` (
  `department` varchar(120) NOT NULL,
  `prefix` varchar(8) NOT NULL,
  `last_number` smallint unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`department`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_employee_barcode_sequence_prefix` (`prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_cash_advance_deductions` (
  `employee_cash_advance_deduction_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_cash_advance_id` int unsigned NOT NULL,
  `employee_payroll_id` int unsigned DEFAULT NULL,
  `deduction_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `remaining_balance_after` decimal(14,2) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `request_key` varchar(80) DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_cash_advance_deduction_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_employee_cash_advance_deduction_advance` (`employee_cash_advance_id`),
  KEY `fk_employee_cash_advance_deduction_payroll` (`employee_payroll_id`),
  KEY `fk_employee_cash_advance_deduction_user` (`created_by_user_id`),
  UNIQUE KEY `uq_employee_cash_advance_request_key` (`employee_cash_advance_id`,`request_key`),
  UNIQUE KEY `uq_employee_cash_advance_payroll_deduction` (`employee_cash_advance_id`,`employee_payroll_id`),
  CONSTRAINT `fk_employee_cash_advance_deduction_advance` FOREIGN KEY (`employee_cash_advance_id`) REFERENCES `employee_cash_advances` (`employee_cash_advance_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_deduction_payroll` FOREIGN KEY (`employee_payroll_id`) REFERENCES `employee_payrolls` (`employee_payroll_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_deduction_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_cash_advances` (
  `employee_cash_advance_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int unsigned NOT NULL,
  `reference_number` varchar(60) NOT NULL,
  `request_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `installment_count` smallint unsigned NOT NULL DEFAULT '1',
  `deduction_per_payroll` decimal(14,2) NOT NULL DEFAULT '0.00',
  `start_deduction_date` date NOT NULL,
  `remaining_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cash_advance_status` enum('pending','approved','active','paid','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `approved_by_user_id` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_cash_advance_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_cash_advance_reference` (`reference_number`),
  KEY `fk_employee_cash_advance_employee` (`employee_id`),
  KEY `fk_employee_cash_advance_approved_by` (`approved_by_user_id`),
  KEY `fk_employee_cash_advance_created_by` (`created_by_user_id`),
  KEY `fk_employee_cash_advance_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_employee_cash_advance_approved_by` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_employment_history` (
  `employee_employment_history_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int unsigned NOT NULL,
  `change_type` enum('hired','promotion','salary_increase','position_change','department_transfer','employment_status_change','allowance_adjustment','demotion','other') NOT NULL,
  `position` varchar(120) NOT NULL,
  `department` varchar(120) NOT NULL,
  `employment_type` enum('regular','probationary','contractual','part_time','intern') NOT NULL DEFAULT 'regular',
  `monthly_basic_salary` decimal(14,2) NOT NULL DEFAULT '0.00',
  `rice_allowance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `transportation_allowance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `attendance_bonus` decimal(14,2) NOT NULL DEFAULT '0.00',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `change_reason` text DEFAULT NULL,
  `previous_history_id` bigint unsigned DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `corrected_by_user_id` int unsigned DEFAULT NULL,
  `corrected_at` datetime DEFAULT NULL,
  `correction_reason` text DEFAULT NULL,
  PRIMARY KEY (`employee_employment_history_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_employment_start` (`employee_id`,`effective_from`),
  KEY `idx_employee_employment_effective` (`employee_id`,`effective_from`,`effective_to`),
  KEY `idx_employee_employment_current` (`employee_id`,`effective_to`),
  KEY `idx_employee_employment_previous` (`previous_history_id`),
  KEY `idx_employee_employment_created_by` (`created_by_user_id`),
  KEY `idx_employee_employment_corrected_by` (`corrected_by_user_id`),
  CONSTRAINT `fk_employee_employment_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_employment_previous` FOREIGN KEY (`previous_history_id`) REFERENCES `employee_employment_history` (`employee_employment_history_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_employment_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_employment_corrected_by` FOREIGN KEY (`corrected_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_payroll_corrections` (
  `employee_payroll_correction_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employee_payroll_id` int unsigned NOT NULL,
  `reason` text NOT NULL,
  `before_snapshot_json` json NOT NULL,
  `after_snapshot_json` json NOT NULL,
  `review_hash` char(64) NOT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_payroll_correction_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_employee_payroll_correction_payroll` (`employee_payroll_id`,`created_at`),
  KEY `fk_employee_payroll_correction_user` (`created_by_user_id`),
  CONSTRAINT `fk_employee_payroll_correction_payroll` FOREIGN KEY (`employee_payroll_id`) REFERENCES `employee_payrolls` (`employee_payroll_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_payroll_correction_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_payroll_periods` (
  `employee_payroll_period_id` int unsigned NOT NULL AUTO_INCREMENT,
  `period_label` varchar(80) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `release_date` date DEFAULT NULL,
  `release_day` tinyint unsigned DEFAULT NULL,
  `period_type` enum('first_half','second_half') DEFAULT NULL,
  `witness_name` varchar(180) DEFAULT NULL,
  `release_notes` text DEFAULT NULL,
  `payroll_status` enum('draft','finalized','cancelled') NOT NULL DEFAULT 'draft',
  `finalized_by_user_id` int unsigned DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `scheduled_release_date` date DEFAULT NULL,
  PRIMARY KEY (`employee_payroll_period_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_payroll_period` (`period_start`,`period_end`),
  UNIQUE KEY `uq_employee_payroll_release_date` (`release_date`),
  KEY `fk_employee_payroll_finalized_by` (`finalized_by_user_id`),
  CONSTRAINT `fk_employee_payroll_finalized_by` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_payroll_settings` (
  `employee_payroll_settings_id` tinyint unsigned NOT NULL,
  `regular_ot_multiplier` decimal(8,4) DEFAULT NULL,
  `rest_day_ot_multiplier` decimal(8,4) DEFAULT NULL,
  `regular_holiday_multiplier` decimal(8,4) DEFAULT NULL,
  `regular_holiday_ot_multiplier` decimal(8,4) DEFAULT NULL,
  `special_holiday_multiplier` decimal(8,4) DEFAULT NULL,
  `special_holiday_ot_multiplier` decimal(8,4) DEFAULT NULL,
  `night_differential_percentage` decimal(6,3) DEFAULT NULL,
  `mid_period_change_rule` varchar(40) NOT NULL DEFAULT 'period_boundary_only',
  `settings_revision` int unsigned NOT NULL DEFAULT '1',
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `first_half_payday` tinyint unsigned NOT NULL DEFAULT '22',
  `second_half_payday` tinyint unsigned NOT NULL DEFAULT '7',
  `new_hire_proration_rule` varchar(40) NOT NULL DEFAULT 'scheduled_workdays',
  `attendance_bonus_rule` varchar(48) NOT NULL DEFAULT 'perfect_attendance_per_period',
  PRIMARY KEY (`employee_payroll_settings_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_employee_payroll_settings_user` (`updated_by_user_id`),
  CONSTRAINT `fk_employee_payroll_settings_user` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_payroll_signed_receipts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employee_payroll_id` int unsigned NOT NULL,
  `employee_id` int unsigned NOT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `stored_file_name` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size_bytes` bigint unsigned NOT NULL,
  `cloudinary_asset_id` varchar(255) DEFAULT NULL,
  `cloudinary_public_id` varchar(500) NOT NULL,
  `cloudinary_resource_type` varchar(30) NOT NULL,
  `cloudinary_delivery_type` varchar(50) NOT NULL DEFAULT 'authenticated',
  `cloudinary_asset_folder` varchar(500) NOT NULL,
  `cloudinary_format` varchar(30) DEFAULT NULL,
  `malware_scan_status` varchar(30) NOT NULL DEFAULT 'pending',
  `malware_scan_provider` varchar(80) DEFAULT NULL,
  `malware_scan_reason` varchar(180) DEFAULT NULL,
  `malware_scanned_at` datetime DEFAULT NULL,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `uploaded_by_user_id` int unsigned DEFAULT NULL,
  `archived_by_user_id` int unsigned DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_payroll_signed_cloudinary` (`cloudinary_public_id`),
  KEY `idx_employee_payroll_signed_active` (`employee_payroll_id`,`status`),
  KEY `idx_employee_payroll_signed_scan` (`malware_scan_status`),
  KEY `fk_employee_payroll_signed_employee` (`employee_id`),
  CONSTRAINT `fk_employee_payroll_signed_payroll` FOREIGN KEY (`employee_payroll_id`) REFERENCES `employee_payrolls` (`employee_payroll_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_payroll_signed_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_payrolls` (
  `employee_payroll_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_payroll_period_id` int unsigned NOT NULL,
  `employee_id` int unsigned NOT NULL,
  `monthly_salary_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payroll_divisor_snapshot` decimal(8,2) NOT NULL DEFAULT '26.00',
  `month_work_days_snapshot` decimal(8,2) NOT NULL DEFAULT '0.00',
  `period_work_days` decimal(8,2) NOT NULL DEFAULT '0.00',
  `hourly_rate_snapshot` decimal(14,4) NOT NULL DEFAULT '0.0000',
  `base_salary` decimal(14,2) NOT NULL DEFAULT '0.00',
  `scheduled_regular_seconds` int unsigned NOT NULL DEFAULT '0',
  `regular_attended_seconds` int unsigned NOT NULL DEFAULT '0',
  `paid_time_off_seconds` int unsigned NOT NULL DEFAULT '0',
  `regular_holiday_seconds` int unsigned NOT NULL DEFAULT '0',
  `special_holiday_seconds` int unsigned NOT NULL DEFAULT '0',
  `late_seconds` int unsigned NOT NULL DEFAULT '0',
  `late_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `undertime_seconds` int unsigned NOT NULL DEFAULT '0',
  `undertime_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `absent_days` decimal(6,2) NOT NULL DEFAULT '0.00',
  `absence_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `overtime_seconds` int unsigned NOT NULL DEFAULT '0',
  `overtime_pay` decimal(14,2) NOT NULL DEFAULT '0.00',
  `night_differential_seconds` int unsigned NOT NULL DEFAULT '0',
  `night_differential_pay` decimal(14,2) NOT NULL DEFAULT '0.00',
  `rice_allowance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `transportation_allowance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `attendance_bonus` decimal(14,2) NOT NULL DEFAULT '0.00',
  `attendance_bonus_eligible` tinyint(1) NOT NULL DEFAULT '0',
  `attendance_bonus_note` varchar(255) DEFAULT NULL,
  `cash_advance_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `other_adjustments` decimal(14,2) NOT NULL DEFAULT '0.00',
  `gross_pay` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_pay` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payroll_status` enum('draft','finalized','corrected','released','cancelled') NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `employment_history_id` bigint unsigned DEFAULT NULL,
  `employee_name_snapshot` varchar(255) DEFAULT NULL,
  `position_snapshot` varchar(120) DEFAULT NULL,
  `department_snapshot` varchar(120) DEFAULT NULL,
  `employment_status_snapshot` varchar(40) DEFAULT NULL,
  `half_month_basic` decimal(14,2) NOT NULL DEFAULT '0.00',
  `daily_rate` decimal(14,6) NOT NULL DEFAULT '0.000000',
  `minute_rate` decimal(14,6) NOT NULL DEFAULT '0.000000',
  `regular_working_minutes_snapshot` smallint unsigned NOT NULL DEFAULT '0',
  `attendance_calculated_through` date DEFAULT NULL,
  `expected_regular_minutes` int unsigned NOT NULL DEFAULT '0',
  `regular_attended_minutes` int unsigned NOT NULL DEFAULT '0',
  `pto_minutes` int unsigned NOT NULL DEFAULT '0',
  `regular_holiday_minutes` int unsigned NOT NULL DEFAULT '0',
  `special_holiday_minutes` int unsigned NOT NULL DEFAULT '0',
  `late_minutes` int unsigned NOT NULL DEFAULT '0',
  `absence_minutes` int unsigned NOT NULL DEFAULT '0',
  `tardiness_absence_minutes` int unsigned NOT NULL DEFAULT '0',
  `overtime_minutes` int unsigned NOT NULL DEFAULT '0',
  `rest_day_overtime_minutes` int unsigned NOT NULL DEFAULT '0',
  `night_differential_minutes` int unsigned NOT NULL DEFAULT '0',
  `attendance_deduction` decimal(14,2) NOT NULL DEFAULT '0.00',
  `rest_day_overtime_pay` decimal(14,2) NOT NULL DEFAULT '0.00',
  `regular_holiday_pay` decimal(14,2) NOT NULL DEFAULT '0.00',
  `special_holiday_pay` decimal(14,2) NOT NULL DEFAULT '0.00',
  `manual_additions_total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `manual_deductions_total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_fund_release` decimal(14,2) NOT NULL DEFAULT '0.00',
  `calculation_version` varchar(80) DEFAULT NULL,
  `calculation_warnings_json` json DEFAULT NULL,
  `attendance_breakdown_json` json DEFAULT NULL,
  `finalized_snapshot_json` json DEFAULT NULL,
  `finalized_attendance_fingerprint` char(64) DEFAULT NULL,
  `finalized_by_user_id` int unsigned DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `released_date` date DEFAULT NULL,
  `released_at` datetime DEFAULT NULL,
  `released_by_user_id` int unsigned DEFAULT NULL,
  `release_reference` varchar(180) DEFAULT NULL,
  `release_witness_name` varchar(180) DEFAULT NULL,
  `release_notes` text DEFAULT NULL,
  `payroll_settings_snapshot_json` json DEFAULT NULL,
  PRIMARY KEY (`employee_payroll_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_payroll_employee` (`employee_payroll_period_id`,`employee_id`),
  KEY `fk_employee_payroll_employee` (`employee_id`),
  CONSTRAINT `fk_employee_payroll_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_payroll_period` FOREIGN KEY (`employee_payroll_period_id`) REFERENCES `employee_payroll_periods` (`employee_payroll_period_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_rest_day_assignments` (
  `employee_rest_day_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int unsigned NOT NULL,
  `day_of_week` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_rest_day_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_rest_day_period` (`employee_id`,`day_of_week`,`effective_from`),
  KEY `idx_employee_rest_day_employee_dates` (`employee_id`,`effective_from`,`effective_to`),
  KEY `idx_employee_rest_day_day` (`day_of_week`),
  KEY `fk_employee_rest_day_created_by` (`created_by_user_id`),
  KEY `fk_employee_rest_day_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_employee_rest_day_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_rest_day_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_rest_day_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employee_work_schedules` (
  `employee_work_schedule_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int unsigned NOT NULL,
  `weekday` tinyint unsigned NOT NULL,
  `is_work_day` tinyint(1) NOT NULL DEFAULT '0',
  `shift_start` time DEFAULT NULL,
  `shift_end` time DEFAULT NULL,
  `break_minutes` smallint unsigned NOT NULL DEFAULT '60',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_work_schedule_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employee_weekday` (`employee_id`,`weekday`),
  CONSTRAINT `fk_employee_schedule_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `employees` (
  `employee_id` int unsigned NOT NULL AUTO_INCREMENT,
  `linked_user_id` int unsigned DEFAULT NULL,
  `employee_code` varchar(40) NOT NULL,
  `barcode_code` char(10) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `contact_number` varchar(60) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `department` varchar(120) DEFAULT NULL,
  `position` varchar(120) NOT NULL,
  `employment_type` enum('regular','probationary','contractual','part_time','intern') NOT NULL DEFAULT 'regular',
  `hire_date` date NOT NULL,
  `monthly_salary` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payroll_divisor` decimal(8,2) NOT NULL DEFAULT '26.00',
  `attendance_grace_minutes` smallint unsigned NOT NULL DEFAULT '15',
  `rice_allowance` decimal(14,2) NOT NULL DEFAULT '500.00',
  `transportation_allowance` decimal(14,2) NOT NULL DEFAULT '500.00',
  `attendance_bonus_amount` decimal(14,2) NOT NULL DEFAULT '3000.00',
  `overtime_multiplier` decimal(6,2) NOT NULL DEFAULT '2.00',
  `night_differential_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `employee_status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
  `created_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_employees_code` (`employee_code`),
  UNIQUE KEY `uq_employees_barcode_code` (`barcode_code`),
  UNIQUE KEY `uq_employees_email` (`email`),
  KEY `fk_employees_linked_user` (`linked_user_id`),
  KEY `fk_employees_created_by` (`created_by_user_id`),
  KEY `fk_employees_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_employees_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employees_linked_user` FOREIGN KEY (`linked_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employees_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `internal_notifications` (
  `internal_notification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `notification_type` varchar(80) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text DEFAULT NULL,
  `link` varchar(500) DEFAULT NULL,
  `operational_review_id` bigint unsigned DEFAULT NULL,
  `audit_case_id` bigint unsigned DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`internal_notification_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_internal_notification_user` (`user_id`,`read_at`,`created_at`),
  KEY `idx_internal_notification_review` (`operational_review_id`,`created_at`),
  KEY `fk_internal_notification_case` (`audit_case_id`),
  CONSTRAINT `fk_internal_notification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_internal_notification_review` FOREIGN KEY (`operational_review_id`) REFERENCES `operational_reviews` (`operational_review_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_internal_notification_case` FOREIGN KEY (`audit_case_id`) REFERENCES `audit_cases` (`audit_case_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_account_purge_events` (
  `lot_project_account_purge_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `deletion_reference` varchar(50) NOT NULL,
  `account_id_snapshot` bigint unsigned NOT NULL,
  `account_reference_snapshot` varchar(40) NOT NULL,
  `lot_project_id_snapshot` int unsigned NOT NULL,
  `lot_project_listing_id_snapshot` int unsigned NOT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `deletion_reason` text NOT NULL,
  `requested_by_user_id` int unsigned NOT NULL,
  `destructive_action_verification_id` bigint unsigned NOT NULL,
  `deleted_row_counts_json` json DEFAULT NULL,
  `cloudinary_asset_count` int unsigned NOT NULL DEFAULT '0',
  `deletion_manifest_hash` char(64) DEFAULT NULL,
  `purge_status` enum('requested','processing','completed','failed') NOT NULL DEFAULT 'requested',
  `error_message` text DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`lot_project_account_purge_event_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_account_purge_deletion_reference` (`deletion_reference`),
  KEY `idx_account_purge_account_snapshot` (`account_id_snapshot`),
  KEY `idx_account_purge_status` (`purge_status`,`requested_at`),
  KEY `fk_account_purge_requested_by` (`requested_by_user_id`),
  KEY `fk_account_purge_verification` (`destructive_action_verification_id`),
  CONSTRAINT `fk_account_purge_requested_by` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_account_purge_verification` FOREIGN KEY (`destructive_action_verification_id`) REFERENCES `destructive_action_verifications` (`destructive_action_verification_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_accounts` (
  `lot_project_account_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `account_reference` varchar(40) NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned DEFAULT NULL,
  `lot_project_reservation_history_id` bigint unsigned DEFAULT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `account_status` enum('active','pending_cancellation','cancelled','closed_fully_paid','deletion_pending') NOT NULL DEFAULT 'active',
  `reservation_date` datetime DEFAULT NULL,
  `cancellation_date` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `cash_collected_at_cancellation` decimal(14,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discontinued_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `commissionable_retained_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `commissionable_retained_percent` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `cancellation_reason` text DEFAULT NULL,
  `settlement_notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_account_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_lot_project_account_reference` (`account_reference`),
  UNIQUE KEY `uq_lot_project_account_profile` (`lot_project_client_profile_id`),
  KEY `idx_lot_project_account_listing_status` (`lot_project_listing_id`,`account_status`),
  KEY `idx_lot_project_account_project_status` (`lot_project_id`,`account_status`),
  CONSTRAINT `fk_lot_project_account_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_project_account_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_project_account_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_archived_commission_releases` (
  `lot_project_archived_commission_release_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_cancelled_sale_archive_id` bigint unsigned NOT NULL,
  `lot_project_reservation_history_id` bigint unsigned NOT NULL,
  `source_commission_release_id` int unsigned NOT NULL,
  `source_commission_id` int unsigned NOT NULL,
  `source_commission_receipt_id` int unsigned DEFAULT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned DEFAULT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `accredited_seller_id` int unsigned NOT NULL,
  `sale_owner_accredited_seller_id` int unsigned DEFAULT NULL,
  `project_name_snapshot` varchar(255) NOT NULL,
  `project_location_snapshot` varchar(255) DEFAULT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `commission_role` varchar(50) NOT NULL,
  `commission_seller_type` varchar(50) NOT NULL,
  `commission_rate_type` varchar(50) NOT NULL,
  `commission_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `gross_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `release_stage` varchar(50) NOT NULL,
  `release_trigger_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `release_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `gross_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `deduction_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `actual_release_date` date NOT NULL,
  `release_entry_mode` enum('live','historical') NOT NULL DEFAULT 'live',
  `release_recorded_at` datetime DEFAULT NULL,
  `historical_release_note` varchar(500) DEFAULT NULL,
  `external_agent_receipt_status` varchar(20) DEFAULT NULL,
  `receipt_date` date DEFAULT NULL,
  `receipt_reference_number` varchar(150) DEFAULT NULL,
  `receipt_bank_name` varchar(150) DEFAULT NULL,
  `receipt_account_number` varchar(100) DEFAULT NULL,
  `receipt_witness_name` varchar(255) DEFAULT NULL,
  `receipt_total_amount` decimal(14,2) DEFAULT NULL,
  `receipt_status` varchar(20) DEFAULT NULL,
  `receipt_created_by_name` varchar(255) DEFAULT NULL,
  `archived_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_archived_commission_release_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_archived_commission_source_release` (`source_commission_release_id`),
  KEY `idx_archived_commission_seller_date` (`accredited_seller_id`,`actual_release_date`),
  KEY `idx_archived_commission_owner_date` (`sale_owner_accredited_seller_id`,`actual_release_date`),
  KEY `idx_archived_commission_receipt` (`source_commission_receipt_id`),
  KEY `fk_archived_commission_sale_archive` (`lot_project_cancelled_sale_archive_id`),
  KEY `fk_archived_commission_history` (`lot_project_reservation_history_id`),
  KEY `idx_archived_commission_account` (`lot_project_account_id`),
  KEY `idx_archived_commission_release_entry_mode_date` (`release_entry_mode`,`actual_release_date`),
  CONSTRAINT `fk_archived_commission_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_archived_commission_history` FOREIGN KEY (`lot_project_reservation_history_id`) REFERENCES `lot_project_reservation_history` (`lot_project_reservation_history_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_archived_commission_sale_archive` FOREIGN KEY (`lot_project_cancelled_sale_archive_id`) REFERENCES `lot_project_cancelled_sale_archives` (`lot_project_cancelled_sale_archive_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_assigned_seller_changes` (
  `change_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `old_seller_id` int unsigned NOT NULL,
  `new_seller_id` int unsigned NOT NULL,
  `old_sale_channel` varchar(40) NOT NULL,
  `new_sale_channel` varchar(40) NOT NULL,
  `before_snapshot_json` json NOT NULL,
  `after_snapshot_json` json NOT NULL,
  `changed_by_user_id` int unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `authorization_type` varchar(40) NOT NULL,
  `authorization_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`change_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_seller_changes_account` (`lot_project_account_id`,`created_at`),
  KEY `idx_seller_changes_profile` (`lot_project_client_profile_id`,`created_at`),
  KEY `idx_seller_changes_actor` (`changed_by_user_id`,`created_at`),
  KEY `fk_assigned_seller_change_old` (`old_seller_id`),
  KEY `fk_assigned_seller_change_new` (`new_seller_id`),
  CONSTRAINT `fk_assigned_seller_change_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_assigned_seller_change_old` FOREIGN KEY (`old_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_assigned_seller_change_new` FOREIGN KEY (`new_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_buyer_form_links` (
  `lot_project_buyer_form_link_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `token_hash` char(64) NOT NULL,
  `generation_number` int unsigned NOT NULL,
  `link_status` enum('active','opened','submitted','expired','revoked','superseded','consumed') NOT NULL DEFAULT 'active',
  `expires_at` datetime NOT NULL,
  `generated_by_user_id` int unsigned DEFAULT NULL,
  `generated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `first_opened_at` datetime DEFAULT NULL,
  `last_opened_at` datetime DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `recipient_email` varchar(150) DEFAULT NULL,
  `recipient_mobile_number` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_buyer_form_link_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_buyer_form_token_hash` (`token_hash`),
  KEY `idx_buyer_form_link_listing_status` (`lot_project_listing_id`,`link_status`),
  KEY `idx_buyer_form_link_expiry` (`link_status`,`expires_at`),
  KEY `idx_buyer_form_link_project` (`lot_project_id`),
  KEY `idx_buyer_form_link_generator` (`generated_by_user_id`),
  KEY `idx_buyer_form_link_account` (`lot_project_account_id`),
  CONSTRAINT `fk_buyer_form_link_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_link_generator` FOREIGN KEY (`generated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_link_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_link_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_buyer_form_submissions` (
  `lot_project_buyer_form_submission_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_buyer_form_link_id` bigint unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `submission_status` enum('submitted','pending_review','approved','rejected','cancelled','archived') NOT NULL DEFAULT 'pending_review',
  `buyer_full_name` varchar(255) NOT NULL,
  `buyer_email` varchar(150) DEFAULT NULL,
  `buyer_contact_number` varchar(50) DEFAULT NULL,
  `buyer_type` enum('single','spouses','and_account') NOT NULL DEFAULT 'single',
  `submitted_payload_json` json NOT NULL,
  `approved_payload_json` json DEFAULT NULL,
  `privacy_consent_at` datetime NOT NULL,
  `submission_ip` varchar(45) DEFAULT NULL,
  `submission_user_agent` varchar(255) DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by_user_id` int unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_buyer_form_submission_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_buyer_form_submission_link` (`lot_project_buyer_form_link_id`),
  KEY `idx_buyer_form_submission_listing_status` (`lot_project_listing_id`,`submission_status`),
  KEY `idx_buyer_form_submission_project` (`lot_project_id`),
  KEY `idx_buyer_form_submission_reviewer` (`reviewed_by_user_id`),
  KEY `idx_buyer_form_submission_account` (`lot_project_account_id`),
  CONSTRAINT `fk_buyer_form_submission_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_submission_link` FOREIGN KEY (`lot_project_buyer_form_link_id`) REFERENCES `lot_project_buyer_form_links` (`lot_project_buyer_form_link_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_submission_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_submission_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_submission_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_cadastral_lot_numbers` (
  `lot_project_cadastral_lot_number_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_cadastral_lot_number` varchar(100) NOT NULL,
  `lot_project_cadastral_lot_number_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_cadastral_lot_number_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_cadastral_lot_number_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_lot_project_cadastral_number` (`lot_project_id`,`lot_project_cadastral_lot_number`),
  CONSTRAINT `fk_lot_project_cadastral_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_cancelled_sale_archives` (
  `lot_project_cancelled_sale_archive_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_reservation_history_id` bigint unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `cash_collected_at_cancellation` decimal(14,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discontinued_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `released_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `buyer_profile_snapshot` json DEFAULT NULL,
  `payment_snapshot` json DEFAULT NULL,
  `payment_schedule_snapshot` json DEFAULT NULL,
  `payment_allocation_snapshot` json DEFAULT NULL,
  `payment_log_snapshot` json DEFAULT NULL,
  `penalty_relief_snapshot` json DEFAULT NULL,
  `client_document_snapshot` json DEFAULT NULL,
  `commission_snapshot` json DEFAULT NULL,
  `commission_release_snapshot` json DEFAULT NULL,
  `commission_receipt_snapshot` json DEFAULT NULL,
  `commission_receipt_item_snapshot` json DEFAULT NULL,
  `archived_by_user_id` int unsigned DEFAULT NULL,
  `archived_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_cancelled_sale_archive_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_cancelled_sale_archive_history` (`lot_project_reservation_history_id`),
  KEY `idx_cancelled_sale_archive_project` (`lot_project_id`,`archived_at`),
  KEY `idx_cancelled_sale_archive_listing` (`lot_project_listing_id`,`archived_at`),
  KEY `fk_cancelled_sale_archive_user` (`archived_by_user_id`),
  KEY `idx_cancelled_sale_archive_account` (`lot_project_account_id`),
  CONSTRAINT `fk_cancelled_sale_archive_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_cancelled_sale_archive_history` FOREIGN KEY (`lot_project_reservation_history_id`) REFERENCES `lot_project_reservation_history` (`lot_project_reservation_history_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cancelled_sale_archive_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cancelled_sale_archive_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cancelled_sale_archive_user` FOREIGN KEY (`archived_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_client_document_files` (
  `lot_project_client_document_file_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_account_id` bigint unsigned NOT NULL,
  `lot_project_client_document_id` int unsigned NOT NULL,
  `cloudinary_asset_id` varchar(255) DEFAULT NULL,
  `cloudinary_public_id` varchar(500) NOT NULL,
  `cloudinary_resource_type` enum('image','raw','video') NOT NULL DEFAULT 'image',
  `cloudinary_delivery_type` varchar(40) NOT NULL DEFAULT 'authenticated',
  `cloudinary_version` bigint unsigned DEFAULT NULL,
  `cloudinary_asset_folder` varchar(700) DEFAULT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `stored_file_name` varchar(255) DEFAULT NULL,
  `file_version` int unsigned NOT NULL DEFAULT '1',
  `file_sequence` int unsigned NOT NULL DEFAULT '1',
  `file_format` varchar(50) DEFAULT NULL,
  `file_mime_type` varchar(150) DEFAULT NULL,
  `file_size_bytes` bigint unsigned NOT NULL DEFAULT '0',
  `malware_scan_status` enum('pending','approved','rejected','not_scanned','error') NOT NULL DEFAULT 'not_scanned',
  `malware_scan_provider` varchar(40) DEFAULT NULL,
  `malware_scan_reason` varchar(80) DEFAULT NULL,
  `malware_scanned_at` datetime DEFAULT NULL,
  `file_status` enum('active','superseded','removed') NOT NULL DEFAULT 'active',
  `uploaded_by_user_id` int unsigned DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `removed_at` datetime DEFAULT NULL,
  `removal_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`lot_project_client_document_file_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_client_document_cloudinary_asset` (`cloudinary_asset_id`),
  KEY `idx_client_document_file_account` (`lot_project_account_id`,`file_status`),
  KEY `idx_client_document_file_document` (`lot_project_client_document_id`,`file_status`),
  KEY `fk_client_document_file_user` (`uploaded_by_user_id`),
  KEY `idx_client_document_malware_scan` (`malware_scan_status`,`file_status`),
  CONSTRAINT `fk_client_document_file_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_file_document` FOREIGN KEY (`lot_project_client_document_id`) REFERENCES `lot_project_client_documents` (`lot_project_client_document_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_file_user` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_client_documents` (
  `lot_project_client_document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `document_id` int unsigned NOT NULL,
  `lot_project_client_document_file_name` varchar(255) DEFAULT NULL,
  `lot_project_client_document_file_url` longtext DEFAULT NULL,
  `lot_project_client_document_status` enum('Missing','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Missing',
  `lot_project_client_document_uploaded_at` datetime DEFAULT NULL,
  `lot_project_client_document_approved_at` datetime DEFAULT NULL,
  `lot_project_client_document_approved_by_user_id` int unsigned DEFAULT NULL,
  `lot_project_client_document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_client_document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_client_document_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_client_document` (`lot_project_client_profile_id`,`document_id`),
  KEY `fk_client_document_project` (`lot_project_id`),
  KEY `fk_client_document_listing` (`lot_project_listing_id`),
  KEY `fk_client_document_document` (`document_id`),
  KEY `fk_client_document_approved_by` (`lot_project_client_document_approved_by_user_id`),
  KEY `idx_client_document_account` (`lot_project_account_id`),
  CONSTRAINT `fk_client_document_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_approved_by` FOREIGN KEY (`lot_project_client_document_approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_client_profiles` (
  `lot_project_client_profile_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `assigned_accredited_seller_id` int unsigned DEFAULT NULL,
  `sale_channel` enum('distributed','direct_to_developer','external_group') NOT NULL DEFAULT 'distributed',
  `buyer_type` enum('single','spouses','and_account') NOT NULL DEFAULT 'single',
  `buyer_first_name` varchar(100) DEFAULT NULL,
  `buyer_middle_name` varchar(100) DEFAULT NULL,
  `buyer_last_name` varchar(100) DEFAULT NULL,
  `buyer_suffix` varchar(50) DEFAULT NULL,
  `buyer_full_name` varchar(255) DEFAULT NULL,
  `buyer_birth_date` date DEFAULT NULL,
  `buyer_place_of_birth` varchar(255) DEFAULT NULL,
  `buyer_citizenship` varchar(100) DEFAULT NULL,
  `buyer_gender` varchar(50) DEFAULT NULL,
  `buyer_civil_status` varchar(100) DEFAULT NULL,
  `buyer_contact_number` varchar(50) DEFAULT NULL,
  `buyer_residence_phone_number` varchar(50) DEFAULT NULL,
  `buyer_email` varchar(150) DEFAULT NULL,
  `buyer_tin` varchar(100) DEFAULT NULL,
  `buyer_present_address` text DEFAULT NULL,
  `buyer_present_zip_code` varchar(20) DEFAULT NULL,
  `buyer_permanent_address` text DEFAULT NULL,
  `buyer_permanent_zip_code` varchar(20) DEFAULT NULL,
  `buyer_employment_status` varchar(150) DEFAULT NULL,
  `buyer_employer_business_name` varchar(255) DEFAULT NULL,
  `buyer_employer_zip_code` varchar(20) DEFAULT NULL,
  `buyer_employer_business_address` text DEFAULT NULL,
  `buyer_nature_of_work_business` varchar(255) DEFAULT NULL,
  `buyer_occupation_position` varchar(255) DEFAULT NULL,
  `buyer_monthly_income` decimal(14,2) DEFAULT '0.00',
  `second_buyer_full_name` varchar(255) DEFAULT NULL,
  `second_buyer_first_name` varchar(100) DEFAULT NULL,
  `second_buyer_middle_name` varchar(100) DEFAULT NULL,
  `second_buyer_last_name` varchar(100) DEFAULT NULL,
  `second_buyer_suffix` varchar(50) DEFAULT NULL,
  `second_buyer_role` enum('spouse','co_owner','second_buyer') DEFAULT NULL,
  `second_buyer_birth_date` date DEFAULT NULL,
  `second_buyer_place_of_birth` varchar(255) DEFAULT NULL,
  `second_buyer_citizenship` varchar(100) DEFAULT NULL,
  `second_buyer_gender` varchar(50) DEFAULT NULL,
  `second_buyer_civil_status` varchar(100) DEFAULT NULL,
  `second_buyer_contact_number` varchar(50) DEFAULT NULL,
  `second_buyer_residence_phone_number` varchar(50) DEFAULT NULL,
  `second_buyer_email` varchar(150) DEFAULT NULL,
  `second_buyer_tin` varchar(100) DEFAULT NULL,
  `second_buyer_present_address` text DEFAULT NULL,
  `second_buyer_present_zip_code` varchar(20) DEFAULT NULL,
  `second_buyer_permanent_address` text DEFAULT NULL,
  `second_buyer_permanent_zip_code` varchar(20) DEFAULT NULL,
  `second_buyer_employment_status` varchar(150) DEFAULT NULL,
  `second_buyer_employer_business_name` varchar(255) DEFAULT NULL,
  `second_buyer_employer_zip_code` varchar(20) DEFAULT NULL,
  `second_buyer_employer_business_address` text DEFAULT NULL,
  `second_buyer_nature_of_work_business` varchar(255) DEFAULT NULL,
  `second_buyer_occupation_position` varchar(255) DEFAULT NULL,
  `second_buyer_monthly_income` decimal(14,2) DEFAULT '0.00',
  `lot_project_client_profile_status` enum('active','cancelled','closed') NOT NULL DEFAULT 'active',
  `soa_mode_of_payment` enum('cash','installment') NOT NULL DEFAULT 'installment',
  `soa_selected_price_per_sqm` decimal(12,2) DEFAULT NULL,
  `soa_selected_base_selling_price` decimal(14,2) DEFAULT NULL,
  `soa_sale_discount_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `soa_sale_discount_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `soa_selected_net_selling_price` decimal(14,2) DEFAULT NULL,
  `soa_selected_lmf_amount` decimal(14,2) DEFAULT NULL,
  `soa_selected_tcp` decimal(14,2) DEFAULT NULL,
  `soa_reservation_fee` decimal(14,2) DEFAULT NULL,
  `soa_reservation_fee_applied_to_downpayment` tinyint(1) NOT NULL DEFAULT '0',
  `soa_legal_misc_fee_mode` enum('include_in_monthly','separate_soa_row') NOT NULL DEFAULT 'include_in_monthly',
  `soa_legal_misc_fee_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `soa_lmf_waived_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `soa_lmf_waiver_reason` text DEFAULT NULL,
  `soa_lmf_waiver_reference` varchar(150) DEFAULT NULL,
  `soa_lmf_waived_by_user_id` int unsigned DEFAULT NULL,
  `soa_lmf_waived_at` datetime DEFAULT NULL,
  `soa_starting_date` date DEFAULT NULL,
  `soa_first_due_date` date DEFAULT NULL,
  `soa_is_historical_entry` tinyint(1) NOT NULL DEFAULT '0',
  `soa_downpayment_percentage` decimal(5,2) DEFAULT '30.00',
  `soa_downpayment_input_mode` enum('percentage','amount') NOT NULL DEFAULT 'percentage',
  `soa_downpayment_amount` decimal(14,2) DEFAULT NULL,
  `soa_downpayment_terms` int unsigned DEFAULT '3',
  `soa_monthly_terms` int unsigned DEFAULT '36',
  `soa_annual_interest_rate` decimal(5,2) DEFAULT '0.00',
  `soa_interest_rate_overridden` tinyint(1) NOT NULL DEFAULT '0',
  `soa_interest_calculation_type` enum('amortized','diminishing') NOT NULL DEFAULT 'amortized',
  `needs_soa_review` tinyint(1) NOT NULL DEFAULT '0',
  `soa_dp_discount_percentage` decimal(5,2) DEFAULT '0.00',
  `soa_penalty_rate_percent` decimal(5,2) NOT NULL DEFAULT '0.05',
  `soa_penalty_grace_days` int unsigned NOT NULL DEFAULT '0',
  `soa_penalty_effective_from` date DEFAULT NULL,
  `soa_penalty_calculation_method` enum('none','monthly_started','daily') NOT NULL DEFAULT 'none',
  `lot_project_client_profile_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_client_profile_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_client_profile_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_client_profile_project` (`lot_project_id`),
  KEY `idx_client_profile_assigned_seller` (`assigned_accredited_seller_id`),
  KEY `idx_client_profile_listing` (`lot_project_listing_id`),
  KEY `idx_client_profile_listing_status` (`lot_project_listing_id`,`lot_project_client_profile_status`),
  CONSTRAINT `fk_client_profile_assigned_seller` FOREIGN KEY (`assigned_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_client_profile_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_profile_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_commission_receipt_files` (
  `lot_project_commission_receipt_file_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_commission_receipt_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned NOT NULL,
  `accredited_seller_id` int unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `stored_file_name` varchar(255) NOT NULL,
  `file_version` int unsigned NOT NULL DEFAULT '1',
  `file_mime_type` varchar(150) NOT NULL,
  `file_size_bytes` bigint unsigned NOT NULL DEFAULT '0',
  `cloudinary_asset_id` varchar(255) DEFAULT NULL,
  `cloudinary_public_id` varchar(255) NOT NULL,
  `cloudinary_resource_type` varchar(30) NOT NULL DEFAULT 'image',
  `cloudinary_delivery_type` varchar(30) NOT NULL DEFAULT 'authenticated',
  `cloudinary_version` bigint unsigned DEFAULT NULL,
  `cloudinary_asset_folder` varchar(500) DEFAULT NULL,
  `cloudinary_format` varchar(50) DEFAULT NULL,
  `malware_scan_status` varchar(30) NOT NULL DEFAULT 'not_scanned',
  `malware_scan_provider` varchar(80) DEFAULT NULL,
  `malware_scan_reason` varchar(150) DEFAULT NULL,
  `malware_scanned_at` datetime DEFAULT NULL,
  `file_status` enum('active','replaced','removed') NOT NULL DEFAULT 'active',
  `uploaded_by_user_id` int unsigned DEFAULT NULL,
  `replaced_at` datetime DEFAULT NULL,
  `removed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_receipt_file_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_commission_receipt_file_public_id` (`cloudinary_public_id`),
  KEY `idx_commission_receipt_file_receipt` (`lot_project_commission_receipt_id`,`file_status`),
  KEY `idx_commission_receipt_file_account` (`lot_project_account_id`,`file_status`),
  KEY `idx_commission_receipt_file_seller` (`accredited_seller_id`),
  KEY `idx_commission_receipt_file_uploader` (`uploaded_by_user_id`),
  KEY `fk_commission_receipt_file_project` (`lot_project_id`),
  KEY `fk_commission_receipt_file_listing` (`lot_project_listing_id`),
  KEY `fk_commission_receipt_file_profile` (`lot_project_client_profile_id`),
  CONSTRAINT `fk_commission_receipt_file_receipt` FOREIGN KEY (`lot_project_commission_receipt_id`) REFERENCES `lot_project_commission_receipts` (`lot_project_commission_receipt_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_file_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_file_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_file_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_file_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_file_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_file_uploader` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_commission_receipt_items` (
  `lot_project_commission_receipt_item_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_commission_receipt_id` int unsigned NOT NULL,
  `lot_project_commission_release_id` int unsigned NOT NULL,
  `release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_receipt_item_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_commission_receipt_release` (`lot_project_commission_release_id`),
  KEY `idx_commission_receipt_item_receipt` (`lot_project_commission_receipt_id`),
  CONSTRAINT `fk_commission_receipt_item_receipt` FOREIGN KEY (`lot_project_commission_receipt_id`) REFERENCES `lot_project_commission_receipts` (`lot_project_commission_receipt_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_item_release` FOREIGN KEY (`lot_project_commission_release_id`) REFERENCES `lot_project_commission_releases` (`lot_project_commission_release_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_commission_receipts` (
  `lot_project_commission_receipt_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `lot_project_commission_id` int unsigned NOT NULL,
  `accredited_seller_id` int unsigned NOT NULL,
  `bank_name` varchar(150) NOT NULL,
  `account_number` varchar(100) NOT NULL,
  `receipt_date` date NOT NULL,
  `reference_number` varchar(150) NOT NULL,
  `witness_name` varchar(255) NOT NULL,
  `total_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `receipt_status` enum('active','void') NOT NULL DEFAULT 'active',
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_receipt_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_commission_receipt_seller` (`accredited_seller_id`),
  KEY `idx_commission_receipt_commission` (`lot_project_commission_id`),
  KEY `idx_commission_receipt_listing` (`lot_project_listing_id`),
  KEY `idx_commission_receipt_date` (`receipt_date`),
  KEY `idx_commission_receipt_creator` (`created_by_user_id`),
  KEY `fk_commission_receipt_project` (`lot_project_id`),
  KEY `fk_commission_receipt_client` (`lot_project_client_profile_id`),
  KEY `idx_commission_receipt_account` (`lot_project_account_id`),
  CONSTRAINT `fk_commission_receipt_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_client` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_commission` FOREIGN KEY (`lot_project_commission_id`) REFERENCES `lot_project_commissions` (`lot_project_commission_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_commission_releases` (
  `lot_project_commission_release_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_commission_id` int unsigned NOT NULL,
  `release_stage` enum('1st Release','2nd Release','3rd Release','4th Release','Retention') NOT NULL,
  `release_trigger_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `release_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `gross_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `deduction_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `release_status` enum('Pending','Eligible','Earned on Cancellation','Released','On Hold','Forfeited on Cancellation','Cancelled') NOT NULL DEFAULT 'Pending',
  `cancellation_earning_reason` varchar(255) DEFAULT NULL,
  `cancellation_settled_at` datetime DEFAULT NULL,
  `scheduled_release_date` date DEFAULT NULL,
  `actual_release_date` date DEFAULT NULL,
  `released_by_user_id` int unsigned DEFAULT NULL,
  `release_entry_mode` enum('live','historical') NOT NULL DEFAULT 'live',
  `release_recorded_at` datetime DEFAULT NULL,
  `historical_release_note` varchar(500) DEFAULT NULL,
  `external_agent_receipt_status` enum('unsubmitted','submitted') DEFAULT NULL,
  `external_receipt_hold_source_release_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_release_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_commission_release_commission` (`lot_project_commission_id`),
  KEY `fk_commission_release_user` (`released_by_user_id`),
  UNIQUE KEY `uq_commission_release_stage` (`lot_project_commission_id`,`release_stage`),
  KEY `idx_commission_release_entry_mode_date` (`release_entry_mode`,`actual_release_date`),
  KEY `idx_commission_release_external_receipt_status` (`external_agent_receipt_status`),
  KEY `idx_commission_release_receipt_hold_source` (`external_receipt_hold_source_release_id`),
  CONSTRAINT `fk_commission_release_commission` FOREIGN KEY (`lot_project_commission_id`) REFERENCES `lot_project_commissions` (`lot_project_commission_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_release_user` FOREIGN KEY (`released_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_commissions` (
  `lot_project_commission_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `accredited_seller_id` int unsigned NOT NULL,
  `sale_origin_accredited_seller_id` int unsigned DEFAULT NULL,
  `sale_owner_accredited_seller_id` int unsigned DEFAULT NULL,
  `commission_role` enum('division_manager','sales_director','unit_manager','sales_agent','external_group') NOT NULL,
  `commission_seller_type` enum('main_seller','hierarchy_seller','selling_agent') NOT NULL,
  `commission_sale_type` enum('direct','distributed') NOT NULL DEFAULT 'distributed',
  `commission_rate_type` enum('direct','override') NOT NULL DEFAULT 'override',
  `seller_display_name_snapshot` varchar(255) DEFAULT NULL,
  `seller_group_name_snapshot` varchar(150) DEFAULT NULL,
  `commission_pool_rate_snapshot` decimal(7,4) DEFAULT NULL,
  `company_profit_rate_snapshot` decimal(7,4) DEFAULT NULL,
  `distribution_pool_rate_snapshot` decimal(7,4) DEFAULT NULL,
  `role_pool_share_percent_snapshot` decimal(7,4) DEFAULT NULL,
  `commission_base_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `commission_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `gross_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `released_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_remaining_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payment_percent` decimal(7,2) NOT NULL DEFAULT '0.00',
  `commission_status` enum('Pending','Eligible','Partially Released','Released','On Hold','Cancelled') NOT NULL DEFAULT 'Pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_commission_seller_per_profile` (`lot_project_client_profile_id`,`accredited_seller_id`),
  KEY `fk_commission_project` (`lot_project_id`),
  KEY `fk_commission_client_profile` (`lot_project_client_profile_id`),
  KEY `fk_commission_seller` (`accredited_seller_id`),
  KEY `idx_commission_rate_type` (`commission_rate_type`),
  KEY `idx_commission_sale_origin` (`sale_origin_accredited_seller_id`),
  KEY `idx_commission_sale_owner` (`sale_owner_accredited_seller_id`),
  KEY `idx_commission_listing` (`lot_project_listing_id`),
  KEY `idx_commission_account` (`lot_project_account_id`),
  CONSTRAINT `fk_commission_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_sale_origin` FOREIGN KEY (`sale_origin_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_sale_owner` FOREIGN KEY (`sale_owner_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_contract_adjustments` (
  `lot_project_contract_adjustment_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `lot_project_payment_schedule_id` int unsigned DEFAULT NULL,
  `adjustment_type` enum('lmf_waiver') NOT NULL,
  `original_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `adjustment_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `reason` text NOT NULL,
  `approval_reference` varchar(150) DEFAULT NULL,
  `internal_notes` text DEFAULT NULL,
  `approved_by_user_id` int unsigned NOT NULL,
  `approved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','reversed') NOT NULL DEFAULT 'active',
  `reversed_by_user_id` int unsigned DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `reversal_reason` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_contract_adjustment_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_contract_adjustment_project` (`lot_project_id`),
  KEY `idx_contract_adjustment_listing` (`lot_project_listing_id`),
  KEY `idx_contract_adjustment_profile` (`lot_project_client_profile_id`),
  KEY `idx_contract_adjustment_account` (`lot_project_account_id`),
  KEY `idx_contract_adjustment_schedule` (`lot_project_payment_schedule_id`),
  KEY `idx_contract_adjustment_approved_by` (`approved_by_user_id`),
  KEY `fk_contract_adjustment_reversed_by` (`reversed_by_user_id`),
  CONSTRAINT `fk_contract_adjustment_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_contract_adjustment_approved_by` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_contract_adjustment_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_contract_adjustment_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_contract_adjustment_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_contract_adjustment_reversed_by` FOREIGN KEY (`reversed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_contract_adjustment_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_default_documents` (
  `lot_project_default_document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `document_id` int unsigned NOT NULL,
  `lot_project_default_document_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `lot_project_default_document_responsible_party` enum('client','internal','seller') NOT NULL DEFAULT 'client',
  `lot_project_default_document_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `lot_project_default_document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_default_document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_default_document_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_lot_project_default_document` (`lot_project_id`,`document_id`),
  KEY `fk_lot_project_default_document_document` (`document_id`),
  CONSTRAINT `fk_lot_project_default_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_project_default_document_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_document_notification_logs` (
  `document_notification_log_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned DEFAULT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `recipient_email` varchar(150) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `attachment_filename` varchar(255) DEFAULT NULL,
  `sent_by_user_id` int unsigned DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `send_status` enum('sent','failed') NOT NULL DEFAULT 'sent',
  `error_message` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_notification_log_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_document_notification_listing_client` (`lot_project_listing_id`,`lot_project_client_profile_id`),
  KEY `idx_document_notification_project` (`lot_project_id`),
  KEY `idx_document_notification_account` (`lot_project_account_id`),
  KEY `idx_document_notification_sender` (`sent_by_user_id`),
  KEY `fk_document_notification_client` (`lot_project_client_profile_id`),
  CONSTRAINT `fk_document_notification_client` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_document_notification_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_document_notification_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_document_notification_sender` FOREIGN KEY (`sent_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_listing_bulk_batches` (
  `batch_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `changed_by_user_id` int unsigned DEFAULT NULL,
  `source_filename` varchar(255) DEFAULT NULL,
  `adjustment_reason` varchar(1000) NOT NULL,
  `changed_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_listing_bulk_project` (`lot_project_id`,`created_at`),
  KEY `fk_listing_bulk_user` (`changed_by_user_id`),
  CONSTRAINT `fk_listing_bulk_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_listing_bulk_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_listing_bulk_rows` (
  `row_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `before_snapshot_json` json NOT NULL,
  `after_snapshot_json` json NOT NULL,
  `changed_fields_json` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`row_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_listing_bulk_listing` (`lot_project_listing_id`,`created_at`),
  KEY `fk_listing_bulk_row_batch` (`batch_id`),
  CONSTRAINT `fk_listing_bulk_row_batch` FOREIGN KEY (`batch_id`) REFERENCES `lot_project_listing_bulk_batches` (`batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_listing_bulk_row_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_listing_cadastral_lots` (
  `lot_project_listing_cadastral_lot_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_cadastral_lot_number_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_listing_cadastral_lot_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_listing_cadastral_lot` (`lot_project_listing_id`,`lot_project_cadastral_lot_number_id`),
  KEY `fk_listing_cadastral_lot_number` (`lot_project_cadastral_lot_number_id`),
  CONSTRAINT `fk_listing_cadastral_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_cadastral_lot_number` FOREIGN KEY (`lot_project_cadastral_lot_number_id`) REFERENCES `lot_project_cadastral_lot_numbers` (`lot_project_cadastral_lot_number_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_listing_documents` (
  `lot_project_listing_document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `document_id` int unsigned NOT NULL,
  `lot_project_listing_document_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `lot_project_listing_document_responsible_party` enum('client','internal','seller') NOT NULL DEFAULT 'client',
  `lot_project_listing_document_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `lot_project_listing_document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_listing_document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_listing_document_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_listing_document` (`lot_project_listing_id`,`document_id`),
  KEY `fk_listing_document_project` (`lot_project_id`),
  KEY `fk_listing_document_document` (`document_id`),
  CONSTRAINT `fk_listing_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_document_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_document_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_listing_import_batches` (
  `lot_project_listing_import_batch_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_reference` varchar(40) NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `file_sha256` char(64) DEFAULT NULL,
  `total_rows` int unsigned NOT NULL DEFAULT '0',
  `valid_rows` int unsigned NOT NULL DEFAULT '0',
  `imported_rows` int unsigned NOT NULL DEFAULT '0',
  `removed_rows` int unsigned NOT NULL DEFAULT '0',
  `import_status` enum('validated','imported','partially_reverted','reverted','failed') NOT NULL DEFAULT 'validated',
  `imported_by_user_id` int unsigned DEFAULT NULL,
  `imported_at` datetime DEFAULT NULL,
  `reverted_by_user_id` int unsigned DEFAULT NULL,
  `reverted_at` datetime DEFAULT NULL,
  `revert_reason` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_listing_import_batch_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_listing_import_batch_reference` (`batch_reference`),
  KEY `idx_listing_import_project_created` (`lot_project_id`,`created_at`),
  KEY `idx_listing_import_status` (`import_status`),
  KEY `fk_listing_import_user` (`imported_by_user_id`),
  KEY `fk_listing_import_reverted_user` (`reverted_by_user_id`),
  CONSTRAINT `fk_listing_import_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_import_user` FOREIGN KEY (`imported_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_import_reverted_user` FOREIGN KEY (`reverted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_listing_import_rows` (
  `lot_project_listing_import_row_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_listing_import_batch_id` bigint unsigned NOT NULL,
  `excel_row_number` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned DEFAULT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `original_input_json` json DEFAULT NULL,
  `normalized_input_json` json DEFAULT NULL,
  `validation_status` enum('valid','invalid','imported','removed') NOT NULL DEFAULT 'valid',
  `validation_errors_json` json DEFAULT NULL,
  `imported_at` datetime DEFAULT NULL,
  `removed_at` datetime DEFAULT NULL,
  `removed_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_listing_import_row_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_listing_import_batch_excel_row` (`lot_project_listing_import_batch_id`,`excel_row_number`),
  KEY `idx_listing_import_row_listing` (`lot_project_listing_id`),
  KEY `idx_listing_import_row_status` (`lot_project_listing_import_batch_id`,`validation_status`),
  KEY `fk_listing_import_row_removed_user` (`removed_by_user_id`),
  CONSTRAINT `fk_listing_import_row_batch` FOREIGN KEY (`lot_project_listing_import_batch_id`) REFERENCES `lot_project_listing_import_batches` (`lot_project_listing_import_batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_import_row_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_import_row_removed_user` FOREIGN KEY (`removed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_listings` (
  `lot_project_listing_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_listing_storage_code` varchar(40) DEFAULT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_unit_type` enum('Inner','Corner','End') NOT NULL,
  `lot_project_listing_unit_id` varchar(50) NOT NULL,
  `lot_project_listing_old_unit_ids` text DEFAULT NULL,
  `lot_project_listing_area_sqm` decimal(12,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_price_per_sqm` decimal(12,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_installment_price_per_sqm` decimal(12,2) DEFAULT NULL,
  `lot_project_listing_cash_price_per_sqm` decimal(12,2) DEFAULT NULL,
  `lot_project_listing_net_selling_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_lmf_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_lmf_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_tcp` decimal(14,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_reservation_fee` decimal(14,2) NOT NULL DEFAULT '0.00',
  `annual_interest_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_status` enum('available','hold','sold','pending_for_cancellation','cancelled') NOT NULL DEFAULT 'available',
  `lot_project_listing_sold_substatus` enum('active','fully_paid') DEFAULT NULL,
  `lot_project_listing_cancellation_type` enum('refunded','discontinued') DEFAULT NULL,
  `lot_project_listing_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_listing_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hold_client_name` varchar(150) DEFAULT NULL,
  `hold_note` text DEFAULT NULL,
  `hold_created_at` datetime DEFAULT NULL,
  `hold_created_by_user_id` int unsigned DEFAULT NULL,
  `buyer_form_generation` int unsigned NOT NULL DEFAULT '0',
  `pending_buyer_form_submission_id` bigint unsigned DEFAULT NULL,
  `current_account_id` bigint unsigned DEFAULT NULL,
  `created_from_import_batch_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`lot_project_listing_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_project_unit_id` (`lot_project_id`,`lot_project_listing_unit_id`),
  KEY `idx_listing_pending_buyer_form_submission` (`pending_buyer_form_submission_id`),
  KEY `idx_listing_current_account` (`current_account_id`),
  UNIQUE KEY `uq_lot_project_listing_storage_code` (`lot_project_listing_storage_code`),
  KEY `idx_listing_import_batch` (`created_from_import_batch_id`),
  CONSTRAINT `fk_listing_current_account` FOREIGN KEY (`current_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_pending_buyer_form_submission` FOREIGN KEY (`pending_buyer_form_submission_id`) REFERENCES `lot_project_buyer_form_submissions` (`lot_project_buyer_form_submission_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_project_listing_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_network_profit_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned NOT NULL,
  `seller_group_id` int unsigned NOT NULL,
  `source_commission_id` int unsigned DEFAULT NULL,
  `network_name_snapshot` varchar(150) NOT NULL,
  `broker_name_snapshot` varchar(180) NOT NULL,
  `payee_name_snapshot` varchar(180) NOT NULL,
  `commission_base_snapshot` decimal(14,2) NOT NULL,
  `company_profit_rate_snapshot` decimal(7,4) NOT NULL,
  `gross_profit_snapshot` decimal(14,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_network_profit_account` (`lot_project_account_id`,`seller_group_id`),
  KEY `idx_network_profit_project` (`lot_project_id`,`lot_project_account_id`),
  KEY `fk_network_profit_network` (`seller_group_id`),
  CONSTRAINT `fk_network_profit_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_network_profit_network` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_network_profit_releases` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `profit_account_id` bigint unsigned NOT NULL,
  `release_stage` varchar(32) NOT NULL,
  `release_trigger_percent` decimal(7,2) NOT NULL,
  `release_percent` decimal(7,2) NOT NULL,
  `release_amount` decimal(14,2) NOT NULL,
  `release_status` enum('Pending','On Hold','Released') NOT NULL DEFAULT 'Pending',
  `actual_release_date` date DEFAULT NULL,
  `released_by_user_id` int unsigned DEFAULT NULL,
  `payee_name` varchar(180) DEFAULT NULL,
  `payment_method` varchar(30) DEFAULT NULL,
  `payment_reference` varchar(120) DEFAULT NULL,
  `release_recorded_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bank_name` varchar(150) DEFAULT NULL,
  `account_number` varchar(100) DEFAULT NULL,
  `receipt_date` date DEFAULT NULL,
  `witness_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_network_profit_stage` (`profit_account_id`,`release_stage`),
  KEY `idx_network_profit_status` (`release_status`,`actual_release_date`),
  CONSTRAINT `fk_network_profit_release_account` FOREIGN KEY (`profit_account_id`) REFERENCES `lot_project_network_profit_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_network_profit_signed_files` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `profit_release_id` bigint unsigned NOT NULL,
  `file_version` int unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_mime_type` varchar(150) NOT NULL,
  `file_size_bytes` bigint unsigned NOT NULL,
  `cloudinary_asset_id` varchar(255) DEFAULT NULL,
  `cloudinary_public_id` varchar(255) NOT NULL,
  `cloudinary_resource_type` varchar(30) NOT NULL DEFAULT 'image',
  `cloudinary_version` bigint unsigned DEFAULT NULL,
  `cloudinary_format` varchar(50) DEFAULT NULL,
  `cloudinary_asset_folder` varchar(500) NOT NULL,
  `malware_scan_status` varchar(30) NOT NULL DEFAULT 'pending',
  `malware_scan_provider` varchar(80) DEFAULT NULL,
  `malware_scan_reason` varchar(255) DEFAULT NULL,
  `malware_scanned_at` datetime DEFAULT NULL,
  `file_status` enum('active','replaced','removed') NOT NULL DEFAULT 'active',
  `uploaded_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_network_profit_file_public_id` (`cloudinary_public_id`),
  UNIQUE KEY `uq_network_profit_file_version` (`profit_release_id`,`file_version`),
  KEY `idx_network_profit_file_release` (`profit_release_id`,`file_status`),
  CONSTRAINT `fk_network_profit_file_release` FOREIGN KEY (`profit_release_id`) REFERENCES `lot_project_network_profit_releases` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_notification_logs` (
  `notification_log_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned DEFAULT NULL,
  `lot_project_listing_id` int unsigned DEFAULT NULL,
  `lot_project_client_profile_id` int unsigned DEFAULT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `lot_project_payment_schedule_id` int unsigned DEFAULT NULL,
  `notification_type` enum('due_soon','overdue') NOT NULL,
  `recipient_email` varchar(150) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `sent_by_user_id` int unsigned DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `send_status` enum('sent','failed','contacted') NOT NULL DEFAULT 'sent',
  `error_message` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_log_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_notification_schedule` (`lot_project_payment_schedule_id`),
  KEY `idx_notification_project` (`lot_project_id`),
  KEY `idx_notification_listing` (`lot_project_listing_id`),
  KEY `idx_notification_client` (`lot_project_client_profile_id`),
  KEY `idx_notification_sender` (`sent_by_user_id`),
  KEY `idx_notification_account` (`lot_project_account_id`),
  CONSTRAINT `fk_notification_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_log_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_sender` FOREIGN KEY (`sent_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_payment_acknowledgement_files` (
  `lot_project_payment_acknowledgement_file_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_payment_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `stored_file_name` varchar(255) NOT NULL,
  `file_version` int unsigned NOT NULL DEFAULT '1',
  `file_mime_type` varchar(150) NOT NULL,
  `file_size_bytes` bigint unsigned NOT NULL DEFAULT '0',
  `cloudinary_asset_id` varchar(255) DEFAULT NULL,
  `cloudinary_public_id` varchar(255) NOT NULL,
  `cloudinary_resource_type` varchar(30) NOT NULL DEFAULT 'image',
  `cloudinary_delivery_type` varchar(30) NOT NULL DEFAULT 'authenticated',
  `cloudinary_version` bigint unsigned DEFAULT NULL,
  `cloudinary_asset_folder` varchar(500) DEFAULT NULL,
  `cloudinary_format` varchar(50) DEFAULT NULL,
  `malware_scan_status` varchar(30) NOT NULL DEFAULT 'not_scanned',
  `malware_scan_provider` varchar(80) DEFAULT NULL,
  `malware_scan_reason` varchar(150) DEFAULT NULL,
  `malware_scanned_at` datetime DEFAULT NULL,
  `file_status` enum('active','replaced','removed') NOT NULL DEFAULT 'active',
  `uploaded_by_user_id` int unsigned DEFAULT NULL,
  `replaced_at` datetime DEFAULT NULL,
  `removed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_acknowledgement_file_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_payment_ack_file_public_id` (`cloudinary_public_id`),
  KEY `idx_payment_ack_file_payment` (`lot_project_payment_id`,`file_status`),
  KEY `idx_payment_ack_file_account` (`lot_project_account_id`,`file_status`),
  KEY `idx_payment_ack_file_listing` (`lot_project_listing_id`),
  KEY `idx_payment_ack_file_uploader` (`uploaded_by_user_id`),
  KEY `fk_payment_ack_file_project` (`lot_project_id`),
  KEY `fk_payment_ack_file_profile` (`lot_project_client_profile_id`),
  CONSTRAINT `fk_payment_ack_file_payment` FOREIGN KEY (`lot_project_payment_id`) REFERENCES `lot_project_payments` (`lot_project_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_ack_file_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_ack_file_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_ack_file_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_ack_file_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_ack_file_uploader` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_payment_allocations` (
  `lot_project_payment_allocation_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_payment_id` int unsigned NOT NULL,
  `lot_project_payment_schedule_id` int unsigned NOT NULL,
  `applied_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_allocation_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_payment_allocation_payment` (`lot_project_payment_id`),
  KEY `idx_payment_allocation_schedule` (`lot_project_payment_schedule_id`),
  CONSTRAINT `fk_payment_allocation_payment` FOREIGN KEY (`lot_project_payment_id`) REFERENCES `lot_project_payments` (`lot_project_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocation_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_payment_logs` (
  `lot_project_payment_log_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_payment_id` int unsigned NOT NULL,
  `action_type` enum('created','updated','verified','rejected','cancelled','deleted') NOT NULL,
  `action_description` text DEFAULT NULL,
  `action_by_user_id` int unsigned DEFAULT NULL,
  `action_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_log_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_payment_log_payment` (`lot_project_payment_id`),
  KEY `fk_payment_log_user` (`action_by_user_id`),
  CONSTRAINT `fk_payment_log_payment` FOREIGN KEY (`lot_project_payment_id`) REFERENCES `lot_project_payments` (`lot_project_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_log_user` FOREIGN KEY (`action_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_payment_proofs` (
  `lot_project_payment_proof_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `lot_project_payment_id` int unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `stored_file_name` varchar(255) DEFAULT NULL,
  `proof_sequence` int unsigned NOT NULL DEFAULT '1',
  `file_mime_type` varchar(150) NOT NULL,
  `file_size_bytes` bigint unsigned NOT NULL DEFAULT '0',
  `cloudinary_asset_id` varchar(255) DEFAULT NULL,
  `cloudinary_public_id` varchar(255) NOT NULL,
  `cloudinary_resource_type` varchar(30) NOT NULL DEFAULT 'image',
  `cloudinary_delivery_type` varchar(30) NOT NULL DEFAULT 'authenticated',
  `cloudinary_version` bigint unsigned DEFAULT NULL,
  `cloudinary_asset_folder` varchar(500) DEFAULT NULL,
  `cloudinary_format` varchar(50) DEFAULT NULL,
  `malware_scan_status` enum('pending','approved','rejected','not_scanned','error') NOT NULL DEFAULT 'not_scanned',
  `malware_scan_provider` varchar(40) DEFAULT NULL,
  `malware_scan_reason` varchar(80) DEFAULT NULL,
  `malware_scanned_at` datetime DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `uploaded_by_user_id` int unsigned DEFAULT NULL,
  `proof_status` enum('active','removed') NOT NULL DEFAULT 'active',
  `removed_by_user_id` int unsigned DEFAULT NULL,
  `removed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_proof_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_payment_proof_cloudinary_public_id` (`cloudinary_public_id`),
  KEY `idx_payment_proof_payment` (`lot_project_payment_id`,`proof_status`),
  KEY `idx_payment_proof_account` (`lot_project_account_id`),
  KEY `idx_payment_proof_listing` (`lot_project_listing_id`),
  KEY `idx_payment_proof_uploaded_by` (`uploaded_by_user_id`),
  KEY `fk_payment_proof_project` (`lot_project_id`),
  KEY `fk_payment_proof_profile` (`lot_project_client_profile_id`),
  KEY `fk_payment_proof_removed_by` (`removed_by_user_id`),
  KEY `idx_payment_proof_malware_scan` (`malware_scan_status`,`proof_status`),
  CONSTRAINT `fk_payment_proof_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_proof_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_proof_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_proof_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_proof_payment` FOREIGN KEY (`lot_project_payment_id`) REFERENCES `lot_project_payments` (`lot_project_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_proof_uploaded_by` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_proof_removed_by` FOREIGN KEY (`removed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_payment_schedules` (
  `lot_project_payment_schedule_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `description` varchar(150) NOT NULL,
  `beginning_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `due_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `interest_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `principal_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `monthly_amortization_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `penalty_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `calculated_penalty_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `waived_penalty_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `penalty_calculated_through` date DEFAULT NULL,
  `amount_paid` decimal(14,2) NOT NULL DEFAULT '0.00',
  `paid_penalty_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `paid_interest_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `paid_principal_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `date_paid` date DEFAULT NULL,
  `reference_id` varchar(150) DEFAULT NULL,
  `ending_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `schedule_status` enum('Unpaid','Partial','Paid','Advance','Overdue','Cancelled') NOT NULL DEFAULT 'Unpaid',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_schedule_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_schedule_project` (`lot_project_id`),
  KEY `fk_schedule_listing` (`lot_project_listing_id`),
  KEY `fk_schedule_client_profile` (`lot_project_client_profile_id`),
  KEY `idx_payment_schedule_account` (`lot_project_account_id`),
  CONSTRAINT `fk_payment_schedule_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_schedule_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedule_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedule_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_payments` (
  `lot_project_payment_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_payment_storage_code` varchar(40) DEFAULT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `lot_project_payment_schedule_id` int unsigned DEFAULT NULL,
  `lot_project_payment_type` enum('reservation','downpayment','monthly_amortization','legal_misc','advance_payment','balloon','full_payment','other') NOT NULL,
  `lot_project_payment_method` enum('Cash','Bank Transfer','Online Payment','Check','Other') NOT NULL DEFAULT 'Cash',
  `lot_project_payment_bank_name` varchar(150) DEFAULT NULL,
  `lot_project_payment_account_number` varchar(100) DEFAULT NULL,
  `lot_project_payment_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `lot_project_payment_date` date NOT NULL,
  `lot_project_payment_reference_id` varchar(150) DEFAULT NULL,
  `lot_project_payment_request_key` varchar(80) DEFAULT NULL,
  `lot_project_payment_status` enum('Pending','Verified','Rejected','Cancelled') NOT NULL DEFAULT 'Verified',
  `lot_project_payment_verified_by_user_id` int unsigned DEFAULT NULL,
  `lot_project_payment_verified_at` datetime DEFAULT NULL,
  `lot_project_payment_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_payment_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_payment_reference` (`lot_project_payment_reference_id`),
  KEY `fk_payment_project` (`lot_project_id`),
  KEY `fk_payment_listing` (`lot_project_listing_id`),
  KEY `fk_payment_client_profile` (`lot_project_client_profile_id`),
  KEY `fk_payment_schedule` (`lot_project_payment_schedule_id`),
  KEY `fk_payment_verified_by` (`lot_project_payment_verified_by_user_id`),
  KEY `idx_payment_account` (`lot_project_account_id`),
  UNIQUE KEY `uq_lot_project_payment_request_key` (`lot_project_payment_request_key`),
  UNIQUE KEY `uq_lot_project_payment_storage_code` (`lot_project_payment_storage_code`),
  CONSTRAINT `fk_payment_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_verified_by` FOREIGN KEY (`lot_project_payment_verified_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_penalty_reliefs` (
  `penalty_relief_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `lot_project_payment_schedule_id` int unsigned NOT NULL,
  `lot_project_payment_id` int unsigned DEFAULT NULL,
  `relief_type` enum('penalty_free_extension','full_waiver','partial_waiver','penalty_correction','restoration') NOT NULL,
  `promised_payment_date` date DEFAULT NULL,
  `effective_date` date DEFAULT NULL,
  `relief_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `restores_penalty_relief_id` int unsigned DEFAULT NULL,
  `status` enum('active','honored','partially_honored','broken','expired','cancelled','restored') NOT NULL DEFAULT 'active',
  `reason` varchar(255) NOT NULL,
  `internal_notes` text DEFAULT NULL,
  `approved_by_user_id` int unsigned NOT NULL,
  `honored_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`penalty_relief_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_penalty_relief_schedule` (`lot_project_payment_schedule_id`),
  KEY `idx_penalty_relief_listing` (`lot_project_listing_id`),
  KEY `idx_penalty_relief_status` (`status`),
  KEY `idx_penalty_relief_restores` (`restores_penalty_relief_id`),
  KEY `fk_penalty_relief_project` (`lot_project_id`),
  KEY `fk_penalty_relief_profile` (`lot_project_client_profile_id`),
  KEY `fk_penalty_relief_user` (`approved_by_user_id`),
  KEY `idx_penalty_relief_account` (`lot_project_account_id`),
  KEY `idx_penalty_relief_effective_date` (`effective_date`),
  KEY `idx_penalty_relief_payment` (`lot_project_payment_id`),
  KEY `fk_penalty_relief_payment` (`lot_project_payment_id`),
  CONSTRAINT `fk_penalty_relief_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_restores` FOREIGN KEY (`restores_penalty_relief_id`) REFERENCES `lot_project_penalty_reliefs` (`penalty_relief_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_user` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_payment` FOREIGN KEY (`lot_project_payment_id`) REFERENCES `lot_project_payments` (`lot_project_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_reservation_corrections` (
  `lot_project_reservation_correction_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_reservation_history_id` bigint unsigned DEFAULT NULL,
  `source_listing_id` int unsigned NOT NULL,
  `source_unit_id_snapshot` varchar(50) NOT NULL,
  `destination_listing_id` int unsigned NOT NULL,
  `destination_unit_id_snapshot` varchar(50) NOT NULL,
  `account_reference_snapshot` varchar(80) DEFAULT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `before_snapshot` json NOT NULL,
  `after_snapshot` json NOT NULL,
  `correction_reason` varchar(500) NOT NULL,
  `corrected_by_user_id` int unsigned DEFAULT NULL,
  `corrected_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_reservation_correction_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_reservation_correction_project` (`lot_project_id`,`corrected_at`),
  KEY `idx_reservation_correction_account` (`lot_project_account_id`,`corrected_at`),
  KEY `idx_reservation_correction_source` (`source_listing_id`,`corrected_at`),
  KEY `idx_reservation_correction_destination` (`destination_listing_id`,`corrected_at`),
  KEY `fk_reservation_correction_profile` (`lot_project_client_profile_id`),
  KEY `fk_reservation_correction_history` (`lot_project_reservation_history_id`),
  KEY `fk_reservation_correction_user` (`corrected_by_user_id`),
  CONSTRAINT `fk_reservation_correction_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_correction_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_correction_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_correction_history` FOREIGN KEY (`lot_project_reservation_history_id`) REFERENCES `lot_project_reservation_history` (`lot_project_reservation_history_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_correction_source_listing` FOREIGN KEY (`source_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_correction_destination_listing` FOREIGN KEY (`destination_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_correction_user` FOREIGN KEY (`corrected_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_reservation_history` (
  `lot_project_reservation_history_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned DEFAULT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `reservation_status` enum('active','pending_for_cancellation','cancelled') NOT NULL DEFAULT 'active',
  `reserved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `pricing_mode_snapshot` enum('cash','installment') DEFAULT NULL,
  `price_per_sqm_snapshot` decimal(12,2) NOT NULL DEFAULT '0.00',
  `base_selling_price_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_selling_price_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `lmf_amount_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `sale_discount_percentage_snapshot` decimal(5,2) NOT NULL DEFAULT '0.00',
  `sale_discount_amount_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `dp_discount_percentage_snapshot` decimal(5,2) NOT NULL DEFAULT '0.00',
  `dp_discount_amount_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `tcp_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discount_percentage_snapshot` decimal(5,2) NOT NULL DEFAULT '0.00',
  `discount_applied_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_type` enum('refunded','discontinued') DEFAULT NULL,
  `cancellation_refund_type` enum('no_refund','partial_refund','full_refund') DEFAULT NULL,
  `cancellation_reason` text DEFAULT NULL,
  `cancelled_value` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cash_collected_at_cancellation` decimal(14,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discontinued_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `refund_date` date DEFAULT NULL,
  `refund_reference` varchar(150) DEFAULT NULL,
  `cancellation_settlement_notes` text DEFAULT NULL,
  `released_commission_amount_at_cancellation` decimal(14,2) NOT NULL DEFAULT '0.00',
  `sale_data_archived_at` datetime DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `cancelled_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_reservation_history_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_reservation_history_project_reserved` (`lot_project_id`,`reserved_at`),
  KEY `idx_reservation_history_project_cancelled` (`lot_project_id`,`cancelled_at`),
  KEY `idx_reservation_history_listing_status` (`lot_project_listing_id`,`reservation_status`),
  KEY `fk_reservation_history_profile` (`lot_project_client_profile_id`),
  KEY `fk_reservation_history_created_by` (`created_by_user_id`),
  KEY `fk_reservation_history_cancelled_by` (`cancelled_by_user_id`),
  KEY `idx_reservation_history_account` (`lot_project_account_id`),
  CONSTRAINT `fk_reservation_history_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_cancelled_by` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_settings` (
  `lot_project_setting_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `release_day_one` tinyint unsigned NOT NULL DEFAULT '7',
  `release_day_two` tinyint unsigned NOT NULL DEFAULT '22',
  `reservation_contact_name` varchar(150) DEFAULT NULL,
  `reservation_contact_email` varchar(150) DEFAULT NULL,
  `reservation_contact_number` varchar(50) DEFAULT NULL,
  `company_name` varchar(150) DEFAULT NULL,
  `company_email` varchar(150) DEFAULT NULL,
  `company_contact_number` varchar(50) DEFAULT NULL,
  `payment_entry_email_notification_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `default_penalty_rate_percent` decimal(5,2) NOT NULL DEFAULT '0.05',
  `default_penalty_grace_days` int unsigned NOT NULL DEFAULT '0',
  `lot_project_setting_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_setting_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_setting_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_lot_project_setting` (`lot_project_id`),
  CONSTRAINT `fk_lot_project_setting_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_project_soa_statements` (
  `soa_statement_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `soa_reference` varchar(32) DEFAULT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_account_id` bigint unsigned DEFAULT NULL,
  `lot_project_payment_schedule_id` int unsigned NOT NULL,
  `statement_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `description` varchar(150) NOT NULL,
  `total_contract_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `legal_misc_fee` decimal(14,2) NOT NULL DEFAULT '0.00',
  `due_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `penalty_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payment_due` decimal(14,2) NOT NULL DEFAULT '0.00',
  `recipient_email` varchar(150) NOT NULL,
  `pdf_filename` varchar(255) DEFAULT NULL,
  `snapshot_json` json DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `last_sent_by_user_id` int unsigned DEFAULT NULL,
  `first_sent_at` datetime DEFAULT NULL,
  `last_sent_at` datetime DEFAULT NULL,
  `sent_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`soa_statement_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_soa_schedule` (`lot_project_payment_schedule_id`),
  UNIQUE KEY `uq_soa_reference` (`soa_reference`),
  KEY `idx_soa_project` (`lot_project_id`),
  KEY `idx_soa_listing` (`lot_project_listing_id`),
  KEY `idx_soa_client` (`lot_project_client_profile_id`),
  KEY `idx_soa_created_by` (`created_by_user_id`),
  KEY `idx_soa_last_sent_by` (`last_sent_by_user_id`),
  KEY `idx_soa_statement_account` (`lot_project_account_id`),
  CONSTRAINT `fk_soa_client` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_last_sent_by` FOREIGN KEY (`last_sent_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_statement_account` FOREIGN KEY (`lot_project_account_id`) REFERENCES `lot_project_accounts` (`lot_project_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `lot_projects` (
  `lot_project_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_storage_code` varchar(40) DEFAULT NULL,
  `lot_project_name` varchar(150) NOT NULL,
  `lot_project_slug` varchar(180) NOT NULL,
  `lot_project_location` varchar(255) NOT NULL,
  `lot_project_location_code` varchar(20) NOT NULL,
  `lot_project_administrator_name` varchar(150) DEFAULT NULL,
  `lot_project_tax_declaration_no` varchar(100) DEFAULT NULL,
  `lot_project_title_number` varchar(150) DEFAULT NULL,
  `lot_project_pin` varchar(100) DEFAULT NULL,
  `lot_project_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `lot_project_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_lot_project_slug` (`lot_project_slug`),
  UNIQUE KEY `uq_lot_project_location_code` (`lot_project_location_code`),
  UNIQUE KEY `uq_lot_project_storage_code` (`lot_project_storage_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `network_member_bulk_edit_batches` (
  `batch_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `seller_group_id` int unsigned NOT NULL,
  `actor_user_id` int unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `request_key` char(36) NOT NULL,
  `snapshot_hash` char(64) NOT NULL,
  `changed_count` int unsigned NOT NULL,
  `operational_review_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`batch_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_bulk_request_key` (`request_key`),
  KEY `idx_bulk_network` (`seller_group_id`,`created_at`),
  KEY `fk_bulk_actor` (`actor_user_id`),
  CONSTRAINT `fk_bulk_network` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bulk_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `network_member_bulk_edit_items` (
  `item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `accredited_seller_id` int unsigned NOT NULL,
  `previous_manager_user_id` int unsigned DEFAULT NULL,
  `new_manager_user_id` int unsigned NOT NULL,
  PRIMARY KEY (`item_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_bulk_member` (`batch_id`,`accredited_seller_id`),
  KEY `idx_bulk_seller` (`accredited_seller_id`),
  CONSTRAINT `fk_bulk_item_batch` FOREIGN KEY (`batch_id`) REFERENCES `network_member_bulk_edit_batches` (`batch_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bulk_item_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `network_member_import_batches` (
  `batch_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `seller_group_id` int unsigned NOT NULL,
  `imported_by_user_id` int unsigned DEFAULT NULL,
  `member_count` int unsigned NOT NULL DEFAULT '0',
  `status` enum('committed','undone') NOT NULL DEFAULT 'committed',
  `imported_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `undone_at` datetime DEFAULT NULL,
  `undone_by_user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`batch_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_member_import_group` (`seller_group_id`,`imported_at`),
  KEY `idx_member_import_status` (`seller_group_id`,`status`),
  KEY `fk_member_import_actor` (`imported_by_user_id`),
  KEY `fk_member_undo_actor` (`undone_by_user_id`),
  CONSTRAINT `fk_member_import_actor` FOREIGN KEY (`imported_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_member_undo_actor` FOREIGN KEY (`undone_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `network_member_import_items` (
  `item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `batch_id` bigint unsigned NOT NULL,
  `source_row` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `accredited_seller_id` int unsigned NOT NULL,
  `member_email` varchar(150) NOT NULL,
  `import_action` varchar(16) NOT NULL,
  `user_created` tinyint(1) NOT NULL DEFAULT '0',
  `seller_created` tinyint(1) NOT NULL DEFAULT '0',
  `before_user_json` json DEFAULT NULL,
  `after_user_json` json NOT NULL,
  `before_seller_json` json DEFAULT NULL,
  `after_seller_json` json NOT NULL,
  `linked_employee_ids_json` json DEFAULT NULL,
  `before_managers_json` json DEFAULT NULL,
  `after_managers_json` json NOT NULL,
  PRIMARY KEY (`item_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_member_import_batch_row` (`batch_id`,`source_row`),
  KEY `idx_member_import_user` (`user_id`,`batch_id`),
  KEY `idx_member_import_seller` (`accredited_seller_id`,`batch_id`),
  CONSTRAINT `fk_member_import_item_batch` FOREIGN KEY (`batch_id`) REFERENCES `network_member_import_batches` (`batch_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `operational_review_events` (
  `operational_review_event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `operational_review_id` bigint unsigned NOT NULL,
  `event_type` varchar(80) NOT NULL,
  `from_status` varchar(60) DEFAULT NULL,
  `to_status` varchar(60) DEFAULT NULL,
  `actor_user_id` int unsigned DEFAULT NULL,
  `actor_role` varchar(80) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`operational_review_event_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_operational_review_event_review` (`operational_review_id`,`created_at`),
  KEY `idx_operational_review_event_actor` (`actor_user_id`,`created_at`),
  CONSTRAINT `fk_operational_review_event_review` FOREIGN KEY (`operational_review_id`) REFERENCES `operational_reviews` (`operational_review_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_operational_review_event_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `operational_reviews` (
  `operational_review_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `review_number` varchar(40) DEFAULT NULL,
  `action_key` varchar(120) NOT NULL,
  `department` enum('marketing','sales','accounting','operations','system') NOT NULL,
  `lot_project_id` int unsigned DEFAULT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` varchar(120) NOT NULL,
  `entity_label` varchar(255) DEFAULT NULL,
  `initiated_by_user_id` int unsigned NOT NULL,
  `initiated_by_role` varchar(80) NOT NULL,
  `before_snapshot_json` json DEFAULT NULL,
  `after_snapshot_json` json DEFAULT NULL,
  `revision` int unsigned NOT NULL DEFAULT '1',
  `status` enum('pending_head_review','returned_for_correction','pending_auditor_review','auditor_verified','audit_case_open','correction_required','pending_auditor_recheck','closed') NOT NULL DEFAULT 'pending_head_review',
  `approval_type` varchar(40) DEFAULT NULL,
  `claimed_by_user_id` int unsigned DEFAULT NULL,
  `claimed_at` datetime DEFAULT NULL,
  `head_reviewed_by_user_id` int unsigned DEFAULT NULL,
  `head_reviewed_at` datetime DEFAULT NULL,
  `auditor_reviewed_by_user_id` int unsigned DEFAULT NULL,
  `auditor_reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`operational_review_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_operational_review_number` (`review_number`),
  KEY `idx_operational_review_queue` (`department`,`status`,`lot_project_id`,`created_at`),
  KEY `idx_operational_review_entity` (`entity_type`,`entity_id`,`status`),
  KEY `idx_operational_review_initiator` (`initiated_by_user_id`,`created_at`),
  KEY `idx_operational_review_project` (`lot_project_id`,`status`),
  KEY `fk_operational_review_claimed_by` (`claimed_by_user_id`),
  KEY `fk_operational_review_head` (`head_reviewed_by_user_id`),
  KEY `fk_operational_review_auditor` (`auditor_reviewed_by_user_id`),
  CONSTRAINT `fk_operational_review_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_operational_review_initiator` FOREIGN KEY (`initiated_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_operational_review_claimed_by` FOREIGN KEY (`claimed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_operational_review_head` FOREIGN KEY (`head_reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_operational_review_auditor` FOREIGN KEY (`auditor_reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `protected_change_requests` (
  `protected_change_request_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_number` varchar(40) DEFAULT NULL,
  `action_key` varchar(120) NOT NULL,
  `department` enum('marketing','sales','accounting','operations') NOT NULL,
  `lot_project_id` int unsigned DEFAULT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` varchar(120) NOT NULL,
  `entity_label` varchar(255) DEFAULT NULL,
  `requested_by_user_id` int unsigned NOT NULL,
  `request_payload_json` json NOT NULL,
  `request_payload_hash` char(64) NOT NULL,
  `reason` text NOT NULL,
  `status` enum('pending','approved','rejected','used','expired','cancelled') NOT NULL DEFAULT 'pending',
  `reviewed_by_head_user_id` int unsigned DEFAULT NULL,
  `head_note` text DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`protected_change_request_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_protected_change_request_number` (`request_number`),
  KEY `idx_protected_change_queue` (`department`,`status`,`lot_project_id`,`created_at`),
  KEY `idx_protected_change_entity` (`entity_type`,`entity_id`,`status`),
  KEY `idx_protected_change_requester` (`requested_by_user_id`,`status`,`created_at`),
  KEY `fk_protected_change_project` (`lot_project_id`),
  KEY `fk_protected_change_head` (`reviewed_by_head_user_id`),
  CONSTRAINT `fk_protected_change_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_protected_change_requester` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_protected_change_head` FOREIGN KEY (`reviewed_by_head_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `role_permission_defaults` (
  `role_permission_default_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role` enum('system_admin','auditor','marketing_staff','marketing_head','sales_staff','sales_head','accounting_staff','accounting_head','operations_staff','operations_head') NOT NULL,
  `permission_key` varchar(120) NOT NULL,
  `allowed` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_permission_default_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_role_permission_default` (`role`,`permission_key`),
  KEY `idx_role_permission_default_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_role_permission_default_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `seller_group_lot_project_rates` (
  `seller_group_lot_project_rate_id` int unsigned NOT NULL AUTO_INCREMENT,
  `seller_group_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `seller_group_pool_rate` decimal(7,4) NOT NULL DEFAULT '8.0000',
  `company_profit_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `commission_structure_type` enum('in_house','external') NOT NULL DEFAULT 'in_house',
  `division_manager_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `sales_director_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `unit_manager_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `sales_agent_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `seller_group_lot_project_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `seller_group_lot_project_rate_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `seller_group_lot_project_rate_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`seller_group_lot_project_rate_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_group_project_rate` (`seller_group_id`,`lot_project_id`),
  KEY `fk_group_project_rate_project` (`lot_project_id`),
  CONSTRAINT `fk_group_project_rate_group` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_group_project_rate_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `seller_groups` (
  `seller_group_id` int unsigned NOT NULL AUTO_INCREMENT,
  `seller_group_name` varchar(150) NOT NULL,
  `seller_group_type` enum('in_house','external') NOT NULL DEFAULT 'in_house',
  `seller_group_head_user_id` int unsigned DEFAULT NULL,
  `seller_group_external_account_user_id` int unsigned DEFAULT NULL,
  `broker_name` varchar(180) DEFAULT NULL,
  `broker_license_number` varchar(100) DEFAULT NULL,
  `realty_name` varchar(180) DEFAULT NULL,
  `broker_prc_number` varchar(100) DEFAULT NULL,
  `broker_name_normalized` varchar(180) DEFAULT NULL,
  `broker_license_number_normalized` varchar(100) DEFAULT NULL,
  `realty_name_normalized` varchar(180) DEFAULT NULL,
  `broker_prc_number_normalized` varchar(100) DEFAULT NULL,
  `seller_group_description` text DEFAULT NULL,
  `seller_group_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `seller_group_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `seller_group_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`seller_group_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_seller_group_external_account_user` (`seller_group_external_account_user_id`),
  KEY `fk_seller_group_head_user` (`seller_group_head_user_id`),
  UNIQUE KEY `uq_network_broker_license_normalized` (`broker_license_number_normalized`),
  UNIQUE KEY `uq_network_realty_name_normalized` (`realty_name_normalized`),
  UNIQUE KEY `uq_network_broker_prc_normalized` (`broker_prc_number_normalized`),
  KEY `idx_network_broker_name_normalized` (`broker_name_normalized`),
  CONSTRAINT `fk_seller_group_external_account_user` FOREIGN KEY (`seller_group_external_account_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_seller_group_head_user` FOREIGN KEY (`seller_group_head_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `seller_hierarchy_lot_project_overrides` (
  `seller_hierarchy_lot_project_override_id` int unsigned NOT NULL AUTO_INCREMENT,
  `child_accredited_seller_id` int unsigned NOT NULL,
  `parent_accredited_seller_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `override_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `override_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`seller_hierarchy_lot_project_override_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_child_parent_project_override` (`child_accredited_seller_id`,`parent_accredited_seller_id`,`lot_project_id`),
  KEY `idx_hierarchy_override_project` (`lot_project_id`,`override_rate_status`),
  KEY `idx_hierarchy_override_parent` (`parent_accredited_seller_id`),
  CONSTRAINT `fk_hierarchy_override_child` FOREIGN KEY (`child_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hierarchy_override_parent` FOREIGN KEY (`parent_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hierarchy_override_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `seller_manager_replacement_items` (
  `replacement_item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `replacement_id` bigint unsigned NOT NULL,
  `affected_accredited_seller_id` int unsigned NOT NULL,
  `previous_manager_user_id` int unsigned NOT NULL,
  `new_manager_user_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`replacement_item_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_manager_replacement_item` (`replacement_id`,`affected_accredited_seller_id`),
  KEY `idx_manager_replacement_seller` (`affected_accredited_seller_id`),
  CONSTRAINT `fk_replacement_item_batch` FOREIGN KEY (`replacement_id`) REFERENCES `seller_manager_replacements` (`replacement_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_replacement_item_seller` FOREIGN KEY (`affected_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `seller_manager_replacement_reversals` (
  `reversal_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `replacement_id` bigint unsigned NOT NULL,
  `seller_group_id` int unsigned NOT NULL,
  `actor_user_id` int unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `request_key` char(36) NOT NULL,
  `snapshot_hash` char(64) NOT NULL,
  `restored_count` int unsigned NOT NULL,
  `operational_review_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reversal_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_reversed_replacement` (`replacement_id`),
  UNIQUE KEY `uq_reversal_request` (`request_key`),
  KEY `idx_restore_group` (`seller_group_id`,`created_at`),
  KEY `fk_restore_actor` (`actor_user_id`),
  CONSTRAINT `fk_restore_replacement` FOREIGN KEY (`replacement_id`) REFERENCES `seller_manager_replacements` (`replacement_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_restore_network` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_restore_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `seller_manager_replacements` (
  `replacement_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `seller_group_id` int unsigned NOT NULL,
  `outgoing_user_id` int unsigned NOT NULL,
  `replacement_user_id` int unsigned NOT NULL,
  `outgoing_role` varchar(40) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_by_user_id` int unsigned NOT NULL,
  `verification_id` bigint unsigned DEFAULT NULL,
  `direct_reports_moved` int unsigned NOT NULL,
  `impact_snapshot_json` json NOT NULL,
  `operational_review_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`replacement_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_manager_replacement_group` (`seller_group_id`,`created_at`),
  KEY `idx_manager_replacement_outgoing` (`outgoing_user_id`,`created_at`),
  KEY `idx_manager_replacement_incoming` (`replacement_user_id`,`created_at`),
  KEY `fk_manager_replace_actor` (`created_by_user_id`),
  KEY `fk_manager_replace_review` (`operational_review_id`),
  CONSTRAINT `fk_manager_replace_network` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_manager_replace_old` FOREIGN KEY (`outgoing_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_manager_replace_new` FOREIGN KEY (`replacement_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_manager_replace_actor` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_manager_replace_review` FOREIGN KEY (`operational_review_id`) REFERENCES `operational_reviews` (`operational_review_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `system_scheduled_job_state` (
  `job_name` varchar(100) NOT NULL,
  `last_success_date` date DEFAULT NULL,
  `current_run_date` date DEFAULT NULL,
  `status` enum('idle','running','completed','failed') NOT NULL DEFAULT 'idle',
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `lock_expires_at` datetime DEFAULT NULL,
  `last_error` varchar(1000) DEFAULT NULL,
  `last_refreshed_count` int unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`job_name`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_scheduled_job_status` (`status`,`current_run_date`),
  KEY `idx_scheduled_job_lock` (`lock_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `system_settings` (
  `system_setting_id` tinyint unsigned NOT NULL DEFAULT '1',
  `company_name` varchar(150) NOT NULL DEFAULT 'D&C Prime Realty',
  `company_email` varchar(150) DEFAULT NULL,
  `company_contact_number` varchar(60) DEFAULT NULL,
  `company_address` text DEFAULT NULL,
  `company_tin` varchar(80) DEFAULT NULL,
  `system_status` enum('active','maintenance') NOT NULL DEFAULT 'active',
  `maintenance_message` text DEFAULT NULL,
  `reservation_contact_name` varchar(150) DEFAULT NULL,
  `reservation_contact_email` varchar(150) DEFAULT NULL,
  `reservation_contact_number` varchar(60) DEFAULT NULL,
  `default_release_day_one` tinyint unsigned NOT NULL DEFAULT '7',
  `default_release_day_two` tinyint unsigned NOT NULL DEFAULT '22',
  `in_house_dm_pool_share_percent` decimal(7,4) NOT NULL DEFAULT '14.1800',
  `in_house_sd_pool_share_percent` decimal(7,4) NOT NULL DEFAULT '15.8200',
  `in_house_um_pool_share_percent` decimal(7,4) NOT NULL DEFAULT '20.0000',
  `in_house_sa_pool_share_percent` decimal(7,4) NOT NULL DEFAULT '50.0000',
  `max_company_profit_percent_of_pool` decimal(7,4) NOT NULL DEFAULT '50.0000',
  `payment_entry_email_notification_enabled` tinyint(1) NOT NULL DEFAULT '0',
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
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`system_setting_id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_system_settings_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_system_settings_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `template_document_list` (
  `template_document_list_id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  `document_id` int unsigned NOT NULL,
  `template_document_list_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `template_document_list_responsible_party` enum('client','internal','seller') NOT NULL DEFAULT 'client',
  `template_document_list_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `template_document_list_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_document_list_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_template_document` (`template_id`,`document_id`),
  KEY `fk_template_document_document` (`document_id`),
  CONSTRAINT `fk_template_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_template_document_template` FOREIGN KEY (`template_id`) REFERENCES `document_templates` (`template_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `user_password_reset_codes` (
  `user_password_reset_code_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `code_hash` char(64) NOT NULL,
  `status` enum('pending','verified','used','expired','locked') NOT NULL DEFAULT 'pending',
  `attempt_count` tinyint unsigned NOT NULL DEFAULT '0',
  `max_attempts` tinyint unsigned NOT NULL DEFAULT '5',
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `request_ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_password_reset_code_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_password_reset_user_created` (`user_id`,`created_at`),
  KEY `idx_password_reset_status_expiry` (`status`,`expires_at`),
  CONSTRAINT `fk_password_reset_code_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `user_permissions` (
  `user_permission_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `permission_key` varchar(120) NOT NULL,
  `allowed` tinyint(1) NOT NULL DEFAULT '1',
  `granted_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_permission_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_user_permission` (`user_id`,`permission_key`),
  KEY `idx_user_permission_granted_by` (`granted_by_user_id`),
  CONSTRAINT `fk_user_permission_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_permission_granted_by` FOREIGN KEY (`granted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `user_project_access` (
  `user_project_access_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_project_access_id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_user_project_access` (`user_id`,`lot_project_id`),
  KEY `idx_user_project_access_project` (`lot_project_id`),
  KEY `idx_user_project_access_created_by` (`created_by_user_id`),
  CONSTRAINT `fk_user_project_access_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_project_access_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_project_access_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `user_role_history` (
  `user_role_history_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `previous_role` varchar(80) NOT NULL,
  `new_role` varchar(80) NOT NULL,
  `previous_account_code` varchar(80) DEFAULT NULL,
  `current_account_code` varchar(80) DEFAULT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `changed_by_user_id` int unsigned DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_role_history_id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_user_role_history_user` (`user_id`,`changed_at`),
  KEY `idx_user_role_history_changed_by` (`changed_by_user_id`),
  CONSTRAINT `fk_user_role_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_user_role_history_changed_by` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

/*!40014 SET FOREIGN_KEY_CHECKS=0*/;
/*!40101 SET NAMES binary*/;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `account_code` varchar(80) DEFAULT NULL,
  `account_category` enum('system','seller','external') NOT NULL DEFAULT 'seller',
  `person_key` char(36) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `contact_no` varchar(50) DEFAULT NULL,
  `tin_no` varchar(100) DEFAULT NULL,
  `prc_no` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('super_admin','system_admin','auditor','marketing_staff','marketing_head','sales_staff','sales_head','accounting_staff','accounting_head','operations_staff','operations_head','division_manager','sales_director','unit_manager','sales_agent','external_group') NOT NULL DEFAULT 'sales_agent',
  `role_sequence` int unsigned NOT NULL DEFAULT '1',
  `admin_type` enum('admin_1','admin_2','admin_3') DEFAULT NULL,
  `admin_all_projects` tinyint(1) NOT NULL DEFAULT '0',
  `all_projects_access` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `deactivated_at` datetime DEFAULT NULL,
  `deactivated_by_user_id` int unsigned DEFAULT NULL,
  `deactivation_reason` varchar(500) DEFAULT NULL,
  `must_change_password` tinyint(1) NOT NULL DEFAULT '1',
  `auth_version` int unsigned NOT NULL DEFAULT '0',
  `can_login` tinyint(1) NOT NULL DEFAULT '1',
  `is_system_account` tinyint(1) NOT NULL DEFAULT '0',
  `active_login_email` varchar(150) GENERATED ALWAYS AS (case when `status` = _utf8mb4'active' and `can_login` = 1 and `is_system_account` = 0 then lower(`email`) else null end) STORED,
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_users_active_login_email` (`active_login_email`),
  UNIQUE KEY `uq_users_account_code` (`account_code`),
  UNIQUE KEY `uq_users_person_role_sequence` (`person_key`,`role`,`role_sequence`),
  KEY `idx_users_person_key` (`person_key`),
  KEY `idx_users_account_category` (`account_category`),
  KEY `idx_users_role_status` (`role`,`status`),
  KEY `idx_users_deactivated_by` (`deactivated_by_user_id`),
  CONSTRAINT `fk_users_deactivated_by` FOREIGN KEY (`deactivated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

-- Restore standard constraint checking after schema import.
SET SESSION FOREIGN_KEY_CHECKS=1;
