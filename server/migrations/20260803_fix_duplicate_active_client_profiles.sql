-- D&C Prime Realty
-- Repair accidental duplicate ACTIVE buyer profiles created by the old
-- Edit Buyer Profile INSERT ... ON DUPLICATE KEY UPDATE logic.
--
-- This script keeps the buyer profile already referenced by each listing's
-- current_account_id. It copies only personal/work information from the newest
-- accidental ACTIVE profile into that current profile, then closes the extra
-- ACTIVE profiles. It does NOT change SOA terms, payments, schedules,
-- commissions, documents, account IDs, or reservation financial snapshots.

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_duplicate_client_profile_repair;
CREATE TEMPORARY TABLE tmp_duplicate_client_profile_repair AS
SELECT
  l.lot_project_listing_id,
  l.current_account_id,
  a.lot_project_client_profile_id AS current_profile_id,
  MAX(cp.lot_project_client_profile_id) AS newest_active_profile_id,
  COUNT(*) AS active_profile_count
FROM lot_project_listings l
INNER JOIN lot_project_accounts a
  ON a.lot_project_account_id = l.current_account_id
INNER JOIN lot_project_client_profiles cp
  ON cp.lot_project_listing_id = l.lot_project_listing_id
 AND cp.lot_project_client_profile_status = 'active'
WHERE l.current_account_id IS NOT NULL
  AND a.lot_project_client_profile_id IS NOT NULL
GROUP BY
  l.lot_project_listing_id,
  l.current_account_id,
  a.lot_project_client_profile_id
HAVING COUNT(*) > 1;


-- Preview what will be repaired.
SELECT
  r.lot_project_listing_id,
  l.lot_project_listing_unit_id,
  r.current_account_id,
  r.current_profile_id,
  r.newest_active_profile_id,
  r.active_profile_count,
  current_cp.buyer_full_name AS current_buyer_name,
  newest_cp.buyer_full_name AS newest_buyer_name,
  current_cp.buyer_employment_status AS current_employment_status,
  newest_cp.buyer_employment_status AS newest_employment_status
FROM tmp_duplicate_client_profile_repair r
INNER JOIN lot_project_listings l
  ON l.lot_project_listing_id = r.lot_project_listing_id
INNER JOIN lot_project_client_profiles current_cp
  ON current_cp.lot_project_client_profile_id = r.current_profile_id
INNER JOIN lot_project_client_profiles newest_cp
  ON newest_cp.lot_project_client_profile_id = r.newest_active_profile_id
ORDER BY l.lot_project_listing_unit_id;

-- Copy only fields that Edit Buyer Profile is allowed to change.
UPDATE lot_project_client_profiles target
INNER JOIN tmp_duplicate_client_profile_repair r
  ON r.current_profile_id = target.lot_project_client_profile_id
INNER JOIN lot_project_client_profiles source
  ON source.lot_project_client_profile_id = r.newest_active_profile_id
