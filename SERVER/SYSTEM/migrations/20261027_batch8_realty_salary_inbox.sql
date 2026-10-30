-- Batch 8 additive ONLY. Apply to isolated Realty staging database first.
-- Never drop or edit existing employee_payrolls / employee_cash_advances in this batch.
CREATE TABLE IF NOT EXISTS `finance_external_salary_event_inbox` (
  `event_id` char(36) NOT NULL,
  `source_system` varchar(20) NOT NULL,
  `source_payroll_id` varchar(20) NOT NULL,
  `source_event_version` int unsigned NOT NULL,
  `event_type` varchar(80) NOT NULL,
  `payload_sha256` char(64) NOT NULL,
  `payload_json` json NOT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  UNIQUE KEY `uq_external_salary_payroll_revision` (`source_system`,`source_payroll_id`,`source_event_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `finance_external_salary_entries` (
  `event_id` char(36) NOT NULL,
  `source_payroll_id` varchar(20) NOT NULL,
  `cash_date` date NOT NULL,
  `kind` enum('expense') NOT NULL DEFAULT 'expense',
  `amount` decimal(14,2) NOT NULL,
  `reference` varchar(180) NOT NULL,
  `recorded_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  UNIQUE KEY `uq_external_salary_payroll` (`source_payroll_id`),
  KEY `idx_external_salary_date` (`cash_date`),
  CONSTRAINT `fk_external_salary_event` FOREIGN KEY (`event_id`) REFERENCES `finance_external_salary_event_inbox` (`event_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- This checkpoint is updated ONLY after independent HR/Realty count + amount reconciliation.
-- Do not infer completeness from the last received event timestamp.
CREATE TABLE IF NOT EXISTS `finance_hr_sync_state` (
  `id` tinyint unsigned NOT NULL,
  `reconciled_through_date` date DEFAULT NULL,
  `reconciled_at` datetime DEFAULT NULL,
  `cash_advances_to_review` int unsigned DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT INTO finance_hr_sync_state (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id;
