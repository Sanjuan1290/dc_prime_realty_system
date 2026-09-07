-- Read-only verification for signed Proof of Income and Acknowledgement Receipt copies.
-- Run after server/migrations/20260814_signed_receipt_copies.sql.

USE `dc_prime_realty_system_db`;

-- 1) Every Proof of Income signed file must match its exact receipt/account ownership.
SELECT
  f.lot_project_commission_receipt_file_id,
  f.lot_project_commission_receipt_id,
  f.lot_project_account_id AS file_account_id,
  r.lot_project_account_id AS receipt_account_id,
  c.lot_project_account_id AS commission_account_id
FROM lot_project_commission_receipt_files f
LEFT JOIN lot_project_commission_receipts r
  ON r.lot_project_commission_receipt_id = f.lot_project_commission_receipt_id
LEFT JOIN lot_project_commissions c
  ON c.lot_project_commission_id = r.lot_project_commission_id
WHERE r.lot_project_commission_receipt_id IS NULL
   OR f.lot_project_id <> r.lot_project_id
   OR f.lot_project_listing_id <> r.lot_project_listing_id
   OR f.lot_project_client_profile_id <> r.lot_project_client_profile_id
   OR f.accredited_seller_id <> r.accredited_seller_id
   OR f.lot_project_account_id <> COALESCE(r.lot_project_account_id, c.lot_project_account_id);

-- 2) Every signed Acknowledgement Receipt must match its exact verified payment/account ownership.
SELECT
  f.lot_project_payment_acknowledgement_file_id,
  f.lot_project_payment_id,
  f.lot_project_account_id AS file_account_id,
  p.lot_project_account_id AS payment_account_id,
  p.lot_project_payment_status
FROM lot_project_payment_acknowledgement_files f
LEFT JOIN lot_project_payments p
  ON p.lot_project_payment_id = f.lot_project_payment_id
WHERE p.lot_project_payment_id IS NULL
   OR p.lot_project_payment_status <> 'Verified'
   OR f.lot_project_id <> p.lot_project_id
   OR f.lot_project_listing_id <> p.lot_project_listing_id
   OR f.lot_project_client_profile_id <> p.lot_project_client_profile_id
   OR f.lot_project_account_id <> p.lot_project_account_id;

-- 3) There must be at most one active signed copy per Proof of Income receipt.
SELECT lot_project_commission_receipt_id, COUNT(*) AS active_count
FROM lot_project_commission_receipt_files
WHERE file_status = 'active'
GROUP BY lot_project_commission_receipt_id
HAVING COUNT(*) > 1;

-- 4) There must be at most one active signed copy per payment acknowledgement receipt.
SELECT lot_project_payment_id, COUNT(*) AS active_count
FROM lot_project_payment_acknowledgement_files
WHERE file_status = 'active'
GROUP BY lot_project_payment_id
HAVING COUNT(*) > 1;

-- 5) Protected-file metadata must be present and scan state must be recognized.
SELECT 'proof_of_income' AS signed_copy_type, lot_project_commission_receipt_file_id AS file_id,
       cloudinary_public_id, malware_scan_status, file_status
FROM lot_project_commission_receipt_files
WHERE NULLIF(TRIM(cloudinary_public_id), '') IS NULL
   OR malware_scan_status NOT IN ('pending', 'approved', 'rejected', 'error', 'not_scanned')
UNION ALL
SELECT 'acknowledgement_receipt', lot_project_payment_acknowledgement_file_id,
       cloudinary_public_id, malware_scan_status, file_status
FROM lot_project_payment_acknowledgement_files
WHERE NULLIF(TRIM(cloudinary_public_id), '') IS NULL
   OR malware_scan_status NOT IN ('pending', 'approved', 'rejected', 'error', 'not_scanned');

-- 6) Summary only. Non-zero counts here are expected once signed copies are uploaded.
SELECT 'proof_of_income_signed_files' AS metric, COUNT(*) AS value
FROM lot_project_commission_receipt_files
UNION ALL
SELECT 'acknowledgement_signed_files', COUNT(*)
FROM lot_project_payment_acknowledgement_files;