SET
  target.buyer_type = source.buyer_type,
  target.buyer_first_name = source.buyer_first_name,
  target.buyer_middle_name = source.buyer_middle_name,
  target.buyer_last_name = source.buyer_last_name,
  target.buyer_suffix = source.buyer_suffix,
  target.buyer_full_name = source.buyer_full_name,
  target.buyer_birth_date = source.buyer_birth_date,
  target.buyer_place_of_birth = source.buyer_place_of_birth,
  target.buyer_citizenship = source.buyer_citizenship,
  target.buyer_gender = source.buyer_gender,
  target.buyer_civil_status = source.buyer_civil_status,
  target.buyer_contact_number = source.buyer_contact_number,
  target.buyer_residence_phone_number = source.buyer_residence_phone_number,
  target.buyer_email = source.buyer_email,
  target.buyer_tin = source.buyer_tin,
  target.buyer_present_address = source.buyer_present_address,
  target.buyer_present_zip_code = source.buyer_present_zip_code,
  target.buyer_permanent_address = source.buyer_permanent_address,
  target.buyer_permanent_zip_code = source.buyer_permanent_zip_code,
  target.buyer_employment_status = source.buyer_employment_status,
  target.buyer_employer_business_name = source.buyer_employer_business_name,
  target.buyer_employer_zip_code = source.buyer_employer_zip_code,
  target.buyer_employer_business_address = source.buyer_employer_business_address,
  target.buyer_nature_of_work_business = source.buyer_nature_of_work_business,
  target.buyer_occupation_position = source.buyer_occupation_position,
  target.buyer_monthly_income = source.buyer_monthly_income,
  target.second_buyer_full_name = source.second_buyer_full_name,
  target.second_buyer_first_name = source.second_buyer_first_name,
  target.second_buyer_middle_name = source.second_buyer_middle_name,
  target.second_buyer_last_name = source.second_buyer_last_name,
  target.second_buyer_suffix = source.second_buyer_suffix,
  target.second_buyer_role = source.second_buyer_role,
  target.second_buyer_birth_date = source.second_buyer_birth_date,
  target.second_buyer_place_of_birth = source.second_buyer_place_of_birth,
  target.second_buyer_citizenship = source.second_buyer_citizenship,
  target.second_buyer_gender = source.second_buyer_gender,
  target.second_buyer_civil_status = source.second_buyer_civil_status,
  target.second_buyer_contact_number = source.second_buyer_contact_number,
  target.second_buyer_residence_phone_number = source.second_buyer_residence_phone_number,
  target.second_buyer_email = source.second_buyer_email,
  target.second_buyer_tin = source.second_buyer_tin,
  target.second_buyer_present_address = source.second_buyer_present_address,
  target.second_buyer_present_zip_code = source.second_buyer_present_zip_code,
  target.second_buyer_permanent_address = source.second_buyer_permanent_address,
  target.second_buyer_permanent_zip_code = source.second_buyer_permanent_zip_code,
  target.second_buyer_employment_status = source.second_buyer_employment_status,
  target.second_buyer_employer_business_name = source.second_buyer_employer_business_name,
  target.second_buyer_employer_zip_code = source.second_buyer_employer_zip_code,
  target.second_buyer_employer_business_address = source.second_buyer_employer_business_address,
  target.second_buyer_nature_of_work_business = source.second_buyer_nature_of_work_business,
  target.second_buyer_occupation_position = source.second_buyer_occupation_position,
  target.second_buyer_monthly_income = source.second_buyer_monthly_income,
  target.lot_project_client_profile_updated_at = NOW()
WHERE r.newest_active_profile_id <> r.current_profile_id;

-- Keep exactly the account-owned profile ACTIVE for the current sale.
UPDATE lot_project_client_profiles cp
INNER JOIN tmp_duplicate_client_profile_repair r
  ON r.lot_project_listing_id = cp.lot_project_listing_id
SET
  cp.lot_project_client_profile_status = 'closed',
  cp.lot_project_client_profile_updated_at = NOW()
WHERE cp.lot_project_client_profile_status = 'active'
  AND cp.lot_project_client_profile_id <> r.current_profile_id;

UPDATE lot_project_client_profiles cp
INNER JOIN tmp_duplicate_client_profile_repair r
  ON r.current_profile_id = cp.lot_project_client_profile_id
INNER JOIN lot_project_accounts a
  ON a.lot_project_account_id = r.current_account_id
SET
  cp.lot_project_client_profile_status = CASE
    WHEN a.account_status IN ('active', 'pending_cancellation') THEN 'active'
    ELSE cp.lot_project_client_profile_status
  END,
  cp.lot_project_client_profile_updated_at = NOW();

COMMIT;

-- Verification: this should return zero rows for current listings.
SELECT
  l.lot_project_listing_unit_id,
  l.current_account_id,
  a.lot_project_client_profile_id AS current_profile_id,
  COUNT(cp.lot_project_client_profile_id) AS active_profile_count
FROM lot_project_listings l
INNER JOIN lot_project_accounts a
  ON a.lot_project_account_id = l.current_account_id
LEFT JOIN lot_project_client_profiles cp
  ON cp.lot_project_listing_id = l.lot_project_listing_id
 AND cp.lot_project_client_profile_status = 'active'
WHERE l.current_account_id IS NOT NULL
GROUP BY
  l.lot_project_listing_id,
  l.lot_project_listing_unit_id,
  l.current_account_id,
  a.lot_project_client_profile_id
HAVING COUNT(cp.lot_project_client_profile_id) > 1;

DROP TEMPORARY TABLE IF EXISTS tmp_duplicate_client_profile_repair;


