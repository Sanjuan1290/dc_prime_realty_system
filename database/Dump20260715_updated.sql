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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_seller_lot_project_rates`
--

LOCK TABLES `accredited_seller_lot_project_rates` WRITE;
/*!40000 ALTER TABLE `accredited_seller_lot_project_rates` DISABLE KEYS */;
INSERT INTO `accredited_seller_lot_project_rates` VALUES (1,1,1,8.00,'active','2026-07-13 13:48:27','2026-07-13 13:48:27'),(3,2,1,7.00,'active','2026-07-13 13:49:50','2026-07-13 13:49:50'),(4,3,1,6.00,'active','2026-07-13 14:00:48','2026-07-13 14:00:57'),(6,5,1,5.00,'active','2026-07-13 14:01:35','2026-07-13 17:03:18');
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_seller_managed_sellers`
--

LOCK TABLES `accredited_seller_managed_sellers` WRITE;
/*!40000 ALTER TABLE `accredited_seller_managed_sellers` DISABLE KEYS */;
INSERT INTO `accredited_seller_managed_sellers` VALUES (1,1,2,'2026-07-13 13:49:50','2026-07-13 13:49:50'),(3,2,3,'2026-07-13 14:00:57','2026-07-13 14:00:57'),(7,3,5,'2026-07-13 17:03:18','2026-07-13 17:03:18');
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
  `accredited_seller_accreditation_date` date DEFAULT NULL,
  `accredited_seller_status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `accredited_seller_created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accredited_seller_updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`accredited_seller_id`),
  UNIQUE KEY `uq_accredited_seller_user` (`user_id`),
  KEY `fk_accredited_seller_group` (`seller_group_id`),
  KEY `fk_accredited_seller_reports_under_user` (`accredited_seller_reports_under_user_id`),
  CONSTRAINT `fk_accredited_seller_group` FOREIGN KEY (`seller_group_id`) REFERENCES `seller_groups` (`seller_group_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_reports_under_user` FOREIGN KEY (`accredited_seller_reports_under_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_accredited_seller_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accredited_sellers`
--

LOCK TABLES `accredited_sellers` WRITE;
/*!40000 ALTER TABLE `accredited_sellers` DISABLE KEYS */;
INSERT INTO `accredited_sellers` VALUES (1,2,1,NULL,'2026-07-13','active','2026-07-13 13:48:27','2026-07-13 13:48:27'),(2,3,1,2,'2026-07-13','active','2026-07-13 13:49:50','2026-07-13 13:49:50'),(3,4,1,3,'2026-07-13','active','2026-07-13 14:00:48','2026-07-13 14:00:48'),(5,5,1,4,'2026-07-13','active','2026-07-13 14:01:35','2026-07-13 14:10:20');
/*!40000 ALTER TABLE `accredited_sellers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log_deletion_verifications`
--

DROP TABLE IF EXISTS `audit_log_deletion_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log_deletion_verifications` (
  `audit_log_deletion_verification_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `code_hash` char(64) NOT NULL,
  `status` enum('pending','used','expired','locked') NOT NULL DEFAULT 'pending',
  `attempt_count` tinyint unsigned NOT NULL DEFAULT '0',
  `max_attempts` tinyint unsigned NOT NULL DEFAULT '5',
  `expires_at` datetime NOT NULL,
  `verified_at` datetime DEFAULT NULL,
  `request_ip` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_log_deletion_verification_id`),
  KEY `idx_audit_delete_verification_user` (`user_id`),
  KEY `idx_audit_delete_verification_status` (`status`,`expires_at`),
  CONSTRAINT `fk_audit_delete_verification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log_deletion_verifications`
--

LOCK TABLES `audit_log_deletion_verifications` WRITE;
/*!40000 ALTER TABLE `audit_log_deletion_verifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log_deletion_verifications` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Projects','lot_project','1','Bailen Project','Created lot project','Created lot project Bailen Project.','{\"slug\": \"bailen-project\", \"status\": \"active\", \"locationCode\": \"LA\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 13:32:40'),(2,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Projects','lot_project','1','Bailen Project','Updated lot project','Updated lot project Bailen Project.','{\"slug\": \"bailen-project\", \"status\": \"active\", \"locationCode\": \"LA\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 13:32:52'),(3,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Seller Groups','seller_group','1','North Star Group','Created seller group','Created seller group North Star Group.','{\"status\": \"active\", \"projectRates\": [{\"lot_project_id\": 1, \"seller_group_pool_rate\": 8}]}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 13:48:07'),(4,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','2','ROWENA CORTEZ','Created user account','Created account for ROWENA CORTEZ (rrcsanjuan@pcu.edu.ph).','{\"role\": \"broker_network_manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 13:48:27'),(5,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','1','ROWENA CORTEZ','Accredited seller','Accredited ROWENA CORTEZ as broker_network_manager.','{\"role\": \"broker_network_manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 13:48:27'),(6,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','3','Broker1 NorthStar','Created user account','Created account for Broker1 NorthStar (Broker1NorthStar@gmail.com).','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 13:49:50'),(7,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','2','Broker1 NorthStar','Accredited seller','Accredited Broker1 NorthStar as broker.','{\"role\": \"broker\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"2\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 13:49:50'),(8,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','4','Manager1 NorthStar','Created user account','Created account for Manager1 NorthStar (Manager1NorthStar@gmail.com).','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:00:48'),(9,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','3','Manager1 NorthStar','Accredited seller','Accredited Manager1 NorthStar as manager.','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:00:48'),(10,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Users','user','4','Manager1 NorthStar','Updated user account','Updated account for Manager1 NorthStar (Manager1NorthStar@gmail.com).','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:00:57'),(11,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Accreditation','accredited_seller','3','Manager1 NorthStar','Updated accreditation','Updated accreditation for Manager1 NorthStar.','{\"role\": \"manager\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:00:57'),(12,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','5','Agent1 NorthStar','Created user account','Created account for Agent1 NorthStar (Agent1NorthStar@gmail.com).','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:01:35'),(13,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Accreditation','accredited_seller','5','Agent1 NorthStar','Accredited seller','Accredited Agent1 NorthStar as agent.','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"3\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:01:35'),(14,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Projects','lot_project','1','Bailen Project','Updated lot project','Updated lot project Bailen Project.','{\"slug\": \"bailen-project\", \"status\": \"active\", \"locationCode\": \"LA\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:03:51'),(15,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Added new listing','Added LA-0101 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0101\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:04:18'),(16,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Placed listing on hold','Placed LA-0101 on hold for rr.','{\"holdNote\": \"gggg\", \"clientName\": \"rr\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:04:51'),(17,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Removed listing hold','Returned LA-0101 to available status.','{\"previousHoldClientName\": \"rr\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:06:04'),(18,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Reservations','lot_project_listing','1','Unit LA-0101 — Diego MORENO George','Reserved listing for client','Reserved LA-0101 for Diego MORENO George.','{\"buyerName\": \"Diego MORENO George\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 1, \"assignedSellerId\": 5, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:10:00'),(19,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Users','user','5','Agent1 NorthStar','Updated user account','Updated account for Agent1 NorthStar (Agent1NorthStar@gmail.com).','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:10:20'),(20,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Accreditation','accredited_seller','5','Agent1 NorthStar','Updated accreditation','Updated accreditation for Agent1 NorthStar.','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:10:20'),(21,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Commissions','lot_project_listing','1','Unit LA-0101 — Bailen Project','Recalculated unit commission hierarchy','Recalculated the commission hierarchy for LA-0101 using Agent1 NorthStar\'s current reporting structure.','{\"after\": [{\"rate\": 3, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 4, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 22950, \"accreditedSellerId\": 5}, {\"rate\": 3, \"role\": \"manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Manager\", \"sellerName\": \"Manager1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 5, \"reportsUnder\": \"Broker1 NorthStar\", \"grossCommission\": 22950, \"accreditedSellerId\": 3}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 6, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 7, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"before\": [{\"rate\": 3, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 1, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 22950, \"accreditedSellerId\": 5}, {\"rate\": 4, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 2, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 30600, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 3, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"saleChannel\": \"distributed\", \"paymentPercent\": 0, \"assignedSellerName\": \"Agent1 NorthStar\", \"assignedAccreditedSellerId\": 5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 14:53:17'),(22,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Commissions','lot_project_listing','1','Unit LA-0101 — Bailen Project','Recalculated unit commission hierarchy','Recalculated the commission hierarchy for LA-0101 using Agent1 NorthStar\'s current reporting structure.','{\"after\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 8, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 9, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 10, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"before\": [{\"rate\": 3, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 4, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 22950, \"accreditedSellerId\": 5}, {\"rate\": 3, \"role\": \"manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Manager\", \"sellerName\": \"Manager1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 5, \"reportsUnder\": \"Broker1 NorthStar\", \"grossCommission\": 22950, \"accreditedSellerId\": 3}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 6, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 7, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"saleChannel\": \"distributed\", \"paymentPercent\": 0, \"assignedSellerName\": \"Agent1 NorthStar\", \"assignedAccreditedSellerId\": 5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:08:59'),(23,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Commissions','lot_project_listing','1','Unit LA-0101 — Bailen Project','Recalculated unit commission hierarchy','Recalculated the commission hierarchy for LA-0101 using Agent1 NorthStar\'s current reporting structure.','{\"after\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 11, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 12, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 13, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"before\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 8, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 9, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 10, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"saleChannel\": \"distributed\", \"paymentPercent\": 0, \"assignedSellerName\": \"Agent1 NorthStar\", \"assignedAccreditedSellerId\": 5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:19:33'),(24,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Commissions','lot_project_listing','1','Unit LA-0101 — Bailen Project','Recalculated unit commission hierarchy','Recalculated the commission hierarchy for LA-0101 using Agent1 NorthStar\'s current reporting structure.','{\"after\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 14, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 15, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 16, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"before\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 11, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 12, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 13, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"saleChannel\": \"distributed\", \"paymentPercent\": 0, \"assignedSellerName\": \"Agent1 NorthStar\", \"assignedAccreditedSellerId\": 5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:19:42'),(25,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Updated listing details','Updated LA-0101 in Bailen Project.','{\"unitCode\": \"LA-0101\", \"nextStatus\": \"sold\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": \"active\", \"previousStatus\": \"sold\", \"resetToAvailable\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:21:26'),(26,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-01011 — Bailen Project','Updated listing details','Updated LA-01011 in Bailen Project.','{\"unitCode\": \"LA-01011\", \"nextStatus\": \"sold\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": \"active\", \"previousStatus\": \"sold\", \"resetToAvailable\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:21:31'),(27,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Updated listing details','Updated LA-0101 in Bailen Project.','{\"unitCode\": \"LA-0101\", \"nextStatus\": \"sold\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": \"active\", \"previousStatus\": \"sold\", \"resetToAvailable\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:21:36'),(28,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Documents','lot_project_client_document','1','BUYER ACKNOWLEDGEMENT FORM — Diego MORENO George','Uploaded client document','Uploaded 1 image(s) for BUYER ACKNOWLEDGEMENT FORM of Diego MORENO George.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"documentId\": 11, \"totalImages\": 1, \"documentName\": \"BUYER ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:26:40'),(29,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Documents','lot_project_client_document','1','BUYER ACKNOWLEDGEMENT FORM — Diego MORENO George','Uploaded client document','Uploaded 1 image(s) for BUYER ACKNOWLEDGEMENT FORM of Diego MORENO George.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"documentId\": 11, \"totalImages\": 2, \"documentName\": \"BUYER ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:26:46'),(30,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0201 — Bailen Project','Updated listing details','Updated LA-0201 in Bailen Project.','{\"unitCode\": \"LA-0201\", \"nextStatus\": \"sold\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": \"active\", \"previousStatus\": \"sold\", \"resetToAvailable\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:27:39'),(31,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Documents','lot_project_client_document','2','BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM — Diego MORENO George','Uploaded client document','Uploaded 1 image(s) for BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM of Diego MORENO George.','{\"unitId\": \"LA-0201\", \"listingId\": 1, \"documentId\": 9, \"totalImages\": 1, \"documentName\": \"BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:28:03'),(32,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Documents','lot_project_client_document','1','BUYER ACKNOWLEDGEMENT FORM — Diego MORENO George','Uploaded client document','Uploaded 1 image(s) for BUYER ACKNOWLEDGEMENT FORM of Diego MORENO George.','{\"unitId\": \"LA-0201\", \"listingId\": 1, \"documentId\": 11, \"totalImages\": 1, \"documentName\": \"BUYER ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:58:28'),(33,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Updated listing details','Updated LA-0101 in Bailen Project.','{\"unitCode\": \"LA-0101\", \"nextStatus\": \"sold\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": \"active\", \"previousStatus\": \"sold\", \"previousUnitCode\": \"LA-0201\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 1, \"deletedFolders\": 3, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 1}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:59:10'),(34,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Documents','lot_project_client_document','2','BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM — Diego MORENO George','Uploaded client document','Uploaded 1 image(s) for BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM of Diego MORENO George.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"documentId\": 9, \"totalImages\": 1, \"documentName\": \"BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 15:59:39'),(35,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','1','CASH-20260713-LA0101-0001 — Diego MORENO George','Recorded SOA payment','Recorded Reservation payment for Diego MORENO George.','{\"amount\": 50000, \"unitId\": \"LA-0101\", \"listingId\": 1, \"clientName\": \"Diego MORENO George\", \"scheduleId\": 71, \"paymentDate\": \"2026-07-13\", \"paymentType\": \"reservation\", \"referenceId\": \"CASH-20260713-LA0101-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:30:57'),(36,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','2','iuyt77876yu — Diego MORENO George','Recorded SOA payment','Recorded Downpayment payment for Diego MORENO George.','{\"amount\": 126225, \"unitId\": \"LA-0101\", \"listingId\": 1, \"clientName\": \"Diego MORENO George\", \"scheduleId\": 72, \"paymentDate\": \"2026-07-13\", \"paymentType\": \"downpayment\", \"referenceId\": \"iuyt77876yu\", \"paymentMethod\": \"Bank Transfer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:31:12'),(37,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Users','user','6','kirs tel','Created user account','Created account for kirs tel (kirstel@gmail.com).','{\"role\": \"admin\", \"status\": \"active\", \"seller_group_id\": \"\", \"reports_under_user_id\": \"\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:32:38'),(38,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:32:39'),(39,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:34:14'),(40,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:42:32'),(41,6,'kirs tel','kirstel@gmail.com','admin','login','Authentication','user','6','kirs tel','User logged in','kirstel@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:42:39'),(42,6,'kirs tel','kirstel@gmail.com','admin','update','Users','user','6','kirs tel','Changed password','User changed their password after a reset requirement.','{\"previousMustChangePassword\": true}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:42:44'),(43,6,'kirs tel','kirstel@gmail.com','admin','create','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Added new listing','Added LA-0102 to Bailen Project.','{\"status\": \"available\", \"unitCode\": \"LA-0102\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:47:50'),(44,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Updated listing details','Updated LA-0101 in Bailen Project.','{\"unitCode\": \"LA-0101\", \"nextStatus\": \"sold\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 1}, \"soldSubstatus\": \"active\", \"previousStatus\": \"sold\", \"previousUnitCode\": \"LA-0101\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:48:22'),(45,6,'kirs tel','kirstel@gmail.com','admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 16:59:44'),(46,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:00:12'),(47,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Commissions','lot_project_listing','1','Unit LA-0101 — Bailen Project','Recalculated unit commission hierarchy','Recalculated the commission hierarchy for LA-0101 using Agent1 NorthStar\'s current reporting structure.','{\"after\": [{\"rate\": 5, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 17, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 38250, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Manager\", \"sellerName\": \"Manager1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 18, \"reportsUnder\": \"Broker1 NorthStar\", \"grossCommission\": 7650, \"accreditedSellerId\": 3}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 19, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 20, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"before\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 14, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 15, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 16, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"saleChannel\": \"distributed\", \"paymentPercent\": 20, \"assignedSellerName\": \"Agent1 NorthStar\", \"assignedAccreditedSellerId\": 5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:02:16'),(48,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Users','user','5','Agent1 NorthStar','Updated user account','Updated account for Agent1 NorthStar (Agent1NorthStar@gmail.com).','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:02:46'),(49,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Accreditation','accredited_seller','5','Agent1 NorthStar','Updated accreditation','Updated accreditation for Agent1 NorthStar.','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:02:46'),(50,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Commissions','lot_project_listing','1','Unit LA-0101 — Bailen Project','Recalculated unit commission hierarchy','Recalculated the commission hierarchy for LA-0101 using Agent1 NorthStar\'s current reporting structure.','{\"after\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 21, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 22, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 23, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"before\": [{\"rate\": 5, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 17, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 38250, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Manager\", \"sellerName\": \"Manager1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 18, \"reportsUnder\": \"Broker1 NorthStar\", \"grossCommission\": 7650, \"accreditedSellerId\": 3}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 19, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 20, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"saleChannel\": \"distributed\", \"paymentPercent\": 20, \"assignedSellerName\": \"Agent1 NorthStar\", \"assignedAccreditedSellerId\": 5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:02:58'),(51,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Users','user','5','Agent1 NorthStar','Updated user account','Updated account for Agent1 NorthStar (Agent1NorthStar@gmail.com).','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:03:18'),(52,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Accreditation','accredited_seller','5','Agent1 NorthStar','Updated accreditation','Updated accreditation for Agent1 NorthStar.','{\"role\": \"agent\", \"status\": \"active\", \"seller_group_id\": \"1\", \"reports_under_user_id\": \"4\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:03:18'),(53,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Commissions','lot_project_listing','1','Unit LA-0101 — Bailen Project','Recalculated unit commission hierarchy','Recalculated the commission hierarchy for LA-0101 using Agent1 NorthStar\'s current reporting structure.','{\"after\": [{\"rate\": 5, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 24, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 38250, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Manager\", \"sellerName\": \"Manager1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 25, \"reportsUnder\": \"Broker1 NorthStar\", \"grossCommission\": 7650, \"accreditedSellerId\": 3}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 26, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 27, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"before\": [{\"rate\": 6, \"role\": \"agent\", \"saleType\": \"distributed\", \"roleLabel\": \"Agent\", \"sellerName\": \"Agent1 NorthStar\", \"sellerType\": \"selling_agent\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 21, \"reportsUnder\": \"Manager1 NorthStar\", \"grossCommission\": 45900, \"accreditedSellerId\": 5}, {\"rate\": 1, \"role\": \"broker\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker\", \"sellerName\": \"Broker1 NorthStar\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 22, \"reportsUnder\": \"ROWENA MORENO CORTEZ\", \"grossCommission\": 7650, \"accreditedSellerId\": 2}, {\"rate\": 1, \"role\": \"broker_network_manager\", \"saleType\": \"distributed\", \"roleLabel\": \"Broker Network Manager\", \"sellerName\": \"ROWENA MORENO CORTEZ\", \"sellerType\": \"hierarchy_seller\", \"sellerGroup\": \"North Star Group\", \"commissionId\": 23, \"reportsUnder\": \"-\", \"grossCommission\": 7650, \"accreditedSellerId\": 1}], \"saleChannel\": \"distributed\", \"paymentPercent\": 20, \"assignedSellerName\": \"Agent1 NorthStar\", \"assignedAccreditedSellerId\": 5}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:03:29'),(54,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:04:00'),(55,6,'kirs tel','kirstel@gmail.com','admin','login','Authentication','user','6','kirs tel','User logged in','kirstel@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:04:07'),(56,6,'kirs tel','kirstel@gmail.com','admin','create','Documents','lot_project_client_document','3','BUYER\'S INFORMATION FORM — Diego MORENO George','Uploaded client document','Uploaded 1 image(s) for BUYER\'S INFORMATION FORM of Diego MORENO George.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"documentId\": 3, \"totalImages\": 1, \"documentName\": \"BUYER\'S INFORMATION FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:25:29'),(57,6,'kirs tel','kirstel@gmail.com','admin','create','Documents','lot_project_client_document','4','CLIENT REGISTRATION FORM (Administrator Copy) — Diego MORENO George','Uploaded client document','Uploaded 3 image(s) for CLIENT REGISTRATION FORM (Administrator Copy) of Diego MORENO George.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"documentId\": 2, \"totalImages\": 3, \"documentName\": \"CLIENT REGISTRATION FORM (Administrator Copy)\", \"uploadedCount\": 3, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:26:29'),(58,6,'kirs tel','kirstel@gmail.com','admin','create','Documents','lot_project_client_document','1','BUYER ACKNOWLEDGEMENT FORM — Diego MORENO George','Uploaded client document','Uploaded 3 image(s) for BUYER ACKNOWLEDGEMENT FORM of Diego MORENO George.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"documentId\": 11, \"totalImages\": 3, \"documentName\": \"BUYER ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 3, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:34:22'),(59,6,'kirs tel','kirstel@gmail.com','admin','create','Documents','lot_project_client_document','2','BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM — Diego MORENO George','Uploaded client document','Uploaded 1 image(s) for BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM of Diego MORENO George.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"documentId\": 9, \"totalImages\": 1, \"documentName\": \"BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM\", \"uploadedCount\": 1, \"clientProfileId\": 1}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:34:47'),(60,6,'kirs tel','kirstel@gmail.com','admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:51:25'),(61,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-13 17:53:29'),(62,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 06:56:01'),(63,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Buyer Forms','lot_project_buyer_form_link','1','Unit LA-0102 — Bailen Project','Generated buyer form link','Generated a new buyer form link for LA-0102.','{\"listingId\": 2, \"generation\": 1, \"expiresHours\": 24, \"recipientEmail\": \"rrcsanjuan@pcu.edu.ph\", \"recipientMobileNumber\": \"09057557640\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 09:46:19'),(64,NULL,'Robert Renby Cortez San Juan','rrcsanjuan@pcu.edu.ph','public_buyer','create','Buyer Forms','lot_project_buyer_form_submission','1','Unit LA-0102 — Robert Renby Cortez San Juan','Buyer submitted information form','Robert Renby Cortez San Juan submitted buyer information for LA-0102.','{\"linkId\": 1, \"buyerType\": \"and_account\", \"listingId\": 2}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 09:49:07'),(65,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Reservations','lot_project_listing','2','Unit LA-0102 — Robert Renby Cortez San Juan','Reserved listing for client','Reserved LA-0102 for Robert Renby Cortez San Juan.','{\"buyerName\": \"Robert Renby Cortez San Juan\", \"buyerType\": \"and_account\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 2, \"assignedSellerId\": 1, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": 1, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:04:30'),(66,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:05:27'),(67,6,'kirs tel','kirstel@gmail.com','admin','login','Authentication','user','6','kirs tel','User logged in','kirstel@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:05:36'),(68,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"sold\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": true, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:05:49'),(69,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"pending_for_cancellation\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"available\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:06:05'),(70,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"cancelled\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"pending_for_cancellation\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:06:07'),(71,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"cancelled\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": true, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:06:12'),(72,6,'kirs tel','kirstel@gmail.com','admin','create','Buyer Forms','lot_project_buyer_form_link','2','Unit LA-0102 — Bailen Project','Generated buyer form link','Generated a new buyer form link for LA-0102.','{\"listingId\": 2, \"generation\": 6, \"expiresHours\": 72, \"recipientEmail\": \"rrcsanjuan@pcu.edu.ph\", \"recipientMobileNumber\": \"09057557640\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:08:21'),(73,NULL,'ROWENA MORENO CORTEZ',NULL,'public_buyer','create','Buyer Forms','lot_project_buyer_form_submission','2','Unit LA-0102 — ROWENA MORENO CORTEZ','Buyer submitted information form','ROWENA MORENO CORTEZ submitted buyer information for LA-0102.','{\"linkId\": 2, \"buyerType\": \"single\", \"listingId\": 2}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:08:45'),(74,6,'kirs tel','kirstel@gmail.com','admin','create','Reservations','lot_project_listing','2','Unit LA-0102 — ROWENA MORENO CORTEZ','Reserved listing for client','Reserved LA-0102 for ROWENA MORENO CORTEZ.','{\"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 3, \"assignedSellerId\": 1, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": 2, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:09:12'),(75,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"pending_for_cancellation\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"sold\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:19:59'),(76,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"cancelled\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"pending_for_cancellation\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": \"settle_cancellation\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:20:07'),(77,6,'kirs tel','kirstel@gmail.com','admin','update','Listings','lot_project_listing','2','Unit LA-0102 — Bailen Project','Updated listing details','Updated LA-0102 in Bailen Project.','{\"unitCode\": \"LA-0102\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"cancelled\", \"previousUnitCode\": \"LA-0102\", \"resetToAvailable\": true, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": \"reset_to_available\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:20:13'),(78,6,'kirs tel','kirstel@gmail.com','admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:28:48'),(79,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:28:56'),(80,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Payments','lot_project_payment','3','CASH-20260715-LA0101-0001 — Diego MORENO George','Recorded SOA payment','Recorded Monthly payment for Diego MORENO George.','{\"amount\": 55439.58, \"unitId\": \"LA-0101\", \"listingId\": 1, \"clientName\": \"Diego MORENO George\", \"scheduleId\": 73, \"paymentDate\": \"2026-07-15\", \"paymentType\": \"monthly_amortization\", \"referenceId\": \"CASH-20260715-LA0101-0001\", \"paymentMethod\": \"Cash\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:32:51'),(81,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Updated listing details','Updated LA-0101 in Bailen Project.','{\"unitCode\": \"LA-0101\", \"nextStatus\": \"pending_for_cancellation\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 1}, \"soldSubstatus\": null, \"previousStatus\": \"sold\", \"previousUnitCode\": \"LA-0101\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:33:25'),(82,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','1','Unit LA-0101 — Bailen Project','Updated listing details','Updated LA-0101 in Bailen Project.','{\"unitCode\": \"LA-0101\", \"nextStatus\": \"cancelled\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 1}, \"soldSubstatus\": null, \"previousStatus\": \"pending_for_cancellation\", \"previousUnitCode\": \"LA-0101\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": \"settle_cancellation\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:33:37'),(83,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Projects','lot_project','2','maragondon project','Created lot project','Created lot project maragondon project.','{\"slug\": \"maragondon-project\", \"status\": \"active\", \"locationCode\": \"PE\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:39:04'),(84,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Listings','lot_project_listing','3','Unit PE-1212 — maragondon project','Added new listing','Added PE-1212 to maragondon project.','{\"status\": \"available\", \"unitCode\": \"PE-1212\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:39:16'),(85,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Seller Groups','seller_group','1','North Star Group','Updated seller group','Updated seller group North Star Group.','{\"status\": \"active\", \"projectRates\": [{\"lot_project_id\": 1, \"seller_group_pool_rate\": 8}, {\"lot_project_id\": 2, \"seller_group_pool_rate\": 8}]}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:40:15'),(86,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Reservations','lot_project_listing','3','Unit PE-1212 — ROWENA MORENO CORTEZ','Reserved listing for client','Reserved PE-1212 for ROWENA MORENO CORTEZ.','{\"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"saleChannel\": \"distributed\", \"modeOfPayment\": \"installment\", \"clientProfileId\": 5, \"assignedSellerId\": 1, \"dailyPenaltyRate\": 0.1, \"penaltyGraceDays\": 1, \"buyerFormSubmissionId\": null, \"penaltyCalculationMethod\": \"daily\", \"reservationFeeAppliedToDownpayment\": false}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:40:28'),(87,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Project Settings','lot_project_settings','1','Bailen Project','Updated project release settings','Super updated release settings for Bailen Project.','{\"companyName\": \"D&C Prime Realty\", \"companyEmail\": \"dcprimerealty@gmail.com\", \"releaseDayOne\": 7, \"releaseDayTwo\": 15, \"companyContactNumber\": \"(046) 866-0616\", \"reservationContactName\": \"D&C Prime Realty\", \"reservationContactEmail\": \"dcprimerealty@gmail.com\", \"reservationContactNumber\": \"0912-345-6789\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:42:30'),(88,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','27','ROWENA MORENO CORTEZ — ₱1,530.00','Released commission','Released 1st Release commission for ROWENA MORENO CORTEZ.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"releaseId\": 131, \"clientName\": \"Diego MORENO George\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 1530}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:42:35'),(89,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','26','Broker1 NorthStar — ₱1,530.00','Released commission','Released 1st Release commission for Broker1 NorthStar.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"releaseId\": 126, \"clientName\": \"Diego MORENO George\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 1530}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:42:39'),(90,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','25','Manager1 NorthStar — ₱1,530.00','Released commission','Released 1st Release commission for Manager1 NorthStar.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"releaseId\": 121, \"clientName\": \"Diego MORENO George\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 1530}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:42:42'),(91,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','release','Commissions','lot_project_commission','24','Agent1 NorthStar — ₱7,650.00','Released commission','Released 1st Release commission for Agent1 NorthStar.','{\"unitId\": \"LA-0101\", \"listingId\": 1, \"releaseId\": 116, \"clientName\": \"Diego MORENO George\", \"releaseStage\": \"1st Release\", \"releaseAmount\": 7650}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:42:45'),(92,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Commissions','lot_project_commission_receipt','1','Agent1 NorthStar — LA-0101','Generated seller proof of income receipt','Generated a 7650.00 proof of income receipt from 1 released commission stage(s).','{\"sellerId\": 5, \"releaseIds\": [116], \"totalAmount\": 7650, \"commissionId\": 24, \"referenceNumber\": \"21312\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:43:16'),(93,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','3','Unit PE-1212 — maragondon project','Updated listing details','Updated PE-1212 in maragondon project.','{\"unitCode\": \"PE-1212\", \"nextStatus\": \"pending_for_cancellation\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"sold\", \"previousUnitCode\": \"PE-1212\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 12:07:23'),(94,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','3','Unit PE-1212 — maragondon project','Updated listing details','Updated PE-1212 in maragondon project.','{\"unitCode\": \"PE-1212\", \"nextStatus\": \"cancelled\", \"soaSyncResult\": {\"synced\": 1, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"pending_for_cancellation\", \"previousUnitCode\": \"PE-1212\", \"resetToAvailable\": false, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": \"settle_cancellation\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 12:07:26'),(95,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Listings','lot_project_listing','3','Unit PE-1212 — maragondon project','Updated listing details','Updated PE-1212 in maragondon project.','{\"unitCode\": \"PE-1212\", \"nextStatus\": \"available\", \"soaSyncResult\": {\"synced\": 0, \"skipped\": 0}, \"soldSubstatus\": null, \"previousStatus\": \"cancelled\", \"previousUnitCode\": \"PE-1212\", \"resetToAvailable\": true, \"cloudinarySyncResult\": {\"movedAssets\": 0, \"deletedFolders\": 0, \"cleanupWarnings\": [], \"repairedMetadata\": 0, \"updatedDocumentRows\": 0}, \"statusTransitionAction\": \"reset_to_available\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 12:07:28'),(96,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Projects','lot_project','2','maragondon project','Updated lot project','Updated lot project maragondon project.','{\"slug\": \"maragondon-project\", \"status\": \"active\", \"locationCode\": \"PE\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 12:07:48'),(97,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','logout','Authentication',NULL,NULL,NULL,'User logged out','User ended the current session.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 12:10:43'),(98,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','login','Authentication','user','1','Super Admin','User logged in','robertrenbysanjuan@gmail.com logged in successfully.',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 12:10:54'),(99,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','update','Projects','lot_project','1','Bailen Project','Updated lot project','Updated lot project Bailen Project.','{\"slug\": \"bailen-project\", \"status\": \"active\", \"locationCode\": \"LA\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 12:58:14'),(100,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Projects','lot_project','3','Prime Enclave','Created lot project','Created lot project Prime Enclave.','{\"slug\": \"prime-enclave\", \"status\": \"active\", \"locationCode\": \"PE\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 13:04:30'),(101,1,'Super Admin','robertrenbysanjuan@gmail.com','super_admin','create','Listings','lot_project_listing','4','Unit PE-0101 — Prime Enclave','Added new listing','Added PE-0101 to Prime Enclave.','{\"status\": \"available\", \"unitCode\": \"PE-0101\", \"soldSubstatus\": null}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 13:05:49');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
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
INSERT INTO `document_templates` VALUES (1,'DEFAULT LIST DOCUMENTS',NULL,'active','2026-07-13 13:41:15','2026-07-13 13:41:15'),(2,'FOR OFW\'S',NULL,'active','2026-07-13 13:41:53','2026-07-13 13:41:53'),(3,'REQUIRED FOR SUBMISSION (DEFAULT)',NULL,'active','2026-07-13 13:45:11','2026-07-13 13:46:08'),(4,'REQUIRED FOR SUBMISSION (For Married Client\'s)',NULL,'active','2026-07-13 13:46:01','2026-07-13 13:46:01'),(5,'REQUIRED FOR SUBMISSION (For OFW\'s or Representative)',NULL,'active','2026-07-13 13:46:36','2026-07-13 13:46:36');
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
INSERT INTO `documents` VALUES (1,'CLIENT REGISTRATION FORM (Seller\'s Copy)',NULL,1,1,'active','2026-07-13 13:35:46','2026-07-13 13:35:46'),(2,'CLIENT REGISTRATION FORM (Administrator Copy)',NULL,1,1,'active','2026-07-13 13:36:01','2026-07-13 13:36:01'),(3,'BUYER\'S INFORMATION FORM',NULL,1,1,'active','2026-07-13 13:36:15','2026-07-13 13:36:15'),(4,'INTENT TO BUY',NULL,1,1,'active','2026-07-13 13:36:28','2026-07-13 13:36:28'),(5,'OFFER TO BUY & BUYER\'S PROFILE',NULL,1,1,'active','2026-07-13 13:36:40','2026-07-13 13:36:40'),(6,'RESERVATION AGREEMENT',NULL,1,1,'active','2026-07-13 13:36:46','2026-07-13 13:36:46'),(7,'DEED OF SALE',NULL,1,1,'active','2026-07-13 13:36:51','2026-07-13 13:36:51'),(8,'CONTRACT TO SELL',NULL,1,1,'active','2026-07-13 13:36:55','2026-07-13 13:36:55'),(9,'BUYER COUNSELLING AND ACKNOWLEDGEMENT FORM',NULL,1,1,'active','2026-07-13 13:37:05','2026-07-13 13:37:05'),(10,'VOLUNTARY CANCELLATION AND WAIVER OF RIGHTS',NULL,1,1,'active','2026-07-13 13:37:14','2026-07-13 13:37:21'),(11,'BUYER ACKNOWLEDGEMENT FORM',NULL,1,1,'active','2026-07-13 13:37:33','2026-07-13 13:37:33'),(12,'SPA to Process Title (for Company)',NULL,1,1,'active','2026-07-13 13:37:53','2026-07-13 13:37:53'),(13,'SPA Authorization to Sign (for Representative)',NULL,1,1,'active','2026-07-13 13:38:02','2026-07-13 13:38:02'),(14,'Two valid Government-Issued ID\'s (w/ 3 specimen signatures)',NULL,1,1,'active','2026-07-13 13:38:23','2026-07-13 13:38:23'),(15,'TIN No. / TIN ID',NULL,1,1,'active','2026-07-13 13:38:29','2026-07-13 13:38:29'),(16,'PSA (Single)',NULL,1,1,'active','2026-07-13 13:38:37','2026-07-13 13:38:37'),(17,'Marriage Certificate',NULL,1,1,'active','2026-07-13 13:38:46','2026-07-13 13:38:46'),(18,'Valid ID of Spouse (w/ 3 specimen signature)',NULL,1,1,'active','2026-07-13 13:39:05','2026-07-13 13:39:05'),(19,'Spouse\'s Signature (when required)',NULL,1,1,'active','2026-07-13 13:39:17','2026-07-13 13:39:17'),(20,'CENOMAR (if the buyer has kids but not married)',NULL,1,1,'active','2026-07-13 13:39:40','2026-07-13 13:39:40'),(21,'Passport ID',NULL,1,1,'active','2026-07-13 13:39:51','2026-07-13 13:39:51'),(22,'Valid ID\'s of both Principal and Representative',NULL,1,1,'active','2026-07-13 13:40:02','2026-07-13 13:40:02');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_buyer_form_links`
--

LOCK TABLES `lot_project_buyer_form_links` WRITE;
/*!40000 ALTER TABLE `lot_project_buyer_form_links` DISABLE KEYS */;
INSERT INTO `lot_project_buyer_form_links` VALUES (1,1,2,'1950392cd367e7d4c6067e0d679000dca8c3a85f38d34d7acde51fe32ba3b72d',1,'consumed','2026-07-16 09:46:19',1,'2026-07-15 09:46:19','2026-07-15 09:46:42','2026-07-15 09:46:50','2026-07-15 09:49:07',NULL,'2026-07-15 10:04:30','rrcsanjuan@pcu.edu.ph','09057557640','2026-07-15 09:46:19','2026-07-15 10:04:30'),(2,1,2,'b11b6b2eb3dd6e64c3114efdf4786e3d65142f728036aac537be84020e215004',6,'consumed','2026-07-18 10:08:21',6,'2026-07-15 10:08:21','2026-07-15 10:08:26','2026-07-15 10:08:26','2026-07-15 10:08:45',NULL,'2026-07-15 10:09:12','rrcsanjuan@pcu.edu.ph','09057557640','2026-07-15 10:08:21','2026-07-15 10:09:12');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_buyer_form_submissions`
--

LOCK TABLES `lot_project_buyer_form_submissions` WRITE;
/*!40000 ALTER TABLE `lot_project_buyer_form_submissions` DISABLE KEYS */;
INSERT INTO `lot_project_buyer_form_submissions` VALUES (1,1,1,2,'archived','Robert Renby Cortez San Juan','rrcsanjuan@pcu.edu.ph','09057557640','and_account','{\"tin\": \"\", \"email\": \"rrcsanjuan@pcu.edu.ph\", \"gender\": \"Male\", \"birthDate\": \"2005-01-18\", \"buyerName\": \"Robert Renby Cortez San Juan\", \"buyerType\": \"and_account\", \"contactNo\": \"09057557640\", \"buyerSuffix\": \"\", \"citizenship\": \"Filipino\", \"civilStatus\": \"Single\", \"placeOfBirth\": \"Imus\", \"buyerLastName\": \"San Juan\", \"monthlyIncome\": \"45000\", \"buyerFirstName\": \"Robert Renby\", \"presentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"presentZipCode\": \"4107\", \"secondBuyerTin\": \"\", \"buyerMiddleName\": \"Cortez\", \"employerZipCode\": \"test\", \"secondBuyerName\": \"Nick Ryan Cortez San Juan\", \"secondBuyerRole\": \"second_buyer\", \"employmentStatus\": \"Employed - Private\", \"permanentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"permanentZipCode\": \"4107\", \"secondBuyerEmail\": \"\", \"secondBuyerGender\": \"Male\", \"secondBuyerSuffix\": \"\", \"secondBuyerLastName\": \"San Juan\", \"employerBusinessName\": \"test\", \"natureOfWorkBusiness\": \"test\", \"residencePhoneNumber\": \"\", \"secondBuyerBirthDate\": \"2002-03-07\", \"secondBuyerContactNo\": \"09278965570\", \"secondBuyerFirstName\": \"Nick Ryan\", \"secondBuyerMiddleName\": \"Cortez\", \"secondBuyerCitizenship\": \"Filipino\", \"secondBuyerCivilStatus\": \"Single\", \"employerBusinessAddress\": \"test\", \"occupationPositionTitle\": \"test\", \"secondBuyerPlaceOfBirth\": \"hongkong\", \"secondBuyerMonthlyIncome\": \"80000\", \"secondBuyerPresentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"secondBuyerPresentZipCode\": \"4107\", \"secondBuyerEmployerZipCode\": \"test\", \"secondBuyerEmploymentStatus\": \"Employed - Private\", \"secondBuyerPermanentAddress\": \"\", \"secondBuyerPermanentZipCode\": \"\", \"secondBuyerEmployerBusinessName\": \"test\", \"secondBuyerNatureOfWorkBusiness\": \"test\", \"secondBuyerResidencePhoneNumber\": \"\", \"secondBuyerEmployerBusinessAddress\": \"test\", \"secondBuyerOccupationPositionTitle\": \"test\"}','{\"tin\": \"\", \"email\": \"rrcsanjuan@pcu.edu.ph\", \"gender\": \"Male\", \"birthDate\": \"2005-01-18\", \"buyerName\": \"Robert Renby Cortez San Juan\", \"buyerType\": \"and_account\", \"contactNo\": \"09057557640\", \"buyerSuffix\": \"\", \"citizenship\": \"Filipino\", \"civilStatus\": \"Single\", \"computedAge\": \"-\", \"placeOfBirth\": \"Imus\", \"buyerLastName\": \"San Juan\", \"monthlyIncome\": \"45000\", \"profileStatus\": \"complete\", \"buyerFirstName\": \"Robert Renby\", \"presentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"presentZipCode\": \"4107\", \"secondBuyerTin\": \"\", \"buyerMiddleName\": \"Cortez\", \"employerZipCode\": \"test\", \"secondBuyerName\": \"Nick Ryan Cortez San Juan\", \"secondBuyerRole\": \"second_buyer\", \"employmentStatus\": \"Employed - Private\", \"permanentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"permanentZipCode\": \"4107\", \"secondBuyerEmail\": \"\", \"secondBuyerGender\": \"Male\", \"secondBuyerSuffix\": \"\", \"secondBuyerLastName\": \"San Juan\", \"employerBusinessName\": \"test\", \"natureOfWorkBusiness\": \"test\", \"residencePhoneNumber\": \"\", \"secondBuyerBirthDate\": \"2002-03-07\", \"secondBuyerContactNo\": \"09278965570\", \"secondBuyerFirstName\": \"Nick Ryan\", \"secondBuyerMiddleName\": \"Cortez\", \"secondBuyerCitizenship\": \"Filipino\", \"secondBuyerCivilStatus\": \"Single\", \"secondBuyerComputedAge\": \"-\", \"employerBusinessAddress\": \"test\", \"occupationPositionTitle\": \"test\", \"secondBuyerPlaceOfBirth\": \"hongkong\", \"secondBuyerMonthlyIncome\": \"80000\", \"secondBuyerPresentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"secondBuyerPresentZipCode\": \"4107\", \"secondBuyerEmployerZipCode\": \"test\", \"secondBuyerEmploymentStatus\": \"Employed - Private\", \"secondBuyerPermanentAddress\": \"\", \"secondBuyerPermanentZipCode\": \"\", \"secondBuyerEmployerBusinessName\": \"test\", \"secondBuyerNatureOfWorkBusiness\": \"test\", \"secondBuyerResidencePhoneNumber\": \"\", \"secondBuyerEmployerBusinessAddress\": \"test\", \"secondBuyerOccupationPositionTitle\": \"test\"}','2026-07-15 09:49:07','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 09:49:07',1,'2026-07-15 10:04:30','2026-07-15 10:04:30',NULL,NULL,'2026-07-15 09:49:07','2026-07-15 10:20:13'),(2,2,1,2,'archived','ROWENA MORENO CORTEZ',NULL,'09278965570','single','{\"tin\": \"\", \"email\": \"\", \"gender\": \"Male\", \"birthDate\": \"2002-11-11\", \"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"contactNo\": \"09278965570\", \"buyerSuffix\": \"\", \"citizenship\": \"test\", \"civilStatus\": \"Single\", \"placeOfBirth\": \"test\", \"buyerLastName\": \"CORTEZ\", \"monthlyIncome\": \"434343\", \"buyerFirstName\": \"ROWENA\", \"presentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"presentZipCode\": \"4343\", \"secondBuyerTin\": \"\", \"buyerMiddleName\": \"MORENO\", \"employerZipCode\": \"\", \"secondBuyerName\": \"\", \"secondBuyerRole\": \"spouse\", \"employmentStatus\": \"Employed - Private\", \"permanentAddress\": \"\", \"permanentZipCode\": \"\", \"secondBuyerEmail\": \"\", \"secondBuyerGender\": \"\", \"secondBuyerSuffix\": \"\", \"secondBuyerLastName\": \"\", \"employerBusinessName\": \"\", \"natureOfWorkBusiness\": \"\", \"residencePhoneNumber\": \"\", \"secondBuyerBirthDate\": \"\", \"secondBuyerContactNo\": \"\", \"secondBuyerFirstName\": \"\", \"secondBuyerMiddleName\": \"\", \"secondBuyerCitizenship\": \"\", \"secondBuyerCivilStatus\": \"\", \"employerBusinessAddress\": \"\", \"occupationPositionTitle\": \"\", \"secondBuyerPlaceOfBirth\": \"\", \"secondBuyerMonthlyIncome\": \"\", \"secondBuyerPresentAddress\": \"\", \"secondBuyerPresentZipCode\": \"\", \"secondBuyerEmployerZipCode\": \"\", \"secondBuyerEmploymentStatus\": \"\", \"secondBuyerPermanentAddress\": \"\", \"secondBuyerPermanentZipCode\": \"\", \"secondBuyerEmployerBusinessName\": \"\", \"secondBuyerNatureOfWorkBusiness\": \"\", \"secondBuyerResidencePhoneNumber\": \"\", \"secondBuyerEmployerBusinessAddress\": \"\", \"secondBuyerOccupationPositionTitle\": \"\"}','{\"tin\": \"\", \"email\": \"\", \"gender\": \"Male\", \"birthDate\": \"2002-11-11\", \"buyerName\": \"ROWENA MORENO CORTEZ\", \"buyerType\": \"single\", \"contactNo\": \"09278965570\", \"buyerSuffix\": \"\", \"citizenship\": \"test\", \"civilStatus\": \"Single\", \"computedAge\": \"-\", \"placeOfBirth\": \"test\", \"buyerLastName\": \"CORTEZ\", \"monthlyIncome\": \"434343\", \"profileStatus\": \"complete\", \"buyerFirstName\": \"ROWENA\", \"presentAddress\": \"b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite\", \"presentZipCode\": \"4343\", \"secondBuyerTin\": \"\", \"buyerMiddleName\": \"MORENO\", \"employerZipCode\": \"\", \"secondBuyerName\": \"\", \"secondBuyerRole\": \"spouse\", \"employmentStatus\": \"Employed - Private\", \"permanentAddress\": \"\", \"permanentZipCode\": \"\", \"secondBuyerEmail\": \"\", \"secondBuyerGender\": \"\", \"secondBuyerSuffix\": \"\", \"secondBuyerLastName\": \"\", \"employerBusinessName\": \"\", \"natureOfWorkBusiness\": \"\", \"residencePhoneNumber\": \"\", \"secondBuyerBirthDate\": \"\", \"secondBuyerContactNo\": \"\", \"secondBuyerFirstName\": \"\", \"secondBuyerMiddleName\": \"\", \"secondBuyerCitizenship\": \"\", \"secondBuyerCivilStatus\": \"\", \"secondBuyerComputedAge\": \"-\", \"employerBusinessAddress\": \"\", \"occupationPositionTitle\": \"\", \"secondBuyerPlaceOfBirth\": \"\", \"secondBuyerMonthlyIncome\": \"\", \"secondBuyerPresentAddress\": \"\", \"secondBuyerPresentZipCode\": \"\", \"secondBuyerEmployerZipCode\": \"\", \"secondBuyerEmploymentStatus\": \"\", \"secondBuyerPermanentAddress\": \"\", \"secondBuyerPermanentZipCode\": \"\", \"secondBuyerEmployerBusinessName\": \"\", \"secondBuyerNatureOfWorkBusiness\": \"\", \"secondBuyerResidencePhoneNumber\": \"\", \"secondBuyerEmployerBusinessAddress\": \"\", \"secondBuyerOccupationPositionTitle\": \"\"}','2026-07-15 10:08:45','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-07-15 10:08:45',6,'2026-07-15 10:09:12','2026-07-15 10:09:12',NULL,NULL,'2026-07-15 10:08:45','2026-07-15 10:20:13');
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_cadastral_lot_numbers`
--

LOCK TABLES `lot_project_cadastral_lot_numbers` WRITE;
/*!40000 ALTER TABLE `lot_project_cadastral_lot_numbers` DISABLE KEYS */;
INSERT INTO `lot_project_cadastral_lot_numbers` VALUES (5,1,'1306','2026-07-15 12:58:14','2026-07-15 12:58:14'),(6,1,'1314','2026-07-15 12:58:14','2026-07-15 12:58:14');
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
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_client_documents`
--

LOCK TABLES `lot_project_client_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_client_documents` DISABLE KEYS */;
INSERT INTO `lot_project_client_documents` VALUES (1,1,1,1,11,'3 document image(s)','[{\"url\":\"https://res.cloudinary.com/dvazrmgq9/image/upload/v1783935261/dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages/dlhypivt4dppitwu44fe.jpg\",\"fileName\":\"599806701_1112998174072822_6069652898086497307_n.jpg\",\"fileSize\":231949,\"fileType\":\"image/jpeg\",\"cloudinaryPublicId\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages/dlhypivt4dppitwu44fe\",\"cloudinaryResourceType\":\"image\",\"cloudinaryFolder\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages\",\"cloudinaryAssetFolder\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages\",\"uploadedAt\":\"2026-07-13T09:34:22.129Z\"},{\"url\":\"https://res.cloudinary.com/dvazrmgq9/image/upload/v1783935261/dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages/pt7vrb1yvkljfdo1qbmm.jpg\",\"fileName\":\"608210451_10235901746897290_5972062690288508654_n.jpg\",\"fileSize\":74194,\"fileType\":\"image/jpeg\",\"cloudinaryPublicId\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages/pt7vrb1yvkljfdo1qbmm\",\"cloudinaryResourceType\":\"image\",\"cloudinaryFolder\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages\",\"cloudinaryAssetFolder\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages\",\"uploadedAt\":\"2026-07-13T09:34:22.129Z\"},{\"url\":\"https://res.cloudinary.com/dvazrmgq9/image/upload/v1783935263/dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages/cygzp6ykutup8oxp0fal.jpg\",\"fileName\":\"701496260_1295884702754144_127681999631321322_n.jpg\",\"fileSize\":339037,\"fileType\":\"image/jpeg\",\"cloudinaryPublicId\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages/cygzp6ykutup8oxp0fal\",\"cloudinaryResourceType\":\"image\",\"cloudinaryFolder\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages\",\"cloudinaryAssetFolder\":\"dc_prime/bailen_project/la_0101/buyer_acknowledgement_form/documentimages\",\"uploadedAt\":\"2026-07-13T09:34:22.129Z\"}]','Submitted','2026-07-13 17:34:22',NULL,NULL,'2026-07-13 14:10:00','2026-07-13 17:34:22'),(2,1,1,1,9,'git-github-reference.pdf','[{\"url\":\"https://res.cloudinary.com/dvazrmgq9/image/upload/v1783935289/dc_prime/bailen_project/la_0101/buyer_counselling_and_acknowledgement_form/documentimages/wclxyqxxjqiqg3vqm9ww.pdf\",\"fileName\":\"git-github-reference.pdf\",\"fileSize\":2281316,\"fileType\":\"application/pdf\",\"cloudinaryPublicId\":\"dc_prime/bailen_project/la_0101/buyer_counselling_and_acknowledgement_form/documentimages/wclxyqxxjqiqg3vqm9ww\",\"cloudinaryResourceType\":\"image\",\"cloudinaryFolder\":\"dc_prime/bailen_project/la_0101/buyer_counselling_and_acknowledgement_form/documentimages\",\"cloudinaryAssetFolder\":\"dc_prime/bailen_project/la_0101/buyer_counselling_and_acknowledgement_form/documentimages\",\"uploadedAt\":\"2026-07-13T09:34:47.908Z\"}]','Submitted','2026-07-13 17:34:47',NULL,NULL,'2026-07-13 14:10:00','2026-07-13 17:34:47'),(3,1,1,1,3,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 17:33:42'),(4,1,1,1,2,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 17:33:40'),(5,1,1,1,1,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(6,1,1,1,8,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(7,1,1,1,7,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(8,1,1,1,4,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(9,1,1,1,5,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(10,1,1,1,16,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(11,1,1,1,6,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(12,1,1,1,15,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(13,1,1,1,14,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00'),(14,1,1,1,10,NULL,NULL,'Missing',NULL,NULL,NULL,'2026-07-13 14:10:00','2026-07-13 14:10:00');
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_client_profiles`
--

LOCK TABLES `lot_project_client_profiles` WRITE;
/*!40000 ALTER TABLE `lot_project_client_profiles` DISABLE KEYS */;
INSERT INTO `lot_project_client_profiles` VALUES (1,1,1,5,'distributed','single','Diego','MORENO','George',NULL,'Diego MORENO George','1982-08-23','Silang, Cavite','Filipino','Male','Married','0904324323',NULL,NULL,NULL,'b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite','4102',NULL,NULL,'Employed - Private',NULL,NULL,NULL,NULL,NULL,56000.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0.00,'active','installment',50000.00,0,'include_in_monthly',76500.00,'2026-07-13','2026-07-31',15.00,0,12,0.00,0,'amortized',0,0.00,0.10,1,'daily','2026-07-13 14:10:00','2026-07-13 14:10:00');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commission_receipt_items`
--

LOCK TABLES `lot_project_commission_receipt_items` WRITE;
/*!40000 ALTER TABLE `lot_project_commission_receipt_items` DISABLE KEYS */;
INSERT INTO `lot_project_commission_receipt_items` VALUES (1,1,116,7650.00,'2026-07-15 10:43:16');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commission_receipts`
--

LOCK TABLES `lot_project_commission_receipts` WRITE;
/*!40000 ALTER TABLE `lot_project_commission_receipts` DISABLE KEYS */;
INSERT INTO `lot_project_commission_receipts` VALUES (1,1,1,1,24,5,'Cash','09090','2026-07-15','21312','ewew',7650.00,'active',1,'2026-07-15 10:43:16','2026-07-15 10:43:16');
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
) ENGINE=InnoDB AUTO_INCREMENT=151 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commission_releases`
--

LOCK TABLES `lot_project_commission_releases` WRITE;
/*!40000 ALTER TABLE `lot_project_commission_releases` DISABLE KEYS */;
INSERT INTO `lot_project_commission_releases` VALUES (116,24,'1st Release',20.00,20.00,7650.00,0.00,7650.00,'Released',NULL,'2026-07-15',1,'2026-07-13 17:03:29','2026-07-15 10:42:45'),(117,24,'2nd Release',40.00,20.00,7650.00,0.00,7650.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(118,24,'3rd Release',60.00,20.00,7650.00,0.00,7650.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(119,24,'4th Release',75.00,15.00,5737.50,0.00,5737.50,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(120,24,'Retention',100.00,25.00,9562.50,0.00,9562.50,'On Hold',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(121,25,'1st Release',20.00,20.00,1530.00,0.00,1530.00,'Released',NULL,'2026-07-15',1,'2026-07-13 17:03:29','2026-07-15 10:42:42'),(122,25,'2nd Release',40.00,20.00,1530.00,0.00,1530.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(123,25,'3rd Release',60.00,20.00,1530.00,0.00,1530.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(124,25,'4th Release',75.00,15.00,1147.50,0.00,1147.50,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(125,25,'Retention',100.00,25.00,1912.50,0.00,1912.50,'On Hold',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(126,26,'1st Release',20.00,20.00,1530.00,0.00,1530.00,'Released',NULL,'2026-07-15',1,'2026-07-13 17:03:29','2026-07-15 10:42:39'),(127,26,'2nd Release',40.00,20.00,1530.00,0.00,1530.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(128,26,'3rd Release',60.00,20.00,1530.00,0.00,1530.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(129,26,'4th Release',75.00,15.00,1147.50,0.00,1147.50,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(130,26,'Retention',100.00,25.00,1912.50,0.00,1912.50,'On Hold',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(131,27,'1st Release',20.00,20.00,1530.00,0.00,1530.00,'Released',NULL,'2026-07-15',1,'2026-07-13 17:03:29','2026-07-15 10:42:35'),(132,27,'2nd Release',40.00,20.00,1530.00,0.00,1530.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(133,27,'3rd Release',60.00,20.00,1530.00,0.00,1530.00,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(134,27,'4th Release',75.00,15.00,1147.50,0.00,1147.50,'Pending',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29'),(135,27,'Retention',100.00,25.00,1912.50,0.00,1912.50,'On Hold',NULL,NULL,NULL,'2026-07-13 17:03:29','2026-07-13 17:03:29');
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
  `commission_role` enum('broker_network_manager','broker','manager','agent') NOT NULL,
  `commission_seller_type` enum('main_seller','hierarchy_seller','selling_agent') NOT NULL,
  `commission_sale_type` enum('direct','distributed') NOT NULL DEFAULT 'distributed',
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
  CONSTRAINT `fk_commission_client_profile` FOREIGN KEY (`lot_project_client_profile_id`) REFERENCES `lot_project_client_profiles` (`lot_project_client_profile_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_listing` FOREIGN KEY (`lot_project_listing_id`) REFERENCES `lot_project_listings` (`lot_project_listing_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_project` FOREIGN KEY (`lot_project_id`) REFERENCES `lot_projects` (`lot_project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_commission_seller` FOREIGN KEY (`accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_commissions`
--

LOCK TABLES `lot_project_commissions` WRITE;
/*!40000 ALTER TABLE `lot_project_commissions` DISABLE KEYS */;
INSERT INTO `lot_project_commissions` VALUES (24,1,1,1,5,'agent','selling_agent','distributed',765000.00,5.00,38250.00,7650.00,30600.00,20.00,'Partially Released','2026-07-13 17:03:29','2026-07-15 10:42:45'),(25,1,1,1,3,'manager','hierarchy_seller','distributed',765000.00,1.00,7650.00,1530.00,6120.00,20.00,'Partially Released','2026-07-13 17:03:29','2026-07-15 10:42:42'),(26,1,1,1,2,'broker','hierarchy_seller','distributed',765000.00,1.00,7650.00,1530.00,6120.00,20.00,'Partially Released','2026-07-13 17:03:29','2026-07-15 10:42:39'),(27,1,1,1,1,'broker_network_manager','hierarchy_seller','distributed',765000.00,1.00,7650.00,1530.00,6120.00,20.00,'Partially Released','2026-07-13 17:03:29','2026-07-15 10:42:35');
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
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_default_documents`
--

LOCK TABLES `lot_project_default_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_default_documents` DISABLE KEYS */;
INSERT INTO `lot_project_default_documents` VALUES (37,1,11,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(38,1,9,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(39,1,3,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(40,1,2,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(41,1,1,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(42,1,8,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(43,1,7,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(44,1,4,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(45,1,5,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(46,1,16,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(47,1,6,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(48,1,15,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(49,1,14,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(50,1,10,1,'active','2026-07-15 12:58:14','2026-07-15 12:58:14'),(51,3,11,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(52,3,9,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(53,3,3,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(54,3,2,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(55,3,1,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(56,3,8,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(57,3,7,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(58,3,4,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(59,3,5,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(60,3,6,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30'),(61,3,10,1,'active','2026-07-15 13:04:30','2026-07-15 13:04:30');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listing_documents`
--

LOCK TABLES `lot_project_listing_documents` WRITE;
/*!40000 ALTER TABLE `lot_project_listing_documents` DISABLE KEYS */;
INSERT INTO `lot_project_listing_documents` VALUES (15,1,1,11,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(16,1,1,9,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(17,1,1,3,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(18,1,1,2,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(19,1,1,1,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(20,1,1,8,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(21,1,1,7,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(22,1,1,4,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(23,1,1,5,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(24,1,1,16,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(25,1,1,6,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(26,1,1,15,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(27,1,1,14,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(28,1,1,10,1,'active','2026-07-13 14:10:00','2026-07-13 14:10:00'),(57,1,2,11,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(58,1,2,9,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(59,1,2,3,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(60,1,2,2,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(61,1,2,1,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(62,1,2,8,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(63,1,2,7,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(64,1,2,4,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(65,1,2,5,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(66,1,2,16,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(67,1,2,6,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(68,1,2,15,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(69,1,2,14,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(70,1,2,10,1,'active','2026-07-15 10:09:12','2026-07-15 10:09:12'),(104,3,4,11,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(105,3,4,9,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(106,3,4,3,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(107,3,4,2,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(108,3,4,1,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(109,3,4,8,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(110,3,4,7,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(111,3,4,4,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(112,3,4,5,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(113,3,4,6,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49'),(114,3,4,10,1,'active','2026-07-15 13:05:49','2026-07-15 13:05:49');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_listings`
--

LOCK TABLES `lot_project_listings` WRITE;
/*!40000 ALTER TABLE `lot_project_listings` DISABLE KEYS */;
INSERT INTO `lot_project_listings` VALUES (1,1,'Corner','LA-0101','-',450.00,1700.00,765000.00,10.00,76500.00,841500.00,50000.00,0.00,'cancelled',NULL,NULL,'2026-07-13 14:04:18','2026-07-15 10:33:37',NULL,NULL,NULL,NULL,2,NULL),(2,1,'Inner','LA-0102','-',350.00,1500.00,525000.00,10.00,52500.00,577500.00,50000.00,0.00,'available',NULL,NULL,'2026-07-13 16:47:50','2026-07-15 10:20:13',NULL,NULL,NULL,NULL,9,NULL),(4,3,'Corner','PE-0101',NULL,331.00,4600.00,1522600.00,10.00,152260.00,1674860.00,50000.00,0.00,'available',NULL,NULL,'2026-07-15 13:05:49','2026-07-15 13:05:49',NULL,NULL,NULL,NULL,0,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_allocations`
--

LOCK TABLES `lot_project_payment_allocations` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_allocations` DISABLE KEYS */;
INSERT INTO `lot_project_payment_allocations` VALUES (1,1,71,50000.00,'2026-07-13 16:30:57'),(2,2,72,126225.00,'2026-07-13 16:31:12'),(3,3,73,55439.58,'2026-07-15 10:32:51');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_logs`
--

LOCK TABLES `lot_project_payment_logs` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_logs` DISABLE KEYS */;
INSERT INTO `lot_project_payment_logs` VALUES (1,1,'created','Reservation payment created and verified for LA-0101.',1,'2026-07-13 16:30:57'),(2,2,'created','Downpayment payment created and verified for LA-0101.',1,'2026-07-13 16:31:12'),(3,3,'created','Monthly payment created and verified for LA-0101.',1,'2026-07-15 10:32:51');
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
) ENGINE=InnoDB AUTO_INCREMENT=389 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payment_schedules`
--

LOCK TABLES `lot_project_payment_schedules` WRITE;
/*!40000 ALTER TABLE `lot_project_payment_schedules` DISABLE KEYS */;
INSERT INTO `lot_project_payment_schedules` VALUES (71,1,1,1,'2026-07-13','Reservation Fee',841500.00,50000.00,0.00,50000.00,50000.00,0.00,0.00,0.00,'2026-07-15',50000.00,0.00,0.00,50000.00,'2026-07-13','CASH-20260713-LA0101-0001',791500.00,'Paid','2026-07-13 15:59:10','2026-07-15 06:55:52'),(72,1,1,1,'2026-07-31','Downpayment',791500.00,126225.00,0.00,126225.00,126225.00,0.00,0.00,0.00,'2026-07-15',126225.00,0.00,0.00,126225.00,'2026-07-13','iuyt77876yu',665275.00,'Advance','2026-07-13 15:59:10','2026-07-15 06:55:52'),(73,1,1,1,'2026-08-31','1st Monthly Payment',665275.00,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',55439.58,0.00,0.00,55439.58,'2026-07-15','CASH-20260715-LA0101-0001',609835.42,'Advance','2026-07-13 15:59:10','2026-07-15 10:32:51'),(74,1,1,1,'2026-09-30','2nd Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(75,1,1,1,'2026-10-31','3rd Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(76,1,1,1,'2026-11-30','4th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(77,1,1,1,'2026-12-31','5th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(78,1,1,1,'2027-01-31','6th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(79,1,1,1,'2027-02-28','7th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(80,1,1,1,'2027-03-31','8th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(81,1,1,1,'2027-04-30','9th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(82,1,1,1,'2027-05-31','10th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(83,1,1,1,'2027-06-30','11th Monthly Payment',609835.42,55439.58,0.00,55439.58,55439.58,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51'),(84,1,1,1,'2027-07-31','12th Monthly Payment',609835.42,55439.62,0.00,55439.62,55439.62,0.00,0.00,0.00,'2026-07-15',0.00,0.00,0.00,0.00,NULL,NULL,609835.42,'Unpaid','2026-07-13 15:59:10','2026-07-15 10:32:51');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_payments`
--

LOCK TABLES `lot_project_payments` WRITE;
/*!40000 ALTER TABLE `lot_project_payments` DISABLE KEYS */;
INSERT INTO `lot_project_payments` VALUES (1,1,1,1,71,'reservation','Cash',50000.00,'2026-07-13','CASH-20260713-LA0101-0001','Verified',1,'2026-07-13 16:30:57','2026-07-13 16:30:57','2026-07-13 16:30:57'),(2,1,1,1,72,'downpayment','Bank Transfer',126225.00,'2026-07-13','iuyt77876yu','Verified',1,'2026-07-13 16:31:12','2026-07-13 16:31:12','2026-07-13 16:31:12'),(3,1,1,1,73,'monthly_amortization','Cash',55439.58,'2026-07-15','CASH-20260715-LA0101-0001','Verified',1,'2026-07-15 10:32:51','2026-07-15 10:32:51','2026-07-15 10:32:51');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_project_settings`
--

LOCK TABLES `lot_project_settings` WRITE;
/*!40000 ALTER TABLE `lot_project_settings` DISABLE KEYS */;
INSERT INTO `lot_project_settings` VALUES (1,1,7,15,'D&C Prime Realty','dcprimerealty@gmail.com','0912-345-6789','D&C Prime Realty','dcprimerealty@gmail.com','(046) 866-0616',0.00,0,'2026-07-13 13:32:40','2026-07-15 10:42:30'),(4,3,7,22,'D&C Prime Realty','dcprimerealty@gmail.com','0912-345-6789','D&C Prime Realty','dcprimerealty@gmail.com','(046) 866-0616',0.00,0,'2026-07-15 13:04:30','2026-07-15 13:04:30');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_projects`
--

LOCK TABLES `lot_projects` WRITE;
/*!40000 ALTER TABLE `lot_projects` DISABLE KEYS */;
INSERT INTO `lot_projects` VALUES (1,'Bailen Project','bailen-project','Bailen, Cavite','LA','IMELDA B. VILLALOBOS','AA-06-0005-00105','022-06-0005-003-04','active','2026-07-13 13:32:40','2026-07-15 12:58:14'),(3,'Prime Enclave','prime-enclave','Maragondon, Cavite','PE','test','9034-34-4343','0433-433-4343','active','2026-07-15 13:04:30','2026-07-15 13:04:30');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_group_lot_project_rates`
--

LOCK TABLES `seller_group_lot_project_rates` WRITE;
/*!40000 ALTER TABLE `seller_group_lot_project_rates` DISABLE KEYS */;
INSERT INTO `seller_group_lot_project_rates` VALUES (1,1,1,8.00,'active','2026-07-13 13:48:07','2026-07-13 13:48:07');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_groups`
--

LOCK TABLES `seller_groups` WRITE;
/*!40000 ALTER TABLE `seller_groups` DISABLE KEYS */;
INSERT INTO `seller_groups` VALUES (1,'North Star Group',NULL,NULL,'active','2026-07-13 13:48:07','2026-07-13 13:48:07');
/*!40000 ALTER TABLE `seller_groups` ENABLE KEYS */;
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
INSERT INTO `system_settings` VALUES (1,'D&C Prime Realty',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,7,22,NULL,'2026-07-13 16:46:57','2026-07-13 16:46:57');
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
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `template_document_list`
--

LOCK TABLES `template_document_list` WRITE;
/*!40000 ALTER TABLE `template_document_list` DISABLE KEYS */;
INSERT INTO `template_document_list` VALUES (1,1,2,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(2,1,1,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(3,1,3,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(4,1,4,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(5,1,5,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(6,1,6,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(7,1,7,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(8,1,8,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(9,1,9,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(10,1,10,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(11,1,11,1,'2026-07-13 13:41:15','2026-07-13 13:41:15'),(12,2,13,1,'2026-07-13 13:41:53','2026-07-13 13:41:53'),(13,2,12,1,'2026-07-13 13:41:53','2026-07-13 13:41:53'),(17,4,17,1,'2026-07-13 13:46:01','2026-07-13 13:46:01'),(18,4,18,1,'2026-07-13 13:46:01','2026-07-13 13:46:01'),(19,4,19,1,'2026-07-13 13:46:01','2026-07-13 13:46:01'),(20,4,20,1,'2026-07-13 13:46:01','2026-07-13 13:46:01'),(21,3,16,1,'2026-07-13 13:46:08','2026-07-13 13:46:08'),(22,3,15,1,'2026-07-13 13:46:08','2026-07-13 13:46:08'),(23,3,14,1,'2026-07-13 13:46:08','2026-07-13 13:46:08'),(24,5,21,1,'2026-07-13 13:46:36','2026-07-13 13:46:36'),(25,5,22,1,'2026-07-13 13:46:36','2026-07-13 13:46:36');
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
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Super','Admin',NULL,NULL,NULL,NULL,NULL,'robertrenbysanjuan@gmail.com','$2b$10$NctIePlPkOKirDJpOSR5PemQyFQydpwRSK2uE2oTj5e1dmbpPwGGy','super_admin','active',0,'2026-07-15 12:10:54','2026-07-13 13:29:59','2026-07-15 12:10:54'),(2,'ROWENA','CORTEZ','MORENO',NULL,NULL,NULL,'b70 l44 cremona st. cluster 5, bella vista, brgy. santiago, general trias, cavite','rrcsanjuan@pcu.edu.ph','$2b$10$vJBoNDvg62.acT79IbDKmuBopSRzW.75ZlgV7eaFGuPz27mm0r15m','broker_network_manager','active',1,NULL,'2026-07-13 13:48:27','2026-07-13 13:48:27'),(3,'Broker1','NorthStar',NULL,NULL,NULL,NULL,NULL,'Broker1NorthStar@gmail.com','$2b$10$Z6WSOjdQd0vKuFUzWrfOt.YE8L1gK7usIcfthWWSuzNikaWUg5jiK','broker','active',1,NULL,'2026-07-13 13:49:50','2026-07-13 13:49:50'),(4,'Manager1','NorthStar',NULL,'0987654354',NULL,NULL,NULL,'Manager1NorthStar@gmail.com','$2b$10$ypgpXs.PHD7CznZKqwJos.bT1Xnmm6/hZXvvUjgDJalmeADF.KHX.','manager','active',1,NULL,'2026-07-13 14:00:48','2026-07-13 14:00:48'),(5,'Agent1','NorthStar',NULL,NULL,NULL,NULL,NULL,'Agent1NorthStar@gmail.com','$2b$10$pXGPVk8jan6Pu7.P7skPUexoc97X609TsmlFCR9Wg84ff4O2h/1EW','agent','active',1,NULL,'2026-07-13 14:01:35','2026-07-13 14:01:35'),(6,'kirs','tel',NULL,NULL,NULL,NULL,NULL,'kirstel@gmail.com','$2b$10$F5CQI9WKBcUDR.mrkN3RA.gg/NWzIlfL4JHw9h5ZlWLpr2PSeSs62','admin','active',0,'2026-07-15 10:05:36','2026-07-13 16:32:38','2026-07-15 10:05:36');
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

-- Dump completed on 2026-07-15 16:10:19
-- Replaces permanent audit-log delete-all with export-first archival.
-- Run this once against the existing D&C Prime database.

START TRANSACTION;

DROP TABLE IF EXISTS audit_log_deletion_verifications;

CREATE TABLE IF NOT EXISTS audit_log_archive_policy (
  policy_id TINYINT UNSIGNED NOT NULL,
  retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 365,
  updated_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (policy_id),
  CONSTRAINT fk_audit_archive_policy_user
    FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO audit_log_archive_policy (policy_id, retention_days)
VALUES (1, 365);

CREATE TABLE IF NOT EXISTS audit_log_archive_verifications (
  audit_log_archive_verification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  retention_days SMALLINT UNSIGNED NOT NULL,
  cutoff_at DATETIME NOT NULL,
  eligible_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending','used','expired','locked') NOT NULL DEFAULT 'pending',
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  request_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_verification_id),
  KEY idx_audit_archive_verification_user (user_id),
  KEY idx_audit_archive_verification_status (status, expires_at),
  CONSTRAINT fk_audit_archive_verification_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_log_archive_batches (
  audit_log_archive_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  retention_days SMALLINT UNSIGNED NOT NULL,
  cutoff_at DATETIME NOT NULL,
  record_count INT UNSIGNED NOT NULL,
  export_filename VARCHAR(255) NOT NULL,
  export_sha256 CHAR(64) NOT NULL,
  export_csv LONGBLOB NOT NULL,
  archived_by_user_id INT UNSIGNED NULL,
  archived_by_name VARCHAR(255) NULL,
  archived_by_email VARCHAR(150) NULL,
  request_ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_batch_id),
  KEY idx_audit_archive_batch_created (created_at),
  KEY idx_audit_archive_batch_cutoff (cutoff_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs_archive (
  audit_log_archive_record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_log_archive_batch_id BIGINT UNSIGNED NOT NULL,
  original_audit_log_id BIGINT UNSIGNED NOT NULL,
  actor_user_id INT UNSIGNED NULL,
  actor_name VARCHAR(255) NULL,
  actor_email VARCHAR(150) NULL,
  actor_role VARCHAR(80) NULL,
  action VARCHAR(40) NOT NULL,
  module VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id VARCHAR(120) NULL,
  entity_label VARCHAR(255) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  metadata_json JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  audit_log_created_at DATETIME NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_record_id),
  UNIQUE KEY uq_archived_original_audit_log (original_audit_log_id),
  KEY idx_archived_audit_batch (audit_log_archive_batch_id),
  KEY idx_archived_audit_created (audit_log_created_at),
  KEY idx_archived_audit_module (module),
  CONSTRAINT fk_archived_audit_batch
    FOREIGN KEY (audit_log_archive_batch_id) REFERENCES audit_log_archive_batches (audit_log_archive_batch_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_log_archive_events (
  audit_log_archive_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  audit_log_archive_batch_id BIGINT UNSIGNED NULL,
  actor_user_id INT UNSIGNED NULL,
  actor_name VARCHAR(255) NULL,
  actor_email VARCHAR(150) NULL,
  event_type ENUM('archive_created','export_downloaded') NOT NULL,
  record_count INT UNSIGNED NOT NULL DEFAULT 0,
  retention_days SMALLINT UNSIGNED NULL,
  cutoff_at DATETIME NULL,
  export_sha256 CHAR(64) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  event_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_archive_event_id),
  KEY idx_audit_archive_event_batch (audit_log_archive_batch_id),
  KEY idx_audit_archive_event_created (event_created_at),
  CONSTRAINT fk_audit_archive_event_batch
    FOREIGN KEY (audit_log_archive_batch_id) REFERENCES audit_log_archive_batches (audit_log_archive_batch_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

COMMIT;

-- Database guard: active audit rows can only be removed by the archive transaction.
DROP TRIGGER IF EXISTS trg_audit_logs_archive_only_delete;
DELIMITER $$
CREATE TRIGGER trg_audit_logs_archive_only_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  IF COALESCE(@audit_archive_operation, 0) <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Audit logs cannot be deleted. Use the archive workflow.';
  END IF;
END$$
DELIMITER ;

-- Archive records, archive batches, and archive events are append-only.
DROP TRIGGER IF EXISTS trg_audit_logs_archive_no_update;
DROP TRIGGER IF EXISTS trg_audit_logs_archive_no_delete;
DROP TRIGGER IF EXISTS trg_audit_archive_batches_no_update;
DROP TRIGGER IF EXISTS trg_audit_archive_batches_no_delete;
DROP TRIGGER IF EXISTS trg_audit_archive_events_no_update;
DROP TRIGGER IF EXISTS trg_audit_archive_events_no_delete;

DELIMITER $$
CREATE TRIGGER trg_audit_logs_archive_no_update
BEFORE UPDATE ON audit_logs_archive
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Archived audit records are append-only.';
END$$

CREATE TRIGGER trg_audit_logs_archive_no_delete
BEFORE DELETE ON audit_logs_archive
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Archived audit records are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_batches_no_update
BEFORE UPDATE ON audit_log_archive_batches
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive batches are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_batches_no_delete
BEFORE DELETE ON audit_log_archive_batches
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive batches are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_events_no_update
BEFORE UPDATE ON audit_log_archive_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive events are append-only.';
END$$

CREATE TRIGGER trg_audit_archive_events_no_delete
BEFORE DELETE ON audit_log_archive_events
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit archive events are append-only.';
END$$
DELIMITER ;
