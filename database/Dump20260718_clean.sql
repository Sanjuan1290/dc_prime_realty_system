-- Clean deployment seed generated from Dump20260718 (4)(1).sql
-- All application records were removed.
-- Seeded data: one Super Admin user, document library, document templates,
-- and template-document assignments only.

-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: dc_prime_realty_system_db
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accredited_seller_documents`
--

DROP TABLE IF EXISTS `accredited_seller_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`accredited_seller_document_id`),
  KEY `idx_accredited_seller_documents_seller` (`accredited_seller_id`),
  KEY `idx_accredited_seller_documents_type` (`document_type`),
  KEY `idx_accredited_seller_documents_uploader` (`uploaded_by_user_id`),
  CONSTRAINT `fk_accredited_seller_documents_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_documents_uploader` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_seller_documents`
--

LOCK TABLES `accredited_seller_documents` WRITE;
/*!40000 ALTER TABLE `accredited_seller_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `accredited_seller_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accredited_seller_lot_project_rates`
--

DROP TABLE IF EXISTS `accredited_seller_lot_project_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accredited_seller_lot_project_rates` (
  `accredited_seller_lot_project_rate_id` int unsigned NOT NULL AUTO_INCREMENT,
  `accredited_seller_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `accredited_seller_project_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `accredited_seller_lot_project_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `accredited_seller_lot_project_rate_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accredited_seller_lot_project_rate_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accredited_seller_lot_project_rate_id`),
  UNIQUE KEY `uq_seller_project_rate` (`accredited_seller_id`,`lot_project_id`),
  KEY `fk_seller_project_rate_project` (`lot_project_id`),
  CONSTRAINT `fk_seller_project_rate_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_seller_project_rate_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_accredited_seller_project_rate` CHECK ((`accredited_seller_project_rate` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_seller_lot_project_rates`
--

LOCK TABLES `accredited_seller_lot_project_rates` WRITE;
/*!40000 ALTER TABLE `accredited_seller_lot_project_rates` DISABLE KEYS */;

/*!40000 ALTER TABLE `accredited_seller_lot_project_rates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accredited_seller_managed_sellers`
--

DROP TABLE IF EXISTS `accredited_seller_managed_sellers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accredited_seller_managed_sellers` (
  `accredited_seller_managed_seller_id` int unsigned NOT NULL AUTO_INCREMENT,
  `manager_accredited_seller_id` int unsigned NOT NULL,
  `managed_accredited_seller_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accredited_seller_managed_seller_id`),
  UNIQUE KEY `uq_manager_managed_seller` (`manager_accredited_seller_id`,`managed_accredited_seller_id`),
  KEY `fk_managed_seller_managed` (`managed_accredited_seller_id`),
  CONSTRAINT `fk_managed_seller_managed` FOREIGN KEY (`managed_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_managed_seller_manager` FOREIGN KEY (`manager_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_seller_managed_sellers`
--

LOCK TABLES `accredited_seller_managed_sellers` WRITE;
/*!40000 ALTER TABLE `accredited_seller_managed_sellers` DISABLE KEYS */;

/*!40000 ALTER TABLE `accredited_seller_managed_sellers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accredited_sellers`
--

DROP TABLE IF EXISTS `accredited_sellers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`accredited_seller_id`),
  UNIQUE KEY `uq_accredited_seller_user` (`user_id`),
  UNIQUE KEY `uq_accredited_seller_dummy_owner` (`dummy_owner_accredited_seller_id`),
  KEY `fk_accredited_seller_group` (`seller_group_id`),
  KEY `fk_accredited_seller_reports_under_user` (`accredited_seller_reports_under_user_id`),
  KEY `idx_accredited_seller_system_dummy` (`is_system_dummy`),
  CONSTRAINT `fk_accredited_seller_dummy_owner` FOREIGN KEY (`dummy_owner_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_group` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_reports_under_user` FOREIGN KEY (`accredited_seller_reports_under_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_sellers`
--

LOCK TABLES `accredited_sellers` WRITE;
/*!40000 ALTER TABLE `accredited_sellers` DISABLE KEYS */;

/*!40000 ALTER TABLE `accredited_sellers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `agent_lot_project_direct_rates`
--

DROP TABLE IF EXISTS `agent_lot_project_direct_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_lot_project_direct_rates` (
  `agent_lot_project_direct_rate_id` int unsigned NOT NULL AUTO_INCREMENT,
  `accredited_seller_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `direct_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `direct_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`agent_lot_project_direct_rate_id`),
  UNIQUE KEY `uq_agent_project_direct_rate` (`accredited_seller_id`,`lot_project_id`),
  KEY `idx_agent_direct_rate_project` (`lot_project_id`,`direct_rate_status`),
  CONSTRAINT `fk_agent_direct_rate_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_agent_direct_rate_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_agent_direct_rate` CHECK (((`direct_rate` >= 0) and (`direct_rate` <= 15)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_lot_project_direct_rates`
--

LOCK TABLES `agent_lot_project_direct_rates` WRITE;
/*!40000 ALTER TABLE `agent_lot_project_direct_rates` DISABLE KEYS */;

/*!40000 ALTER TABLE `agent_lot_project_direct_rates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log_archive_batches`
--

DROP TABLE IF EXISTS `audit_log_archive_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`audit_log_archive_batch_id`),
  KEY `idx_audit_archive_batch_created` (`created_at`),
  KEY `idx_audit_archive_batch_cutoff` (`cutoff_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log_archive_batches`
--

LOCK TABLES `audit_log_archive_batches` WRITE;
/*!40000 ALTER TABLE `audit_log_archive_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log_archive_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log_archive_events`
--

DROP TABLE IF EXISTS `audit_log_archive_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`audit_log_archive_event_id`),
  KEY `idx_audit_archive_event_batch` (`audit_log_archive_batch_id`),
  KEY `idx_audit_archive_event_created` (`event_created_at`),
  CONSTRAINT `fk_audit_archive_event_batch` FOREIGN KEY (`audit_log_archive_batch_id`) REFERENCES `audit_log_archive_batches` (`audit_log_archive_batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log_archive_events`
--

LOCK TABLES `audit_log_archive_events` WRITE;
/*!40000 ALTER TABLE `audit_log_archive_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log_archive_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log_archive_policy`
--

DROP TABLE IF EXISTS `audit_log_archive_policy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log_archive_policy` (
  `policy_id` tinyint unsigned NOT NULL,
  `retention_days` smallint unsigned NOT NULL DEFAULT '365',
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`policy_id`),
  KEY `fk_audit_archive_policy_user` (`updated_by_user_id`),
  CONSTRAINT `fk_audit_archive_policy_user` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log_archive_policy`
--

LOCK TABLES `audit_log_archive_policy` WRITE;
/*!40000 ALTER TABLE `audit_log_archive_policy` DISABLE KEYS */;

/*!40000 ALTER TABLE `audit_log_archive_policy` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log_archive_verifications`
--

DROP TABLE IF EXISTS `audit_log_archive_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`audit_log_archive_verification_id`),
  KEY `idx_audit_archive_verification_user` (`user_id`),
  KEY `idx_audit_archive_verification_status` (`status`,`expires_at`),
  CONSTRAINT `fk_audit_archive_verification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log_archive_verifications`
--

LOCK TABLES `audit_log_archive_verifications` WRITE;
/*!40000 ALTER TABLE `audit_log_archive_verifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log_archive_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `audit_log_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_user_id` int unsigned DEFAULT NULL,
  `actor_name` varchar(255) DEFAULT NULL,
  `actor_email` varchar(150) DEFAULT NULL,
  `actor_role` varchar(80) DEFAULT NULL,
  `action` enum('create','update','delete','login','logout','send','approve','reject','release','system','view') NOT NULL DEFAULT 'system',
  `module` varchar(100) NOT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` varchar(120) DEFAULT NULL,
  `entity_label` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `metadata_json` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `audit_log_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_module` (`module`),
  KEY `idx_audit_actor` (`actor_user_id`),
  KEY `idx_audit_created` (`audit_log_created_at`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_module_action` (`module`,`action`),
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
 Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:50:34'),(2,1,'Super Admin','admin@dcprime.local','super_admin','create','Projects','lot_project','2','Prime Enclave Project','Created lot project','Created lot project Prime Enclave Project.','{\"slug\": \"prime-enclave-project\", \"status\": \"active\", \"locationCode\": \"PE\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:51:23'),(3,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Added new listing','Added LA-0101 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0101\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:52:46'),(4,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Added new listing','Added LA-0102 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0102\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:53:01'),(5,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','3','Unit LA-0103 — Bailen Project','Added new listing','Added LA-0103 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0103\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:53:18'),(6,1,'Super Admin','admin@dcprime.local','super_admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"available\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:53:26'),(7,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','4','Unit LA-0104 — Bailen Project','Added new listing','Added LA-0104 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0104\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:53:40'),(8,1,'Super Admin','admin@dcprime.local','super_admin','update','Listings','lot_project_listing','4','Unit LA-0104 — Bailen Project','Updated listing details','Updated LA-0104 in Bailen Project.','{\"unitCode\": \"LA-0104\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"available\", \"previousUnitCode\": \"LA-0104\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:53:45'),(9,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','5','Unit LA-0105 — Bailen Project','Added new listing','Added LA-0105 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0105\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:54:01'),(10,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','6','Unit PE-0101 — Prime Enclave Project','Added new listing','Added PE-0101 to Prime Enclave Project.','{\"status\": \"available\", \"unitCode\": \"PE-0101\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:55:32'),(11,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','7','Unit PE-0102 — Prime Enclave Project','Added new listing','Added PE-0102 to Prime Enclave Project.','{\"status\": \"available\", \"unitCode\": \"PE-0102\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:55:51'),(12,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','8','Unit PE-0103 — Prime Enclave Project','Added new listing','Added PE-0103 to Prime Enclave Project.','{\"status\": \"available\", \"unitCode\": \"PE-0103\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:57:01'),(13,1,'Super Admin','admin@dcprime.local','super_admin','create','Listings','lot_project_listing','9','Unit PE-0104 — Prime Enclave Project','Added new listing','Added PE-0104 to Prime Enclave Project.','{\"status\": \"available\", \"unitCode\": \"PE-0104\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:57:30'),(14,1,'Super Admin','admin@dcprime.local','super_admin','create','Buyer Forms','lot_project_buyer_form_link','1','Unit PE-0101 — Prime Enclave Project','Generated buyer form link','Generated a new buyer form link for PE-0101.','{\"listingId\": 6, \"generation\": 1, \"expiresHours\": 24, \"recipientEmail\": \"rrcsanjuan@pcu.edu.ph\", \"recipientMobileNumber\": \"09057557640\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:57:56'),(15,NULL,'ROWENA MORENO CORTEZ','rrcsanjuan@pcu.edu.ph','public_buyer','create','Buyer Forms','lot_project_buyer_form_submission','1','Unit PE-0101 — ROWENA MORENO CORTEZ','Buyer submitted information form','ROWENA MORENO CORTEZ submitted buyer information for PE-0101.','{\"linkId\": 1, \"buyerType\": \"single\", \"listingId\": 6}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:59:40'),(16,1,'Super Admin','admin@dcprime.local','super_admin','create','Seller Groups','seller_group','1','North Star Group','Created seller group','Created seller group North Star Group.','{\"status\": \"active\", \"projectRates\": [{\"lot_project_id\": 1, \"seller_group_pool_rate\": 8}, {\"lot_project_id\": 2, \"seller_group_pool_rate\": 8}]}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:04:22'),(17,1,'Super Admin','admin@dcprime.local','super_admin','create','Users','user','2','ROWENA CORTEZ','Created user account','Created account for ROWENA CORTEZ (rowena@gmail.com).','{\"role\": \"broker_network_manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:04:45'),(18,1,'Super Admin','admin@dcprime.local','super_admin','create','Accreditation','accredited_seller','1','ROWENA CORTEZ','Accredited seller','Accredited ROWENA CORTEZ as broker_network_manager.','{\"role\": \"broker_network_manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:04:45'),(19,1,'Super Admin','admin@dcprime.local','super_admin','create','Users','user','3','Broker1 North Star','Created user account','Created account for Broker1 North Star (broker1northstar@gmail.com).','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:05:15'),(20,1,'Super Admin','admin@dcprime.local','super_admin','create','Accreditation','accredited_seller','2','Broker1 North Star','Accredited seller','Accredited Broker1 North Star as broker.','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:05:15'),(21,1,'Super Admin','admin@dcprime.local','super_admin','create','Users','user','4','manager1 North Star','Created user account','Created account for manager1 North Star (manager1northstar@gmail.com).','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:05:54'),(22,1,'Super Admin','admin@dcprime.local','super_admin','create','Accreditation','accredited_seller','3','manager1 North Star','Accredited seller','Accredited manager1 North Star as manager.','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:05:54'),(23,1,'Super Admin','admin@dcprime.local','super_admin','update','Users','user','3','Broker1 North Star','Updated user account','Updated account for Broker1 North Star (broker1northstar@gmail.com).','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:06:03'),(24,1,'Super Admin','admin@dcprime.local','super_admin','update','Accreditation','accredited_seller','2','Broker1 North Star','Updated accreditation','Updated accreditation for Broker1 North Star.','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:06:03'),(25,1,'Super Admin','admin@dcprime.local','super_admin','update','Users','user','4','manager1 North Star','Updated user account','Updated account for manager1 North Star (manager1northstar@gmail.com).','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:06:10'),(26,1,'Super Admin','admin@dcprime.local','super_admin','update','Accreditation','accredited_seller','3','manager1 North Star','Updated accreditation','Updated accreditation for manager1 North Star.','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:06:10'),(27,1,'Super Admin','admin@dcprime.local','super_admin','create','Users','user','5','Agent  1 North Star','Created user account','Created account for Agent  1 North Star (agent1northstar@gmail.com).','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:07:46'),(28,1,'Super Admin','admin@dcprime.local','super_admin','create','Accreditation','accredited_seller','6','Agent  1 North Star','Accredited seller','Accredited Agent  1 North Star as agent.','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:07:46'),(29,1,'Super Admin','admin@dcprime.local','super_admin','create','Users','user','6','Agent 2 North Star','Created user account','Created account for Agent 2 North Star (agent2northstar@gmail.com).','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:09:44'),(30,1,'Super Admin','admin@dcprime.local','super_admin','create','Accreditation','accredited_seller','7','Agent 2 North Star','Accredited seller','Accredited Agent 2 North Star as agent.','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:09:44'),(31,1,'Super Admin','admin@dcprime.local','super_admin','create','Reservations','lot_project_listing','6','Unit PE-0101 — ROWENA MORENO CORTEZ','Reserved listing for client','Reserved PE-0101 for ROWENA MORENO CORTEZ.','{\"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 1, \"assignedSellerId\": 7, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": 1, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:13:38'),(32,1,'Super Admin','admin@dcprime.local','super_admin','create','Payments','lot_project_payment','1','CASH-20260717-PE0101-0001 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Reservation payment for ROWENA MORENO CORTEZ.','{\"amount\": 50000, \"unitId\": \"PE-0101\", \"listingId\": 6, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 1, \"paymentDate\": \"2026-07-17\", \"paymentType\": \"reservation\", \"referenceId\": \"CASH-20260717-PE0101-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:16:58'),(33,1,'Super Admin','admin@dcprime.local','super_admin','create','Payments','lot_project_payment','2','CASH-20260717-PE0101-0002 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Downpayment payment for ROWENA MORENO CORTEZ.','{\"amount\": 254520, \"unitId\": \"PE-0101\", \"listingId\": 6, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 2, \"paymentDate\": \"2026-07-17\", \"paymentType\": \"downpayment\", \"referenceId\": \"CASH-20260717-PE0101-0002\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:17:01'),(34,1,'Super Admin','admin@dcprime.local','super_admin','create','Payments','lot_project_payment','3','CASH-20260717-PE0101-0003 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Balloon payment for ROWENA MORENO CORTEZ.','{\"amount\": 200000, \"unitId\": \"PE-0101\", \"listingId\": 6, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": null, \"paymentDate\": \"2026-07-17\", \"paymentType\": \"balloon\", \"referenceId\": \"CASH-20260717-PE0101-0003\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:17:20'),(35,1,'Super Admin','admin@dcprime.local','super_admin','create','Payments','lot_project_payment','4','CASH-20260717-PE0101-0004 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Monthly payment for ROWENA MORENO CORTEZ.','{\"amount\": 28221, \"unitId\": \"PE-0101\", \"listingId\": 6, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 6, \"paymentDate\": \"2026-07-17\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260717-PE0101-0004\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:20:16'),(36,1,'Super Admin','admin@dcprime.local','super_admin','create','Documents','lot_project_client_document','1','BUYER ACKNOWLEDGEMENT FORM — ROWENA MORENO CORTEZ','Uploaded client document','Uploaded 1 image(s) for BUYER ACKNOWLEDGEMENT FORM of ROWENA MORENO CORTEZ.','{\"unitId\": \"PE-0101\", \"listingId\": 6, \"documentId\": 11, \"totalImages\": 1, \"documentName\": \"BUYER ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:23:53'),(37,1,'Super Admin','admin@dcprime.local','super_admin','create','Documents','lot_project_client_document','2','BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM — ROWENA MORENO CORTEZ','Uploaded client document','Uploaded 1 image(s) for BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM of ROWENA MORENO CORTEZ.','{\"unitId\": \"PE-0101\", \"listingId\": 6, \"documentId\": 9, \"totalImages\": 1, \"documentName\": \"BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:24:12'),(38,1,'Super Admin','admin@dcprime.local','super_admin','create','Reservations','lot_project_listing','5','Unit LA-0105 — ROWENA MORENO CORTEZ','Reserved listing for client','Reserved LA-0105 for ROWENA MORENO CORTEZ.','{\"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 2, \"assignedSellerId\": 3, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": null, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:34:58'),(39,1,'Super Admin','admin@dcprime.local','super_admin','create','Payments','lot_project_payment','5','CASH-20260717-LA0105-0001 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Reservation payment for ROWENA MORENO CORTEZ.','{\"amount\": 50000, \"unitId\": \"LA-0105\", \"listingId\": 5, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 28, \"paymentDate\": \"2026-07-17\", \"paymentType\": \"reservation\", \"referenceId\": \"CASH-20260717-LA0105-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:35:03'),(40,1,'Super Admin','admin@dcprime.local','super_admin','create','Payments','lot_project_payment','6','CASH-20260717-LA0105-0002 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Downpayment payment for ROWENA MORENO CORTEZ.','{\"amount\": 148500, \"unitId\": \"LA-0105\", \"listingId\": 5, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 29, \"paymentDate\": \"2026-07-17\", \"paymentType\": \"downpayment\", \"referenceId\": \"CASH-20260717-LA0105-0002\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:35:04'),(41,1,'Super Admin','admin@dcprime.local','super_admin','create','Documents','lot_project_client_document','14','BUYER ACKNOWLEDGEMENT FORM — ROWENA MORENO CORTEZ','Uploaded client document','Uploaded 1 image(s) for BUYER ACKNOWLEDGEMENT FORM of ROWENA MORENO CORTEZ.','{\"unitId\": \"LA-0105\", \"listingId\": 5, \"documentId\": 11, \"totalImages\": 1, \"documentName\": \"BUYER ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 2}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:35:47'),(42,1,'Super Admin','admin@dcprime.local','super_admin','update','Project Settings','lot_project_settings','1','Bailen Project','Updated project release settings','Super updated release settings for Bailen Project.','{\"companyName\": \"D&C Prime Realty\", \"companyEmail\": \"dcprimerealty@gmail.com\", \"releaseDayOne\": 7, \"releaseDayTwo\": 17, \"companyContactNumber\": \"(046) 866-0616\", \"reservationContactName\": \"D&C Prime Realty\", \"reservationContactEmail\": \"dcprimerealty@gmail.com\", \"reservationContactNumber\": \"0912-345-6789\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:40:03'),(43,1,'Super Admin','admin@dcprime.local','super_admin','update','Project Settings','lot_project_settings','1','Bailen Project','Updated project release settings','Super updated release settings for Bailen Project.','{\"companyName\": \"D&C Prime Realty\", \"companyEmail\": \"dcprimerealty@gmail.com\", \"releaseDayOne\": 7, \"releaseDayTwo\": 22, \"companyContactNumber\": \"(046) 866-0616\", \"reservationContactName\": \"D&C Prime Realty\", \"reservationContactEmail\": \"dcprimerealty@gmail.com\", \"reservationContactNumber\": \"0912-345-6789\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:41:12'),(44,1,'Super Admin','admin@dcprime.local','super_admin','update','Project Settings','lot_project_settings','2','Prime Enclave Project','Updated project release settings','Super updated release settings for Prime Enclave Project.','{\"companyName\": \"D&C Prime Realty\", \"companyEmail\": \"dcprimerealty@gmail.com\", \"releaseDayOne\": 7, \"releaseDayTwo\": 22, \"companyContactNumber\": \"(046) 866-0616\", \"reservationContactName\": \"D&C Prime Realty\", \"reservationContactEmail\": \"dcprimerealty@gmail.com\", \"reservationContactNumber\": \"0912-345-6789\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 15:42:10'),(45,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 10:10:30'),(46,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_group','1','North Star Group','Updated seller group','Updated seller group North Star Group.','{\"status\": \"active\", \"projectRates\": [{\"lot_project_id\": 1, \"seller_group_pool_rate\": 8}, {\"lot_project_id\": 2, \"seller_group_pool_rate\": 8}]}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:16:44'),(47,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Reservations','lot_project_listing','3','Unit LA-0103 — ROWENA MORENO CORTEZ','Reserved listing for client','Reserved LA-0103 for ROWENA MORENO CORTEZ.','{\"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 3, \"assignedSellerId\": 6, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": null, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:22:22'),(48,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','7','CASH-20260718-LA0103-0001 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Reservation payment for ROWENA MORENO CORTEZ.','{\"amount\": 50000, \"unitId\": \"LA-0103\", \"listingId\": 3, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 54, \"paymentDate\": \"2026-07-18\", \"paymentType\": \"reservation\", \"referenceId\": \"CASH-20260718-LA0103-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:22:27'),(49,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','8','CASH-20260718-LA0103-0002 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Downpayment payment for ROWENA MORENO CORTEZ.','{\"amount\": 103950, \"unitId\": \"LA-0103\", \"listingId\": 3, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 55, \"paymentDate\": \"2026-07-18\", \"paymentType\": \"downpayment\", \"referenceId\": \"CASH-20260718-LA0103-0002\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:22:29'),(50,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','9','CASH-20260718-LA0103-0003 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Monthly payment for ROWENA MORENO CORTEZ.','{\"amount\": 44920.83, \"unitId\": \"LA-0103\", \"listingId\": 3, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 56, \"paymentDate\": \"2026-07-18\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260718-LA0103-0003\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:22:31'),(51,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','10','CASH-20260718-LA0103-0004 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Monthly payment for ROWENA MORENO CORTEZ.','{\"amount\": 44920.83, \"unitId\": \"LA-0103\", \"listingId\": 3, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 57, \"paymentDate\": \"2026-07-18\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260718-LA0103-0004\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:22:41'),(52,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','11','CASH-20260718-LA0103-0005 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Monthly payment for ROWENA MORENO CORTEZ.','{\"amount\": 44920.83, \"unitId\": \"LA-0103\", \"listingId\": 3, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 58, \"paymentDate\": \"2026-07-18\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260718-LA0103-0005\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:23:14'),(53,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','12','CASH-20260718-LA0103-0006 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Monthly payment for ROWENA MORENO CORTEZ.','{\"amount\": 44920.83, \"unitId\": \"LA-0103\", \"listingId\": 3, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 59, \"paymentDate\": \"2026-07-18\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260718-LA0103-0006\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:23:16'),(54,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','13','CASH-20260718-LA0103-0007 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Monthly payment for ROWENA MORENO CORTEZ.','{\"amount\": 44920.83, \"unitId\": \"LA-0103\", \"listingId\": 3, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 60, \"paymentDate\": \"2026-07-18\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260718-LA0103-0007\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:23:17'),(55,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Project Settings','lot_project_settings','1','Bailen Project','Updated project release settings','Super updated release settings for Bailen Project.','{\"companyName\": \"D&C Prime Realty\", \"companyEmail\": \"dcprimerealty@gmail.com\", \"releaseDayOne\": 7, \"releaseDayTwo\": 18, \"companyContactNumber\": \"(046) 866-0616\", \"reservationContactName\": \"D&C Prime Realty\", \"reservationContactEmail\": \"dcprimerealty@gmail.com\", \"reservationContactNumber\": \"0912-345-6789\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:32:11'),(56,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','8','Agent  1 North Star — ₱5,040.00','Released commission','Released 1st Release commission for Agent  1 North Star.','{\"unitId\": \"LA-0103\", \"listingId\": 3, \"releaseId\": 36, \"clientName\": \"ROWENA MORENO CORTEZ\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 5040}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:32:20'),(57,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','8','Agent  1 North Star — ₱5,040.00','Released commission','Released 2nd Release commission for Agent  1 North Star.','{\"unitId\": \"LA-0103\", \"listingId\": 3, \"releaseId\": 37, \"clientName\": \"ROWENA MORENO CORTEZ\", \"releaseStage\": \"2nd Release\", \"releaseAmount\": 5040}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:32:24'),(58,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Commissions','lot_project_commission_receipt','1','Agent  1 North Star — LA-0103','Generated seller proof of income receipt','Generated a 10080.00 proof of income receipt from 2 released commission stage(s).','{\"sellerId\": 6, \"releaseIds\": [36, 37], \"totalAmount\": 10080, \"commissionId\": 8, \"referenceNumber\": \"32423\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-18 11:33:45');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs_archive`
--

DROP TABLE IF EXISTS `audit_logs_archive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `description` text,
  `metadata_json` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `audit_log_created_at` datetime NOT NULL,
  `archived_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_archive_record_id`),
  UNIQUE KEY `uq_archived_original_audit_log` (`original_audit_log_id`),
  KEY `idx_archived_audit_batch` (`audit_log_archive_batch_id`),
  KEY `idx_archived_audit_created` (`audit_log_created_at`),
  KEY `idx_archived_audit_module` (`module`),
  CONSTRAINT `fk_archived_audit_batch` FOREIGN KEY (`audit_log_archive_batch_id`) REFERENCES `audit_log_archive_batches` (`audit_log_archive_batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs_archive`
--

LOCK TABLES `audit_logs_archive` WRITE;
/*!40000 ALTER TABLE `audit_logs_archive` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs_archive` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_templates`
--

DROP TABLE IF EXISTS `document_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_templates` (
  `template_id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_name` varchar(150) NOT NULL,
  `template_description` text,
  `template_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `template_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `template_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_templates`
--

LOCK TABLES `document_templates` WRITE;
/*!40000 ALTER TABLE `document_templates` DISABLE KEYS */;
INSERT INTO `document_templates` VALUES (1,'DEFAULT LIST DOCUMENTS','Standard reservation and sales forms','active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(2,'FOR OFW CLIENTS','Documents for OFW buyers and representatives','active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(3,'REQUIRED FOR SUBMISSION (DEFAULT)','Identity and tax documents for a single buyer','active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(4,'REQUIRED FOR SUBMISSION (MARRIED)','Additional requirements for married buyers','active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(5,'REQUIRED FOR SUBMISSION (REPRESENTATIVE)','Additional requirements for representatives','active','2026-07-17 09:00:00','2026-07-17 09:00:00');
/*!40000 ALTER TABLE `document_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `document_name` varchar(150) NOT NULL,
  `document_description` text,
  `document_is_reusable` tinyint(1) NOT NULL DEFAULT '1',
  `document_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `document_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (1,'CLIENT REGISTRATION FORM (Seller\'s Copy)','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(2,'CLIENT REGISTRATION FORM (Administrator Copy)','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(3,'BUYER\'S INFORMATION FORM','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(4,'INTENT TO BUY','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(5,'OFFER TO BUY & BUYER\'S PROFILE','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(6,'RESERVATION AGREEMENT','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(7,'DEED OF SALE','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(8,'CONTRACT TO SELL','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(9,'BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(10,'VOLUNTARY CANCELLATION AND WAIVER OF RIGHTS','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(11,'BUYER ACKNOWLEDGEMENT FORM','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(12,'SPA to Process Title (for Company)','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(13,'SPA Authorization to Sign (for Representative)','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(14,'Two valid Government-Issued IDs (with 3 specimen signatures)','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(15,'TIN Number / TIN ID','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(16,'PSA Birth Certificate (Single)','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(17,'Marriage Certificate','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(18,'Valid ID of Spouse (with 3 specimen signatures)','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(19,'Spouse Signature Form','Mock core document library item',1,1,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(20,'CENOMAR','Mock core document library item',1,0,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(21,'Passport ID','Mock core document library item',1,0,'active','2026-07-17 09:00:00','2026-07-17 09:00:00'),(22,'Valid IDs of Principal and Representative','Mock core document library item',1,0,'active','2026-07-17 09:00:00','2026-07-17 09:00:00');
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_attendance_records`
--

DROP TABLE IF EXISTS `employee_attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_attendance_records` (
  `employee_attendance_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int unsigned NOT NULL,
  `attendance_date` date NOT NULL,
  `scheduled_time_in` time DEFAULT NULL,
  `scheduled_time_out` time DEFAULT NULL,
  `actual_time_in` time DEFAULT NULL,
  `actual_time_out` time DEFAULT NULL,
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
  `notes` text,
  `source` enum('manual','import','device') NOT NULL DEFAULT 'manual',
  `recorded_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_attendance_id`),
  UNIQUE KEY `uq_employee_attendance_date` (`employee_id`,`attendance_date`),
  KEY `fk_attendance_recorded_by` (`recorded_by_user_id`),
  KEY `fk_attendance_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_recorded_by` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_attendance_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_attendance_records`
--

LOCK TABLES `employee_attendance_records` WRITE;
/*!40000 ALTER TABLE `employee_attendance_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_attendance_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_cash_advance_deductions`
--

DROP TABLE IF EXISTS `employee_cash_advance_deductions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_cash_advance_deductions` (
  `employee_cash_advance_deduction_id` int unsigned NOT NULL AUTO_INCREMENT,
  `employee_cash_advance_id` int unsigned NOT NULL,
  `employee_payroll_id` int unsigned DEFAULT NULL,
  `deduction_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `remaining_balance_after` decimal(14,2) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_cash_advance_deduction_id`),
  KEY `fk_employee_cash_advance_deduction_advance` (`employee_cash_advance_id`),
  KEY `fk_employee_cash_advance_deduction_payroll` (`employee_payroll_id`),
  KEY `fk_employee_cash_advance_deduction_user` (`created_by_user_id`),
  CONSTRAINT `fk_employee_cash_advance_deduction_advance` FOREIGN KEY (`employee_cash_advance_id`) REFERENCES `employee_cash_advances` (`employee_cash_advance_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_deduction_payroll` FOREIGN KEY (`employee_payroll_id`) REFERENCES `employee_payrolls` (`employee_payroll_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_deduction_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_cash_advance_deductions`
--

LOCK TABLES `employee_cash_advance_deductions` WRITE;
/*!40000 ALTER TABLE `employee_cash_advance_deductions` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_cash_advance_deductions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_cash_advances`
--

DROP TABLE IF EXISTS `employee_cash_advances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `notes` text,
  `approved_by_user_id` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_by_user_id` int unsigned DEFAULT NULL,
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_cash_advance_id`),
  UNIQUE KEY `uq_employee_cash_advance_reference` (`reference_number`),
  KEY `fk_employee_cash_advance_employee` (`employee_id`),
  KEY `fk_employee_cash_advance_approved_by` (`approved_by_user_id`),
  KEY `fk_employee_cash_advance_created_by` (`created_by_user_id`),
  KEY `fk_employee_cash_advance_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_employee_cash_advance_approved_by` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_cash_advance_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_cash_advances`
--

LOCK TABLES `employee_cash_advances` WRITE;
/*!40000 ALTER TABLE `employee_cash_advances` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_cash_advances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_payroll_periods`
--

DROP TABLE IF EXISTS `employee_payroll_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_payroll_periods` (
  `employee_payroll_period_id` int unsigned NOT NULL AUTO_INCREMENT,
  `period_label` varchar(80) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `release_date` date DEFAULT NULL,
  `release_day` tinyint unsigned DEFAULT NULL,
  `period_type` enum('first_half','second_half') DEFAULT NULL,
  `witness_name` varchar(180) DEFAULT NULL,
  `release_notes` text,
  `payroll_status` enum('draft','finalized','cancelled') NOT NULL DEFAULT 'draft',
  `finalized_by_user_id` int unsigned DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_payroll_period_id`),
  UNIQUE KEY `uq_employee_payroll_period` (`period_start`,`period_end`),
  UNIQUE KEY `uq_employee_payroll_release_date` (`release_date`),
  KEY `fk_employee_payroll_finalized_by` (`finalized_by_user_id`),
  CONSTRAINT `fk_employee_payroll_finalized_by` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_payroll_periods`
--

LOCK TABLES `employee_payroll_periods` WRITE;
/*!40000 ALTER TABLE `employee_payroll_periods` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_payroll_periods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_payrolls`
--

DROP TABLE IF EXISTS `employee_payrolls`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `payroll_status` enum('draft','finalized','cancelled') NOT NULL DEFAULT 'draft',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_payroll_id`),
  UNIQUE KEY `uq_employee_payroll_employee` (`employee_payroll_period_id`,`employee_id`),
  KEY `fk_employee_payroll_employee` (`employee_id`),
  CONSTRAINT `fk_employee_payroll_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_payroll_period` FOREIGN KEY (`employee_payroll_period_id`) REFERENCES `employee_payroll_periods` (`employee_payroll_period_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_payrolls`
--

LOCK TABLES `employee_payrolls` WRITE;
/*!40000 ALTER TABLE `employee_payrolls` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_payrolls` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_work_schedules`
--

DROP TABLE IF EXISTS `employee_work_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`employee_work_schedule_id`),
  UNIQUE KEY `uq_employee_weekday` (`employee_id`,`weekday`),
  CONSTRAINT `fk_employee_schedule_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_work_schedules`
--

LOCK TABLES `employee_work_schedules` WRITE;
/*!40000 ALTER TABLE `employee_work_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_work_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `employee_id` int unsigned NOT NULL AUTO_INCREMENT,
  `linked_user_id` int unsigned DEFAULT NULL,
  `employee_code` varchar(40) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `contact_number` varchar(60) DEFAULT NULL,
  `address` text,
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
  PRIMARY KEY (`employee_id`),
  UNIQUE KEY `uq_employees_code` (`employee_code`),
  UNIQUE KEY `uq_employees_email` (`email`),
  KEY `fk_employees_linked_user` (`linked_user_id`),
  KEY `fk_employees_created_by` (`created_by_user_id`),
  KEY `fk_employees_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_employees_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employees_linked_user` FOREIGN KEY (`linked_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_employees_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_buyer_form_links`
--

DROP TABLE IF EXISTS `lot_project_buyer_form_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_buyer_form_links` (
  `lot_project_buyer_form_link_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
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
  PRIMARY KEY (`lot_project_buyer_form_link_id`),
  UNIQUE KEY `uq_buyer_form_token_hash` (`token_hash`),
  KEY `idx_buyer_form_link_listing_status` (`lot_project_listing_id`,`link_status`),
  KEY `idx_buyer_form_link_expiry` (`link_status`,`expires_at`),
  KEY `idx_buyer_form_link_project` (`lot_project_id`),
  KEY `idx_buyer_form_link_generator` (`generated_by_user_id`),
  CONSTRAINT `fk_buyer_form_link_generator` FOREIGN KEY (`generated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_link_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_link_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_buyer_form_links`
--

LOCK TABLES `lot_project_buyer_form_links` WRITE;
/*!40000 ALTER TABLE `lot_project_buyer_form_links` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_buyer_form_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_buyer_form_submissions`
--

DROP TABLE IF EXISTS `lot_project_buyer_form_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_buyer_form_submissions` (
  `lot_project_buyer_form_submission_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_buyer_form_link_id` bigint unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
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
  `rejection_reason` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_buyer_form_submission_id`),
  UNIQUE KEY `uq_buyer_form_submission_link` (`lot_project_buyer_form_link_id`),
  KEY `idx_buyer_form_submission_listing_status` (`lot_project_listing_id`,`submission_status`),
  KEY `idx_buyer_form_submission_project` (`lot_project_id`),
  KEY `idx_buyer_form_submission_reviewer` (`reviewed_by_user_id`),
  CONSTRAINT `fk_buyer_form_submission_link` FOREIGN KEY (`lot_project_buyer_form_link_id`) REFERENCES `lot_project_buyer_form_links` (`lot_project_buyer_form_link_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_submission_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_submission_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_buyer_form_submission_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_buyer_form_submissions`
--

LOCK TABLES `lot_project_buyer_form_submissions` WRITE;
/*!40000 ALTER TABLE `lot_project_buyer_form_submissions` DISABLE KEYS */;
 Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-17 14:59:40',1,'2026-07-17 15:13:38','2026-07-17 15:13:38',NULL,NULL,'2026-07-17 14:59:40','2026-07-17 15:13:38');
/*!40000 ALTER TABLE `lot_project_buyer_form_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_cadastral_lot_numbers`
--

DROP TABLE IF EXISTS `lot_project_cadastral_lot_numbers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_cadastral_lot_numbers` (
  `lot_project_cadastral_lot_number_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_cadastral_lot_number` varchar(100) NOT NULL,
  `lot_project_cadastral_lot_number_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_cadastral_lot_number_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_cadastral_lot_number_id`),
  UNIQUE KEY `uq_lot_project_cadastral_number` (`lot_project_id`,`lot_project_cadastral_lot_number`),
  CONSTRAINT `fk_lot_project_cadastral_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_cadastral_lot_numbers`
--

LOCK TABLES `lot_project_cadastral_lot_numbers` WRITE;
/*!40000 ALTER TABLE `lot_project_cadastral_lot_numbers` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_cadastral_lot_numbers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_client_documents`
--

DROP TABLE IF EXISTS `lot_project_client_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_client_documents` (
  `lot_project_client_document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `document_id` int unsigned NOT NULL,
  `lot_project_client_document_file_name` varchar(255) DEFAULT NULL,
  `lot_project_client_document_file_url` longtext,
  `lot_project_client_document_status` enum('Missing','Submitted','Approved','Rejected') NOT NULL DEFAULT 'Missing',
  `lot_project_client_document_uploaded_at` datetime DEFAULT NULL,
  `lot_project_client_document_approved_at` datetime DEFAULT NULL,
  `lot_project_client_document_approved_by_user_id` int unsigned DEFAULT NULL,
  `lot_project_client_document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_client_document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_client_document_id`),
  UNIQUE KEY `uq_client_document` (`lot_project_client_profile_id`,`document_id`),
  KEY `fk_client_document_project` (`lot_project_id`),
  KEY `fk_client_document_listing` (`lot_project_listing_id`),
  KEY `fk_client_document_document` (`document_id`),
  KEY `fk_client_document_approved_by` (`lot_project_client_document_approved_by_user_id`),
  CONSTRAINT `fk_client_document_approved_by` FOREIGN KEY (`lot_project_client_document_approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_document_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_client_documents`
--

LOCK TABLES `lot_project_client_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_client_documents` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_client_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_client_profiles`
--

DROP TABLE IF EXISTS `lot_project_client_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_client_profiles` (
  `lot_project_client_profile_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `assigned_accredited_seller_id` int unsigned DEFAULT NULL,
  `sale_channel` enum('distributed','direct_to_developer') NOT NULL DEFAULT 'distributed',
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
  `buyer_present_address` text,
  `buyer_present_zip_code` varchar(20) DEFAULT NULL,
  `buyer_permanent_address` text,
  `buyer_permanent_zip_code` varchar(20) DEFAULT NULL,
  `buyer_employment_status` varchar(150) DEFAULT NULL,
  `buyer_employer_business_name` varchar(255) DEFAULT NULL,
  `buyer_employer_zip_code` varchar(20) DEFAULT NULL,
  `buyer_employer_business_address` text,
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
  `second_buyer_present_address` text,
  `second_buyer_present_zip_code` varchar(20) DEFAULT NULL,
  `second_buyer_permanent_address` text,
  `second_buyer_permanent_zip_code` varchar(20) DEFAULT NULL,
  `second_buyer_employment_status` varchar(150) DEFAULT NULL,
  `second_buyer_employer_business_name` varchar(255) DEFAULT NULL,
  `second_buyer_employer_zip_code` varchar(20) DEFAULT NULL,
  `second_buyer_employer_business_address` text,
  `second_buyer_nature_of_work_business` varchar(255) DEFAULT NULL,
  `second_buyer_occupation_position` varchar(255) DEFAULT NULL,
  `second_buyer_monthly_income` decimal(14,2) DEFAULT '0.00',
  `lot_project_client_profile_status` enum('active','cancelled','closed') NOT NULL DEFAULT 'active',
  `soa_mode_of_payment` enum('cash','installment') NOT NULL DEFAULT 'installment',
  `soa_reservation_fee` decimal(14,2) DEFAULT NULL,
  `soa_reservation_fee_applied_to_downpayment` tinyint(1) NOT NULL DEFAULT '0',
  `soa_legal_misc_fee_mode` enum('include_in_monthly','separate_soa_row') NOT NULL DEFAULT 'include_in_monthly',
  `soa_legal_misc_fee_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `soa_starting_date` date DEFAULT NULL,
  `soa_first_due_date` date DEFAULT NULL,
  `soa_downpayment_percentage` decimal(5,2) DEFAULT '30.00',
  `soa_downpayment_terms` int unsigned DEFAULT '3',
  `soa_monthly_terms` int unsigned DEFAULT '36',
  `soa_annual_interest_rate` decimal(5,2) DEFAULT '0.00',
  `soa_interest_rate_overridden` tinyint(1) NOT NULL DEFAULT '0',
  `soa_interest_calculation_type` enum('amortized','diminishing') NOT NULL DEFAULT 'amortized',
  `needs_soa_review` tinyint(1) NOT NULL DEFAULT '0',
  `soa_dp_discount_percentage` decimal(5,2) DEFAULT '0.00',
  `soa_penalty_rate_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `soa_penalty_grace_days` int unsigned NOT NULL DEFAULT '0',
  `soa_penalty_calculation_method` enum('none','monthly_started','daily') NOT NULL DEFAULT 'none',
  `lot_project_client_profile_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_client_profile_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_client_profile_id`),
  UNIQUE KEY `uq_listing_client_profile` (`lot_project_listing_id`),
  KEY `fk_client_profile_project` (`lot_project_id`),
  KEY `idx_client_profile_assigned_seller` (`assigned_accredited_seller_id`),
  CONSTRAINT `fk_client_profile_assigned_seller` FOREIGN KEY (`assigned_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_client_profile_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_client_profile_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_client_penalty_grace_days` CHECK ((`soa_penalty_grace_days` between 0 and 365)),
  CONSTRAINT `chk_client_penalty_rate` CHECK ((`soa_penalty_rate_percent` between 0 and 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_client_profiles`
--

LOCK TABLES `lot_project_client_profiles` WRITE;
/*!40000 ALTER TABLE `lot_project_client_profiles` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_client_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_commission_receipt_items`
--

DROP TABLE IF EXISTS `lot_project_commission_receipt_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_commission_receipt_items` (
  `lot_project_commission_receipt_item_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_commission_receipt_id` int unsigned NOT NULL,
  `lot_project_commission_release_id` int unsigned NOT NULL,
  `release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_receipt_item_id`),
  UNIQUE KEY `uq_commission_receipt_release` (`lot_project_commission_release_id`),
  KEY `idx_commission_receipt_item_receipt` (`lot_project_commission_receipt_id`),
  CONSTRAINT `fk_commission_receipt_item_receipt` FOREIGN KEY (`lot_project_commission_receipt_id`) REFERENCES `lot_project_commission_receipts` (`lot_project_commission_receipt_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_item_release` FOREIGN KEY (`lot_project_commission_release_id`) REFERENCES `lot_project_commission_releases` (`lot_project_commission_release_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commission_receipt_items`
--

LOCK TABLES `lot_project_commission_receipt_items` WRITE;
/*!40000 ALTER TABLE `lot_project_commission_receipt_items` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_commission_receipt_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_commission_receipts`
--

DROP TABLE IF EXISTS `lot_project_commission_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_commission_receipts` (
  `lot_project_commission_receipt_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
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
  PRIMARY KEY (`lot_project_commission_receipt_id`),
  KEY `idx_commission_receipt_seller` (`accredited_seller_id`),
  KEY `idx_commission_receipt_commission` (`lot_project_commission_id`),
  KEY `idx_commission_receipt_listing` (`lot_project_listing_id`),
  KEY `idx_commission_receipt_date` (`receipt_date`),
  KEY `idx_commission_receipt_creator` (`created_by_user_id`),
  KEY `fk_commission_receipt_project` (`lot_project_id`),
  KEY `fk_commission_receipt_client` (`lot_project_client_profile_id`),
  CONSTRAINT `fk_commission_receipt_client` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_commission` FOREIGN KEY (`lot_project_commission_id`) REFERENCES `lot_project_commissions` (`lot_project_commission_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_receipt_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commission_receipts`
--

LOCK TABLES `lot_project_commission_receipts` WRITE;
/*!40000 ALTER TABLE `lot_project_commission_receipts` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_commission_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_commission_releases`
--

DROP TABLE IF EXISTS `lot_project_commission_releases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_commission_releases` (
  `lot_project_commission_release_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_commission_id` int unsigned NOT NULL,
  `release_stage` enum('1st Release','2nd Release','3rd Release','4th Release','Retention') NOT NULL,
  `release_trigger_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `release_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `gross_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `deduction_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `release_status` enum('Pending','Eligible','Released','On Hold','Cancelled') NOT NULL DEFAULT 'Pending',
  `scheduled_release_date` date DEFAULT NULL,
  `actual_release_date` date DEFAULT NULL,
  `released_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_release_id`),
  KEY `fk_commission_release_commission` (`lot_project_commission_id`),
  KEY `fk_commission_release_user` (`released_by_user_id`),
  CONSTRAINT `fk_commission_release_commission` FOREIGN KEY (`lot_project_commission_id`) REFERENCES `lot_project_commissions` (`lot_project_commission_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_release_user` FOREIGN KEY (`released_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commission_releases`
--

LOCK TABLES `lot_project_commission_releases` WRITE;
/*!40000 ALTER TABLE `lot_project_commission_releases` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_commission_releases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_commissions`
--

DROP TABLE IF EXISTS `lot_project_commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_commissions` (
  `lot_project_commission_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `accredited_seller_id` int unsigned NOT NULL,
  `sale_origin_accredited_seller_id` int unsigned DEFAULT NULL,
  `sale_owner_accredited_seller_id` int unsigned DEFAULT NULL,
  `commission_role` enum('broker_network_manager','broker','manager','agent') NOT NULL,
  `commission_seller_type` enum('main_seller','hierarchy_seller','selling_agent') NOT NULL,
  `commission_sale_type` enum('direct','distributed') NOT NULL DEFAULT 'distributed',
  `commission_rate_type` enum('direct','override') NOT NULL DEFAULT 'override',
  `seller_display_name_snapshot` varchar(255) DEFAULT NULL,
  `seller_group_name_snapshot` varchar(150) DEFAULT NULL,
  `commission_base_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `commission_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `gross_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `released_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_remaining_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payment_percent` decimal(7,2) NOT NULL DEFAULT '0.00',
  `commission_status` enum('Pending','Eligible','Partially Released','Released','On Hold','Cancelled') NOT NULL DEFAULT 'Pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_commission_id`),
  UNIQUE KEY `uq_commission_seller_per_listing` (`lot_project_listing_id`,`accredited_seller_id`),
  KEY `fk_commission_project` (`lot_project_id`),
  KEY `fk_commission_client_profile` (`lot_project_client_profile_id`),
  KEY `fk_commission_seller` (`accredited_seller_id`),
  KEY `idx_commission_rate_type` (`commission_rate_type`),
  KEY `idx_commission_sale_origin` (`sale_origin_accredited_seller_id`),
  KEY `idx_commission_sale_owner` (`sale_owner_accredited_seller_id`),
  CONSTRAINT `fk_commission_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_sale_origin` FOREIGN KEY (`sale_origin_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_sale_owner` FOREIGN KEY (`sale_owner_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commissions`
--

LOCK TABLES `lot_project_commissions` WRITE;
/*!40000 ALTER TABLE `lot_project_commissions` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_commissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_default_documents`
--

DROP TABLE IF EXISTS `lot_project_default_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_default_documents` (
  `lot_project_default_document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `document_id` int unsigned NOT NULL,
  `lot_project_default_document_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `lot_project_default_document_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `lot_project_default_document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_default_document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_default_document_id`),
  UNIQUE KEY `uq_lot_project_default_document` (`lot_project_id`,`document_id`),
  KEY `fk_lot_project_default_document_document` (`document_id`),
  CONSTRAINT `fk_lot_project_default_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_project_default_document_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_default_documents`
--

LOCK TABLES `lot_project_default_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_default_documents` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_default_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_listing_cadastral_lots`
--

DROP TABLE IF EXISTS `lot_project_listing_cadastral_lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_listing_cadastral_lots` (
  `lot_project_listing_cadastral_lot_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_cadastral_lot_number_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_listing_cadastral_lot_id`),
  UNIQUE KEY `uq_listing_cadastral_lot` (`lot_project_listing_id`,`lot_project_cadastral_lot_number_id`),
  KEY `fk_listing_cadastral_lot_number` (`lot_project_cadastral_lot_number_id`),
  CONSTRAINT `fk_listing_cadastral_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_cadastral_lot_number` FOREIGN KEY (`lot_project_cadastral_lot_number_id`) REFERENCES `lot_project_cadastral_lot_numbers` (`lot_project_cadastral_lot_number_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listing_cadastral_lots`
--

LOCK TABLES `lot_project_listing_cadastral_lots` WRITE;
/*!40000 ALTER TABLE `lot_project_listing_cadastral_lots` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_listing_cadastral_lots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_listing_documents`
--

DROP TABLE IF EXISTS `lot_project_listing_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_listing_documents` (
  `lot_project_listing_document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `document_id` int unsigned NOT NULL,
  `lot_project_listing_document_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `lot_project_listing_document_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `lot_project_listing_document_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_listing_document_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_listing_document_id`),
  UNIQUE KEY `uq_listing_document` (`lot_project_listing_id`,`document_id`),
  KEY `fk_listing_document_project` (`lot_project_id`),
  KEY `fk_listing_document_document` (`document_id`),
  CONSTRAINT `fk_listing_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_document_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_listing_document_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listing_documents`
--

LOCK TABLES `lot_project_listing_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_listing_documents` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_listing_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_listings`
--

DROP TABLE IF EXISTS `lot_project_listings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_listings` (
  `lot_project_listing_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_unit_type` enum('Inner','Corner','End') NOT NULL,
  `lot_project_listing_unit_id` varchar(50) NOT NULL,
  `lot_project_listing_old_unit_ids` text,
  `lot_project_listing_area_sqm` decimal(12,2) NOT NULL DEFAULT '0.00',
  `lot_project_listing_price_per_sqm` decimal(12,2) NOT NULL DEFAULT '0.00',
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
  `hold_note` text,
  `hold_created_at` datetime DEFAULT NULL,
  `hold_created_by_user_id` int unsigned DEFAULT NULL,
  `buyer_form_generation` int unsigned NOT NULL DEFAULT '0',
  `pending_buyer_form_submission_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`lot_project_listing_id`),
  UNIQUE KEY `uq_project_unit_id` (`lot_project_id`,`lot_project_listing_unit_id`),
  KEY `idx_listing_pending_buyer_form_submission` (`pending_buyer_form_submission_id`),
  CONSTRAINT `fk_listing_pending_buyer_form_submission` FOREIGN KEY (`pending_buyer_form_submission_id`) REFERENCES `lot_project_buyer_form_submissions` (`lot_project_buyer_form_submission_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_lot_project_listing_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listings`
--

LOCK TABLES `lot_project_listings` WRITE;
/*!40000 ALTER TABLE `lot_project_listings` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_listings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_notification_logs`
--

DROP TABLE IF EXISTS `lot_project_notification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_notification_logs` (
  `notification_log_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned DEFAULT NULL,
  `lot_project_listing_id` int unsigned DEFAULT NULL,
  `lot_project_client_profile_id` int unsigned DEFAULT NULL,
  `lot_project_payment_schedule_id` int unsigned DEFAULT NULL,
  `notification_type` enum('due_soon','overdue') NOT NULL,
  `recipient_email` varchar(150) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `sent_by_user_id` int unsigned DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `send_status` enum('sent','failed','contacted') NOT NULL DEFAULT 'sent',
  `error_message` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_log_id`),
  KEY `idx_notification_schedule` (`lot_project_payment_schedule_id`),
  KEY `idx_notification_project` (`lot_project_id`),
  KEY `idx_notification_listing` (`lot_project_listing_id`),
  KEY `idx_notification_client` (`lot_project_client_profile_id`),
  KEY `idx_notification_sender` (`sent_by_user_id`),
  CONSTRAINT `fk_notification_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_sender` FOREIGN KEY (`sent_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_notification_logs`
--

LOCK TABLES `lot_project_notification_logs` WRITE;
/*!40000 ALTER TABLE `lot_project_notification_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_project_notification_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_payment_allocations`
--

DROP TABLE IF EXISTS `lot_project_payment_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_payment_allocations` (
  `lot_project_payment_allocation_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_payment_id` int unsigned NOT NULL,
  `lot_project_payment_schedule_id` int unsigned NOT NULL,
  `applied_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_allocation_id`),
  KEY `idx_payment_allocation_payment` (`lot_project_payment_id`),
  KEY `idx_payment_allocation_schedule` (`lot_project_payment_schedule_id`),
  CONSTRAINT `fk_payment_allocation_payment` FOREIGN KEY (`lot_project_payment_id`) REFERENCES `lot_project_payments` (`lot_project_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_allocation_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_allocations`
--

LOCK TABLES `lot_project_payment_allocations` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_allocations` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_payment_allocations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_payment_logs`
--

DROP TABLE IF EXISTS `lot_project_payment_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_payment_logs` (
  `lot_project_payment_log_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_payment_id` int unsigned NOT NULL,
  `action_type` enum('created','updated','verified','rejected','cancelled','deleted') NOT NULL,
  `action_description` text,
  `action_by_user_id` int unsigned DEFAULT NULL,
  `action_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_log_id`),
  KEY `fk_payment_log_payment` (`lot_project_payment_id`),
  KEY `fk_payment_log_user` (`action_by_user_id`),
  CONSTRAINT `fk_payment_log_payment` FOREIGN KEY (`lot_project_payment_id`) REFERENCES `lot_project_payments` (`lot_project_payment_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_log_user` FOREIGN KEY (`action_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_logs`
--

LOCK TABLES `lot_project_payment_logs` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_logs` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_payment_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_payment_schedules`
--

DROP TABLE IF EXISTS `lot_project_payment_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_payment_schedules` (
  `lot_project_payment_schedule_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `due_date` date DEFAULT NULL,
  `description` varchar(150) NOT NULL,
  `beginning_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `due_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `interest_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `principal_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `monthly_amortization_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
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
  PRIMARY KEY (`lot_project_payment_schedule_id`),
  KEY `fk_schedule_project` (`lot_project_id`),
  KEY `fk_schedule_listing` (`lot_project_listing_id`),
  KEY `fk_schedule_client_profile` (`lot_project_client_profile_id`),
  CONSTRAINT `fk_schedule_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedule_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedule_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_schedules`
--

LOCK TABLES `lot_project_payment_schedules` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_schedules` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_payment_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_payments`
--

DROP TABLE IF EXISTS `lot_project_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_payments` (
  `lot_project_payment_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_payment_schedule_id` int unsigned DEFAULT NULL,
  `lot_project_payment_type` enum('reservation','downpayment','monthly_amortization','legal_misc','advance_payment','balloon','full_payment','other') NOT NULL,
  `lot_project_payment_method` enum('Cash','Bank Transfer','Online Payment','Check','Other') NOT NULL DEFAULT 'Cash',
  `lot_project_payment_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `lot_project_payment_date` date NOT NULL,
  `lot_project_payment_reference_id` varchar(150) DEFAULT NULL,
  `lot_project_payment_status` enum('Pending','Verified','Rejected','Cancelled') NOT NULL DEFAULT 'Verified',
  `lot_project_payment_verified_by_user_id` int unsigned DEFAULT NULL,
  `lot_project_payment_verified_at` datetime DEFAULT NULL,
  `lot_project_payment_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_payment_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_payment_id`),
  UNIQUE KEY `uq_payment_reference` (`lot_project_payment_reference_id`),
  KEY `fk_payment_project` (`lot_project_id`),
  KEY `fk_payment_listing` (`lot_project_listing_id`),
  KEY `fk_payment_client_profile` (`lot_project_client_profile_id`),
  KEY `fk_payment_schedule` (`lot_project_payment_schedule_id`),
  KEY `fk_payment_verified_by` (`lot_project_payment_verified_by_user_id`),
  CONSTRAINT `fk_payment_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_verified_by` FOREIGN KEY (`lot_project_payment_verified_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payments`
--

LOCK TABLES `lot_project_payments` WRITE;
/*!40000 ALTER TABLE `lot_project_payments` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_penalty_reliefs`
--

DROP TABLE IF EXISTS `lot_project_penalty_reliefs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_penalty_reliefs` (
  `penalty_relief_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
  `lot_project_payment_schedule_id` int unsigned NOT NULL,
  `relief_type` enum('penalty_free_extension','full_waiver','partial_waiver','penalty_correction','restoration') NOT NULL,
  `promised_payment_date` date DEFAULT NULL,
  `relief_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `restores_penalty_relief_id` int unsigned DEFAULT NULL,
  `status` enum('active','honored','partially_honored','broken','expired','cancelled','restored') NOT NULL DEFAULT 'active',
  `reason` varchar(255) NOT NULL,
  `internal_notes` text,
  `approved_by_user_id` int unsigned NOT NULL,
  `honored_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`penalty_relief_id`),
  KEY `idx_penalty_relief_schedule` (`lot_project_payment_schedule_id`),
  KEY `idx_penalty_relief_listing` (`lot_project_listing_id`),
  KEY `idx_penalty_relief_status` (`status`),
  KEY `idx_penalty_relief_restores` (`restores_penalty_relief_id`),
  KEY `fk_penalty_relief_project` (`lot_project_id`),
  KEY `fk_penalty_relief_profile` (`lot_project_client_profile_id`),
  KEY `fk_penalty_relief_user` (`approved_by_user_id`),
  CONSTRAINT `fk_penalty_relief_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_restores` FOREIGN KEY (`restores_penalty_relief_id`) REFERENCES `lot_project_penalty_reliefs` (`penalty_relief_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_penalty_relief_user` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_penalty_relief_amount` CHECK ((`relief_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_penalty_reliefs`
--

LOCK TABLES `lot_project_penalty_reliefs` WRITE;
/*!40000 ALTER TABLE `lot_project_penalty_reliefs` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_project_penalty_reliefs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_reservation_history`
--

DROP TABLE IF EXISTS `lot_project_reservation_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_reservation_history` (
  `lot_project_reservation_history_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned DEFAULT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `reservation_status` enum('active','pending_for_cancellation','cancelled') NOT NULL DEFAULT 'active',
  `reserved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tcp_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discount_percentage_snapshot` decimal(5,2) NOT NULL DEFAULT '0.00',
  `discount_applied_snapshot` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_type` enum('refunded','discontinued') DEFAULT NULL,
  `cancellation_reason` text,
  `cancelled_value` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cash_collected_at_cancellation` decimal(14,2) NOT NULL DEFAULT '0.00',
  `created_by_user_id` int unsigned DEFAULT NULL,
  `cancelled_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_reservation_history_id`),
  KEY `idx_reservation_history_project_reserved` (`lot_project_id`,`reserved_at`),
  KEY `idx_reservation_history_project_cancelled` (`lot_project_id`,`cancelled_at`),
  KEY `idx_reservation_history_listing_status` (`lot_project_listing_id`,`reservation_status`),
  KEY `fk_reservation_history_profile` (`lot_project_client_profile_id`),
  KEY `fk_reservation_history_created_by` (`created_by_user_id`),
  KEY `fk_reservation_history_cancelled_by` (`cancelled_by_user_id`),
  CONSTRAINT `fk_reservation_history_cancelled_by` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_reservation_history_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_reservation_history`
--

LOCK TABLES `lot_project_reservation_history` WRITE;
/*!40000 ALTER TABLE `lot_project_reservation_history` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_reservation_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_settings`
--

DROP TABLE IF EXISTS `lot_project_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `default_penalty_rate_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `default_penalty_grace_days` int unsigned NOT NULL DEFAULT '0',
  `lot_project_setting_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_setting_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_setting_id`),
  UNIQUE KEY `uq_lot_project_setting` (`lot_project_id`),
  CONSTRAINT `fk_lot_project_setting_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_default_penalty_grace_days` CHECK ((`default_penalty_grace_days` between 0 and 365)),
  CONSTRAINT `chk_default_penalty_rate` CHECK ((`default_penalty_rate_percent` between 0 and 100)),
  CONSTRAINT `chk_release_day_one` CHECK ((`release_day_one` between 1 and 31)),
  CONSTRAINT `chk_release_day_two` CHECK ((`release_day_two` between 1 and 31))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_settings`
--

LOCK TABLES `lot_project_settings` WRITE;
/*!40000 ALTER TABLE `lot_project_settings` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_project_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_projects`
--

DROP TABLE IF EXISTS `lot_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_projects` (
  `lot_project_id` int unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_name` varchar(150) NOT NULL,
  `lot_project_slug` varchar(180) NOT NULL,
  `lot_project_location` varchar(255) NOT NULL,
  `lot_project_location_code` varchar(20) NOT NULL,
  `lot_project_administrator_name` varchar(150) DEFAULT NULL,
  `lot_project_tax_declaration_no` varchar(100) DEFAULT NULL,
  `lot_project_pin` varchar(100) DEFAULT NULL,
  `lot_project_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `lot_project_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lot_project_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_id`),
  UNIQUE KEY `uq_lot_project_slug` (`lot_project_slug`),
  UNIQUE KEY `uq_lot_project_location_code` (`lot_project_location_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_projects`
--

LOCK TABLES `lot_projects` WRITE;
/*!40000 ALTER TABLE `lot_projects` DISABLE KEYS */;

/*!40000 ALTER TABLE `lot_projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `seller_group_lot_project_rates`
--

DROP TABLE IF EXISTS `seller_group_lot_project_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seller_group_lot_project_rates` (
  `seller_group_lot_project_rate_id` int unsigned NOT NULL AUTO_INCREMENT,
  `seller_group_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `seller_group_pool_rate` decimal(5,2) NOT NULL DEFAULT '8.00',
  `seller_group_lot_project_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `seller_group_lot_project_rate_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `seller_group_lot_project_rate_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`seller_group_lot_project_rate_id`),
  UNIQUE KEY `uq_group_project_rate` (`seller_group_id`,`lot_project_id`),
  KEY `fk_group_project_rate_project` (`lot_project_id`),
  CONSTRAINT `fk_group_project_rate_group` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_group_project_rate_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_seller_group_pool_rate` CHECK ((`seller_group_pool_rate` between 6 and 15))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_group_lot_project_rates`
--

LOCK TABLES `seller_group_lot_project_rates` WRITE;
/*!40000 ALTER TABLE `seller_group_lot_project_rates` DISABLE KEYS */;

/*!40000 ALTER TABLE `seller_group_lot_project_rates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `seller_groups`
--

DROP TABLE IF EXISTS `seller_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seller_groups` (
  `seller_group_id` int unsigned NOT NULL AUTO_INCREMENT,
  `seller_group_name` varchar(150) NOT NULL,
  `seller_group_head_user_id` int unsigned DEFAULT NULL,
  `seller_group_description` text,
  `seller_group_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `seller_group_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `seller_group_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`seller_group_id`),
  KEY `fk_seller_group_head_user` (`seller_group_head_user_id`),
  CONSTRAINT `fk_seller_group_head_user` FOREIGN KEY (`seller_group_head_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_groups`
--

LOCK TABLES `seller_groups` WRITE;
/*!40000 ALTER TABLE `seller_groups` DISABLE KEYS */;

/*!40000 ALTER TABLE `seller_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `seller_hierarchy_lot_project_overrides`
--

DROP TABLE IF EXISTS `seller_hierarchy_lot_project_overrides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seller_hierarchy_lot_project_overrides` (
  `seller_hierarchy_lot_project_override_id` int unsigned NOT NULL AUTO_INCREMENT,
  `child_accredited_seller_id` int unsigned NOT NULL,
  `parent_accredited_seller_id` int unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `override_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `override_rate_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`seller_hierarchy_lot_project_override_id`),
  UNIQUE KEY `uq_child_parent_project_override` (`child_accredited_seller_id`,`parent_accredited_seller_id`,`lot_project_id`),
  KEY `idx_hierarchy_override_project` (`lot_project_id`,`override_rate_status`),
  KEY `idx_hierarchy_override_parent` (`parent_accredited_seller_id`),
  CONSTRAINT `fk_hierarchy_override_child` FOREIGN KEY (`child_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hierarchy_override_parent` FOREIGN KEY (`parent_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hierarchy_override_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_hierarchy_override_rate` CHECK (((`override_rate` >= 0) and (`override_rate` <= 15)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_hierarchy_lot_project_overrides`
--

LOCK TABLES `seller_hierarchy_lot_project_overrides` WRITE;
/*!40000 ALTER TABLE `seller_hierarchy_lot_project_overrides` DISABLE KEYS */;

/*!40000 ALTER TABLE `seller_hierarchy_lot_project_overrides` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `system_setting_id` tinyint unsigned NOT NULL DEFAULT '1',
  `company_name` varchar(150) NOT NULL DEFAULT 'D&C Prime Realty',
  `company_email` varchar(150) DEFAULT NULL,
  `company_contact_number` varchar(60) DEFAULT NULL,
  `company_address` text,
  `company_tin` varchar(80) DEFAULT NULL,
  `system_status` enum('active','maintenance') NOT NULL DEFAULT 'active',
  `maintenance_message` text,
  `reservation_contact_name` varchar(150) DEFAULT NULL,
  `reservation_contact_email` varchar(150) DEFAULT NULL,
  `reservation_contact_number` varchar(60) DEFAULT NULL,
  `default_release_day_one` tinyint unsigned NOT NULL DEFAULT '7',
  `default_release_day_two` tinyint unsigned NOT NULL DEFAULT '22',
  `updated_by_user_id` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`system_setting_id`),
  KEY `fk_system_settings_updated_by` (`updated_by_user_id`),
  CONSTRAINT `fk_system_settings_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;

/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `template_document_list`
--

DROP TABLE IF EXISTS `template_document_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `template_document_list` (
  `template_document_list_id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  `document_id` int unsigned NOT NULL,
  `template_document_list_is_required` tinyint(1) NOT NULL DEFAULT '1',
  `template_document_list_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `template_document_list_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_document_list_id`),
  UNIQUE KEY `uq_template_document` (`template_id`,`document_id`),
  KEY `fk_template_document_document` (`document_id`),
  CONSTRAINT `fk_template_document_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_template_document_template` FOREIGN KEY (`template_id`) REFERENCES `document_templates` (`template_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `template_document_list`
--

LOCK TABLES `template_document_list` WRITE;
/*!40000 ALTER TABLE `template_document_list` DISABLE KEYS */;
INSERT INTO `template_document_list` VALUES (1,1,1,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(2,1,2,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(3,1,3,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(4,1,4,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(5,1,5,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(6,1,6,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(7,1,7,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(8,1,8,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(9,1,9,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(10,1,10,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(11,1,11,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(12,2,12,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(13,2,13,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(14,2,21,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(15,2,22,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(16,3,14,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(17,3,15,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(18,3,16,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(19,4,14,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(20,4,15,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(21,4,17,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(22,4,18,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(23,4,19,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(24,5,12,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(25,5,13,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(26,5,14,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(27,5,15,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(28,5,21,1,'2026-07-17 09:00:00','2026-07-17 09:00:00'),(29,5,22,1,'2026-07-17 09:00:00','2026-07-17 09:00:00');
/*!40000 ALTER TABLE `template_document_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `contact_no` varchar(50) DEFAULT NULL,
  `tin_no` varchar(100) DEFAULT NULL,
  `prc_no` varchar(50) DEFAULT NULL,
  `address` text,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('super_admin','admin','broker_network_manager','broker','manager','agent') NOT NULL DEFAULT 'agent',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '1',
  `can_login` tinyint(1) NOT NULL DEFAULT '1',
  `is_system_account` tinyint(1) NOT NULL DEFAULT '0',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Super','Admin',NULL,NULL,NULL,NULL,NULL,'robertrenbysanjuan@gmail.com','$2b$12$J9n9zS1nwQ1GbaLuxISkYOqgb81CC5T.Z7vxqPo989uGkmrxESjFy','super_admin','active',0,1,0,'2026-07-18 10:10:30','2026-07-17 09:00:00','2026-07-18 10:10:30');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-18 16:09:51


