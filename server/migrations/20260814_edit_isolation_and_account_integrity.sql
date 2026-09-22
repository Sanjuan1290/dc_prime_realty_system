-- 2026-08-14 — Edit isolation, buyer-account integrity, and cadastral safety.
-- TiDB / MySQL compatible for the current D&C Prime Realty schema.
--
-- Goals:
-- 1. Repair legacy account-owned rows whose account id was omitted by older writers.
-- 2. Make assigned cadastral master rows database-protected from accidental deletion.
-- 3. Keep application-level edit refactors concurrency-safe with a DB backstop.

USE `dc_prime_realty_system_db`;

-- Buyer account/profile ownership is one-to-one in lot_project_accounts, so NULL
-- account ids can be repaired safely when project/listing/profile all match.
UPDATE lot_project_payment_schedules schedule
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = schedule.lot_project_id
 AND account.lot_project_listing_id = schedule.lot_project_listing_id
 AND account.lot_project_client_profile_id = schedule.lot_project_client_profile_id
SET schedule.lot_project_account_id = account.lot_project_account_id
WHERE schedule.lot_project_account_id IS NULL;

UPDATE lot_project_payments payment
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = payment.lot_project_id
 AND account.lot_project_listing_id = payment.lot_project_listing_id
 AND account.lot_project_client_profile_id = payment.lot_project_client_profile_id
SET payment.lot_project_account_id = account.lot_project_account_id
WHERE payment.lot_project_account_id IS NULL;

UPDATE lot_project_client_documents document_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = document_row.lot_project_id
 AND account.lot_project_listing_id = document_row.lot_project_listing_id
 AND account.lot_project_client_profile_id = document_row.lot_project_client_profile_id
SET document_row.lot_project_account_id = account.lot_project_account_id
WHERE document_row.lot_project_account_id IS NULL;

UPDATE lot_project_commissions commission
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = commission.lot_project_id
 AND account.lot_project_listing_id = commission.lot_project_listing_id
 AND account.lot_project_client_profile_id = commission.lot_project_client_profile_id
SET commission.lot_project_account_id = account.lot_project_account_id
WHERE commission.lot_project_account_id IS NULL;

UPDATE lot_project_reservation_history history
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = history.lot_project_id
 AND account.lot_project_listing_id = history.lot_project_listing_id
 AND account.lot_project_client_profile_id = history.lot_project_client_profile_id
SET history.lot_project_account_id = account.lot_project_account_id
WHERE history.lot_project_account_id IS NULL
  AND history.lot_project_client_profile_id IS NOT NULL;

UPDATE lot_project_soa_statements statement_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = statement_row.lot_project_id
 AND account.lot_project_listing_id = statement_row.lot_project_listing_id
 AND account.lot_project_client_profile_id = statement_row.lot_project_client_profile_id
SET statement_row.lot_project_account_id = account.lot_project_account_id
WHERE statement_row.lot_project_account_id IS NULL;

UPDATE lot_project_notification_logs notification_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = notification_row.lot_project_id
 AND account.lot_project_listing_id = notification_row.lot_project_listing_id
 AND account.lot_project_client_profile_id = notification_row.lot_project_client_profile_id
SET notification_row.lot_project_account_id = account.lot_project_account_id
WHERE notification_row.lot_project_account_id IS NULL
  AND notification_row.lot_project_client_profile_id IS NOT NULL;

UPDATE lot_project_document_notification_logs notification_row
INNER JOIN lot_project_accounts account
  ON account.lot_project_id = notification_row.lot_project_id
 AND account.lot_project_listing_id = notification_row.lot_project_listing_id
 AND account.lot_project_client_profile_id = notification_row.lot_project_client_profile_id
SET notification_row.lot_project_account_id = account.lot_project_account_id
WHERE notification_row.lot_project_account_id IS NULL;

UPDATE lot_project_penalty_reliefs relief
INNER JOIN lot_project_payment_schedules schedule
  ON schedule.lot_project_payment_schedule_id = relief.lot_project_payment_schedule_id
SET relief.lot_project_account_id = schedule.lot_project_account_id
WHERE relief.lot_project_account_id IS NULL
  AND schedule.lot_project_account_id IS NOT NULL;

UPDATE lot_project_payment_proofs proof
INNER JOIN lot_project_payments payment
  ON payment.lot_project_payment_id = proof.lot_project_payment_id
SET proof.lot_project_account_id = payment.lot_project_account_id
WHERE proof.lot_project_account_id IS NULL
  AND payment.lot_project_account_id IS NOT NULL;

UPDATE lot_project_commission_receipts receipt
INNER JOIN lot_project_commissions commission
  ON commission.lot_project_commission_id = receipt.lot_project_commission_id
SET receipt.lot_project_account_id = commission.lot_project_account_id
WHERE receipt.lot_project_account_id IS NULL
  AND commission.lot_project_account_id IS NOT NULL;

UPDATE lot_project_contract_adjustments adjustment
INNER JOIN lot_project_payment_schedules schedule
  ON schedule.lot_project_payment_schedule_id = adjustment.lot_project_payment_schedule_id
SET adjustment.lot_project_account_id = schedule.lot_project_account_id
WHERE adjustment.lot_project_account_id IS NULL
  AND adjustment.lot_project_payment_schedule_id IS NOT NULL
  AND schedule.lot_project_account_id IS NOT NULL;

UPDATE lot_project_cancelled_sale_archives archive_row
INNER JOIN lot_project_reservation_history history
  ON history.lot_project_reservation_history_id = archive_row.lot_project_reservation_history_id
SET archive_row.lot_project_account_id = history.lot_project_account_id
WHERE archive_row.lot_project_account_id IS NULL
  AND history.lot_project_account_id IS NOT NULL;

UPDATE lot_project_archived_commission_releases archived_release
INNER JOIN lot_project_reservation_history history
  ON history.lot_project_reservation_history_id = archived_release.lot_project_reservation_history_id
SET archived_release.lot_project_account_id = history.lot_project_account_id
WHERE archived_release.lot_project_account_id IS NULL
  AND history.lot_project_account_id IS NOT NULL;

-- Assigned cadastral numbers must be explicitly unassigned from listings before
-- the cadastral master row can be deleted. This replaces the old CASCADE behavior.
ALTER TABLE lot_project_listing_cadastral_lots
  DROP FOREIGN KEY fk_listing_cadastral_lot_number;

ALTER TABLE lot_project_listing_cadastral_lots
  ADD CONSTRAINT fk_listing_cadastral_lot_number
  FOREIGN KEY (lot_project_cadastral_lot_number_id)
  REFERENCES lot_project_cadastral_lot_numbers (lot_project_cadastral_lot_number_id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
