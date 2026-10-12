-- D&C Prime Realty | 2026-10-12 | Network Company Profit payouts
-- NON-DESTRUCTIVE. Apply once to TiDB after backing up. No prior payouts are reconstructed.
-- Company Profit belongs to an In-House Network/realty, NOT to the Network Head's personal commission.
USE `dc_prime_realty_system_db`;

CREATE TABLE IF NOT EXISTS lot_project_network_profit_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_account_id BIGINT UNSIGNED NOT NULL,
  seller_group_id INT UNSIGNED NOT NULL,
  source_commission_id INT UNSIGNED NULL,
  network_name_snapshot VARCHAR(150) NOT NULL,
  broker_name_snapshot VARCHAR(180) NOT NULL,
  payee_name_snapshot VARCHAR(180) NOT NULL,
  commission_base_snapshot DECIMAL(14,2) NOT NULL,
  company_profit_rate_snapshot DECIMAL(7,4) NOT NULL,
  gross_profit_snapshot DECIMAL(14,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_network_profit_account (lot_project_account_id, seller_group_id),
  KEY idx_network_profit_project (lot_project_id, lot_project_account_id),
  CONSTRAINT fk_network_profit_account FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts(lot_project_account_id) ON DELETE RESTRICT,
  CONSTRAINT fk_network_profit_network FOREIGN KEY (seller_group_id) REFERENCES seller_groups(seller_group_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lot_project_network_profit_releases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  profit_account_id BIGINT UNSIGNED NOT NULL,
  release_stage VARCHAR(32) NOT NULL,
  release_trigger_percent DECIMAL(7,2) NOT NULL,
  release_percent DECIMAL(7,2) NOT NULL,
  release_amount DECIMAL(14,2) NOT NULL,
  release_status ENUM('Pending','On Hold','Released') NOT NULL DEFAULT 'Pending',
  actual_release_date DATE NULL,
  released_by_user_id INT UNSIGNED NULL,
  payee_name VARCHAR(180) NULL,
  payment_method VARCHAR(30) NULL,
  payment_reference VARCHAR(120) NULL,
  release_recorded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_network_profit_stage (profit_account_id, release_stage),
  KEY idx_network_profit_status (release_status, actual_release_date),
  CONSTRAINT fk_network_profit_release_account FOREIGN KEY (profit_account_id) REFERENCES lot_project_network_profit_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lot_project_network_profit_signed_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  profit_release_id BIGINT UNSIGNED NOT NULL,
  file_version INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_mime_type VARCHAR(150) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  cloudinary_asset_id VARCHAR(255) NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  cloudinary_resource_type VARCHAR(30) NOT NULL DEFAULT 'image',
  cloudinary_version BIGINT UNSIGNED NULL,
  cloudinary_format VARCHAR(50) NULL,
  cloudinary_asset_folder VARCHAR(500) NOT NULL,
  malware_scan_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  malware_scan_provider VARCHAR(80) NULL,
  malware_scan_reason VARCHAR(255) NULL,
  malware_scanned_at DATETIME NULL,
  file_status ENUM('active','replaced','removed') NOT NULL DEFAULT 'active',
  uploaded_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_network_profit_file_public_id (cloudinary_public_id),
  UNIQUE KEY uq_network_profit_file_version (profit_release_id, file_version),
  KEY idx_network_profit_file_release (profit_release_id, file_status),
  CONSTRAINT fk_network_profit_file_release FOREIGN KEY (profit_release_id) REFERENCES lot_project_network_profit_releases(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill historical ACCOUNT/NETWORK snapshots (not payment releases). Safely excludes inconsistent snapshots.
INSERT INTO lot_project_network_profit_accounts (
  lot_project_id, lot_project_listing_id, lot_project_account_id, seller_group_id,
  source_commission_id, network_name_snapshot, broker_name_snapshot, payee_name_snapshot,
  commission_base_snapshot, company_profit_rate_snapshot, gross_profit_snapshot
)
SELECT
  MIN(c.lot_project_id), MIN(c.lot_project_listing_id), c.lot_project_account_id, sg.seller_group_id,
  MIN(c.lot_project_commission_id), sg.seller_group_name,
  COALESCE(NULLIF(TRIM(sg.broker_name), ''), sg.seller_group_name),
  COALESCE(NULLIF(TRIM(sg.realty_name), ''), NULLIF(TRIM(sg.broker_name), ''), sg.seller_group_name),
  MIN(c.commission_base_amount), MIN(c.company_profit_rate_snapshot),
  ROUND(MIN(c.commission_base_amount) * MIN(c.company_profit_rate_snapshot) / 100, 2)
FROM lot_project_commissions c
JOIN accredited_sellers acs ON acs.accredited_seller_id = c.accredited_seller_id
JOIN seller_groups sg ON sg.seller_group_id = acs.seller_group_id
JOIN lot_project_accounts account_row ON account_row.lot_project_account_id = c.lot_project_account_id
WHERE sg.seller_group_type = 'in_house'
  AND c.lot_project_account_id IS NOT NULL
  AND c.company_profit_rate_snapshot > 0
  AND NOT EXISTS (
    SELECT 1
    FROM lot_project_network_profit_accounts existing
    WHERE existing.lot_project_account_id = c.lot_project_account_id
      AND existing.seller_group_id = sg.seller_group_id
  )
GROUP BY c.lot_project_account_id, sg.seller_group_id, sg.seller_group_name, sg.broker_name, sg.realty_name
HAVING MIN(c.company_profit_rate_snapshot) = MAX(c.company_profit_rate_snapshot)
   AND MIN(c.commission_base_amount) = MAX(c.commission_base_amount);

-- Stages mirror the existing seller commission split. The final stage absorbs rounding cents.
INSERT INTO lot_project_network_profit_releases (
  profit_account_id, release_stage, release_trigger_percent, release_percent, release_amount
)
SELECT profit.id, stage.release_stage, stage.trigger_percent, stage.release_percent,
  CASE WHEN stage.release_stage = 'Retention' THEN
    profit.gross_profit_snapshot - ROUND(profit.gross_profit_snapshot * 0.20, 2) * 3 - ROUND(profit.gross_profit_snapshot * 0.15, 2)
  ELSE ROUND(profit.gross_profit_snapshot * stage.release_percent / 100, 2) END
FROM lot_project_network_profit_accounts profit
CROSS JOIN (
  SELECT '1st Release' AS release_stage, 20 AS trigger_percent, 20 AS release_percent UNION ALL
  SELECT '2nd Release',40,20 UNION ALL
  SELECT '3rd Release',60,20 UNION ALL
  SELECT '4th Release',75,15 UNION ALL
  SELECT 'Retention',100,25
) stage
WHERE NOT EXISTS (
  SELECT 1
  FROM lot_project_network_profit_releases existing
  WHERE existing.profit_account_id = profit.id
    AND existing.release_stage = stage.release_stage
);
