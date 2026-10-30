-- D&C Prime Realty / Batch 5 / 27 October 2026
-- NEW HR STAGING DATABASE ONLY. No ALTER, UPDATE or DROP on source database.
-- Stop if target DB exists; do not apply to existing Realty database.

USE `dc_prime_hr_db`;

CREATE TABLE `hr_users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `display_name_snapshot` varchar(255) NOT NULL,
  `email_snapshot` varchar(150) DEFAULT NULL,
  `account_status` enum('historical','invited','active','disabled') NOT NULL DEFAULT 'historical',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_legacy_user_map` (
  `legacy_realty_user_id` int unsigned NOT NULL,
  `hr_user_id` int unsigned NOT NULL,
  `source_name_snapshot` varchar(255) DEFAULT NULL,
  `source_role_snapshot` varchar(80) DEFAULT NULL,
  `source_email_snapshot` varchar(150) DEFAULT NULL,
  `mapping_method` enum('source_pk_preserved','manually_verified') NOT NULL DEFAULT 'source_pk_preserved',
  `mapped_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`legacy_realty_user_id`),
  UNIQUE KEY `uq_hr_legacy_mapped_identity` (`hr_user_id`),
  CONSTRAINT `fk_hr_legacy_map_user` FOREIGN KEY (`hr_user_id`) REFERENCES `hr_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_login_identities` (
  `hr_user_id` int unsigned NOT NULL,
  `login_email` varchar(150) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `login_state` enum('invited','active','disabled') NOT NULL DEFAULT 'invited',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '1',
  `auth_version` int unsigned NOT NULL DEFAULT '0',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`hr_user_id`),
  UNIQUE KEY `uq_hr_login_email` (`login_email`),
  CONSTRAINT `fk_hr_login_identity_user` FOREIGN KEY (`hr_user_id`) REFERENCES `hr_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_roles` (
  `role_code` varchar(60) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_permissions` (
  `permission_code` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`permission_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_role_permissions` (
  `role_code` varchar(60) NOT NULL,
  `permission_code` varchar(100) NOT NULL,
  PRIMARY KEY (`role_code`,`permission_code`),
  KEY `idx_hr_role_permission_code` (`permission_code`),
  CONSTRAINT `fk_hr_role_permission_role` FOREIGN KEY (`role_code`) REFERENCES `hr_roles` (`role_code`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_hr_role_permission_perm` FOREIGN KEY (`permission_code`) REFERENCES `hr_permissions` (`permission_code`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE `hr_user_roles` (
  `hr_user_id` int unsigned NOT NULL,
  `role_code` varchar(60) NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`hr_user_id`,`role_code`),
  KEY `idx_hr_user_roles_role` (`role_code`),
  CONSTRAINT `fk_hr_user_roles_user` FOREIGN KEY (`hr_user_id`) REFERENCES `hr_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_hr_user_roles_role` FOREIGN KEY (`role_code`) REFERENCES `hr_roles` (`role_code`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
