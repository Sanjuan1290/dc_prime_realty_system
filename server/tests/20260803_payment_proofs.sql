np-- D&C Prime Realty
-- Payment proof attachments for verified lot-project payments.
-- TiDB/MySQL compatible: uses a normal CREATE TABLE statement only.

CREATE TABLE IF NOT EXISTS lot_project_payment_proofs (
  lot_project_payment_proof_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NOT NULL,
  lot_project_account_id BIGINT UNSIGNED DEFAULT NULL,
  lot_project_payment_id INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_mime_type VARCHAR(150) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cloudinary_asset_id VARCHAR(255) DEFAULT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  cloudinary_resource_type VARCHAR(30) NOT NULL DEFAULT 'image',
  cloudinary_delivery_type VARCHAR(30) NOT NULL DEFAULT 'authenticated',
  cloudinary_version BIGINT UNSIGNED DEFAULT NULL,
  cloudinary_asset_folder VARCHAR(500) DEFAULT NULL,
  cloudinary_format VARCHAR(50) DEFAULT NULL,
  note VARCHAR(500) DEFAULT NULL,
  uploaded_by_user_id INT UNSIGNED DEFAULT NULL,
  proof_status ENUM('active','removed') NOT NULL DEFAULT 'active',
  removed_by_user_id INT UNSIGNED DEFAULT NULL,
  removed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (lot_project_payment_proof_id),
  UNIQUE KEY uq_payment_proof_cloudinary_public_id (cloudinary_public_id),
  KEY idx_payment_proof_payment (lot_project_payment_id, proof_status),
  KEY idx_payment_proof_account (lot_project_account_id),
  KEY idx_payment_proof_listing (lot_project_listing_id),
  KEY idx_payment_proof_uploaded_by (uploaded_by_user_id),
  CONSTRAINT fk_payment_proof_project FOREIGN KEY (lot_project_id)
    REFERENCES lot_projects (lot_project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_proof_listing FOREIGN KEY (lot_project_listing_id)
    REFERENCES lot_project_listings (lot_project_listing_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_proof_profile FOREIGN KEY (lot_project_client_profile_id)
    REFERENCES lot_project_client_profiles (lot_project_client_profile_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_proof_account FOREIGN KEY (lot_project_account_id)
    REFERENCES lot_project_accounts (lot_project_account_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_payment_proof_payment FOREIGN KEY (lot_project_payment_id)
    REFERENCES lot_project_payments (lot_project_payment_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_proof_uploaded_by FOREIGN KEY (uploaded_by_user_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_payment_proof_removed_by FOREIGN KEY (removed_by_user_id)
    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
