-- Read-only verification after migrate-cloudinary-storage-ids-v3.js --apply.
-- Every query below should return zero rows.

SELECT lot_project_id, lot_project_name, lot_project_storage_code,
       CONCAT('PRJ-', lot_project_id) AS expected_storage_code
FROM lot_projects
WHERE lot_project_storage_code <> CONCAT('PRJ-', lot_project_id)
   OR lot_project_storage_code IS NULL;

SELECT lot_project_listing_id, lot_project_listing_unit_id, lot_project_listing_storage_code,
       CONCAT('LST-', lot_project_listing_id) AS expected_storage_code
FROM lot_project_listings
WHERE lot_project_listing_storage_code <> CONCAT('LST-', lot_project_listing_id)
   OR lot_project_listing_storage_code IS NULL;

SELECT
  file_row.lot_project_client_document_file_id,
  account.lot_project_id,
  account.lot_project_listing_id,
  file_row.cloudinary_asset_folder
FROM lot_project_client_document_files file_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_account_id = file_row.lot_project_account_id
WHERE file_row.file_status <> 'removed'
  AND file_row.cloudinary_asset_folder NOT LIKE CONCAT(
    '%/protected/PRJ-', account.lot_project_id,
    '/LST-', account.lot_project_listing_id, '/%'
  );

SELECT
  proof.lot_project_payment_proof_id,
  proof.lot_project_id,
  proof.lot_project_listing_id,
  proof.cloudinary_asset_folder
FROM lot_project_payment_proofs proof
WHERE proof.proof_status = 'active'
  AND proof.cloudinary_asset_folder NOT LIKE CONCAT(
    '%/protected/PRJ-', proof.lot_project_id,
    '/LST-', proof.lot_project_listing_id, '/%'
  );
