-- Read-only verification after 20260814_edit_isolation_and_account_integrity.sql.
-- Every data query should return zero rows.
USE `dc_prime_realty_system_db`;

-- Active/current SOA rows cannot be detached from a buyer account.
SELECT
  schedule.lot_project_payment_schedule_id,
  schedule.lot_project_id,
  schedule.lot_project_listing_id,
  schedule.lot_project_client_profile_id,
  schedule.lot_project_account_id,
  schedule.description,
  schedule.schedule_status
FROM lot_project_payment_schedules schedule
LEFT JOIN lot_project_accounts account
  ON account.lot_project_account_id = schedule.lot_project_account_id
WHERE schedule.lot_project_account_id IS NULL
   OR account.lot_project_account_id IS NULL
   OR schedule.lot_project_id <> account.lot_project_id
   OR schedule.lot_project_listing_id <> account.lot_project_listing_id
   OR schedule.lot_project_client_profile_id <> account.lot_project_client_profile_id;

-- Current listing account must own the current buyer profile.
SELECT
  listing.lot_project_listing_id,
  listing.current_account_id,
  account.lot_project_account_id,
  account.lot_project_client_profile_id
FROM lot_project_listings listing
LEFT JOIN lot_project_accounts account
  ON account.lot_project_account_id = listing.current_account_id
WHERE listing.current_account_id IS NOT NULL
  AND (
    account.lot_project_account_id IS NULL
    OR account.lot_project_listing_id <> listing.lot_project_listing_id
    OR account.lot_project_id <> listing.lot_project_id
  );

-- Confirm the cadastral FK is RESTRICT/NO ACTION, not CASCADE.
SELECT
  rc.CONSTRAINT_NAME,
  rc.DELETE_RULE,
  rc.UPDATE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
  AND rc.TABLE_NAME = 'lot_project_listing_cadastral_lots'
  AND rc.CONSTRAINT_NAME = 'fk_listing_cadastral_lot_number';

-- Payment proofs must inherit the same account as their parent payment.
SELECT
  proof.lot_project_payment_proof_id,
  proof.lot_project_account_id AS proof_account_id,
  payment.lot_project_account_id AS payment_account_id
FROM lot_project_payment_proofs proof
INNER JOIN lot_project_payments payment
  ON payment.lot_project_payment_id = proof.lot_project_payment_id
WHERE proof.lot_project_account_id IS NULL
   OR payment.lot_project_account_id IS NULL
   OR proof.lot_project_account_id <> payment.lot_project_account_id;

-- Commission receipts must inherit the same account as their commission record.
SELECT
  receipt.lot_project_commission_receipt_id,
  receipt.lot_project_account_id AS receipt_account_id,
  commission.lot_project_account_id AS commission_account_id
FROM lot_project_commission_receipts receipt
INNER JOIN lot_project_commissions commission
  ON commission.lot_project_commission_id = receipt.lot_project_commission_id
WHERE receipt.lot_project_account_id IS NULL
   OR commission.lot_project_account_id IS NULL
   OR receipt.lot_project_account_id <> commission.lot_project_account_id;

-- Contract adjustments attached to a schedule must inherit that schedule's account.
SELECT
  adjustment.lot_project_contract_adjustment_id,
  adjustment.lot_project_account_id AS adjustment_account_id,
  schedule.lot_project_account_id AS schedule_account_id
FROM lot_project_contract_adjustments adjustment
INNER JOIN lot_project_payment_schedules schedule
  ON schedule.lot_project_payment_schedule_id = adjustment.lot_project_payment_schedule_id
WHERE adjustment.lot_project_payment_schedule_id IS NOT NULL
  AND (
    adjustment.lot_project_account_id IS NULL
    OR schedule.lot_project_account_id IS NULL
    OR adjustment.lot_project_account_id <> schedule.lot_project_account_id
  );
