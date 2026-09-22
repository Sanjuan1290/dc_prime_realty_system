-- D&C Prime Realty
-- Read-only verification for V4 account-owned protected Cloudinary folders.
-- Expected canonical root:
--   dc_prime/protected/PRJ-<project-id>/accounts/ACC-.../

-- Buyer document files outside the account-owned root.
SELECT
  file_row.lot_project_client_document_file_id AS file_id,
  file_row.lot_project_account_id AS account_id,
  file_row.cloudinary_asset_folder
FROM lot_project_client_document_files file_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_account_id = file_row.lot_project_account_id
WHERE file_row.file_status <> 'removed'
  AND NULLIF(TRIM(file_row.cloudinary_public_id), '') IS NOT NULL
  AND file_row.cloudinary_asset_folder NOT LIKE CONCAT(
    '%/protected/PRJ-', account.lot_project_id,
    '/accounts/', account.account_reference, '/%'
  );

-- Payment proofs outside the account-owned root or with stale listing metadata.
SELECT
  proof.lot_project_payment_proof_id AS proof_id,
  proof.lot_project_account_id AS account_id,
  proof.lot_project_listing_id AS proof_listing_id,
  account.lot_project_listing_id AS account_listing_id,
  proof.cloudinary_asset_folder
FROM lot_project_payment_proofs proof
INNER JOIN lot_project_accounts account
  ON account.lot_project_account_id = proof.lot_project_account_id
WHERE proof.proof_status = 'active'
  AND (
    proof.lot_project_listing_id <> account.lot_project_listing_id
    OR proof.cloudinary_asset_folder NOT LIKE CONCAT(
      '%/protected/PRJ-', account.lot_project_id,
      '/accounts/', account.account_reference, '/%'
    )
  );

-- Signed acknowledgement copies outside the account-owned root or with stale listing metadata.
SELECT
  file_row.lot_project_payment_acknowledgement_file_id AS file_id,
  file_row.lot_project_account_id AS account_id,
  file_row.lot_project_listing_id AS file_listing_id,
  account.lot_project_listing_id AS account_listing_id,
  file_row.cloudinary_asset_folder
FROM lot_project_payment_acknowledgement_files file_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_account_id = file_row.lot_project_account_id
WHERE file_row.file_status <> 'removed'
  AND (
    file_row.lot_project_listing_id <> account.lot_project_listing_id
    OR file_row.cloudinary_asset_folder NOT LIKE CONCAT(
      '%/protected/PRJ-', account.lot_project_id,
      '/accounts/', account.account_reference, '/%'
    )
  );

-- Signed Proof-of-Income copies outside the account-owned root or with stale listing metadata.
SELECT
  file_row.lot_project_commission_receipt_file_id AS file_id,
  file_row.lot_project_account_id AS account_id,
  file_row.lot_project_listing_id AS file_listing_id,
  account.lot_project_listing_id AS account_listing_id,
  file_row.cloudinary_asset_folder
FROM lot_project_commission_receipt_files file_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_account_id = file_row.lot_project_account_id
WHERE file_row.file_status <> 'removed'
  AND (
    file_row.lot_project_listing_id <> account.lot_project_listing_id
    OR file_row.cloudinary_asset_folder NOT LIKE CONCAT(
      '%/protected/PRJ-', account.lot_project_id,
      '/accounts/', account.account_reference, '/%'
    )
  );
