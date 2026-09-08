-- D&C Prime Realty
-- FIXED TiDB-compatible migration
-- Permanent business/storage codes for Cloudinary organization and canonical file names.
-- Safe to rerun after a partially applied earlier version.
-- Run after 20260720_account_retention_secure_purge_cloudinary.sql and 20260803_payment_proofs.sql.

-- -----------------------------------------------------------------------------
-- DOCUMENT LIBRARY
-- -----------------------------------------------------------------------------
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_code VARCHAR(80) NULL AFTER document_name;

UPDATE documents
SET document_code = CASE document_name
  WHEN 'CLIENT REGISTRATION FORM (Seller''s Copy)' THEN 'DOC-CRF-SELLER'
  WHEN 'CLIENT REGISTRATION FORM (Administrator Copy)' THEN 'DOC-CRF-ADMIN'
  WHEN 'BUYER''S INFORMATION FORM' THEN 'DOC-BIF'
  WHEN 'INTENT TO BUY' THEN 'DOC-ITB'
  WHEN 'SPA to Process Title (For Company)' THEN 'DOC-SPA-TITLE-COMPANY'
  WHEN 'SPA Authorization to Sign (for Representative)' THEN 'DOC-SPA-AUTH-REP'
  ELSE CONCAT('DOC-', LPAD(document_id, 6, '0'))
END
WHERE document_code IS NULL OR TRIM(document_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_document_code
  ON documents (document_code);

-- -----------------------------------------------------------------------------
-- PROJECT STORAGE CODES
-- TiDB validates each ALTER TABLE against the schema that exists before the
-- statement starts, so ADD COLUMN and ADD INDEX are deliberately separate.
-- -----------------------------------------------------------------------------
ALTER TABLE lot_projects
  ADD COLUMN IF NOT EXISTS lot_project_storage_code VARCHAR(40) NULL AFTER lot_project_id;

UPDATE lot_projects
SET lot_project_storage_code = CONCAT('PRJ-', lot_project_id)
WHERE lot_project_storage_code IS NULL OR TRIM(lot_project_storage_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_lot_project_storage_code
  ON lot_projects (lot_project_storage_code);

-- -----------------------------------------------------------------------------
-- LISTING STORAGE CODES
-- -----------------------------------------------------------------------------
ALTER TABLE lot_project_listings
  ADD COLUMN IF NOT EXISTS lot_project_listing_storage_code VARCHAR(40) NULL AFTER lot_project_listing_id;

UPDATE lot_project_listings
SET lot_project_listing_storage_code = CONCAT('LST-', lot_project_listing_id)
WHERE lot_project_listing_storage_code IS NULL OR TRIM(lot_project_listing_storage_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_lot_project_listing_storage_code
  ON lot_project_listings (lot_project_listing_storage_code);

-- -----------------------------------------------------------------------------
-- PAYMENT STORAGE CODES
-- -----------------------------------------------------------------------------
ALTER TABLE lot_project_payments
  ADD COLUMN IF NOT EXISTS lot_project_payment_storage_code VARCHAR(40) NULL AFTER lot_project_payment_id;

UPDATE lot_project_payments
SET lot_project_payment_storage_code = CONCAT(
  'PAY-',
  YEAR(COALESCE(lot_project_payment_created_at, NOW())),
  '-',
  LPAD(lot_project_payment_id, 6, '0')
)
WHERE lot_project_payment_storage_code IS NULL OR TRIM(lot_project_payment_storage_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_lot_project_payment_storage_code
  ON lot_project_payments (lot_project_payment_storage_code);

-- -----------------------------------------------------------------------------
-- BUYER DOCUMENT FILE VERSIONING
-- These are separate ALTER statements because file_sequence is positioned
-- AFTER file_version, and TiDB cannot reference a column added earlier in the
-- same multi-change ALTER statement.
-- -----------------------------------------------------------------------------
ALTER TABLE lot_project_client_document_files
  ADD COLUMN IF NOT EXISTS file_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER stored_file_name;

ALTER TABLE lot_project_client_document_files
  ADD COLUMN IF NOT EXISTS file_sequence INT UNSIGNED NOT NULL DEFAULT 1 AFTER file_version;

-- -----------------------------------------------------------------------------
-- PAYMENT PROOF CANONICAL FILE NAMES / SEQUENCE
-- -----------------------------------------------------------------------------
ALTER TABLE lot_project_payment_proofs
  ADD COLUMN IF NOT EXISTS stored_file_name VARCHAR(255) NULL AFTER file_name;

ALTER TABLE lot_project_payment_proofs
  ADD COLUMN IF NOT EXISTS proof_sequence INT UNSIGNED NOT NULL DEFAULT 1 AFTER stored_file_name;

-- -----------------------------------------------------------------------------
-- READ-ONLY VERIFICATION
-- -----------------------------------------------------------------------------
SELECT document_id, document_name, document_code
FROM documents
ORDER BY document_id;

SELECT lot_project_id, lot_project_name, lot_project_location_code, lot_project_storage_code
FROM lot_projects
ORDER BY lot_project_id;

SELECT lot_project_listing_id, lot_project_listing_unit_id, lot_project_listing_storage_code
FROM lot_project_listings
ORDER BY lot_project_listing_id;

SELECT lot_project_payment_id, lot_project_payment_created_at, lot_project_payment_storage_code
FROM lot_project_payments
ORDER BY lot_project_payment_id;

