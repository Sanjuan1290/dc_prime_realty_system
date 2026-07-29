-- Read-only verification for retained buyer-account ownership.
-- Every query should return zero rows before historical account pages are used.

-- Listing.current_account_id must point to an account owned by the same listing/project.
SELECT
  listing.lot_project_listing_id,
  listing.lot_project_id,
  listing.current_account_id,
  account.lot_project_listing_id AS account_listing_id,
  account.lot_project_id AS account_project_id
FROM lot_project_listings listing
LEFT JOIN lot_project_accounts account
  ON account.lot_project_account_id = listing.current_account_id
WHERE listing.current_account_id IS NOT NULL
  AND (
    account.lot_project_account_id IS NULL
    OR account.lot_project_listing_id <> listing.lot_project_listing_id
    OR account.lot_project_id <> listing.lot_project_id
  );

-- Payments must match the account's project, listing, and client profile.
SELECT
  payment.lot_project_payment_id,
  payment.lot_project_account_id,
  payment.lot_project_id,
  payment.lot_project_listing_id,
  payment.lot_project_client_profile_id
FROM lot_project_payments payment
LEFT JOIN lot_project_accounts account
  ON account.lot_project_account_id = payment.lot_project_account_id
WHERE payment.lot_project_account_id IS NULL
   OR account.lot_project_account_id IS NULL
   OR payment.lot_project_id <> account.lot_project_id
   OR payment.lot_project_listing_id <> account.lot_project_listing_id
   OR payment.lot_project_client_profile_id <> account.lot_project_client_profile_id;

-- SOA rows must match the selected account.
SELECT
  schedule.lot_project_payment_schedule_id,
  schedule.lot_project_account_id,
  schedule.lot_project_id,
  schedule.lot_project_listing_id,
  schedule.lot_project_client_profile_id
FROM lot_project_payment_schedules schedule
LEFT JOIN lot_project_accounts account
  ON account.lot_project_account_id = schedule.lot_project_account_id
WHERE schedule.lot_project_account_id IS NULL
   OR account.lot_project_account_id IS NULL
   OR schedule.lot_project_id <> account.lot_project_id
   OR schedule.lot_project_listing_id <> account.lot_project_listing_id
   OR schedule.lot_project_client_profile_id <> account.lot_project_client_profile_id;

-- Buyer document rows must match the selected account.
SELECT
  document_row.lot_project_client_document_id,
  document_row.lot_project_account_id,
  document_row.lot_project_id,
  document_row.lot_project_listing_id,
  document_row.lot_project_client_profile_id
FROM lot_project_client_documents document_row
LEFT JOIN lot_project_accounts account
  ON account.lot_project_account_id = document_row.lot_project_account_id
WHERE document_row.lot_project_account_id IS NULL
   OR account.lot_project_account_id IS NULL
   OR document_row.lot_project_id <> account.lot_project_id
   OR document_row.lot_project_listing_id <> account.lot_project_listing_id
   OR document_row.lot_project_client_profile_id <> account.lot_project_client_profile_id;

-- Commission rows must match the selected account.
SELECT
  commission.lot_project_commission_id,
  commission.lot_project_account_id,
  commission.lot_project_id,
  commission.lot_project_listing_id,
  commission.lot_project_client_profile_id
FROM lot_project_commissions commission
LEFT JOIN lot_project_accounts account
  ON account.lot_project_account_id = commission.lot_project_account_id
WHERE commission.lot_project_account_id IS NULL
   OR account.lot_project_account_id IS NULL
   OR commission.lot_project_id <> account.lot_project_id
   OR commission.lot_project_listing_id <> account.lot_project_listing_id
   OR commission.lot_project_client_profile_id <> account.lot_project_client_profile_id;

-- Penalty adjustments must match their schedule and account.
SELECT
  relief.penalty_relief_id,
  relief.lot_project_account_id,
  relief.lot_project_payment_schedule_id,
  schedule.lot_project_account_id AS schedule_account_id
FROM lot_project_penalty_reliefs relief
LEFT JOIN lot_project_payment_schedules schedule
  ON schedule.lot_project_payment_schedule_id = relief.lot_project_payment_schedule_id
WHERE relief.lot_project_account_id IS NULL
   OR schedule.lot_project_payment_schedule_id IS NULL
   OR relief.lot_project_account_id <> schedule.lot_project_account_id;
