-- 2026-08-14 — Signed copies for Proof of Income and buyer Acknowledgement Receipts.
-- Keeps the system-generated printout as the unsigned source of truth while
-- attaching one current signed upload (plus retained replaced versions) to the
-- exact commission receipt or payment record.

USE `dc_prime_realty_system_db`;

CREATE TABLE IF NOT EXISTS lot_project_commission_receipt_files (
  lot_project_commission_receipt_file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_commission_receipt_id INT UNSIGNED NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NOT NULL,
  lot_project_account_id BIGINT UNSIGNED NOT NULL,
  accredited_seller_id INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  file_version INT UNSIGNED NOT NULL DEFAULT 1,
  file_mime_type VARCHAR(150) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cloudinary_asset_id VARCHAR(255) DEFAULT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  cloudinary_resource_type VARCHAR(30) NOT NULL DEFAULT 'image',
  cloudinary_delivery_type VARCHAR(30) NOT NULL DEFAULT 'authenticated',
  cloudinary_version BIGINT UNSIGNED DEFAULT NULL,
  cloudinary_asset_folder VARCHAR(500) DEFAULT NULL,
  cloudinary_format VARCHAR(50) DEFAULT NULL,
  malware_scan_status VARCHAR(30) NOT NULL DEFAULT 'not_scanned',
  malware_scan_provider VARCHAR(80) DEFAULT NULL,
  malware_scan_reason VARCHAR(150) DEFAULT NULL,
  malware_scanned_at DATETIME DEFAULT NULL,
  file_status ENUM('active','replaced','removed') NOT NULL DEFAULT 'active',
  uploaded_by_user_id INT UNSIGNED DEFAULT NULL,
  replaced_at DATETIME DEFAULT NULL,
  removed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_commission_receipt_file_id),
  UNIQUE KEY uq_commission_receipt_file_public_id (cloudinary_public_id),
  KEY idx_commission_receipt_file_receipt (lot_project_commission_receipt_id, file_status),
  KEY idx_commission_receipt_file_account (lot_project_account_id, file_status),
  KEY idx_commission_receipt_file_seller (accredited_seller_id),
  KEY idx_commission_receipt_file_uploader (uploaded_by_user_id),
  CONSTRAINT fk_commission_receipt_file_receipt
    FOREIGN KEY (lot_project_commission_receipt_id) REFERENCES lot_project_commission_receipts (lot_project_commission_receipt_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_commission_receipt_file_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_commission_receipt_file_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_commission_receipt_file_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_commission_receipt_file_account
    FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts (lot_project_account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_commission_receipt_file_seller
    FOREIGN KEY (accredited_seller_id) REFERENCES accredited_sellers (accredited_seller_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_commission_receipt_file_uploader
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS lot_project_payment_acknowledgement_files (
  lot_project_payment_acknowledgement_file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_payment_id INT UNSIGNED NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NOT NULL,
  lot_project_account_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  file_version INT UNSIGNED NOT NULL DEFAULT 1,
  file_mime_type VARCHAR(150) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cloudinary_asset_id VARCHAR(255) DEFAULT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  cloudinary_resource_type VARCHAR(30) NOT NULL DEFAULT 'image',
  cloudinary_delivery_type VARCHAR(30) NOT NULL DEFAULT 'authenticated',
  cloudinary_version BIGINT UNSIGNED DEFAULT NULL,
  cloudinary_asset_folder VARCHAR(500) DEFAULT NULL,
  cloudinary_format VARCHAR(50) DEFAULT NULL,
  malware_scan_status VARCHAR(30) NOT NULL DEFAULT 'not_scanned',
  malware_scan_provider VARCHAR(80) DEFAULT NULL,
  malware_scan_reason VARCHAR(150) DEFAULT NULL,
  malware_scanned_at DATETIME DEFAULT NULL,
  file_status ENUM('active','replaced','removed') NOT NULL DEFAULT 'active',
  uploaded_by_user_id INT UNSIGNED DEFAULT NULL,
  replaced_at DATETIME DEFAULT NULL,
  removed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_payment_acknowledgement_file_id),
  UNIQUE KEY uq_payment_ack_file_public_id (cloudinary_public_id),
  KEY idx_payment_ack_file_payment (lot_project_payment_id, file_status),
  KEY idx_payment_ack_file_account (lot_project_account_id, file_status),
  KEY idx_payment_ack_file_listing (lot_project_listing_id),
  KEY idx_payment_ack_file_uploader (uploaded_by_user_id),
  CONSTRAINT fk_payment_ack_file_payment
    FOREIGN KEY (lot_project_payment_id) REFERENCES lot_project_payments (lot_project_payment_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_ack_file_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_ack_file_listing
    FOREIGN KEY (lot_project_listing_id) REFERENCES lot_project_listings (lot_project_listing_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_ack_file_profile
    FOREIGN KEY (lot_project_client_profile_id) REFERENCES lot_project_client_profiles (lot_project_client_profile_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_ack_file_account
    FOREIGN KEY (lot_project_account_id) REFERENCES lot_project_accounts (lot_project_account_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payment_ack_file_uploader
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Existing commission receipts should already be account-scoped by the account-retention migration.
-- Backfill any remaining null receipt account IDs from their source commission before the feature is used.
UPDATE lot_project_commission_receipts receipt
INNER JOIN lot_project_commissions commission
  ON commission.lot_project_commission_id = receipt.lot_project_commission_id
SET receipt.lot_project_account_id = commission.lot_project_account_id
WHERE receipt.lot_project_account_id IS NULL
  AND commission.lot_project_account_id IS NOT NULL;

SELECT 'lot_project_commission_receipt_files' AS table_name, COUNT(*) AS row_count
FROM lot_project_commission_receipt_files
UNION ALL
SELECT 'lot_project_payment_acknowledgement_files', COUNT(*)
FROM lot_project_payment_acknowledgement_files;
