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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_seller_lot_project_rates`
--

LOCK TABLES `accredited_seller_lot_project_rates` WRITE;
/*!40000 ALTER TABLE `accredited_seller_lot_project_rates` DISABLE KEYS */;
INSERT INTO `accredited_seller_lot_project_rates` VALUES (1,1,1,1.00,'active','2026-07-19 10:51:33','2026-07-19 11:53:48'),(2,1,2,1.00,'active','2026-07-19 10:51:33','2026-07-19 11:54:25'),(3,2,1,1.00,'active','2026-07-19 10:55:15','2026-07-19 11:53:36'),(4,2,2,1.00,'active','2026-07-19 10:55:15','2026-07-19 11:54:30'),(5,3,1,2.00,'active','2026-07-19 10:55:55','2026-07-19 11:53:30'),(6,3,2,1.00,'active','2026-07-19 10:55:55','2026-07-19 11:54:35'),(7,4,1,4.00,'active','2026-07-19 10:56:26','2026-07-19 11:53:55'),(8,4,2,5.00,'active','2026-07-19 10:56:26','2026-07-19 11:54:46');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_seller_managed_sellers`
--

LOCK TABLES `accredited_seller_managed_sellers` WRITE;
/*!40000 ALTER TABLE `accredited_seller_managed_sellers` DISABLE KEYS */;
INSERT INTO `accredited_seller_managed_sellers` VALUES (1,1,2,'2026-07-19 10:55:15','2026-07-19 10:55:15'),(3,3,4,'2026-07-19 10:56:26','2026-07-19 10:56:26'),(4,2,3,'2026-07-19 10:56:44','2026-07-19 10:56:44');
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_sellers`
--

LOCK TABLES `accredited_sellers` WRITE;
/*!40000 ALTER TABLE `accredited_sellers` DISABLE KEYS */;
INSERT INTO `accredited_sellers` VALUES (1,2,1,NULL,0,NULL,'2026-07-19','active','2026-07-19 10:51:33','2026-07-19 10:51:33'),(2,3,1,2,0,NULL,'2026-07-19','active','2026-07-19 10:55:15','2026-07-19 10:55:15'),(3,4,1,3,0,NULL,'2026-07-19','active','2026-07-19 10:55:55','2026-07-19 10:56:44'),(4,5,1,4,0,NULL,'2026-07-19','active','2026-07-19 10:56:26','2026-07-19 10:56:26');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_lot_project_direct_rates`
--

