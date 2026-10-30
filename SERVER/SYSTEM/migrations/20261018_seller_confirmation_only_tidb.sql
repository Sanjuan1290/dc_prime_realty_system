-- D&C Prime Realty - Seller management simplified confirmation (TiDB Cloud)
-- REQUIRED before enabling direct Unit Manager / Sales Director replacements.
-- Run once only after verifying the Phase 5-6 migration has created the table.
-- A NULL verification_id means the replacement was approved by an authorized
-- administrator's in-app confirmation, not by an email verification code.
-- Existing historical verification IDs are preserved.
ALTER TABLE `seller_manager_replacements`
  MODIFY COLUMN `verification_id` BIGINT UNSIGNED NULL;

