-- D&C Prime Realty | Company Profit receipt details at commission payout
-- Non-destructive migration. BACK UP FIRST. Existing seller receipt tables are already used by Accredited Sellers.
USE `dc_prime_realty_system_db`;

-- Seller Proof of Income receipts: create ONLY if missing, preserving existing records.
  CREATE TABLE IF NOT EXISTS lot_project_commission_receipts (
    lot_project_commission_receipt_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    lot_project_id INT UNSIGNED NOT NULL,
    lot_project_listing_id INT UNSIGNED NOT NULL,
    lot_project_client_profile_id INT UNSIGNED NOT NULL,
    lot_project_account_id BIGINT UNSIGNED NULL,
    lot_project_commission_id INT UNSIGNED NOT NULL,
    accredited_seller_id INT UNSIGNED NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    receipt_date DATE NOT NULL,
    reference_number VARCHAR(150) NOT NULL,
    witness_name VARCHAR(255) NOT NULL,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    receipt_status ENUM('active', 'void') NOT NULL DEFAULT 'active',
    created_by_user_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (lot_project_commission_receipt_id),
    KEY idx_commission_receipt_seller (accredited_seller_id),
    KEY idx_commission_receipt_commission (lot_project_commission_id),
    KEY idx_commission_receipt_listing (lot_project_listing_id),
    KEY idx_commission_receipt_account (lot_project_account_id),
    KEY idx_commission_receipt_date (receipt_date),
    KEY idx_commission_receipt_creator (created_by_user_id),
    CONSTRAINT fk_commission_receipt_project
      FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_listing
      FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_client
      FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_account
      FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts (lot_project_account_id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_commission
      FOREIGN KEY (lot_project_commission_id) REFERENCES lot_project_commissions (lot_project_commission_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_seller
      FOREIGN KEY (accredited_seller_id) REFERENCES accredited_sellers (accredited_seller_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_ receipt_creator
      FOREIGN KEY (created_by_user_id) REFERENCES users (id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

  CREATE TABLE IF NOT EXISTS lot_project_commission_receipt_items (
    lot_project_commission_receipt_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    lot_project_commission_receipt_id INT UNSIGNED NOT NULL,
    lot_project_commission_release_id INT UNSIGNED NOT NULL,
    release_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lot_project_commission_receipt_item_id),
    UNIQUE KEY uq_commission_receipt_release (lot_project_commission_release_id),
    KEY idx_commission_receipt_item_receipt (lot_project_commission_receipt_id),
    CONSTRAINT fk_commission_receipt_item_receipt
      FOREIGN KEY (lot_project_commission_receipt_id) REFERENCES lot_project_commission_receipts (lot_project_commission_receipt_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_commission_receipt_item_release
      FOREIGN KEY (lot_project_commission_release_id) REFERENCES lot_project_commission_releases (lot_project_commission_release_id)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Rerunnable on TiDB with IF NOT EXISTS; check information_schema.columns if needed. These add nullable fields for
-- historic Company Profit releases, preserving their already-recorded payment data.
ALTER TABLE lot_project_network_profit_releases
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS receipt_date DATE NULL,
  ADD COLUMN IF NOT EXISTS witness_name VARCHAR(255) NULL;

-- Verify existing seller receipt tables; do not drop or recreate them:
SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()
  AND table_name IN ('lot_project_commission_receipts', 'lot_project_commission_receipt_items');