LOCK TABLES `agent_lot_project_direct_rates` WRITE;
/*!40000 ALTER TABLE `agent_lot_project_direct_rates` DISABLE KEYS */;
INSERT INTO `agent_lot_project_direct_rates` VALUES (1,4,1,4.00,'active','2026-07-19 11:53:22','2026-07-19 11:53:55'),(3,4,2,5.00,'active','2026-07-19 11:54:39','2026-07-19 11:54:46');
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
INSERT INTO `audit_log_archive_policy` VALUES (1,365,NULL,'2026-07-19 17:05:35','2026-07-19 17:05:35');
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
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Projects','lot_project','1','Bailen Project','Created lot project','Created lot project Bailen Project.','{\"slug\": \"bailen-project\", \"status\": \"active\", \"locationCode\": \"LA\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 09:51:27'),(2,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Projects','lot_project','1','Bailen Project','Updated lot project','Updated lot project Bailen Project.','{\"slug\": \"bailen-project\", \"status\": \"active\", \"locationCode\": \"LA\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 09:51:46'),(3,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Projects','lot_project','2','Prime Enclave Project','Created lot project','Created lot project Prime Enclave Project.','{\"slug\": \"prime-enclave-project\", \"status\": \"active\", \"locationCode\": \"PE\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 09:52:42'),(4,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Projects','lot_project','1','Bailen Project','Updated lot project','Updated lot project Bailen Project.','{\"slug\": \"bailen-project\", \"status\": \"active\", \"locationCode\": \"LA\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 09:52:54'),(5,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Listings','lot_project_listing','1','Unit LA-0208 — Bailen Project','Added new listing','Added LA-0208 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0208\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:33:31'),(6,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Listings','lot_project_listing','2','Unit LA-0401 — Bailen Project','Added new listing','Added LA-0401 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0401\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:34:39'),(7,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0208 — Bailen Project','Placed listing on hold','Placed LA-0208 on hold for 434.','{\"holdNote\": \"\", \"clientName\": \"434\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:34:58'),(8,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0208 — Bailen Project','Removed listing hold','Returned LA-0208 to available status.','{\"previousHoldClientName\": \"434\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:35:03'),(9,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Buyer Forms','lot_project_buyer_form_link','1','Unit LA-0208 — Bailen Project','Generated buyer form link','Generated a new buyer form link for LA-0208.','{\"listingId\": 1, \"generation\": 3, \"expiresHours\": 72, \"recipientEmail\": null, \"recipientMobileNumber\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:35:11'),(10,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Buyer Forms','lot_project_buyer_form_link','1','Unit LA-0208 — Bailen Project','Revoked buyer form link','Revoked the buyer form link for LA-0208.','{\"listingId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:35:25'),(11,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Buyer Forms','lot_project_buyer_form_link','2','Unit LA-0208 — Bailen Project','Generated buyer form link','Generated a new buyer form link for LA-0208.','{\"listingId\": 1, \"generation\": 5, \"expiresHours\": 72, \"recipientEmail\": null, \"recipientMobileNumber\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:35:39'),(12,NULL,'Robert Renby Cortez San Juan','robertrenbysanjuan@gmail.com','public_buyer','create','Buyer Forms','lot_project_buyer_form_submission','1','Unit LA-0208 — Robert Renby Cortez San Juan','Buyer submitted information form','Robert Renby Cortez San Juan submitted buyer information for LA-0208.','{\"linkId\": 2, \"buyerType\": \"single\", \"listingId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:37:30'),(13,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Seller Groups','seller_group','1','North Star Group','Created seller group','Created seller group North Star Group.','{\"status\": \"active\", \"projectRates\": [{\"lot_project_id\": 2, \"seller_group_pool_rate\": 8}, {\"lot_project_id\": 1, \"seller_group_pool_rate\": 8}]}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:48:01'),(14,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Seller Groups','seller_group','2','Group2 Sample','Created seller group','Created seller group Group2 Sample.','{\"status\": \"active\", \"projectRates\": [{\"lot_project_id\": 1, \"seller_group_pool_rate\": 7}, {\"lot_project_id\": 2, \"seller_group_pool_rate\": 7}]}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:49:19'),(15,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','2','Rowena Cortez','Created user account','Created account for Rowena Cortez (rowen@gmail.com).','{\"role\": \"broker_network_manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:51:33'),(16,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','1','Rowena Cortez','Accredited seller','Accredited Rowena Cortez as broker_network_manager.','{\"role\": \"broker_network_manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:51:33'),(17,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_group','1','North Star Group','Updated seller group','Updated seller group North Star Group.','{\"status\": \"active\", \"projectRates\": [{\"lot_project_id\": 1, \"seller_group_pool_rate\": 8}, {\"lot_project_id\": 2, \"seller_group_pool_rate\": 8}]}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:52:23'),(18,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','3','Rowena Broker1','Created user account','Created account for Rowena Broker1 (rowenaBroker1@gmail.com).','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:55:15'),(19,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','2','Rowena Broker1','Accredited seller','Accredited Rowena Broker1 as broker.','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:55:15'),(20,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','4','Rowena Manager1','Created user account','Created account for Rowena Manager1 (rowenamanager1@gmail.com).','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:55:55'),(21,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','3','Rowena Manager1','Accredited seller','Accredited Rowena Manager1 as manager.','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:55:55'),(22,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','5','Rowena Agent1','Created user account','Created account for Rowena Agent1 (rowenaagent1@gmail.com).','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:56:26'),(23,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','4','Rowena Agent1','Accredited seller','Accredited Rowena Agent1 as agent.','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:56:26'),(24,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Users','user','4','Rowena Manager1','Updated user account','Updated account for Rowena Manager1 (rowenamanager1@gmail.com).','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:56:44'),(25,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Accreditation','accredited_seller','3','Rowena Manager1','Updated accreditation','Updated accreditation for Rowena Manager1.','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 10:56:44'),(26,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','4:1','Rowena Agent1','Updated seller direct rate','Set Rowena Agent1\'s direct rate for Bailen Project to 3.00%.','{\"rate\": 3, \"role\": \"agent\", \"groupId\": 1, \"memberId\": 4, \"rateType\": \"direct\", \"projectId\": 1, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:53:22'),(27,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','3:1','Rowena Manager1','Updated seller override rate','Set Rowena Manager1\'s override rate for Bailen Project to 2.00%.','{\"rate\": 2, \"role\": \"manager\", \"groupId\": 1, \"memberId\": 3, \"rateType\": \"override\", \"projectId\": 1, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:53:30'),(28,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','2:1','Rowena Broker1','Updated seller override rate','Set Rowena Broker1\'s override rate for Bailen Project to 1.00%.','{\"rate\": 1, \"role\": \"broker\", \"groupId\": 1, \"memberId\": 2, \"rateType\": \"override\", \"projectId\": 1, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:53:36'),(29,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','1:1','Rowena Cortez','Updated seller override rate','Set Rowena Cortez\'s override rate for Bailen Project to 1.00%.','{\"rate\": 1, \"role\": \"broker_network_manager\", \"groupId\": 1, \"memberId\": 1, \"rateType\": \"override\", \"projectId\": 1, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:53:48'),(30,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','4:1','Rowena Agent1','Updated seller direct rate','Set Rowena Agent1\'s direct rate for Bailen Project to 4.00%.','{\"rate\": 4, \"role\": \"agent\", \"groupId\": 1, \"memberId\": 4, \"rateType\": \"direct\", \"projectId\": 1, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:53:55'),(31,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','1:2','Rowena Cortez','Updated seller override rate','Set Rowena Cortez\'s override rate for Prime Enclave Project to 1.00%.','{\"rate\": 1, \"role\": \"broker_network_manager\", \"groupId\": 1, \"memberId\": 1, \"rateType\": \"override\", \"projectId\": 2, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:54:25'),(32,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','2:2','Rowena Broker1','Updated seller override rate','Set Rowena Broker1\'s override rate for Prime Enclave Project to 1.00%.','{\"rate\": 1, \"role\": \"broker\", \"groupId\": 1, \"memberId\": 2, \"rateType\": \"override\", \"projectId\": 2, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:54:30'),(33,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','3:2','Rowena Manager1','Updated seller override rate','Set Rowena Manager1\'s override rate for Prime Enclave Project to 1.00%.','{\"rate\": 1, \"role\": \"manager\", \"groupId\": 1, \"memberId\": 3, \"rateType\": \"override\", \"projectId\": 2, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:54:35'),(34,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','4:2','Rowena Agent1','Updated seller direct rate','Set Rowena Agent1\'s direct rate for Prime Enclave Project to 4.00%.','{\"rate\": 4, \"role\": \"agent\", \"groupId\": 1, \"memberId\": 4, \"rateType\": \"direct\", \"projectId\": 2, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:54:39'),(35,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_project_rate','4:2','Rowena Agent1','Updated seller direct rate','Set Rowena Agent1\'s direct rate for Prime Enclave Project to 5.00%.','{\"rate\": 5, \"role\": \"agent\", \"groupId\": 1, \"memberId\": 4, \"rateType\": \"direct\", \"projectId\": 2, \"rateStatus\": \"active\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 11:54:46'),(36,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Reservations','lot_project_listing','63','Unit LA-1806 — Aaron M Corsino','Reserved listing for client','Reserved LA-1806 for Aaron M Corsino.','{\"buyerName\": \"Aaron M Corsino\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 1, \"assignedSellerId\": 4, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 7, \"buyerFormSubmissionId\": null, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 12:24:17'),(37,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','63','Unit LA-1806 — Bailen Project','Updated listing details','Updated LA-1806 in Bailen Project.','{\"unitCode\": \"LA-1806\", \"nextStatus\": \"sold\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": \"active\", \"previousStatus\": \"sold\", \"previousUnitCode\": \"LA-1806\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 12:24:37'),(38,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Reservations','lot_project_listing','62','Unit LA-1805 — ROWENA MORENO CORTEZ','Reserved listing for client','Reserved LA-1805 for ROWENA MORENO CORTEZ.','{\"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 2, \"assignedSellerId\": 4, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": null, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 14:59:45'),(39,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','1','CASH-20260719-LA1806-0001 — Aaron M Corsino','Recorded SOA payment','Recorded Reservation payment for Aaron M Corsino.','{\"amount\": 50000, \"unitId\": \"LA-1806\", \"listingId\": 63, \"clientName\": \"Aaron M Corsino\", \"scheduleId\": 16, \"paymentDate\": \"2026-07-19\", \"paymentType\": \"reservation\", \"referenceId\": \"CASH-20260719-LA1806-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 15:09:16'),(40,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','2','CASH-20260719-LA1806-0002 — Aaron M Corsino','Recorded SOA payment','Recorded Downpayment payment for Aaron M Corsino.','{\"amount\": 64350, \"unitId\": \"LA-1806\", \"listingId\": 63, \"clientName\": \"Aaron M Corsino\", \"scheduleId\": 17, \"paymentDate\": \"2026-07-19\", \"paymentType\": \"downpayment\", \"referenceId\": \"CASH-20260719-LA1806-0002\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 15:09:24'),(41,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','3','CASH-20260719-LA1806-0003 — Aaron M Corsino','Recorded SOA payment','Recorded Balloon payment for Aaron M Corsino.','{\"amount\": 209000, \"unitId\": \"LA-1806\", \"listingId\": 63, \"clientName\": \"Aaron M Corsino\", \"scheduleId\": null, \"paymentDate\": \"2026-07-19\", \"paymentType\": \"balloon\", \"referenceId\": \"CASH-20260719-LA1806-0003\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 15:09:48'),(42,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','4','CASH-20260719-LA1806-0004 — Aaron M Corsino','Recorded SOA payment','Recorded Balloon payment for Aaron M Corsino.','{\"amount\": 200000, \"unitId\": \"LA-1806\", \"listingId\": 63, \"clientName\": \"Aaron M Corsino\", \"scheduleId\": null, \"paymentDate\": \"2026-07-19\", \"paymentType\": \"balloon\", \"referenceId\": \"CASH-20260719-LA1806-0004\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 15:11:24'),(43,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','5','CASH-20260719-LA1806-0005 — Aaron M Corsino','Recorded SOA payment','Recorded Balloon payment for Aaron M Corsino.','{\"amount\": 150000, \"unitId\": \"LA-1806\", \"listingId\": 63, \"clientName\": \"Aaron M Corsino\", \"scheduleId\": null, \"paymentDate\": \"2026-07-19\", \"paymentType\": \"balloon\", \"referenceId\": \"CASH-20260719-LA1806-0005\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 15:38:57'),(44,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Project Settings','lot_project_settings','1','Bailen Project','Updated project release settings','Super updated release settings for Bailen Project.','{\"companyName\": \"D&C Prime Realty\", \"companyEmail\": \"dcprimerealty@gmail.com\", \"releaseDayOne\": 7, \"releaseDayTwo\": 19, \"companyContactNumber\": \"(046) 866-0616\", \"reservationContactName\": \"D&C Prime Realty\", \"reservationContactEmail\": \"dcprimerealty@gmail.com\", \"reservationContactNumber\": \"0912-345-6789\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:24'),(45,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','1','Rowena Agent1 — ₱6,240.00','Released commission','Released 1st Release commission for Rowena Agent1.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 1, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 6240}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:31'),(46,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','1','Rowena Agent1 — ₱6,240.00','Released commission','Released 2nd Release commission for Rowena Agent1.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 2, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"2nd Release\", \"releaseAmount\": 6240}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:34'),(47,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','2','Rowena Manager1 — ₱3,120.00','Released commission','Released 1st Release commission for Rowena Manager1.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 6, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 3120}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:39'),(48,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','2','Rowena Manager1 — ₱3,120.00','Released commission','Released 2nd Release commission for Rowena Manager1.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 7, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"2nd Release\", \"releaseAmount\": 3120}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:43'),(49,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','3','Rowena Broker1 — ₱1,560.00','Released commission','Released 1st Release commission for Rowena Broker1.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 11, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 1560}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:47'),(50,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','3','Rowena Broker1 — ₱1,560.00','Released commission','Released 2nd Release commission for Rowena Broker1.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 12, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"2nd Release\", \"releaseAmount\": 1560}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:50'),(51,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','4','Rowena Cortez — ₱1,560.00','Released commission','Released 1st Release commission for Rowena Cortez.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 16, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 1560}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:53'),(52,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','4','Rowena Cortez — ₱1,560.00','Released commission','Released 2nd Release commission for Rowena Cortez.','{\"unitId\": \"LA-1806\", \"listingId\": 63, \"releaseId\": 17, \"clientName\": \"Aaron M Corsino\", \"releaseStage\": \"2nd Release\", \"releaseAmount\": 1560}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:52:54'),(53,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Commissions','lot_project_commission_receipt','1','Rowena Manager1 — LA-1806','Generated seller proof of income receipt','Generated a 6240.00 proof of income receipt from 2 released commission stage(s).','{\"sellerId\": 3, \"releaseIds\": [7, 6], \"totalAmount\": 6240, \"commissionId\": 2, \"referenceNumber\": \"321\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:53:35'),(54,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Commissions','lot_project_commission_receipt','2','Rowena Agent1 — LA-1806','Generated seller proof of income receipt','Generated a 6240.00 proof of income receipt from 1 released commission stage(s).','{\"sellerId\": 4, \"releaseIds\": [1], \"totalAmount\": 6240, \"commissionId\": 1, \"referenceNumber\": \"321\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:54:11'),(55,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Commissions','lot_project_commission_receipt','3','Rowena Agent1 — LA-1806','Generated seller proof of income receipt','Generated a 6240.00 proof of income receipt from 1 released commission stage(s).','{\"sellerId\": 4, \"releaseIds\": [2], \"totalAmount\": 6240, \"commissionId\": 1, \"referenceNumber\": \"3212\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 16:55:08'),(56,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Listings','lot_project_listing','128','Unit PE-0101 — Prime Enclave Project','Added new listing','Added PE-0101 to Prime Enclave Project.','{\"status\": \"available\", \"unitCode\": \"PE-0101\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 17:01:47'),(57,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','63','Unit LA-1806 — Bailen Project','Updated listing details','Updated LA-1806 in Bailen Project.','{\"unitCode\": \"LA-1806\", \"nextStatus\": \"pending_for_cancellation\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 1}, \"soldSubstatus\": null, \"previousStatus\": \"sold\", \"previousUnitCode\": \"LA-1806\", \"resetToAvailable\": false, \"saleArchiveResult\": null, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"cancellationSettlement\": null, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-19 17:57:15'),(58,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::ffff:127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:36:56'),(59,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:36:58'),(60,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:42:21'),(61,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:48:56'),(62,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:49:08'),(63,NULL,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Authentication','user','1','Super Admin','Password reset completed','User reset their password using an email verification code.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:49:55'),(64,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:49:58'),(65,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','63','Unit LA-1806 — Bailen Project','Settled listing cancellation','Completed cancellation settlement for LA-1806.','{\"unitCode\": \"LA-1806\", \"nextStatus\": \"cancelled\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 1}, \"soldSubstatus\": null, \"previousStatus\": \"pending_for_cancellation\", \"previousUnitCode\": \"LA-1806\", \"resetToAvailable\": false, \"saleArchiveResult\": null, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"cancellationSettlement\": {\"refundDate\": \"2026-07-20\", \"refundType\": \"partial_refund\", \"refundAmount\": 150000, \"refundReference\": \"213\", \"settlementNotes\": null, \"discontinuedAmount\": 214350, \"legacyCancellationType\": \"discontinued\"}, \"statusTransitionAction\": \"settle_cancellation\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:11:12'),(66,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','63','Unit LA-1806 — Bailen Project','Updated listing details','Updated LA-1806 in Bailen Project.','{\"unitCode\": \"LA-1806\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"cancelled\", \"previousUnitCode\": \"LA-1806\", \"resetToAvailable\": true, \"saleArchiveResult\": {\"archiveId\": 1, \"historyId\": 1, \"releasedCommissionAmount\": 24960}, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"cancellationSettlement\": null, \"statusTransitionAction\": \"reset_to_available\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:11:59'),(67,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','6','CASH-20260720-LA1805-0001 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Reservation payment for ROWENA MORENO CORTEZ.','{\"amount\": 50000, \"unitId\": \"LA-1805\", \"listingId\": 62, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 31, \"paymentDate\": \"2026-07-20\", \"paymentType\": \"reservation\", \"referenceId\": \"CASH-20260720-LA1805-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:27:43'),(68,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Documents','lot_project_client_document','15','BUYER ACKNOWLEDGEMENT FORM — ROWENA MORENO CORTEZ','Uploaded client document','Uploaded 1 image(s) for BUYER ACKNOWLEDGEMENT FORM of ROWENA MORENO CORTEZ.','{\"unitId\": \"LA-1805\", \"listingId\": 62, \"documentId\": 11, \"totalImages\": 1, \"documentName\": \"BUYER ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 2}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:28:13'),(69,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Documents','lot_project_client_document','16','BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM — ROWENA MORENO CORTEZ','Uploaded client document','Uploaded 1 image(s) for BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM of ROWENA MORENO CORTEZ.','{\"unitId\": \"LA-1805\", \"listingId\": 62, \"documentId\": 9, \"totalImages\": 1, \"documentName\": \"BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 2}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:28:53'),(70,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Listings','lot_project_listing','129','Unit PE-0101 — Prime Enclave Project','Added new listing','Added PE-0101 to Prime Enclave Project.','{\"status\": \"available\", \"unitCode\": \"PE-0101\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:36:38'),(71,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Buyer Forms','lot_project_buyer_form_link','1','Unit PE-0101 — Prime Enclave Project','Generated buyer form link','Generated a new buyer form link for PE-0101.','{\"listingId\": 129, \"generation\": 1, \"expiresHours\": 72, \"recipientEmail\": null, \"recipientMobileNumber\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:36:51'),(72,NULL,'ROWENA MORENO CORTEZ','rrcsanjuan@pcu.edu.ph','public_buyer','create','Buyer Forms','lot_project_buyer_form_submission','1','Unit PE-0101 — ROWENA MORENO CORTEZ','Buyer submitted information form','ROWENA MORENO CORTEZ submitted buyer information for PE-0101.','{\"linkId\": 1, \"buyerType\": \"single\", \"listingId\": 129}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:39:24'),(73,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Reservations','lot_project_listing','129','Unit PE-0101 — ROWENA MORENO CORTEZ','Reserved listing for client','Reserved PE-0101 for ROWENA MORENO CORTEZ.','{\"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 3, \"assignedSellerId\": 4, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": 1, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:39:52'),(74,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','7','CASH-20260720-PE0101-0001 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Reservation payment for ROWENA MORENO CORTEZ.','{\"amount\": 50000, \"unitId\": \"PE-0101\", \"listingId\": 129, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 69, \"paymentDate\": \"2026-07-20\", \"paymentType\": \"reservation\", \"referenceId\": \"CASH-20260720-PE0101-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:39:57'),(75,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','8','CASH-20260720-PE0101-0002 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Downpayment payment for ROWENA MORENO CORTEZ.','{\"amount\": 519750, \"unitId\": \"PE-0101\", \"listingId\": 129, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 70, \"paymentDate\": \"2026-07-20\", \"paymentType\": \"downpayment\", \"referenceId\": \"CASH-20260720-PE0101-0002\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:40:09'),(76,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','9','CASH-20260720-PE0101-0003 — ROWENA MORENO CORTEZ','Recorded SOA payment','Recorded Monthly payment for ROWENA MORENO CORTEZ.','{\"amount\": 96895.83, \"unitId\": \"PE-0101\", \"listingId\": 129, \"clientName\": \"ROWENA MORENO CORTEZ\", \"scheduleId\": 71, \"paymentDate\": \"2026-07-20\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260720-PE0101-0003\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:40:17'),(77,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','129','Unit PE-0101 — Prime Enclave Project','Updated listing details','Updated PE-0101 in Prime Enclave Project.','{\"unitCode\": \"PE-0101\", \"nextStatus\": \"pending_for_cancellation\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 1}, \"soldSubstatus\": null, \"previousStatus\": \"sold\", \"previousUnitCode\": \"PE-0101\", \"resetToAvailable\": false, \"saleArchiveResult\": null, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"cancellationSettlement\": null, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:40:34'),(78,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','129','Unit PE-0101 — Prime Enclave Project','Settled listing cancellation','Completed cancellation settlement for PE-0101.','{\"unitCode\": \"PE-0101\", \"nextStatus\": \"cancelled\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 1}, \"soldSubstatus\": null, \"previousStatus\": \"pending_for_cancellation\", \"previousUnitCode\": \"PE-0101\", \"resetToAvailable\": false, \"saleArchiveResult\": null, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"cancellationSettlement\": {\"refundDate\": \"2026-07-20\", \"refundType\": \"partial_refund\", \"refundAmount\": 333333, \"refundReference\": \"12\", \"settlementNotes\": \"tes\", \"discontinuedAmount\": 333312.83, \"legacyCancellationType\": \"discontinued\"}, \"statusTransitionAction\": \"settle_cancellation\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:47:34'),(79,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','129','Unit PE-0101 — Prime Enclave Project','Updated listing details','Updated PE-0101 in Prime Enclave Project.','{\"unitCode\": \"PE-0101\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"cancelled\", \"previousUnitCode\": \"PE-0101\", \"resetToAvailable\": true, \"saleArchiveResult\": {\"archiveId\": 2, \"historyId\": 3, \"releasedCommissionAmount\": 0}, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"cancellationSettlement\": null, \"statusTransitionAction\": \"reset_to_available\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:47:40');
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
-- Table structure for table `lot_project_archived_commission_releases`
--

DROP TABLE IF EXISTS `lot_project_archived_commission_releases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `accredited_seller_id` int unsigned NOT NULL,
  `sale_owner_accredited_seller_id` int unsigned DEFAULT NULL,
  `project_name_snapshot` varchar(255) NOT NULL,
  `project_location_snapshot` varchar(255) DEFAULT NULL,
  `unit_id_snapshot` varchar(50) NOT NULL,
  `buyer_name_snapshot` varchar(255) DEFAULT NULL,
  `commission_role` varchar(50) NOT NULL,
  `commission_seller_type` varchar(50) NOT NULL,
  `commission_rate_type` varchar(50) NOT NULL,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `gross_commission_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `release_stage` varchar(50) NOT NULL,
  `release_trigger_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `release_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `gross_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `deduction_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `net_release_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `actual_release_date` date NOT NULL,
  `receipt_date` date DEFAULT NULL,
  `receipt_reference_number` varchar(150) DEFAULT NULL,
  `receipt_bank_name` varchar(150) DEFAULT NULL,
  `receipt_account_number` varchar(100) DEFAULT NULL,
  `receipt_witness_name` varchar(255) DEFAULT NULL,
  `receipt_total_amount` decimal(14,2) DEFAULT NULL,
  `receipt_status` varchar(20) DEFAULT NULL,
  `receipt_created_by_name` varchar(255) DEFAULT NULL,
  `archived_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`lot_project_archived_commission_release_id`),
  UNIQUE KEY `uq_archived_commission_source_release` (`source_commission_release_id`),
  KEY `idx_archived_commission_seller_date` (`accredited_seller_id`,`actual_release_date`),
  KEY `idx_archived_commission_owner_date` (`sale_owner_accredited_seller_id`,`actual_release_date`),
  KEY `idx_archived_commission_receipt` (`source_commission_receipt_id`),
  KEY `fk_archived_commission_sale_archive` (`lot_project_cancelled_sale_archive_id`),
  KEY `fk_archived_commission_history` (`lot_project_reservation_history_id`),
  CONSTRAINT `fk_archived_commission_history` FOREIGN KEY (`lot_project_reservation_history_id`) REFERENCES `lot_project_reservation_history` (`lot_project_reservation_history_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_archived_commission_sale_archive` FOREIGN KEY (`lot_project_cancelled_sale_archive_id`) REFERENCES `lot_project_cancelled_sale_archives` (`lot_project_cancelled_sale_archive_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_archived_commission_releases`
--

LOCK TABLES `lot_project_archived_commission_releases` WRITE;
/*!40000 ALTER TABLE `lot_project_archived_commission_releases` DISABLE KEYS */;
INSERT INTO `lot_project_archived_commission_releases` VALUES (1,1,1,2,1,3,1,63,1,4,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','agent','selling_agent','direct',4.00,31200.00,'2nd Release',40.00,20.00,6240.00,0.00,6240.00,'2026-07-19','2026-07-19','3212','bdo','1232','fdf',6240.00,'active','Super Admin','2026-07-20 10:11:59'),(2,1,1,1,1,2,1,63,1,4,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','agent','selling_agent','direct',4.00,31200.00,'1st Release',20.00,20.00,6240.00,0.00,6240.00,'2026-07-19','2026-07-19','321','cash','123','geg',6240.00,'active','Super Admin','2026-07-20 10:11:59'),(3,1,1,7,2,1,1,63,1,3,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','manager','hierarchy_seller','override',2.00,15600.00,'2nd Release',40.00,20.00,3120.00,0.00,3120.00,'2026-07-19','2026-07-19','321','BPI','123','Fritz',6240.00,'active','Super Admin','2026-07-20 10:11:59'),(4,1,1,6,2,1,1,63,1,3,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','manager','hierarchy_seller','override',2.00,15600.00,'1st Release',20.00,20.00,3120.00,0.00,3120.00,'2026-07-19','2026-07-19','321','BPI','123','Fritz',6240.00,'active','Super Admin','2026-07-20 10:11:59'),(5,1,1,12,3,NULL,1,63,1,2,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','broker','hierarchy_seller','override',1.00,7800.00,'2nd Release',40.00,20.00,1560.00,0.00,1560.00,'2026-07-19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-20 10:11:59'),(6,1,1,11,3,NULL,1,63,1,2,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','broker','hierarchy_seller','override',1.00,7800.00,'1st Release',20.00,20.00,1560.00,0.00,1560.00,'2026-07-19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-20 10:11:59'),(7,1,1,17,4,NULL,1,63,1,1,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','broker_network_manager','hierarchy_seller','override',1.00,7800.00,'2nd Release',40.00,20.00,1560.00,0.00,1560.00,'2026-07-19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-20 10:11:59'),(8,1,1,16,4,NULL,1,63,1,1,4,'Bailen Project','Pantihan, Bailen Cavite','LA-1806','Aaron M Corsino','broker_network_manager','hierarchy_seller','override',1.00,7800.00,'1st Release',20.00,20.00,1560.00,0.00,1560.00,'2026-07-19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-20 10:11:59');
/*!40000 ALTER TABLE `lot_project_archived_commission_releases` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_buyer_form_links`
--

LOCK TABLES `lot_project_buyer_form_links` WRITE;
/*!40000 ALTER TABLE `lot_project_buyer_form_links` DISABLE KEYS */;
INSERT INTO `lot_project_buyer_form_links` VALUES (1,2,129,'91d95aa8db3df33d1d8250613a67fa31800b9e7adbd48e264a86bd457caab722',1,'consumed','2026-07-23 10:36:51',1,'2026-07-20 10:36:51','2026-07-20 10:36:55','2026-07-20 10:36:55','2026-07-20 10:39:24',NULL,'2026-07-20 10:39:52',NULL,NULL,'2026-07-20 10:36:51','2026-07-20 10:39:52');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_buyer_form_submissions`
--

LOCK TABLES `lot_project_buyer_form_submissions` WRITE;
/*!40000 ALTER TABLE `lot_project_buyer_form_submissions` DISABLE KEYS */;
INSERT INTO `lot_project_buyer_form_submissions` VALUES (1,1,2,129,'archived','ROWENA MORENO CORTEZ','rrcsanjuan@pcu.edu.ph','09278965570','single','{\"tin\": \"\", \"email\": \"rrcsanjuan@pcu.edu.ph\", \"gender\": \"Female\", \"birthDate\": \"1944-11-11\", \"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"contactNo\": \"09278965570\", \"buyerSuffix\": \"\", \"citizenship\": \"filipino\", \"civilStatus\": \"Married\", \"placeOfBirth\": \"Dyan\", \"buyerLastName\": \"CORTEZ\", \"monthlyIncome\": \"3434343\", \"buyerFirstName\": \"ROWENA\", \"presentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"presentZipCode\": \"4141\", \"secondBuyerTin\": \"\", \"buyerMiddleName\": \"MORENO\", \"employerZipCode\": \"\", \"secondBuyerName\": \"\", \"secondBuyerRole\": \"spouse\", \"employmentStatus\": \"Employed - Private\", \"permanentAddress\": \"\", \"permanentZipCode\": \"\", \"secondBuyerEmail\": \"\", \"secondBuyerGender\": \"\", \"secondBuyerSuffix\": \"\", \"secondBuyerLastName\": \"\", \"employerBusinessName\": \"\", \"natureOfWorkBusiness\": \"\", \"residencePhoneNumber\": \"\", \"secondBuyerBirthDate\": \"\", \"secondBuyerContactNo\": \"\", \"secondBuyerFirstName\": \"\", \"secondBuyerMiddleName\": \"\", \"secondBuyerCitizenship\": \"\", \"secondBuyerCivilStatus\": \"\", \"employerBusinessAddress\": \"\", \"occupationPositionTitle\": \"\", \"secondBuyerPlaceOfBirth\": \"\", \"secondBuyerMonthlyIncome\": \"\", \"secondBuyerPresentAddress\": \"\", \"secondBuyerPresentZipCode\": \"\", \"secondBuyerEmployerZipCode\": \"\", \"secondBuyerEmploymentStatus\": \"\", \"secondBuyerPermanentAddress\": \"\", \"secondBuyerPermanentZipCode\": \"\", \"secondBuyerEmployerBusinessName\": \"\", \"secondBuyerNatureOfWorkBusiness\": \"\", \"secondBuyerResidencePhoneNumber\": \"\", \"secondBuyerEmployerBusinessAddress\": \"\", \"secondBuyerOccupationPositionTitle\": \"\"}','{\"tin\": \"\", \"email\": \"rrcsanjuan@pcu.edu.ph\", \"gender\": \"Female\", \"birthDate\": \"1944-11-11\", \"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"contactNo\": \"09278965570\", \"buyerSuffix\": \"\", \"citizenship\": \"filipino\", \"civilStatus\": \"Married\", \"computedAge\": \"-\", \"placeOfBirth\": \"Dyan\", \"buyerLastName\": \"CORTEZ\", \"monthlyIncome\": \"3434343\", \"profileStatus\": \"complete\", \"buyerFirstName\": \"ROWENA\", \"presentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"presentZipCode\": \"4141\", \"secondBuyerTin\": \"\", \"buyerMiddleName\": \"MORENO\", \"employerZipCode\": \"\", \"secondBuyerName\": \"\", \"secondBuyerRole\": \"spouse\", \"employmentStatus\": \"Employed - Private\", \"permanentAddress\": \"\", \"permanentZipCode\": \"\", \"secondBuyerEmail\": \"\", \"secondBuyerGender\": \"\", \"secondBuyerSuffix\": \"\", \"secondBuyerLastName\": \"\", \"employerBusinessName\": \"\", \"natureOfWorkBusiness\": \"\", \"residencePhoneNumber\": \"\", \"secondBuyerBirthDate\": \"\", \"secondBuyerContactNo\": \"\", \"secondBuyerFirstName\": \"\", \"secondBuyerMiddleName\": \"\", \"secondBuyerCitizenship\": \"\", \"secondBuyerCivilStatus\": \"\", \"secondBuyerComputedAge\": \"-\", \"employerBusinessAddress\": \"\", \"occupationPositionTitle\": \"\", \"secondBuyerPlaceOfBirth\": \"\", \"secondBuyerMonthlyIncome\": \"\", \"secondBuyerPresentAddress\": \"\", \"secondBuyerPresentZipCode\": \"\", \"secondBuyerEmployerZipCode\": \"\", \"secondBuyerEmploymentStatus\": \"\", \"secondBuyerPermanentAddress\": \"\", \"secondBuyerPermanentZipCode\": \"\", \"secondBuyerEmployerBusinessName\": \"\", \"secondBuyerNatureOfWorkBusiness\": \"\", \"secondBuyerResidencePhoneNumber\": \"\", \"secondBuyerEmployerBusinessAddress\": \"\", \"secondBuyerOccupationPositionTitle\": \"\"}','2026-07-20 10:39:24','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 10:39:24',1,'2026-07-20 10:39:52','2026-07-20 10:39:52',NULL,NULL,'2026-07-20 10:39:24','2026-07-20 10:47:40');
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_cadastral_lot_numbers`
--

LOCK TABLES `lot_project_cadastral_lot_numbers` WRITE;
/*!40000 ALTER TABLE `lot_project_cadastral_lot_numbers` DISABLE KEYS */;
INSERT INTO `lot_project_cadastral_lot_numbers` VALUES (4,1,'1306','2026-07-19 09:52:54','2026-07-19 09:52:54'),(5,1,'1314','2026-07-19 09:52:54','2026-07-19 09:52:54');
/*!40000 ALTER TABLE `lot_project_cadastral_lot_numbers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_cancelled_sale_archives`
--

DROP TABLE IF EXISTS `lot_project_cancelled_sale_archives`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_cancelled_sale_archives` (
  `lot_project_cancelled_sale_archive_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `lot_project_reservation_history_id` bigint unsigned NOT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
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
  PRIMARY KEY (`lot_project_cancelled_sale_archive_id`),
  UNIQUE KEY `uq_cancelled_sale_archive_history` (`lot_project_reservation_history_id`),
  KEY `idx_cancelled_sale_archive_project` (`lot_project_id`,`archived_at`),
  KEY `idx_cancelled_sale_archive_listing` (`lot_project_listing_id`,`archived_at`),
  KEY `fk_cancelled_sale_archive_user` (`archived_by_user_id`),
  CONSTRAINT `fk_cancelled_sale_archive_history` FOREIGN KEY (`lot_project_reservation_history_id`) REFERENCES `lot_project_reservation_history` (`lot_project_reservation_history_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cancelled_sale_archive_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cancelled_sale_archive_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cancelled_sale_archive_user` FOREIGN KEY (`archived_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_cancelled_sale_archives`
--

LOCK TABLES `lot_project_cancelled_sale_archives` WRITE;
/*!40000 ALTER TABLE `lot_project_cancelled_sale_archives` DISABLE KEYS */;
INSERT INTO `lot_project_cancelled_sale_archives` VALUES (1,1,1,63,'LA-1806','Aaron M Corsino',364350.00,150000.00,214350.00,24960.00,'[{\"buyer_tin\": \"0987-65-675\", \"buyer_type\": \"single\", \"buyer_email\": \"aaron@gmail.com\", \"buyer_gender\": \"Male\", \"buyer_suffix\": null, \"sale_channel\": \"distributed\", \"lot_project_id\": 1, \"buyer_full_name\": \"Aaron M Corsino\", \"buyer_last_name\": \"Corsino\", \"buyer_birth_date\": \"2004-02-06\", \"buyer_first_name\": \"Aaron\", \"needs_soa_review\": 0, \"second_buyer_tin\": null, \"soa_selected_tcp\": \"858000.00\", \"buyer_citizenship\": \"filipino\", \"buyer_middle_name\": \"M\", \"second_buyer_role\": null, \"soa_monthly_terms\": 12, \"soa_starting_date\": \"2026-07-19\", \"buyer_civil_status\": \"Single\", \"second_buyer_email\": null, \"soa_first_due_date\": \"2026-07-31\", \"second_buyer_gender\": null, \"second_buyer_suffix\": null, \"soa_mode_of_payment\": \"installment\", \"soa_reservation_fee\": \"50000.00\", \"buyer_contact_number\": \"09045645643\", \"buyer_monthly_income\": \"145000.00\", \"buyer_place_of_birth\": \"Manila\", \"buyer_present_address\": \"test address\", \"soa_downpayment_terms\": 2, \"buyer_present_zip_code\": \"4108\", \"lot_project_listing_id\": 63, \"second_buyer_full_name\": null, \"second_buyer_last_name\": null, \"soa_penalty_grace_days\": 7, \"buyer_employer_zip_code\": \"n/a\", \"buyer_employment_status\": \"Student\", \"buyer_permanent_address\": \"test address\", \"second_buyer_birth_date\": null, \"second_buyer_first_name\": null, \"soa_legal_misc_fee_mode\": \"include_in_monthly\", \"soa_selected_lmf_amount\": \"78000.00\", \"buyer_permanent_zip_code\": \"4108\", \"second_buyer_citizenship\": null, \"second_buyer_middle_name\": null, \"soa_annual_interest_rate\": \"0.00\", \"soa_penalty_rate_percent\": \"0.10\", \"soa_sale_discount_amount\": \"0.00\", \"buyer_occupation_position\": \"Student\", \"second_buyer_civil_status\": null, \"soa_legal_misc_fee_amount\": \"78000.00\", \"soa_downpayment_percentage\": \"15.00\", \"soa_dp_discount_percentage\": \"0.00\", \"soa_selected_price_per_sqm\": \"2600.00\", \"second_buyer_contact_number\": null, \"second_buyer_monthly_income\": \"0.00\", \"second_buyer_place_of_birth\": null, \"buyer_employer_business_name\": \"n/a\", \"buyer_residence_phone_number\": null, \"second_buyer_present_address\": null, \"soa_interest_rate_overridden\": 0, \"soa_sale_discount_percentage\": \"0.00\", \"assigned_accredited_seller_id\": 4, \"buyer_nature_of_work_business\": \"n/a\", \"lot_project_client_profile_id\": 1, \"second_buyer_present_zip_code\": null, \"soa_interest_calculation_type\": \"amortized\", \"second_buyer_employer_zip_code\": null, \"second_buyer_employment_status\": null, \"second_buyer_permanent_address\": null, \"soa_penalty_calculation_method\": \"daily\", \"soa_selected_net_selling_price\": \"780000.00\", \"buyer_employer_business_address\": \"n/a\", \"second_buyer_permanent_zip_code\": null, \"soa_selected_base_selling_price\": \"780000.00\", \"second_buyer_occupation_position\": null, \"lot_project_client_profile_status\": \"active\", \"second_buyer_employer_business_name\": null, \"second_buyer_residence_phone_number\": null, \"second_buyer_nature_of_work_business\": null, \"lot_project_client_profile_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_profile_updated_at\": \"2026-07-19 12:24:17\", \"second_buyer_employer_business_address\": null, \"soa_reservation_fee_applied_to_downpayment\": 0}]','[{\"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_payment_id\": 1, \"lot_project_payment_date\": \"2026-07-19\", \"lot_project_payment_type\": \"reservation\", \"lot_project_payment_amount\": \"50000.00\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Verified\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_created_at\": \"2026-07-19 15:09:16\", \"lot_project_payment_updated_at\": \"2026-07-19 15:09:16\", \"lot_project_payment_schedule_id\": 16, \"lot_project_payment_verified_at\": \"2026-07-19 15:09:16\", \"lot_project_payment_reference_id\": \"CASH-20260719-LA1806-0001\", \"lot_project_payment_verified_by_user_id\": 1}, {\"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_payment_id\": 2, \"lot_project_payment_date\": \"2026-07-19\", \"lot_project_payment_type\": \"downpayment\", \"lot_project_payment_amount\": \"64350.00\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Verified\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_created_at\": \"2026-07-19 15:09:24\", \"lot_project_payment_updated_at\": \"2026-07-19 15:09:24\", \"lot_project_payment_schedule_id\": 17, \"lot_project_payment_verified_at\": \"2026-07-19 15:09:24\", \"lot_project_payment_reference_id\": \"CASH-20260719-LA1806-0002\", \"lot_project_payment_verified_by_user_id\": 1}, {\"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_payment_id\": 3, \"lot_project_payment_date\": \"2026-07-19\", \"lot_project_payment_type\": \"balloon\", \"lot_project_payment_amount\": \"10000.00\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Cancelled\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_created_at\": \"2026-07-19 15:09:48\", \"lot_project_payment_updated_at\": \"2026-07-19 15:19:19\", \"lot_project_payment_schedule_id\": null, \"lot_project_payment_verified_at\": \"2026-07-19 15:10:19\", \"lot_project_payment_reference_id\": \"CASH-20260719-LA1806-0003\", \"lot_project_payment_verified_by_user_id\": 1}, {\"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_payment_id\": 4, \"lot_project_payment_date\": \"2026-07-19\", \"lot_project_payment_type\": \"balloon\", \"lot_project_payment_amount\": \"200000.00\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Cancelled\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_created_at\": \"2026-07-19 15:11:24\", \"lot_project_payment_updated_at\": \"2026-07-19 15:19:00\", \"lot_project_payment_schedule_id\": null, \"lot_project_payment_verified_at\": \"2026-07-19 15:11:24\", \"lot_project_payment_reference_id\": \"CASH-20260719-LA1806-0004\", \"lot_project_payment_verified_by_user_id\": 1}, {\"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_payment_id\": 5, \"lot_project_payment_date\": \"2026-07-19\", \"lot_project_payment_type\": \"balloon\", \"lot_project_payment_amount\": \"250000.00\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Verified\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_created_at\": \"2026-07-19 15:38:57\", \"lot_project_payment_updated_at\": \"2026-07-19 15:39:15\", \"lot_project_payment_schedule_id\": null, \"lot_project_payment_verified_at\": \"2026-07-19 15:39:15\", \"lot_project_payment_reference_id\": \"CASH-20260719-LA1806-0005\", \"lot_project_payment_verified_by_user_id\": 1}]','[{\"due_date\": \"2026-07-19\", \"date_paid\": \"2026-07-19\", \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"50000.00\", \"updated_at\": \"2026-07-19 15:09:16\", \"amount_paid\": \"50000.00\", \"description\": \"Reservation Fee\", \"reference_id\": \"CASH-20260719-LA1806-0001\", \"ending_balance\": \"808000.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Paid\", \"principal_amount\": \"50000.00\", \"beginning_balance\": \"858000.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"50000.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"50000.00\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 16}, {\"due_date\": \"2026-07-31\", \"date_paid\": \"2026-07-19\", \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"64350.00\", \"updated_at\": \"2026-07-19 15:09:24\", \"amount_paid\": \"64350.00\", \"description\": \"1st Downpayment\", \"reference_id\": \"CASH-20260719-LA1806-0002\", \"ending_balance\": \"743650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Advance\", \"principal_amount\": \"64350.00\", \"beginning_balance\": \"808000.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"64350.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"64350.00\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 17}, {\"due_date\": \"2026-08-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"64350.00\", \"updated_at\": \"2026-07-19 15:09:24\", \"amount_paid\": \"0.00\", \"description\": \"2nd Downpayment\", \"reference_id\": null, \"ending_balance\": \"743650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"64350.00\", \"beginning_balance\": \"743650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"64350.00\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 18}, {\"due_date\": \"2026-09-30\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"56608.33\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"1st Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"56608.33\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"56608.33\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 19}, {\"due_date\": \"2026-10-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"56608.33\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"2nd Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"56608.33\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"56608.33\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 20}, {\"due_date\": \"2026-11-30\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"56608.33\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"3rd Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"56608.33\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"56608.33\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 21}, {\"due_date\": \"2026-12-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"56608.33\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"4th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"56608.33\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"56608.33\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 22}, {\"due_date\": \"2027-01-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"56608.33\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"5th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"56608.33\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"56608.33\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 23}, {\"due_date\": \"2027-02-28\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"56608.33\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"6th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"56608.33\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"56608.33\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 24}, {\"due_date\": \"2027-03-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"56608.33\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"7th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"56608.33\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"56608.33\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 25}, {\"due_date\": \"2027-04-30\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"33041.69\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"8th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"33041.69\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"33041.69\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 26}, {\"due_date\": \"2027-05-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"0.00\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"9th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Cancelled\", \"principal_amount\": \"0.00\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"0.00\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 27}, {\"due_date\": \"2027-06-30\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"0.00\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"10th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Cancelled\", \"principal_amount\": \"0.00\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"0.00\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 28}, {\"due_date\": \"2027-07-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"0.00\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"11th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Cancelled\", \"principal_amount\": \"0.00\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"0.00\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 29}, {\"due_date\": \"2027-08-31\", \"date_paid\": null, \"created_at\": \"2026-07-19 12:24:37\", \"due_amount\": \"0.00\", \"updated_at\": \"2026-07-19 15:39:15\", \"amount_paid\": \"0.00\", \"description\": \"12th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"493650.00\", \"lot_project_id\": 1, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Cancelled\", \"principal_amount\": \"0.00\", \"beginning_balance\": \"493650.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 63, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-19\", \"monthly_amortization_amount\": \"0.00\", \"lot_project_client_profile_id\": 1, \"lot_project_payment_schedule_id\": 30}]','[{\"created_at\": \"2026-07-19 15:09:16\", \"applied_amount\": \"50000.00\", \"lot_project_payment_id\": 1, \"lot_project_payment_schedule_id\": 16, \"lot_project_payment_allocation_id\": 1}, {\"created_at\": \"2026-07-19 15:09:24\", \"applied_amount\": \"64350.00\", \"lot_project_payment_id\": 2, \"lot_project_payment_schedule_id\": 17, \"lot_project_payment_allocation_id\": 2}]','[{\"action_at\": \"2026-07-19 15:09:16\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Reservation payment created and verified for LA-1806.\", \"lot_project_payment_id\": 1, \"lot_project_payment_log_id\": 1}, {\"action_at\": \"2026-07-19 15:09:24\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Downpayment payment created and verified for LA-1806.\", \"lot_project_payment_id\": 2, \"lot_project_payment_log_id\": 2}, {\"action_at\": \"2026-07-19 15:09:48\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Balloon payment created and verified for LA-1806.\", \"lot_project_payment_id\": 3, \"lot_project_payment_log_id\": 3}, {\"action_at\": \"2026-07-19 15:10:19\", \"action_type\": \"updated\", \"action_by_user_id\": 1, \"action_description\": \"Balloon payment updated by Super Admin.\", \"lot_project_payment_id\": 3, \"lot_project_payment_log_id\": 4}, {\"action_at\": \"2026-07-19 15:11:24\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Balloon payment created and verified for LA-1806.\", \"lot_project_payment_id\": 4, \"lot_project_payment_log_id\": 5}, {\"action_at\": \"2026-07-19 15:19:00\", \"action_type\": \"deleted\", \"action_by_user_id\": 1, \"action_description\": \"Payment CASH-20260719-LA1806-0004 deleted by Super Admin.\", \"lot_project_payment_id\": 4, \"lot_project_payment_log_id\": 6}, {\"action_at\": \"2026-07-19 15:19:19\", \"action_type\": \"deleted\", \"action_by_user_id\": 1, \"action_description\": \"Payment CASH-20260719-LA1806-0003 deleted by Super Admin.\", \"lot_project_payment_id\": 3, \"lot_project_payment_log_id\": 7}, {\"action_at\": \"2026-07-19 15:38:57\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Balloon payment created and verified for LA-1806.\", \"lot_project_payment_id\": 5, \"lot_project_payment_log_id\": 8}, {\"action_at\": \"2026-07-19 15:39:15\", \"action_type\": \"updated\", \"action_by_user_id\": 1, \"action_description\": \"Balloon payment updated by Super Admin.\", \"lot_project_payment_id\": 5, \"lot_project_payment_log_id\": 9}]','[]','[{\"document_id\": 11, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 1, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 9, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 2, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 3, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 3, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 2, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 4, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 1, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 5, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 8, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 6, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 7, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 7, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 4, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 8, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 5, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 9, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 16, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 10, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 6, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 11, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 15, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 12, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 14, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 13, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 10, \"lot_project_id\": 1, \"lot_project_listing_id\": 63, \"lot_project_client_profile_id\": 1, \"lot_project_client_document_id\": 14, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_updated_at\": \"2026-07-19 12:24:17\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}]','[{\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"lot_project_id\": 1, \"commission_rate\": \"4.00\", \"commission_role\": \"agent\", \"payment_percent\": \"0.00\", \"commission_status\": \"Partially Released\", \"accredited_seller_id\": 4, \"commission_rate_type\": \"direct\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"780000.00\", \"commission_seller_type\": \"selling_agent\", \"lot_project_listing_id\": 63, \"gross_commission_amount\": \"31200.00\", \"lot_project_commission_id\": 1, \"released_commission_amount\": \"12480.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Agent1\", \"lot_project_client_profile_id\": 1, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"lot_project_id\": 1, \"commission_rate\": \"2.00\", \"commission_role\": \"manager\", \"payment_percent\": \"0.00\", \"commission_status\": \"Partially Released\", \"accredited_seller_id\": 3, \"commission_rate_type\": \"override\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"780000.00\", \"commission_seller_type\": \"hierarchy_seller\", \"lot_project_listing_id\": 63, \"gross_commission_amount\": \"15600.00\", \"lot_project_commission_id\": 2, \"released_commission_amount\": \"6240.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Manager1\", \"lot_project_client_profile_id\": 1, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"lot_project_id\": 1, \"commission_rate\": \"1.00\", \"commission_role\": \"broker\", \"payment_percent\": \"0.00\", \"commission_status\": \"Partially Released\", \"accredited_seller_id\": 2, \"commission_rate_type\": \"override\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"780000.00\", \"commission_seller_type\": \"hierarchy_seller\", \"lot_project_listing_id\": 63, \"gross_commission_amount\": \"7800.00\", \"lot_project_commission_id\": 3, \"released_commission_amount\": \"3120.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Broker1\", \"lot_project_client_profile_id\": 1, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"lot_project_id\": 1, \"commission_rate\": \"1.00\", \"commission_role\": \"broker_network_manager\", \"payment_percent\": \"0.00\", \"commission_status\": \"Partially Released\", \"accredited_seller_id\": 1, \"commission_rate_type\": \"override\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"780000.00\", \"commission_seller_type\": \"hierarchy_seller\", \"lot_project_listing_id\": 63, \"gross_commission_amount\": \"7800.00\", \"lot_project_commission_id\": 4, \"released_commission_amount\": \"3120.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Cortez\", \"lot_project_client_profile_id\": 1, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}]','[{\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:31\", \"release_stage\": \"1st Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"6240.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"6240.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 1, \"lot_project_commission_release_id\": 1}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:34\", \"release_stage\": \"2nd Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"6240.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"6240.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 1, \"lot_project_commission_release_id\": 2}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"6240.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"6240.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 1, \"lot_project_commission_release_id\": 3}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"4680.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"4680.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 1, \"lot_project_commission_release_id\": 4}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"7800.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"7800.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 1, \"lot_project_commission_release_id\": 5}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:39\", \"release_stage\": \"1st Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3120.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"3120.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 2, \"lot_project_commission_release_id\": 6}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:43\", \"release_stage\": \"2nd Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3120.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"3120.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 2, \"lot_project_commission_release_id\": 7}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3120.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3120.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 2, \"lot_project_commission_release_id\": 8}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"2340.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"2340.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 2, \"lot_project_commission_release_id\": 9}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3900.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3900.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 2, \"lot_project_commission_release_id\": 10}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:47\", \"release_stage\": \"1st Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1560.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"1560.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 3, \"lot_project_commission_release_id\": 11}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:50\", \"release_stage\": \"2nd Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1560.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"1560.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 3, \"lot_project_commission_release_id\": 12}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1560.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"1560.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 3, \"lot_project_commission_release_id\": 13}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1170.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"1170.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 3, \"lot_project_commission_release_id\": 14}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1950.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"1950.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 3, \"lot_project_commission_release_id\": 15}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:53\", \"release_stage\": \"1st Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1560.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"1560.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 4, \"lot_project_commission_release_id\": 16}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-19 16:52:54\", \"release_stage\": \"2nd Release\", \"release_status\": \"Released\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1560.00\", \"actual_release_date\": \"2026-07-19\", \"released_by_user_id\": 1, \"gross_release_amount\": \"1560.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 4, \"lot_project_commission_release_id\": 17}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1560.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"1560.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 4, \"lot_project_commission_release_id\": 18}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1170.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"1170.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 4, \"lot_project_commission_release_id\": 19}, {\"created_at\": \"2026-07-19 12:24:17\", \"updated_at\": \"2026-07-20 10:11:11\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"1950.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"1950.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 4, \"lot_project_commission_release_id\": 20}]','[{\"bank_name\": \"BPI\", \"created_at\": \"2026-07-19 16:53:35\", \"updated_at\": \"2026-07-19 16:53:35\", \"receipt_date\": \"2026-07-19\", \"total_amount\": \"6240.00\", \"witness_name\": \"Fritz\", \"account_number\": \"123\", \"lot_project_id\": 1, \"receipt_status\": \"active\", \"reference_number\": \"321\", \"created_by_user_id\": 1, \"accredited_seller_id\": 3, \"lot_project_listing_id\": 63, \"lot_project_commission_id\": 2, \"lot_project_client_profile_id\": 1, \"lot_project_commission_receipt_id\": 1}, {\"bank_name\": \"cash\", \"created_at\": \"2026-07-19 16:54:11\", \"updated_at\": \"2026-07-19 16:54:11\", \"receipt_date\": \"2026-07-19\", \"total_amount\": \"6240.00\", \"witness_name\": \"geg\", \"account_number\": \"123\", \"lot_project_id\": 1, \"receipt_status\": \"active\", \"reference_number\": \"321\", \"created_by_user_id\": 1, \"accredited_seller_id\": 4, \"lot_project_listing_id\": 63, \"lot_project_commission_id\": 1, \"lot_project_client_profile_id\": 1, \"lot_project_commission_receipt_id\": 2}, {\"bank_name\": \"bdo\", \"created_at\": \"2026-07-19 16:55:08\", \"updated_at\": \"2026-07-19 16:55:08\", \"receipt_date\": \"2026-07-19\", \"total_amount\": \"6240.00\", \"witness_name\": \"fdf\", \"account_number\": \"1232\", \"lot_project_id\": 1, \"receipt_status\": \"active\", \"reference_number\": \"3212\", \"created_by_user_id\": 1, \"accredited_seller_id\": 4, \"lot_project_listing_id\": 63, \"lot_project_commission_id\": 1, \"lot_project_client_profile_id\": 1, \"lot_project_commission_receipt_id\": 3}]','[{\"created_at\": \"2026-07-19 16:53:35\", \"release_amount\": \"3120.00\", \"lot_project_commission_receipt_id\": 1, \"lot_project_commission_release_id\": 7, \"lot_project_commission_receipt_item_id\": 1}, {\"created_at\": \"2026-07-19 16:53:35\", \"release_amount\": \"3120.00\", \"lot_project_commission_receipt_id\": 1, \"lot_project_commission_release_id\": 6, \"lot_project_commission_receipt_item_id\": 2}, {\"created_at\": \"2026-07-19 16:54:11\", \"release_amount\": \"6240.00\", \"lot_project_commission_receipt_id\": 2, \"lot_project_commission_release_id\": 1, \"lot_project_commission_receipt_item_id\": 3}, {\"created_at\": \"2026-07-19 16:55:08\", \"release_amount\": \"6240.00\", \"lot_project_commission_receipt_id\": 3, \"lot_project_commission_release_id\": 2, \"lot_project_commission_receipt_item_id\": 4}]',1,'2026-07-20 10:11:59'),(2,3,2,129,'PE-0101','ROWENA MORENO CORTEZ',666645.83,333333.00,333312.83,0.00,'[{\"buyer_tin\": null, \"buyer_type\": \"single\", \"buyer_email\": \"rrcsanjuan@pcu.edu.ph\", \"buyer_gender\": \"Female\", \"buyer_suffix\": null, \"sale_channel\": \"distributed\", \"lot_project_id\": 2, \"buyer_full_name\": \"ROWENA MORENO CORTEZ\", \"buyer_last_name\": \"CORTEZ\", \"buyer_birth_date\": \"1944-11-11\", \"buyer_first_name\": \"ROWENA\", \"needs_soa_review\": 0, \"second_buyer_tin\": null, \"soa_selected_tcp\": \"1732500.00\", \"buyer_citizenship\": \"filipino\", \"buyer_middle_name\": \"MORENO\", \"second_buyer_role\": null, \"soa_monthly_terms\": 12, \"soa_starting_date\": \"2026-07-20\", \"buyer_civil_status\": \"Married\", \"second_buyer_email\": null, \"soa_first_due_date\": \"2026-07-20\", \"second_buyer_gender\": null, \"second_buyer_suffix\": null, \"soa_mode_of_payment\": \"installment\", \"soa_reservation_fee\": \"50000.00\", \"buyer_contact_number\": \"09278965570\", \"buyer_monthly_income\": \"3434343.00\", \"buyer_place_of_birth\": \"Dyan\", \"buyer_present_address\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"soa_downpayment_terms\": 0, \"buyer_present_zip_code\": \"4141\", \"lot_project_listing_id\": 129, \"second_buyer_full_name\": null, \"second_buyer_last_name\": null, \"soa_penalty_grace_days\": 1, \"buyer_employer_zip_code\": null, \"buyer_employment_status\": \"Employed - Private\", \"buyer_permanent_address\": null, \"second_buyer_birth_date\": null, \"second_buyer_first_name\": null, \"soa_legal_misc_fee_mode\": \"include_in_monthly\", \"soa_selected_lmf_amount\": \"157500.00\", \"buyer_permanent_zip_code\": null, \"second_buyer_citizenship\": null, \"second_buyer_middle_name\": null, \"soa_annual_interest_rate\": \"0.00\", \"soa_penalty_rate_percent\": \"0.10\", \"soa_sale_discount_amount\": \"0.00\", \"buyer_occupation_position\": null, \"second_buyer_civil_status\": null, \"soa_legal_misc_fee_amount\": \"157500.00\", \"soa_downpayment_percentage\": \"30.00\", \"soa_dp_discount_percentage\": \"0.00\", \"soa_selected_price_per_sqm\": \"4500.00\", \"second_buyer_contact_number\": null, \"second_buyer_monthly_income\": \"0.00\", \"second_buyer_place_of_birth\": null, \"buyer_employer_business_name\": null, \"buyer_residence_phone_number\": null, \"second_buyer_present_address\": null, \"soa_interest_rate_overridden\": 0, \"soa_sale_discount_percentage\": \"0.00\", \"assigned_accredited_seller_id\": 4, \"buyer_nature_of_work_business\": null, \"lot_project_client_profile_id\": 3, \"second_buyer_present_zip_code\": null, \"soa_interest_calculation_type\": \"amortized\", \"second_buyer_employer_zip_code\": null, \"second_buyer_employment_status\": null, \"second_buyer_permanent_address\": null, \"soa_penalty_calculation_method\": \"daily\", \"soa_selected_net_selling_price\": \"1575000.00\", \"buyer_employer_business_address\": null, \"second_buyer_permanent_zip_code\": null, \"soa_selected_base_selling_price\": \"1575000.00\", \"second_buyer_occupation_position\": null, \"lot_project_client_profile_status\": \"active\", \"second_buyer_employer_business_name\": null, \"second_buyer_residence_phone_number\": null, \"second_buyer_nature_of_work_business\": null, \"lot_project_client_profile_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_profile_updated_at\": \"2026-07-20 10:39:52\", \"second_buyer_employer_business_address\": null, \"soa_reservation_fee_applied_to_downpayment\": 0}]','[{\"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_payment_id\": 7, \"lot_project_payment_date\": \"2026-07-20\", \"lot_project_payment_type\": \"reservation\", \"lot_project_payment_amount\": \"50000.00\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Verified\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_created_at\": \"2026-07-20 10:39:57\", \"lot_project_payment_updated_at\": \"2026-07-20 10:39:57\", \"lot_project_payment_schedule_id\": 69, \"lot_project_payment_verified_at\": \"2026-07-20 10:39:57\", \"lot_project_payment_reference_id\": \"CASH-20260720-PE0101-0001\", \"lot_project_payment_verified_by_user_id\": 1}, {\"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_payment_id\": 8, \"lot_project_payment_date\": \"2026-07-20\", \"lot_project_payment_type\": \"downpayment\", \"lot_project_payment_amount\": \"519750.00\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Verified\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_created_at\": \"2026-07-20 10:40:09\", \"lot_project_payment_updated_at\": \"2026-07-20 10:40:09\", \"lot_project_payment_schedule_id\": 70, \"lot_project_payment_verified_at\": \"2026-07-20 10:40:09\", \"lot_project_payment_reference_id\": \"CASH-20260720-PE0101-0002\", \"lot_project_payment_verified_by_user_id\": 1}, {\"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_payment_id\": 9, \"lot_project_payment_date\": \"2026-07-20\", \"lot_project_payment_type\": \"monthly_amortization\", \"lot_project_payment_amount\": \"96895.83\", \"lot_project_payment_method\": \"Cash\", \"lot_project_payment_status\": \"Verified\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_created_at\": \"2026-07-20 10:40:17\", \"lot_project_payment_updated_at\": \"2026-07-20 10:40:17\", \"lot_project_payment_schedule_id\": 71, \"lot_project_payment_verified_at\": \"2026-07-20 10:40:17\", \"lot_project_payment_reference_id\": \"CASH-20260720-PE0101-0003\", \"lot_project_payment_verified_by_user_id\": 1}]','[{\"due_date\": \"2026-07-20\", \"date_paid\": \"2026-07-20\", \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"50000.00\", \"updated_at\": \"2026-07-20 10:39:57\", \"amount_paid\": \"50000.00\", \"description\": \"Reservation Fee\", \"reference_id\": \"CASH-20260720-PE0101-0001\", \"ending_balance\": \"1682500.00\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Paid\", \"principal_amount\": \"50000.00\", \"beginning_balance\": \"1732500.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"50000.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"50000.00\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 69}, {\"due_date\": \"2026-07-20\", \"date_paid\": \"2026-07-20\", \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"519750.00\", \"updated_at\": \"2026-07-20 10:40:09\", \"amount_paid\": \"519750.00\", \"description\": \"Downpayment\", \"reference_id\": \"CASH-20260720-PE0101-0002\", \"ending_balance\": \"1162750.00\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Paid\", \"principal_amount\": \"519750.00\", \"beginning_balance\": \"1682500.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"519750.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"519750.00\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 70}, {\"due_date\": \"2026-08-20\", \"date_paid\": \"2026-07-20\", \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"96895.83\", \"description\": \"1st Monthly Payment\", \"reference_id\": \"CASH-20260720-PE0101-0003\", \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Advance\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1162750.00\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"96895.83\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 71}, {\"due_date\": \"2026-09-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"2nd Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 72}, {\"due_date\": \"2026-10-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"3rd Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 73}, {\"due_date\": \"2026-11-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"4th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 74}, {\"due_date\": \"2026-12-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"5th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 75}, {\"due_date\": \"2027-01-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"6th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 76}, {\"due_date\": \"2027-02-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"7th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 77}, {\"due_date\": \"2027-03-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"8th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 78}, {\"due_date\": \"2027-04-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"9th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 79}, {\"due_date\": \"2027-05-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"10th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 80}, {\"due_date\": \"2027-06-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.83\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"11th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.83\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.83\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 81}, {\"due_date\": \"2027-07-20\", \"date_paid\": null, \"created_at\": \"2026-07-20 10:39:52\", \"due_amount\": \"96895.87\", \"updated_at\": \"2026-07-20 10:40:17\", \"amount_paid\": \"0.00\", \"description\": \"12th Monthly Payment\", \"reference_id\": null, \"ending_balance\": \"1065854.17\", \"lot_project_id\": 2, \"penalty_amount\": \"0.00\", \"interest_amount\": \"0.00\", \"schedule_status\": \"Unpaid\", \"principal_amount\": \"96895.87\", \"beginning_balance\": \"1065854.17\", \"paid_penalty_amount\": \"0.00\", \"paid_interest_amount\": \"0.00\", \"paid_principal_amount\": \"0.00\", \"waived_penalty_amount\": \"0.00\", \"lot_project_listing_id\": 129, \"calculated_penalty_amount\": \"0.00\", \"penalty_calculated_through\": \"2026-07-20\", \"monthly_amortization_amount\": \"96895.87\", \"lot_project_client_profile_id\": 3, \"lot_project_payment_schedule_id\": 82}]','[{\"created_at\": \"2026-07-20 10:39:57\", \"applied_amount\": \"50000.00\", \"lot_project_payment_id\": 7, \"lot_project_payment_schedule_id\": 69, \"lot_project_payment_allocation_id\": 13}, {\"created_at\": \"2026-07-20 10:40:09\", \"applied_amount\": \"519750.00\", \"lot_project_payment_id\": 8, \"lot_project_payment_schedule_id\": 70, \"lot_project_payment_allocation_id\": 14}, {\"created_at\": \"2026-07-20 10:40:17\", \"applied_amount\": \"96895.83\", \"lot_project_payment_id\": 9, \"lot_project_payment_schedule_id\": 71, \"lot_project_payment_allocation_id\": 15}]','[{\"action_at\": \"2026-07-20 10:39:57\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Reservation payment created and verified for PE-0101.\", \"lot_project_payment_id\": 7, \"lot_project_payment_log_id\": 11}, {\"action_at\": \"2026-07-20 10:40:09\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Downpayment payment created and verified for PE-0101.\", \"lot_project_payment_id\": 8, \"lot_project_payment_log_id\": 12}, {\"action_at\": \"2026-07-20 10:40:17\", \"action_type\": \"created\", \"action_by_user_id\": 1, \"action_description\": \"Monthly payment created and verified for PE-0101.\", \"lot_project_payment_id\": 9, \"lot_project_payment_log_id\": 13}]','[]','[{\"document_id\": 11, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 31, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 9, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 32, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 3, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 33, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 2, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 34, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 1, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 35, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 8, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 36, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 7, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 37, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 4, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 38, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 5, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 39, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 16, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 40, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 6, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 41, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 15, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 42, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 14, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 43, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}, {\"document_id\": 10, \"lot_project_id\": 2, \"lot_project_listing_id\": 129, \"lot_project_client_profile_id\": 3, \"lot_project_client_document_id\": 44, \"lot_project_client_document_status\": \"Missing\", \"lot_project_client_document_file_url\": null, \"lot_project_client_document_file_name\": null, \"lot_project_client_document_created_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_updated_at\": \"2026-07-20 10:39:52\", \"lot_project_client_document_approved_at\": null, \"lot_project_client_document_uploaded_at\": null, \"lot_project_client_document_approved_by_user_id\": null}]','[{\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"lot_project_id\": 2, \"commission_rate\": \"5.00\", \"commission_role\": \"agent\", \"payment_percent\": \"0.00\", \"commission_status\": \"Cancelled\", \"accredited_seller_id\": 4, \"commission_rate_type\": \"direct\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"1575000.00\", \"commission_seller_type\": \"selling_agent\", \"lot_project_listing_id\": 129, \"gross_commission_amount\": \"78750.00\", \"lot_project_commission_id\": 9, \"released_commission_amount\": \"0.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Agent1\", \"lot_project_client_profile_id\": 3, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"lot_project_id\": 2, \"commission_rate\": \"1.00\", \"commission_role\": \"manager\", \"payment_percent\": \"0.00\", \"commission_status\": \"Cancelled\", \"accredited_seller_id\": 3, \"commission_rate_type\": \"override\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"1575000.00\", \"commission_seller_type\": \"hierarchy_seller\", \"lot_project_listing_id\": 129, \"gross_commission_amount\": \"15750.00\", \"lot_project_commission_id\": 10, \"released_commission_amount\": \"0.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Manager1\", \"lot_project_client_profile_id\": 3, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"lot_project_id\": 2, \"commission_rate\": \"1.00\", \"commission_role\": \"broker\", \"payment_percent\": \"0.00\", \"commission_status\": \"Cancelled\", \"accredited_seller_id\": 2, \"commission_rate_type\": \"override\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"1575000.00\", \"commission_seller_type\": \"hierarchy_seller\", \"lot_project_listing_id\": 129, \"gross_commission_amount\": \"15750.00\", \"lot_project_commission_id\": 11, \"released_commission_amount\": \"0.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Broker1\", \"lot_project_client_profile_id\": 3, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"lot_project_id\": 2, \"commission_rate\": \"1.00\", \"commission_role\": \"broker_network_manager\", \"payment_percent\": \"0.00\", \"commission_status\": \"Cancelled\", \"accredited_seller_id\": 1, \"commission_rate_type\": \"override\", \"commission_sale_type\": \"distributed\", \"commission_base_amount\": \"1575000.00\", \"commission_seller_type\": \"hierarchy_seller\", \"lot_project_listing_id\": 129, \"gross_commission_amount\": \"15750.00\", \"lot_project_commission_id\": 12, \"released_commission_amount\": \"0.00\", \"seller_group_name_snapshot\": \"North Star Group\", \"seller_display_name_snapshot\": \"Rowena Cortez\", \"lot_project_client_profile_id\": 3, \"net_remaining_commission_amount\": \"0.00\", \"sale_owner_accredited_seller_id\": 4, \"sale_origin_accredited_seller_id\": 4}]','[{\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"1st Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"15750.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"15750.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 9, \"lot_project_commission_release_id\": 41}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"2nd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"15750.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"15750.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 9, \"lot_project_commission_release_id\": 42}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"15750.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"15750.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 9, \"lot_project_commission_release_id\": 43}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"11812.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"11812.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 9, \"lot_project_commission_release_id\": 44}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"19687.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"19687.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 9, \"lot_project_commission_release_id\": 45}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"1st Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 10, \"lot_project_commission_release_id\": 46}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"2nd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 10, \"lot_project_commission_release_id\": 47}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 10, \"lot_project_commission_release_id\": 48}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"2362.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"2362.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 10, \"lot_project_commission_release_id\": 49}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3937.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3937.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 10, \"lot_project_commission_release_id\": 50}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"1st Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 11, \"lot_project_commission_release_id\": 51}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"2nd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 11, \"lot_project_commission_release_id\": 52}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 11, \"lot_project_commission_release_id\": 53}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"2362.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"2362.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 11, \"lot_project_commission_release_id\": 54}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3937.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3937.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 11, \"lot_project_commission_release_id\": 55}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"1st Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"20.00\", \"lot_project_commission_id\": 12, \"lot_project_commission_release_id\": 56}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"2nd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"40.00\", \"lot_project_commission_id\": 12, \"lot_project_commission_release_id\": 57}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"3rd Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"20.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3150.00\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3150.00\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"60.00\", \"lot_project_commission_id\": 12, \"lot_project_commission_release_id\": 58}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"4th Release\", \"release_status\": \"Cancelled\", \"release_percent\": \"15.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"2362.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"2362.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"75.00\", \"lot_project_commission_id\": 12, \"lot_project_commission_release_id\": 59}, {\"created_at\": \"2026-07-20 10:39:52\", \"updated_at\": \"2026-07-20 10:47:34\", \"release_stage\": \"Retention\", \"release_status\": \"Cancelled\", \"release_percent\": \"25.00\", \"deduction_amount\": \"0.00\", \"net_release_amount\": \"3937.50\", \"actual_release_date\": null, \"released_by_user_id\": null, \"gross_release_amount\": \"3937.50\", \"scheduled_release_date\": null, \"release_trigger_percent\": \"100.00\", \"lot_project_commission_id\": 12, \"lot_project_commission_release_id\": 60}]','[]','[]',1,'2026-07-20 10:47:40');
/*!40000 ALTER TABLE `lot_project_cancelled_sale_archives` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_client_documents`
--

LOCK TABLES `lot_project_client_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_client_documents` DISABLE KEYS */;
INSERT INTO `lot_project_client_documents` VALUES (15,1,62,2,11,'470156407_122124145124545768_3372014081389379396_n.jpg','[{\"url\":\"https://res.cloudinary.com/dvazrmgq9/image/upload/v1784514494/dc_prime/bailen_project/la_1805/buyer_acknowledgement_form/documentimages/cwqqqypgi7vyxyohmjkv.jpg\",\"fileName\":\"470156407_122124145124545768_3372014081389379396_n.jpg\",\"fileSize\":49755,\"fileType\":\"image/jpeg\",\"cloudinaryPublicId\":\"dc_prime/bailen_project/la_1805/buyer_acknowledgement_form/documentimages/cwqqqypgi7vyxyohmjkv\",\"cloudinaryResourceType\":\"image\",\"cloudinaryFolder\":\"dc_prime/bailen_project/la_1805/buyer_acknowledgement_form/documentimages\",\"cloudinaryAssetFolder\":\"dc_prime/bailen_project/la_1805/buyer_acknowledgement_form/documentimages\",\"uploadedAt\":\"2026-07-20T02:28:13.000Z\"}]','Approved','2026-07-20 10:28:13','2026-07-20 10:28:46',1,'2026-07-19 14:59:45','2026-07-20 10:28:46'),(16,1,62,2,9,'logo.png','[{\"url\":\"https://res.cloudinary.com/dvazrmgq9/image/upload/v1784514534/dc_prime/bailen_project/la_1805/buyer_counselling_and_acknowledgement_form/documentimages/qqgtuus35fufy7cfe0su.jpg\",\"fileName\":\"logo.png\",\"fileSize\":10296,\"fileType\":\"image/png\",\"cloudinaryPublicId\":\"dc_prime/bailen_project/la_1805/buyer_counselling_and_acknowledgement_form/documentimages/qqgtuus35fufy7cfe0su\",\"cloudinaryResourceType\":\"image\",\"cloudinaryFolder\":\"dc_prime/bailen_project/la_1805/buyer_counselling_and_acknowledgement_form/documentimages\",\"cloudinaryAssetFolder\":\"dc_prime/bailen_project/la_1805/buyer_counselling_and_acknowledgement_form/documentimages\",\"uploadedAt\":\"2026-07-20T02:28:53.156Z\"}]','Submitted','2026-07-20 10:28:53',NULL,NULL,'2026-07-19 14:59:45','2026-07-20 10:28:53'),(17,1,62,2,3,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(18,1,62,2,2,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(19,1,62,2,1,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(20,1,62,2,8,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(21,1,62,2,7,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(22,1,62,2,4,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(23,1,62,2,5,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(24,1,62,2,16,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(25,1,62,2,6,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(26,1,62,2,15,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(27,1,62,2,14,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(28,1,62,2,10,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45');
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
  CONSTRAINT `chk_client_penalty_rate` CHECK ((`soa_penalty_rate_percent` between 0 and 100)),
  CONSTRAINT `chk_client_sale_discount_percentage` CHECK ((`soa_sale_discount_percentage` between 0 and 100))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_client_profiles`
--

LOCK TABLES `lot_project_client_profiles` WRITE;
/*!40000 ALTER TABLE `lot_project_client_profiles` DISABLE KEYS */;
INSERT INTO `lot_project_client_profiles` VALUES (2,1,62,4,'distributed','single','ROWENA','MORENO','CORTEZ',NULL,'ROWENA MORENO CORTEZ','1999-11-11','rfwer','dfs4141','Male','Single','09278965570',NULL,NULL,NULL,'b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite','41',NULL,NULL,'Employed - Private',NULL,NULL,NULL,NULL,NULL,4343.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,'active','installment',2600.00,780000.00,0.00,0.00,780000.00,78000.00,858000.00,50000.00,0,'include_in_monthly',78000.00,'2026-07-19','2026-07-19',30.00,0,36,0.00,0,'amortized',0,0.00,0.10,1,'daily','2026-07-19 14:59:45','2026-07-19 14:59:45');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commission_releases`
--

LOCK TABLES `lot_project_commission_releases` WRITE;
/*!40000 ALTER TABLE `lot_project_commission_releases` DISABLE KEYS */;
INSERT INTO `lot_project_commission_releases` VALUES (21,5,'1st Release',20.00,20.00,6240.00,0.00,6240.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(22,5,'2nd Release',40.00,20.00,6240.00,0.00,6240.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(23,5,'3rd Release',60.00,20.00,6240.00,0.00,6240.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(24,5,'4th Release',75.00,15.00,4680.00,0.00,4680.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(25,5,'Retention',100.00,25.00,7800.00,0.00,7800.00,'On Hold',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(26,6,'1st Release',20.00,20.00,3120.00,0.00,3120.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(27,6,'2nd Release',40.00,20.00,3120.00,0.00,3120.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(28,6,'3rd Release',60.00,20.00,3120.00,0.00,3120.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(29,6,'4th Release',75.00,15.00,2340.00,0.00,2340.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(30,6,'Retention',100.00,25.00,3900.00,0.00,3900.00,'On Hold',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(31,7,'1st Release',20.00,20.00,1560.00,0.00,1560.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(32,7,'2nd Release',40.00,20.00,1560.00,0.00,1560.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(33,7,'3rd Release',60.00,20.00,1560.00,0.00,1560.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(34,7,'4th Release',75.00,15.00,1170.00,0.00,1170.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(35,7,'Retention',100.00,25.00,1950.00,0.00,1950.00,'On Hold',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(36,8,'1st Release',20.00,20.00,1560.00,0.00,1560.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(37,8,'2nd Release',40.00,20.00,1560.00,0.00,1560.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(38,8,'3rd Release',60.00,20.00,1560.00,0.00,1560.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(39,8,'4th Release',75.00,15.00,1170.00,0.00,1170.00,'Pending',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(40,8,'Retention',100.00,25.00,1950.00,0.00,1950.00,'On Hold',NULL,NULL,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45');
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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commissions`
--

LOCK TABLES `lot_project_commissions` WRITE;
/*!40000 ALTER TABLE `lot_project_commissions` DISABLE KEYS */;
INSERT INTO `lot_project_commissions` VALUES (5,1,62,2,4,4,4,'agent','selling_agent','distributed','direct','Rowena Agent1','North Star Group',780000.00,4.00,31200.00,0.00,31200.00,0.00,'Pending','2026-07-19 14:59:45','2026-07-19 14:59:45'),(6,1,62,2,3,4,4,'manager','hierarchy_seller','distributed','override','Rowena Manager1','North Star Group',780000.00,2.00,15600.00,0.00,15600.00,0.00,'Pending','2026-07-19 14:59:45','2026-07-19 14:59:45'),(7,1,62,2,2,4,4,'broker','hierarchy_seller','distributed','override','Rowena Broker1','North Star Group',780000.00,1.00,7800.00,0.00,7800.00,0.00,'Pending','2026-07-19 14:59:45','2026-07-19 14:59:45'),(8,1,62,2,1,4,4,'broker_network_manager','hierarchy_seller','distributed','override','Rowena Cortez','North Star Group',780000.00,1.00,7800.00,0.00,7800.00,0.00,'Pending','2026-07-19 14:59:45','2026-07-19 14:59:45');
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
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_default_documents`
--

LOCK TABLES `lot_project_default_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_default_documents` DISABLE KEYS */;
INSERT INTO `lot_project_default_documents` VALUES (12,2,11,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(13,2,9,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(14,2,3,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(15,2,2,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(16,2,1,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(17,2,8,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(18,2,7,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(19,2,4,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(20,2,5,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(21,2,6,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(22,2,10,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(23,2,16,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(24,2,15,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(25,2,14,1,'active','2026-07-19 09:52:42','2026-07-19 09:52:42'),(26,1,11,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(27,1,9,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(28,1,3,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(29,1,2,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(30,1,1,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(31,1,8,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(32,1,7,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(33,1,4,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(34,1,5,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(35,1,6,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(36,1,10,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(37,1,16,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(38,1,15,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54'),(39,1,14,1,'active','2026-07-19 09:52:54','2026-07-19 09:52:54');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listing_cadastral_lots`
--

LOCK TABLES `lot_project_listing_cadastral_lots` WRITE;
/*!40000 ALTER TABLE `lot_project_listing_cadastral_lots` DISABLE KEYS */;
INSERT INTO `lot_project_listing_cadastral_lots` VALUES (4,63,4,'2026-07-20 10:11:59');
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
) ENGINE=InnoDB AUTO_INCREMENT=1094 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listing_documents`
--

LOCK TABLES `lot_project_listing_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_listing_documents` DISABLE KEYS */;
INSERT INTO `lot_project_listing_documents` VALUES (1,1,1,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(2,1,2,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(3,1,3,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(4,1,4,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(5,1,5,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(6,1,6,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(7,1,7,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(8,1,8,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(9,1,9,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(10,1,10,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(11,1,11,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(12,1,12,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(13,1,13,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(14,1,14,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(15,1,15,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(16,1,16,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(17,1,17,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(18,1,18,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(19,1,19,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(20,1,20,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(21,1,21,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(22,1,22,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(23,1,23,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(24,1,24,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(25,1,25,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(26,1,26,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(27,1,27,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(28,1,28,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(29,1,29,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(30,1,30,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(31,1,31,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(32,1,32,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(33,1,33,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(34,1,34,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(35,1,35,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(36,1,36,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(37,1,37,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(38,1,38,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(39,1,39,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(40,1,40,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(41,1,41,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(42,1,42,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(43,1,43,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(44,1,44,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(45,1,45,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(46,1,46,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(47,1,47,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(48,1,48,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(49,1,49,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(50,1,50,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(51,1,51,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(52,1,52,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(53,1,53,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(54,1,54,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(55,1,55,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(56,1,56,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(57,1,57,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(58,1,58,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(59,1,59,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(60,1,60,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(61,1,61,1,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(65,1,1,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(66,1,2,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(67,1,3,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(68,1,4,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(69,1,5,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(70,1,6,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(71,1,7,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(72,1,8,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(73,1,9,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(74,1,10,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(75,1,11,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(76,1,12,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(77,1,13,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(78,1,14,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(79,1,15,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(80,1,16,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(81,1,17,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(82,1,18,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(83,1,19,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(84,1,20,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(85,1,21,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(86,1,22,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(87,1,23,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(88,1,24,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(89,1,25,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(90,1,26,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(91,1,27,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(92,1,28,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(93,1,29,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(94,1,30,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(95,1,31,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(96,1,32,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(97,1,33,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(98,1,34,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(99,1,35,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(100,1,36,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(101,1,37,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(102,1,38,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(103,1,39,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(104,1,40,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(105,1,41,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(106,1,42,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(107,1,43,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(108,1,44,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(109,1,45,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(110,1,46,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(111,1,47,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(112,1,48,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(113,1,49,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(114,1,50,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(115,1,51,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(116,1,52,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(117,1,53,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(118,1,54,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(119,1,55,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(120,1,56,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(121,1,57,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(122,1,58,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(123,1,59,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(124,1,60,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(125,1,61,2,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(129,1,1,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(130,1,2,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(131,1,3,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(132,1,4,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(133,1,5,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(134,1,6,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(135,1,7,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(136,1,8,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(137,1,9,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(138,1,10,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(139,1,11,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(140,1,12,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(141,1,13,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(142,1,14,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(143,1,15,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(144,1,16,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(145,1,17,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(146,1,18,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(147,1,19,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(148,1,20,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(149,1,21,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(150,1,22,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(151,1,23,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(152,1,24,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(153,1,25,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(154,1,26,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(155,1,27,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(156,1,28,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(157,1,29,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(158,1,30,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(159,1,31,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(160,1,32,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(161,1,33,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(162,1,34,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(163,1,35,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(164,1,36,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(165,1,37,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(166,1,38,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(167,1,39,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(168,1,40,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(169,1,41,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(170,1,42,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(171,1,43,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(172,1,44,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(173,1,45,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(174,1,46,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(175,1,47,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(176,1,48,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(177,1,49,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(178,1,50,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(179,1,51,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(180,1,52,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(181,1,53,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(182,1,54,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(183,1,55,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(184,1,56,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(185,1,57,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(186,1,58,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(187,1,59,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(188,1,60,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(189,1,61,3,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(193,1,1,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(194,1,2,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(195,1,3,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(196,1,4,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(197,1,5,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(198,1,6,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(199,1,7,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(200,1,8,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(201,1,9,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(202,1,10,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(203,1,11,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(204,1,12,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(205,1,13,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(206,1,14,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(207,1,15,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(208,1,16,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(209,1,17,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(210,1,18,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(211,1,19,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(212,1,20,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(213,1,21,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(214,1,22,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(215,1,23,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(216,1,24,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(217,1,25,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(218,1,26,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(219,1,27,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(220,1,28,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(221,1,29,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(222,1,30,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(223,1,31,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(224,1,32,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(225,1,33,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(226,1,34,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(227,1,35,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(228,1,36,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(229,1,37,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(230,1,38,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(231,1,39,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(232,1,40,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(233,1,41,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(234,1,42,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(235,1,43,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(236,1,44,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(237,1,45,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(238,1,46,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(239,1,47,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(240,1,48,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(241,1,49,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(242,1,50,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(243,1,51,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(244,1,52,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(245,1,53,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(246,1,54,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(247,1,55,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(248,1,56,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(249,1,57,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(250,1,58,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(251,1,59,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(252,1,60,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(253,1,61,4,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(257,1,1,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(258,1,2,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(259,1,3,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(260,1,4,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(261,1,5,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(262,1,6,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(263,1,7,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(264,1,8,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(265,1,9,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(266,1,10,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(267,1,11,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(268,1,12,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(269,1,13,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(270,1,14,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(271,1,15,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(272,1,16,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(273,1,17,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(274,1,18,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(275,1,19,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(276,1,20,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(277,1,21,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(278,1,22,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(279,1,23,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(280,1,24,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(281,1,25,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(282,1,26,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(283,1,27,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(284,1,28,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(285,1,29,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(286,1,30,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(287,1,31,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(288,1,32,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(289,1,33,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(290,1,34,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(291,1,35,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(292,1,36,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(293,1,37,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(294,1,38,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(295,1,39,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(296,1,40,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(297,1,41,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(298,1,42,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(299,1,43,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(300,1,44,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(301,1,45,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(302,1,46,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(303,1,47,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(304,1,48,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(305,1,49,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(306,1,50,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(307,1,51,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(308,1,52,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(309,1,53,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(310,1,54,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(311,1,55,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(312,1,56,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(313,1,57,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(314,1,58,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(315,1,59,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(316,1,60,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(317,1,61,5,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(321,1,1,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(322,1,2,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(323,1,3,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(324,1,4,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(325,1,5,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(326,1,6,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(327,1,7,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(328,1,8,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(329,1,9,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(330,1,10,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(331,1,11,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(332,1,12,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(333,1,13,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(334,1,14,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(335,1,15,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(336,1,16,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(337,1,17,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(338,1,18,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(339,1,19,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(340,1,20,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(341,1,21,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(342,1,22,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(343,1,23,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(344,1,24,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(345,1,25,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(346,1,26,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(347,1,27,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(348,1,28,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(349,1,29,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(350,1,30,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(351,1,31,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(352,1,32,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(353,1,33,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(354,1,34,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(355,1,35,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(356,1,36,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(357,1,37,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(358,1,38,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(359,1,39,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(360,1,40,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(361,1,41,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(362,1,42,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(363,1,43,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(364,1,44,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(365,1,45,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(366,1,46,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(367,1,47,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(368,1,48,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(369,1,49,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(370,1,50,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(371,1,51,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(372,1,52,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(373,1,53,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(374,1,54,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(375,1,55,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(376,1,56,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(377,1,57,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(378,1,58,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(379,1,59,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(380,1,60,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(381,1,61,6,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(385,1,1,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(386,1,2,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(387,1,3,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(388,1,4,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(389,1,5,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(390,1,6,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(391,1,7,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(392,1,8,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(393,1,9,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(394,1,10,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(395,1,11,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(396,1,12,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(397,1,13,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(398,1,14,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(399,1,15,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(400,1,16,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(401,1,17,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(402,1,18,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(403,1,19,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(404,1,20,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(405,1,21,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(406,1,22,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(407,1,23,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(408,1,24,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(409,1,25,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(410,1,26,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(411,1,27,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(412,1,28,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(413,1,29,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(414,1,30,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(415,1,31,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(416,1,32,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(417,1,33,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(418,1,34,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(419,1,35,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(420,1,36,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(421,1,37,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(422,1,38,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(423,1,39,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(424,1,40,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(425,1,41,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(426,1,42,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(427,1,43,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(428,1,44,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(429,1,45,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(430,1,46,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(431,1,47,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(432,1,48,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(433,1,49,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(434,1,50,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(435,1,51,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(436,1,52,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(437,1,53,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(438,1,54,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(439,1,55,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(440,1,56,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(441,1,57,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(442,1,58,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(443,1,59,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(444,1,60,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(445,1,61,7,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(449,1,1,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(450,1,2,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(451,1,3,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(452,1,4,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(453,1,5,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(454,1,6,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(455,1,7,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(456,1,8,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(457,1,9,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(458,1,10,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(459,1,11,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(460,1,12,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(461,1,13,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(462,1,14,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(463,1,15,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(464,1,16,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(465,1,17,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(466,1,18,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(467,1,19,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(468,1,20,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(469,1,21,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(470,1,22,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(471,1,23,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(472,1,24,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(473,1,25,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(474,1,26,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(475,1,27,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(476,1,28,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(477,1,29,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(478,1,30,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(479,1,31,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(480,1,32,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(481,1,33,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(482,1,34,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(483,1,35,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(484,1,36,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(485,1,37,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(486,1,38,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(487,1,39,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(488,1,40,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(489,1,41,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(490,1,42,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(491,1,43,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(492,1,44,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(493,1,45,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(494,1,46,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(495,1,47,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(496,1,48,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(497,1,49,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(498,1,50,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(499,1,51,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(500,1,52,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(501,1,53,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(502,1,54,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(503,1,55,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(504,1,56,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(505,1,57,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(506,1,58,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(507,1,59,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(508,1,60,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(509,1,61,8,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(513,1,1,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(514,1,2,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(515,1,3,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(516,1,4,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(517,1,5,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(518,1,6,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(519,1,7,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(520,1,8,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(521,1,9,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(522,1,10,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(523,1,11,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(524,1,12,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(525,1,13,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(526,1,14,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(527,1,15,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(528,1,16,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(529,1,17,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(530,1,18,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(531,1,19,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(532,1,20,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(533,1,21,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(534,1,22,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(535,1,23,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(536,1,24,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(537,1,25,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(538,1,26,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(539,1,27,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(540,1,28,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(541,1,29,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(542,1,30,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(543,1,31,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(544,1,32,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(545,1,33,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(546,1,34,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(547,1,35,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(548,1,36,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(549,1,37,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(550,1,38,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(551,1,39,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(552,1,40,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(553,1,41,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(554,1,42,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(555,1,43,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(556,1,44,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(557,1,45,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(558,1,46,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(559,1,47,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(560,1,48,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(561,1,49,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(562,1,50,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(563,1,51,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(564,1,52,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(565,1,53,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(566,1,54,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(567,1,55,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(568,1,56,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(569,1,57,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(570,1,58,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(571,1,59,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(572,1,60,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(573,1,61,9,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(577,1,1,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(578,1,2,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(579,1,3,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(580,1,4,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(581,1,5,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(582,1,6,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(583,1,7,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(584,1,8,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(585,1,9,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(586,1,10,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(587,1,11,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(588,1,12,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(589,1,13,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(590,1,14,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(591,1,15,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(592,1,16,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(593,1,17,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(594,1,18,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(595,1,19,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(596,1,20,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(597,1,21,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(598,1,22,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(599,1,23,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(600,1,24,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(601,1,25,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(602,1,26,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(603,1,27,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(604,1,28,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(605,1,29,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(606,1,30,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(607,1,31,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(608,1,32,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(609,1,33,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(610,1,34,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(611,1,35,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(612,1,36,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(613,1,37,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(614,1,38,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(615,1,39,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(616,1,40,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(617,1,41,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(618,1,42,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(619,1,43,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(620,1,44,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(621,1,45,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(622,1,46,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(623,1,47,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(624,1,48,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(625,1,49,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(626,1,50,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(627,1,51,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(628,1,52,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(629,1,53,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(630,1,54,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(631,1,55,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(632,1,56,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(633,1,57,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(634,1,58,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(635,1,59,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(636,1,60,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(637,1,61,10,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(641,1,1,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(642,1,2,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(643,1,3,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(644,1,4,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(645,1,5,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(646,1,6,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(647,1,7,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(648,1,8,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(649,1,9,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(650,1,10,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(651,1,11,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(652,1,12,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(653,1,13,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(654,1,14,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(655,1,15,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(656,1,16,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(657,1,17,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(658,1,18,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(659,1,19,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(660,1,20,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(661,1,21,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(662,1,22,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(663,1,23,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(664,1,24,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(665,1,25,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(666,1,26,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(667,1,27,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(668,1,28,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(669,1,29,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(670,1,30,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(671,1,31,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(672,1,32,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(673,1,33,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(674,1,34,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(675,1,35,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(676,1,36,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(677,1,37,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(678,1,38,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(679,1,39,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(680,1,40,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(681,1,41,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(682,1,42,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(683,1,43,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(684,1,44,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(685,1,45,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(686,1,46,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(687,1,47,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(688,1,48,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(689,1,49,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(690,1,50,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(691,1,51,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(692,1,52,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(693,1,53,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(694,1,54,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(695,1,55,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(696,1,56,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(697,1,57,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(698,1,58,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(699,1,59,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(700,1,60,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(701,1,61,11,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(705,1,1,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(706,1,2,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(707,1,3,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(708,1,4,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(709,1,5,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(710,1,6,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(711,1,7,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(712,1,8,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(713,1,9,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(714,1,10,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(715,1,11,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(716,1,12,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(717,1,13,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(718,1,14,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(719,1,15,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(720,1,16,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(721,1,17,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(722,1,18,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(723,1,19,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(724,1,20,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(725,1,21,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(726,1,22,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(727,1,23,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(728,1,24,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(729,1,25,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(730,1,26,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(731,1,27,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(732,1,28,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(733,1,29,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(734,1,30,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(735,1,31,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(736,1,32,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(737,1,33,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(738,1,34,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(739,1,35,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(740,1,36,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(741,1,37,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(742,1,38,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(743,1,39,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(744,1,40,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(745,1,41,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(746,1,42,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(747,1,43,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(748,1,44,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(749,1,45,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(750,1,46,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(751,1,47,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(752,1,48,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(753,1,49,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(754,1,50,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(755,1,51,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(756,1,52,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(757,1,53,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(758,1,54,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(759,1,55,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(760,1,56,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(761,1,57,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(762,1,58,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(763,1,59,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(764,1,60,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(765,1,61,14,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(769,1,1,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(770,1,2,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(771,1,3,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(772,1,4,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(773,1,5,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(774,1,6,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(775,1,7,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(776,1,8,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(777,1,9,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(778,1,10,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(779,1,11,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(780,1,12,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(781,1,13,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(782,1,14,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(783,1,15,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(784,1,16,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(785,1,17,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(786,1,18,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(787,1,19,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(788,1,20,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(789,1,21,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(790,1,22,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(791,1,23,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(792,1,24,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(793,1,25,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(794,1,26,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(795,1,27,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(796,1,28,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(797,1,29,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(798,1,30,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(799,1,31,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(800,1,32,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(801,1,33,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(802,1,34,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(803,1,35,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(804,1,36,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(805,1,37,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(806,1,38,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(807,1,39,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(808,1,40,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(809,1,41,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(810,1,42,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(811,1,43,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(812,1,44,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(813,1,45,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(814,1,46,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(815,1,47,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(816,1,48,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(817,1,49,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(818,1,50,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(819,1,51,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(820,1,52,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(821,1,53,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(822,1,54,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(823,1,55,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(824,1,56,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(825,1,57,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(826,1,58,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(827,1,59,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(828,1,60,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(829,1,61,15,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(833,1,1,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(834,1,2,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(835,1,3,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(836,1,4,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(837,1,5,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(838,1,6,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(839,1,7,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(840,1,8,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(841,1,9,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(842,1,10,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(843,1,11,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(844,1,12,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(845,1,13,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(846,1,14,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(847,1,15,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(848,1,16,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(849,1,17,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(850,1,18,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(851,1,19,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(852,1,20,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(853,1,21,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(854,1,22,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(855,1,23,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(856,1,24,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(857,1,25,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(858,1,26,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(859,1,27,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(860,1,28,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(861,1,29,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(862,1,30,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(863,1,31,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(864,1,32,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(865,1,33,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(866,1,34,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(867,1,35,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(868,1,36,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(869,1,37,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(870,1,38,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(871,1,39,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(872,1,40,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(873,1,41,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(874,1,42,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(875,1,43,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(876,1,44,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(877,1,45,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(878,1,46,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(879,1,47,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(880,1,48,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(881,1,49,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(882,1,50,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(883,1,51,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(884,1,52,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(885,1,53,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(886,1,54,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(887,1,55,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(888,1,56,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(889,1,57,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(890,1,58,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(891,1,59,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(892,1,60,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(893,1,61,16,1,'active','2026-07-19 12:14:28','2026-07-19 12:14:28'),(1024,1,63,11,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1025,1,63,9,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1026,1,63,3,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1027,1,63,2,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1028,1,63,1,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1029,1,63,8,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1030,1,63,7,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1031,1,63,4,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1032,1,63,5,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1033,1,63,16,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1034,1,63,6,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1035,1,63,15,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1036,1,63,14,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1037,1,63,10,1,'active','2026-07-19 12:24:17','2026-07-19 12:24:17'),(1038,1,62,11,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1039,1,62,9,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1040,1,62,3,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1041,1,62,2,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1042,1,62,1,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1043,1,62,8,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1044,1,62,7,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1045,1,62,4,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1046,1,62,5,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1047,1,62,16,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1048,1,62,6,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1049,1,62,15,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1050,1,62,14,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1051,1,62,10,1,'active','2026-07-19 14:59:45','2026-07-19 14:59:45'),(1080,2,129,11,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1081,2,129,9,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1082,2,129,3,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1083,2,129,2,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1084,2,129,1,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1085,2,129,8,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1086,2,129,7,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1087,2,129,4,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1088,2,129,5,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1089,2,129,16,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1090,2,129,6,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1091,2,129,15,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1092,2,129,14,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52'),(1093,2,129,10,1,'active','2026-07-20 10:39:52','2026-07-20 10:39:52');
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
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listings`
--

LOCK TABLES `lot_project_listings` WRITE;
/*!40000 ALTER TABLE `lot_project_listings` DISABLE KEYS */;
INSERT INTO `lot_project_listings` VALUES (1,1,'End','LA-0208',NULL,300.00,1300.00,1300.00,1000.00,390000.00,10.00,39000.00,429000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(2,1,'End','LA-0401',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(3,1,'Inner','LA-0403',NULL,1200.00,2200.00,2200.00,1900.00,2640000.00,10.00,264000.00,2904000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(4,1,'End','LA-0413',NULL,374.00,2200.00,2200.00,1900.00,822800.00,10.00,82280.00,905080.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(5,1,'Inner','LA-0503',NULL,600.00,1900.00,1900.00,1600.00,1140000.00,10.00,114000.00,1254000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(6,1,'Corner','LA-0504',NULL,1200.00,1900.00,1900.00,1600.00,2280000.00,10.00,228000.00,2508000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(7,1,'Corner','LA-0601',NULL,405.00,1900.00,1900.00,1600.00,769500.00,10.00,76950.00,846450.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(8,1,'Inner','LA-0603',NULL,495.00,1800.00,1800.00,1500.00,891000.00,10.00,89100.00,980100.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(9,1,'Inner','LA-0604',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(10,1,'End','LA-0605',NULL,366.00,1800.00,1800.00,1500.00,658800.00,10.00,65880.00,724680.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(11,1,'End','LA-0606',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(12,1,'Corner','LA-0701',NULL,300.00,1900.00,1900.00,1600.00,570000.00,10.00,57000.00,627000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(13,1,'End','LA-0702',NULL,300.00,1900.00,1900.00,1600.00,570000.00,10.00,57000.00,627000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(14,1,'Inner','LA-0703',NULL,300.00,1900.00,1900.00,1600.00,570000.00,10.00,57000.00,627000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(15,1,'Inner','LA-0815',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(16,1,'Inner','LA-0817',NULL,394.00,1800.00,1800.00,1500.00,709200.00,10.00,70920.00,780120.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(17,1,'Corner','LA-0818',NULL,300.00,1900.00,1900.00,1600.00,570000.00,10.00,57000.00,627000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(18,1,'Corner','LA-0901',NULL,320.00,1900.00,1900.00,1600.00,608000.00,10.00,60800.00,668800.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(19,1,'Inner','LA-0903',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(20,1,'Inner','LA-0904',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(21,1,'Inner','LA-0905',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(22,1,'Inner','LA-1006',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(23,1,'Inner','LA-1007',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(24,1,'Inner','LA-1008',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(25,1,'Inner','LA-1009',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(26,1,'End','LA-1010',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(27,1,'Inner','LA-1109',NULL,300.00,1300.00,1300.00,1000.00,390000.00,10.00,39000.00,429000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(28,1,'End','LA-1110',NULL,300.00,1300.00,1300.00,1000.00,390000.00,10.00,39000.00,429000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(29,1,'Corner','LA-1201',NULL,450.00,2500.00,2500.00,2200.00,1125000.00,10.00,112500.00,1237500.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(30,1,'Corner','LA-1216',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(31,1,'Inner','LA-1217',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(32,1,'End','LA-1218',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(33,1,'Corner','LA-1301',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(34,1,'Corner','LA-1302',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(35,1,'Inner','LA-1303',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(36,1,'End','LA-1304',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(37,1,'End','LA-1305',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(38,1,'Corner','LA-1401',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(39,1,'End','LA-1402',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(40,1,'Inner','LA-1403',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(41,1,'Inner','LA-1404',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(42,1,'Inner','LA-1405',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(43,1,'Inner','LA-1406',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(44,1,'Inner','LA-1407',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(45,1,'Inner','LA-1408',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(46,1,'Inner','LA-1409',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(47,1,'Inner','LA-1410',NULL,300.00,1700.00,1700.00,1400.00,510000.00,10.00,51000.00,561000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(48,1,'End','LA-1411',NULL,356.00,1800.00,1800.00,1500.00,640800.00,10.00,64080.00,704880.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(49,1,'Inner','LA-1504-A',NULL,535.00,2200.00,2200.00,1900.00,1177000.00,10.00,117700.00,1294700.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(50,1,'Inner','LA-1504-B',NULL,600.00,2200.00,2200.00,1900.00,1320000.00,10.00,132000.00,1452000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(51,1,'End','LA-1607',NULL,300.00,1800.00,1800.00,1500.00,540000.00,10.00,54000.00,594000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(52,1,'Corner','LA-1701',NULL,300.00,2700.00,2700.00,2400.00,810000.00,10.00,81000.00,891000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(53,1,'Corner','LA-1702',NULL,300.00,2700.00,2700.00,2400.00,810000.00,10.00,81000.00,891000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(54,1,'Inner','LA-1703',NULL,300.00,2500.00,2500.00,2200.00,750000.00,10.00,75000.00,825000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(55,1,'Inner','LA-1704',NULL,300.00,2500.00,2500.00,2200.00,750000.00,10.00,75000.00,825000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(56,1,'Corner','LA-1705',NULL,300.00,2600.00,2600.00,2300.00,780000.00,10.00,78000.00,858000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(57,1,'Corner','LA-1706',NULL,300.00,2600.00,2600.00,2300.00,780000.00,10.00,78000.00,858000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(58,1,'Corner','LA-1801',NULL,300.00,2700.00,2700.00,2400.00,810000.00,10.00,81000.00,891000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(59,1,'Corner','LA-1802',NULL,300.00,2700.00,2700.00,2400.00,810000.00,10.00,81000.00,891000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(60,1,'Inner','LA-1803',NULL,300.00,2500.00,2500.00,2200.00,750000.00,10.00,75000.00,825000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(61,1,'Inner','LA-1804',NULL,300.00,2500.00,2500.00,2200.00,750000.00,10.00,75000.00,825000.00,50000.00,0.00,'available',NULL,NULL,'2026-07-19 12:14:28','2026-07-19 12:14:28',NULL,NULL,NULL,NULL,0,NULL),(62,1,'Corner','LA-1805',NULL,300.00,2600.00,2600.00,2300.00,780000.00,10.00,78000.00,858000.00,50000.00,0.00,'sold','active',NULL,'2026-07-19 12:14:28','2026-07-19 14:59:45',NULL,NULL,NULL,NULL,0,NULL),(63,1,'Corner','LA-1806','-',300.00,2600.00,2600.00,2300.00,780000.00,10.00,78000.00,858000.00,50000.00,0.00,'available',NULL,'discontinued','2026-07-19 12:14:28','2026-07-20 10:11:59',NULL,NULL,NULL,NULL,4,NULL),(129,2,'Inner','PE-0101','-',350.00,4500.00,4500.00,4700.00,1575000.00,10.00,157500.00,1732500.00,50000.00,0.00,'available',NULL,'discontinued','2026-07-20 10:36:38','2026-07-20 10:47:40',NULL,NULL,NULL,NULL,4,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_allocations`
--

LOCK TABLES `lot_project_payment_allocations` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_allocations` DISABLE KEYS */;
INSERT INTO `lot_project_payment_allocations` VALUES (12,6,31,50000.00,'2026-07-20 10:27:43');
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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_logs`
--

LOCK TABLES `lot_project_payment_logs` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_logs` DISABLE KEYS */;
INSERT INTO `lot_project_payment_logs` VALUES (10,6,'created','Reservation payment created and verified for LA-1805.',1,'2026-07-20 10:27:43');
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
) ENGINE=InnoDB AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_schedules`
--

LOCK TABLES `lot_project_payment_schedules` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_schedules` DISABLE KEYS */;
INSERT INTO `lot_project_payment_schedules` VALUES (31,1,62,2,'2026-07-19','Reservation Fee',858000.00,50000.00,0.00,50000.00,50000.00,0.00,0.00,0.00,'2026-07-20',50000.00,0.00,0.00,50000.00,'2026-07-20','CASH-20260720-LA1805-0001',808000.00,'Paid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(32,1,62,2,'2026-07-19','Downpayment',808000.00,257400.00,0.00,257400.00,257400.00,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Overdue','2026-07-19 14:59:45','2026-07-20 10:27:43'),(33,1,62,2,'2026-08-19','1st Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(34,1,62,2,'2026-09-19','2nd Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(35,1,62,2,'2026-10-19','3rd Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(36,1,62,2,'2026-11-19','4th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(37,1,62,2,'2026-12-19','5th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(38,1,62,2,'2027-01-19','6th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(39,1,62,2,'2027-02-19','7th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(40,1,62,2,'2027-03-19','8th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(41,1,62,2,'2027-04-19','9th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(42,1,62,2,'2027-05-19','10th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(43,1,62,2,'2027-06-19','11th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(44,1,62,2,'2027-07-19','12th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(45,1,62,2,'2027-08-19','13th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(46,1,62,2,'2027-09-19','14th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(47,1,62,2,'2027-10-19','15th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(48,1,62,2,'2027-11-19','16th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(49,1,62,2,'2027-12-19','17th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(50,1,62,2,'2028-01-19','18th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(51,1,62,2,'2028-02-19','19th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(52,1,62,2,'2028-03-19','20th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(53,1,62,2,'2028-04-19','21st Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(54,1,62,2,'2028-05-19','22nd Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(55,1,62,2,'2028-06-19','23rd Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(56,1,62,2,'2028-07-19','24th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(57,1,62,2,'2028-08-19','25th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(58,1,62,2,'2028-09-19','26th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(59,1,62,2,'2028-10-19','27th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(60,1,62,2,'2028-11-19','28th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(61,1,62,2,'2028-12-19','29th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(62,1,62,2,'2029-01-19','30th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(63,1,62,2,'2029-02-19','31st Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(64,1,62,2,'2029-03-19','32nd Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(65,1,62,2,'2029-04-19','33rd Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(66,1,62,2,'2029-05-19','34th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(67,1,62,2,'2029-06-19','35th Monthly Payment',808000.00,15294.44,0.00,15294.44,15294.44,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43'),(68,1,62,2,'2029-07-19','36th Monthly Payment',808000.00,15294.60,0.00,15294.60,15294.60,0.00,0.00,0.00,'2026-07-20',0.00,0.00,0.00,0.00,NULL,NULL,808000.00,'Unpaid','2026-07-19 14:59:45','2026-07-20 10:27:43');
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payments`
--

LOCK TABLES `lot_project_payments` WRITE;
/*!40000 ALTER TABLE `lot_project_payments` DISABLE KEYS */;
INSERT INTO `lot_project_payments` VALUES (6,1,62,2,31,'reservation','Cash',50000.00,'2026-07-20','CASH-20260720-LA1805-0001','Verified',1,'2026-07-20 10:27:43','2026-07-20 10:27:43','2026-07-20 10:27:43');
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
  `cancellation_reason` text,
  `cancelled_value` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cash_collected_at_cancellation` decimal(14,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discontinued_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `refund_date` date DEFAULT NULL,
  `refund_reference` varchar(150) DEFAULT NULL,
  `cancellation_settlement_notes` text,
  `released_commission_amount_at_cancellation` decimal(14,2) NOT NULL DEFAULT '0.00',
  `sale_data_archived_at` datetime DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_reservation_history`
--

LOCK TABLES `lot_project_reservation_history` WRITE;
/*!40000 ALTER TABLE `lot_project_reservation_history` DISABLE KEYS */;
INSERT INTO `lot_project_reservation_history` VALUES (1,1,63,NULL,'LA-1806','Aaron M Corsino','cancelled','2026-07-19 12:24:17','installment',2600.00,780000.00,780000.00,78000.00,0.00,0.00,0.00,0.00,858000.00,0.00,0.00,'2026-07-20 10:11:11','discontinued','partial_refund','DSDS',858000.00,364350.00,150000.00,214350.00,'2026-07-20','213',NULL,24960.00,'2026-07-20 10:11:59',1,1,'2026-07-19 12:24:17','2026-07-20 10:11:59'),(2,1,62,2,'LA-1805','ROWENA MORENO CORTEZ','active','2026-07-19 14:59:45','installment',2600.00,780000.00,780000.00,78000.00,0.00,0.00,0.00,0.00,858000.00,0.00,0.00,NULL,NULL,NULL,NULL,0.00,0.00,0.00,0.00,NULL,NULL,NULL,0.00,NULL,1,NULL,'2026-07-19 14:59:45','2026-07-19 14:59:45'),(3,2,129,NULL,'PE-0101','ROWENA MORENO CORTEZ','cancelled','2026-07-20 10:39:52','installment',4500.00,1575000.00,1575000.00,157500.00,0.00,0.00,0.00,0.00,1732500.00,0.00,0.00,'2026-07-20 10:47:34','discontinued','partial_refund','test',1732500.00,666645.83,333333.00,333312.83,'2026-07-20','12','tes',0.00,'2026-07-20 10:47:40',1,1,'2026-07-20 10:39:52','2026-07-20 10:47:40');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_settings`
--

LOCK TABLES `lot_project_settings` WRITE;
/*!40000 ALTER TABLE `lot_project_settings` DISABLE KEYS */;
INSERT INTO `lot_project_settings` VALUES (1,1,7,19,'D&C Prime Realty','dcprimerealty@gmail.com','0912-345-6789','D&C Prime Realty','dcprimerealty@gmail.com','(046) 866-0616',0.00,0,'2026-07-19 09:51:27','2026-07-19 16:52:24'),(2,2,7,22,'D&C Prime Realty','dcprimerealty@gmail.com','0912-345-6789','D&C Prime Realty','dcprimerealty@gmail.com','(046) 866-0616',0.00,0,'2026-07-19 09:52:42','2026-07-19 09:52:42');
/*!40000 ALTER TABLE `lot_project_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_project_soa_statements`
--

DROP TABLE IF EXISTS `lot_project_soa_statements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_project_soa_statements` (
  `soa_statement_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `soa_reference` varchar(32) DEFAULT NULL,
  `lot_project_id` int unsigned NOT NULL,
  `lot_project_listing_id` int unsigned NOT NULL,
  `lot_project_client_profile_id` int unsigned NOT NULL,
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
  PRIMARY KEY (`soa_statement_id`),
  UNIQUE KEY `uq_soa_schedule` (`lot_project_payment_schedule_id`),
  UNIQUE KEY `uq_soa_reference` (`soa_reference`),
  KEY `idx_soa_project` (`lot_project_id`),
  KEY `idx_soa_listing` (`lot_project_listing_id`),
  KEY `idx_soa_client` (`lot_project_client_profile_id`),
  KEY `idx_soa_created_by` (`created_by_user_id`),
  KEY `idx_soa_last_sent_by` (`last_sent_by_user_id`),
  CONSTRAINT `fk_soa_client` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_last_sent_by` FOREIGN KEY (`last_sent_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_soa_schedule` FOREIGN KEY (`lot_project_payment_schedule_id`) REFERENCES `lot_project_payment_schedules` (`lot_project_payment_schedule_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_soa_statements`
--

LOCK TABLES `lot_project_soa_statements` WRITE;
/*!40000 ALTER TABLE `lot_project_soa_statements` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_project_soa_statements` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_projects`
--

LOCK TABLES `lot_projects` WRITE;
/*!40000 ALTER TABLE `lot_projects` DISABLE KEYS */;
INSERT INTO `lot_projects` VALUES (1,'Bailen Project','bailen-project','Pantihan, Bailen Cavite','LA','IMELDA B. VILLALOBOS','AA-06-0005-00105','022-06-0005-003-04','active','2026-07-19 09:51:27','2026-07-19 09:51:27'),(2,'Prime Enclave Project','prime-enclave-project','Maragondon, Cavite','PE','n/a','n/a','n/a','active','2026-07-19 09:52:42','2026-07-19 09:52:42');
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_group_lot_project_rates`
--

LOCK TABLES `seller_group_lot_project_rates` WRITE;
/*!40000 ALTER TABLE `seller_group_lot_project_rates` DISABLE KEYS */;
INSERT INTO `seller_group_lot_project_rates` VALUES (1,1,2,8.00,'active','2026-07-19 10:48:01','2026-07-19 10:48:01'),(2,1,1,8.00,'active','2026-07-19 10:48:01','2026-07-19 10:48:01'),(3,2,1,7.00,'active','2026-07-19 10:49:19','2026-07-19 10:49:19'),(4,2,2,7.00,'active','2026-07-19 10:49:19','2026-07-19 10:49:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_groups`
--

LOCK TABLES `seller_groups` WRITE;
/*!40000 ALTER TABLE `seller_groups` DISABLE KEYS */;
INSERT INTO `seller_groups` VALUES (1,'North Star Group',2,NULL,'active','2026-07-19 10:48:01','2026-07-19 10:52:23'),(2,'Group2 Sample',NULL,NULL,'active','2026-07-19 10:49:19','2026-07-19 10:49:19');
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_hierarchy_lot_project_overrides`
--

LOCK TABLES `seller_hierarchy_lot_project_overrides` WRITE;
/*!40000 ALTER TABLE `seller_hierarchy_lot_project_overrides` DISABLE KEYS */;
INSERT INTO `seller_hierarchy_lot_project_overrides` VALUES (1,4,3,1,2.00,'active','2026-07-19 11:53:30','2026-07-19 11:53:30'),(2,3,2,1,1.00,'active','2026-07-19 11:53:36','2026-07-19 11:53:36'),(3,2,1,1,1.00,'active','2026-07-19 11:53:48','2026-07-19 11:53:48'),(4,2,1,2,1.00,'active','2026-07-19 11:54:25','2026-07-19 11:54:25'),(5,3,2,2,1.00,'active','2026-07-19 11:54:30','2026-07-19 11:54:30'),(6,4,3,2,1.00,'active','2026-07-19 11:54:35','2026-07-19 11:54:35');
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
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
-- Table structure for table `user_password_reset_codes`
--

DROP TABLE IF EXISTS `user_password_reset_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  PRIMARY KEY (`user_password_reset_code_id`),
  KEY `idx_password_reset_user_created` (`user_id`,`created_at`),
  KEY `idx_password_reset_status_expiry` (`status`,`expires_at`),
  CONSTRAINT `fk_password_reset_code_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_password_reset_codes`
--

LOCK TABLES `user_password_reset_codes` WRITE;
/*!40000 ALTER TABLE `user_password_reset_codes` DISABLE KEYS */;
INSERT INTO `user_password_reset_codes` VALUES (1,1,'5d010ed03203bce01fafcc37b9099356af53fa73fd8e7d160b5257985ec3b73c','used',0,5,'2026-07-20 09:59:23','2026-07-20 09:49:42','2026-07-20 09:49:55','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-20 09:49:23','2026-07-20 09:49:55');
/*!40000 ALTER TABLE `user_password_reset_codes` ENABLE KEYS */;
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
  `auth_version` int unsigned NOT NULL DEFAULT '0',
  `can_login` tinyint(1) NOT NULL DEFAULT '1',
  `is_system_account` tinyint(1) NOT NULL DEFAULT '0',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Super','Admin',NULL,NULL,NULL,NULL,NULL,'robertrenbysanjuan@gmail.com','$2b$10$WSnTKhSm7rSX2AWD0bQglOeZjDYgcklqu4au0AJ8UVOkuROd2tbaq','super_admin','active',0,1,1,0,'2026-07-20 09:49:58','2026-07-17 09:00:00','2026-07-20 09:49:58'),(2,'Rowena','Cortez',NULL,'09045854584','434-343-4343',NULL,NULL,'rowen@gmail.com','$2b$10$A.LwV4FayCDdTKruJoI/ceWnPn4REI2wVk5z/im0Ol4/0mb8t54eW','broker_network_manager','active',1,0,1,0,NULL,'2026-07-19 10:51:33','2026-07-19 10:51:33'),(3,'Rowena','Broker1',NULL,'0985678976567',NULL,NULL,NULL,'rowenaBroker1@gmail.com','$2b$10$loxuQ9a7qP.wt8yUFd6yBO9krvNw66pwDGrXO6e69PNVcmej5BULu','broker','active',1,0,1,0,NULL,'2026-07-19 10:55:15','2026-07-19 10:55:15'),(4,'Rowena','Manager1',NULL,'085678903',NULL,NULL,NULL,'rowenamanager1@gmail.com','$2b$10$ZjRTBXVc18UM7UyXGc/LP.nijnhPfnyxEP.WwSbXvy9ig0Gdcbs52','manager','active',1,0,1,0,NULL,'2026-07-19 10:55:55','2026-07-19 10:55:55'),(5,'Rowena','Agent1',NULL,'09876545678',NULL,NULL,NULL,'rowenaagent1@gmail.com','$2b$10$e2cMzhi101ZSn0ZYBmOhreUmWEXE.c.xxhH5V.ATNeXsxL/CEDe8W','agent','active',1,0,1,0,NULL,'2026-07-19 10:56:26','2026-07-19 10:56:26');
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

-- Dump completed on 2026-07-20 11:01:17


-- ============================================================================
-- Complete cancellation/account retention, secure purge, and authenticated Cloudinary update
-- Appended for a fresh database import after the current configured seed dump.
-- ============================================================================

-- Buyer account retention, cancellation commission settlement, signed Cloudinary files,
-- and Super Admin verified permanent account deletion.
-- Rerunnable and compatible with MySQL safe update mode because backfills use keyed joins.

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DELIMITER $$

DROP PROCEDURE IF EXISTS migration_add_column_if_missing$$
CREATE PROCEDURE migration_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_index_if_missing$$
CREATE PROCEDURE migration_add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND index_name = p_index_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD INDEX `', p_index_name, '` (', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_unique_index_if_missing$$
CREATE PROCEDURE migration_add_unique_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND index_name = p_index_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD UNIQUE INDEX `', p_index_name, '` (', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_drop_index_if_exists$$
CREATE PROCEDURE migration_drop_index_if_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND index_name = p_index_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table_name, '` DROP INDEX `', p_index_name, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_fk_if_missing$$
CREATE PROCEDURE migration_add_fk_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_constraint_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_reference_table VARCHAR(64),
  IN p_reference_column VARCHAR(64),
  IN p_delete_rule VARCHAR(20)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_table_name
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = p_reference_table
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_name
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = p_table_name
      AND constraint_name = p_constraint_name
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table_name, '` ADD CONSTRAINT `', p_constraint_name,
      '` FOREIGN KEY (`', p_column_name, '`) REFERENCES `', p_reference_table,
      '` (`', p_reference_column, '`) ON DELETE ', p_delete_rule, ' ON UPDATE CASCADE'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_modify_commission_release_status$$
CREATE PROCEDURE migration_modify_commission_release_status()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'lot_project_commission_releases'
  ) THEN
    ALTER TABLE lot_project_commission_releases
      MODIFY COLUMN release_status ENUM(
        'Pending',
        'Eligible',
        'Earned on Cancellation',
        'Released',
        'On Hold',
        'Forfeited on Cancellation',
        'Cancelled'
      ) NOT NULL DEFAULT 'Pending';
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS lot_project_accounts (
  lot_project_account_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_reference VARCHAR(40) NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED DEFAULT NULL,
  lot_project_reservation_history_id BIGINT UNSIGNED DEFAULT NULL,
  buyer_name_snapshot VARCHAR(255) DEFAULT NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  account_status ENUM(
    'active',
    'pending_cancellation',
    'cancelled',
    'closed_fully_paid',
    'deletion_pending'
  ) NOT NULL DEFAULT 'active',
  reservation_date DATETIME DEFAULT NULL,
  cancellation_date DATETIME DEFAULT NULL,
  closed_at DATETIME DEFAULT NULL,
  cash_collected_at_cancellation DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discontinued_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  commissionable_retained_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  commissionable_retained_percent DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  cancellation_reason TEXT,
  settlement_notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_account_id),
  UNIQUE KEY uq_lot_project_account_reference (account_reference),
  UNIQUE KEY uq_lot_project_account_profile (lot_project_client_profile_id),
  KEY idx_lot_project_account_listing_status (lot_project_listing_id, account_status),
  KEY idx_lot_project_account_project_status (lot_project_id, account_status),
  CONSTRAINT fk_lot_project_account_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_lot_project_account_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_lot_project_account_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Keep the migration rerunnable after an earlier draft created this column as NOT NULL.
ALTER TABLE lot_project_accounts
  MODIFY COLUMN lot_project_client_profile_id INT UNSIGNED NULL;

CALL migration_drop_index_if_exists('lot_project_client_profiles', 'uq_listing_client_profile');
CALL migration_add_index_if_missing('lot_project_client_profiles', 'idx_client_profile_listing_status', '`lot_project_listing_id`, `lot_project_client_profile_status`');
CALL migration_drop_index_if_exists('lot_project_commissions', 'uq_commission_seller_per_listing');
CALL migration_add_unique_index_if_missing('lot_project_commissions', 'uq_commission_seller_per_profile', '`lot_project_client_profile_id`, `accredited_seller_id`');

CALL migration_add_column_if_missing('lot_project_listings', 'current_account_id', 'BIGINT UNSIGNED NULL');
CALL migration_add_index_if_missing('lot_project_listings', 'idx_listing_current_account', '`current_account_id`');

CALL migration_add_column_if_missing('lot_project_reservation_history', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_payments', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_payment_schedules', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_client_documents', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_commissions', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_commission_receipts', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_penalty_reliefs', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_soa_statements', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_notification_logs', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_archived_commission_releases', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_client_profile_id`');
CALL migration_add_column_if_missing('lot_project_buyer_form_links', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_listing_id`');
CALL migration_add_column_if_missing('lot_project_buyer_form_submissions', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_listing_id`');
CALL migration_add_column_if_missing('lot_project_cancelled_sale_archives', 'lot_project_account_id', 'BIGINT UNSIGNED NULL AFTER `lot_project_listing_id`');

CALL migration_add_index_if_missing('lot_project_reservation_history', 'idx_reservation_history_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_payments', 'idx_payment_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_payment_schedules', 'idx_payment_schedule_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_client_documents', 'idx_client_document_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_commissions', 'idx_commission_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_commission_receipts', 'idx_commission_receipt_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_penalty_reliefs', 'idx_penalty_relief_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_soa_statements', 'idx_soa_statement_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_notification_logs', 'idx_notification_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_archived_commission_releases', 'idx_archived_commission_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_buyer_form_links', 'idx_buyer_form_link_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_buyer_form_submissions', 'idx_buyer_form_submission_account', '`lot_project_account_id`');
CALL migration_add_index_if_missing('lot_project_cancelled_sale_archives', 'idx_cancelled_sale_archive_account', '`lot_project_account_id`');

CALL migration_modify_commission_release_status();
CALL migration_add_column_if_missing('lot_project_commission_releases', 'cancellation_earning_reason', 'VARCHAR(255) NULL AFTER `release_status`');
CALL migration_add_column_if_missing('lot_project_commission_releases', 'cancellation_settled_at', 'DATETIME NULL AFTER `cancellation_earning_reason`');

CREATE TABLE IF NOT EXISTS lot_project_client_document_files (
  lot_project_client_document_file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_account_id BIGINT UNSIGNED NOT NULL,
  lot_project_client_document_id INT UNSIGNED NOT NULL,
  cloudinary_asset_id VARCHAR(255) DEFAULT NULL,
  cloudinary_public_id VARCHAR(500) NOT NULL,
  cloudinary_resource_type ENUM('image','raw','video') NOT NULL DEFAULT 'image',
  cloudinary_delivery_type VARCHAR(40) NOT NULL DEFAULT 'authenticated',
  cloudinary_version BIGINT UNSIGNED DEFAULT NULL,
  cloudinary_asset_folder VARCHAR(700) DEFAULT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) DEFAULT NULL,
  file_format VARCHAR(50) DEFAULT NULL,
  file_mime_type VARCHAR(150) DEFAULT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  file_status ENUM('active','superseded','removed') NOT NULL DEFAULT 'active',
  uploaded_by_user_id INT UNSIGNED DEFAULT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME DEFAULT NULL,
  removal_reason VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (lot_project_client_document_file_id),
  UNIQUE KEY uq_client_document_cloudinary_asset (cloudinary_asset_id),
  KEY idx_client_document_file_account (lot_project_account_id, file_status),
  KEY idx_client_document_file_document (lot_project_client_document_id, file_status),
  CONSTRAINT fk_client_document_file_account
    FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts (lot_project_account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_client_document_file_document
    FOREIGN KEY (lot_project_client_document_id) REFERENCES lot_project_client_documents (lot_project_client_document_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_client_document_file_user
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS destructive_action_verifications (
  destructive_action_verification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  reason TEXT,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  status ENUM('pending','verified','used','expired','locked','cancelled') NOT NULL DEFAULT 'pending',
  request_ip VARCHAR(100) DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (destructive_action_verification_id),
  KEY idx_destructive_verification_user_status (user_id, status, created_at),
  KEY idx_destructive_verification_entity (entity_type, entity_id, status),
  CONSTRAINT fk_destructive_verification_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lot_project_account_purge_events (
  lot_project_account_purge_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  deletion_reference VARCHAR(50) NOT NULL,
  account_id_snapshot BIGINT UNSIGNED NOT NULL,
  account_reference_snapshot VARCHAR(40) NOT NULL,
  lot_project_id_snapshot INT UNSIGNED NOT NULL,
  lot_project_listing_id_snapshot INT UNSIGNED NOT NULL,
  unit_id_snapshot VARCHAR(50) NOT NULL,
  buyer_name_snapshot VARCHAR(255) DEFAULT NULL,
  deletion_reason TEXT NOT NULL,
  requested_by_user_id INT UNSIGNED NOT NULL,
  destructive_action_verification_id BIGINT UNSIGNED NOT NULL,
  deleted_row_counts_json JSON DEFAULT NULL,
  cloudinary_asset_count INT UNSIGNED NOT NULL DEFAULT 0,
  deletion_manifest_hash CHAR(64) DEFAULT NULL,
  purge_status ENUM('requested','processing','completed','failed') NOT NULL DEFAULT 'requested',
  error_message TEXT,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (lot_project_account_purge_event_id),
  UNIQUE KEY uq_account_purge_deletion_reference (deletion_reference),
  KEY idx_account_purge_account_snapshot (account_id_snapshot),
  KEY idx_account_purge_status (purge_status, requested_at),
  CONSTRAINT fk_account_purge_requested_by
    FOREIGN KEY (requested_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_account_purge_verification
    FOREIGN KEY (destructive_action_verification_id) REFERENCES destructive_action_verifications (destructive_action_verification_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One permanent account per existing buyer profile.
INSERT INTO lot_project_accounts (
  account_reference,
  lot_project_id,
  lot_project_listing_id,
  lot_project_client_profile_id,
  lot_project_reservation_history_id,
  buyer_name_snapshot,
  unit_id_snapshot,
  account_status,
  reservation_date,
  cancellation_date,
  closed_at,
  cash_collected_at_cancellation,
  refund_amount,
  discontinued_amount,
  commissionable_retained_amount,
  commissionable_retained_percent,
  cancellation_reason,
  settlement_notes
)
SELECT
  CONCAT('ACC-', YEAR(COALESCE(cp.lot_project_client_profile_created_at, NOW())), '-', LPAD(cp.lot_project_client_profile_id, 6, '0')),
  cp.lot_project_id,
  cp.lot_project_listing_id,
  cp.lot_project_client_profile_id,
  history.lot_project_reservation_history_id,
  cp.buyer_full_name,
  listing.lot_project_listing_unit_id,
  CASE
    WHEN cp.lot_project_client_profile_status = 'cancelled' OR history.reservation_status = 'cancelled' THEN 'cancelled'
    WHEN history.reservation_status = 'pending_for_cancellation' THEN 'pending_cancellation'
    WHEN cp.lot_project_client_profile_status = 'closed' OR listing.lot_project_listing_sold_substatus = 'fully_paid' THEN 'closed_fully_paid'
    ELSE 'active'
  END,
  COALESCE(history.reserved_at, cp.lot_project_client_profile_created_at),
  history.cancelled_at,
  CASE WHEN history.reservation_status = 'cancelled' THEN COALESCE(history.cancelled_at, history.updated_at) ELSE NULL END,
  COALESCE(history.cash_collected_at_cancellation, 0),
  COALESCE(history.refund_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  CASE
    WHEN COALESCE(history.tcp_snapshot, 0) > 0
      THEN LEAST(100, GREATEST(0, ROUND((COALESCE(history.discontinued_amount, 0) / history.tcp_snapshot) * 100, 4)))
    ELSE 0
  END,
  history.cancellation_reason,
  history.cancellation_settlement_notes
FROM lot_project_client_profiles cp
INNER JOIN lot_project_listings listing
  ON listing.lot_project_listing_id = cp.lot_project_listing_id
LEFT JOIN lot_project_reservation_history history
  ON history.lot_project_reservation_history_id = (
    SELECT history2.lot_project_reservation_history_id
    FROM lot_project_reservation_history history2
    WHERE history2.lot_project_client_profile_id = cp.lot_project_client_profile_id
    ORDER BY history2.lot_project_reservation_history_id DESC
    LIMIT 1
  )
LEFT JOIN lot_project_accounts existing
  ON existing.lot_project_client_profile_id = cp.lot_project_client_profile_id
WHERE existing.lot_project_account_id IS NULL;

-- Older database versions deleted live buyer rows after returning a cancelled unit
-- to Available. Keep those surviving reservation/archive snapshots visible as
-- history-only accounts even when the original client profile no longer exists.
INSERT INTO lot_project_accounts (
  account_reference,
  lot_project_id,
  lot_project_listing_id,
  lot_project_client_profile_id,
  lot_project_reservation_history_id,
  buyer_name_snapshot,
  unit_id_snapshot,
  account_status,
  reservation_date,
  cancellation_date,
  closed_at,
  cash_collected_at_cancellation,
  refund_amount,
  discontinued_amount,
  commissionable_retained_amount,
  commissionable_retained_percent,
  cancellation_reason,
  settlement_notes
)
SELECT
  CONCAT('ACC-', YEAR(COALESCE(history.reserved_at, history.created_at, NOW())), '-H', LPAD(history.lot_project_reservation_history_id, 6, '0')),
  history.lot_project_id,
  history.lot_project_listing_id,
  NULL,
  history.lot_project_reservation_history_id,
  history.buyer_name_snapshot,
  history.unit_id_snapshot,
  'cancelled',
  history.reserved_at,
  history.cancelled_at,
  COALESCE(history.sale_data_archived_at, history.cancelled_at, history.updated_at),
  COALESCE(history.cash_collected_at_cancellation, 0),
  COALESCE(history.refund_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  COALESCE(history.discontinued_amount, 0),
  CASE
    WHEN COALESCE(history.tcp_snapshot, 0) > 0
      THEN LEAST(100, GREATEST(0, ROUND((COALESCE(history.discontinued_amount, 0) / history.tcp_snapshot) * 100, 4)))
    ELSE 0
  END,
  history.cancellation_reason,
  history.cancellation_settlement_notes
FROM lot_project_reservation_history history
LEFT JOIN lot_project_accounts existing
  ON existing.lot_project_reservation_history_id = history.lot_project_reservation_history_id
WHERE history.reservation_status = 'cancelled'
  AND existing.lot_project_account_id IS NULL;

UPDATE lot_project_reservation_history history
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = history.lot_project_client_profile_id
SET history.lot_project_account_id = account.lot_project_account_id
WHERE history.lot_project_account_id IS NULL;

UPDATE lot_project_reservation_history history
INNER JOIN lot_project_accounts account
  ON account.lot_project_reservation_history_id = history.lot_project_reservation_history_id
SET history.lot_project_account_id = account.lot_project_account_id
WHERE history.lot_project_account_id IS NULL;

UPDATE lot_project_payments row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_payment_schedules row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_client_documents row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_commissions row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_commission_receipts row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_penalty_reliefs row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_soa_statements row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_notification_logs row_data
INNER JOIN lot_project_accounts account
  ON account.lot_project_client_profile_id = row_data.lot_project_client_profile_id
SET row_data.lot_project_account_id = account.lot_project_account_id
WHERE row_data.lot_project_account_id IS NULL;

UPDATE lot_project_cancelled_sale_archives archive_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_reservation_history_id = archive_row.lot_project_reservation_history_id
SET archive_row.lot_project_account_id = account.lot_project_account_id
WHERE archive_row.lot_project_account_id IS NULL;

UPDATE lot_project_archived_commission_releases release_row
INNER JOIN lot_project_cancelled_sale_archives archive_row
  ON archive_row.lot_project_cancelled_sale_archive_id = release_row.lot_project_cancelled_sale_archive_id
SET release_row.lot_project_account_id = archive_row.lot_project_account_id
WHERE release_row.lot_project_account_id IS NULL
  AND archive_row.lot_project_account_id IS NOT NULL;

-- Buyer-form records created before account support are attached only when the
-- listing still points to the same active account. Historical unmatched forms
-- stay NULL rather than being assigned to the wrong buyer.
UPDATE lot_project_buyer_form_links form_link
INNER JOIN lot_project_accounts account
  ON account.lot_project_listing_id = form_link.lot_project_listing_id
 AND account.account_status IN ('active', 'pending_cancellation', 'closed_fully_paid')
SET form_link.lot_project_account_id = account.lot_project_account_id
WHERE form_link.lot_project_account_id IS NULL;

UPDATE lot_project_buyer_form_submissions submission
INNER JOIN lot_project_buyer_form_links form_link
  ON form_link.lot_project_buyer_form_link_id = submission.lot_project_buyer_form_link_id
SET submission.lot_project_account_id = form_link.lot_project_account_id
WHERE submission.lot_project_account_id IS NULL
  AND form_link.lot_project_account_id IS NOT NULL;

UPDATE lot_project_listings listing
INNER JOIN lot_project_accounts account
  ON account.lot_project_listing_id = listing.lot_project_listing_id
 AND account.account_status IN ('active', 'pending_cancellation', 'closed_fully_paid')
SET listing.current_account_id = account.lot_project_account_id
WHERE listing.current_account_id IS NULL
  AND listing.lot_project_listing_status <> 'available';

-- Guard retained history from accidental parent deletion. The verified purge
-- removes account-owned rows in child-to-parent order before deleting an account.
CALL migration_add_fk_if_missing('lot_project_listings', 'fk_listing_current_account', 'current_account_id', 'lot_project_accounts', 'lot_project_account_id', 'SET NULL');
CALL migration_add_fk_if_missing('lot_project_reservation_history', 'fk_reservation_history_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_payments', 'fk_payment_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_payment_schedules', 'fk_payment_schedule_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_client_documents', 'fk_client_document_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_commissions', 'fk_commission_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_commission_receipts', 'fk_commission_receipt_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_penalty_reliefs', 'fk_penalty_relief_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_soa_statements', 'fk_soa_statement_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_notification_logs', 'fk_notification_log_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_archived_commission_releases', 'fk_archived_commission_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_buyer_form_links', 'fk_buyer_form_link_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_buyer_form_submissions', 'fk_buyer_form_submission_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');
CALL migration_add_fk_if_missing('lot_project_cancelled_sale_archives', 'fk_cancelled_sale_archive_account', 'lot_project_account_id', 'lot_project_accounts', 'lot_project_account_id', 'RESTRICT');

DROP PROCEDURE IF EXISTS migration_add_column_if_missing;
DROP PROCEDURE IF EXISTS migration_add_index_if_missing;
DROP PROCEDURE IF EXISTS migration_add_unique_index_if_missing;
DROP PROCEDURE IF EXISTS migration_drop_index_if_exists;
DROP PROCEDURE IF EXISTS migration_add_fk_if_missing;
DROP PROCEDURE IF EXISTS migration_modify_commission_release_status;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
