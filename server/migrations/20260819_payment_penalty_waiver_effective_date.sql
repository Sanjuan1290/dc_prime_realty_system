-- 2026-08-19 — Payment-linked penalty waivers and penalty policy effective date.
--
-- Goals:
-- 1. Let an admin waive the penalty calculated for one specific payment.
-- 2. Preserve the actual historical payment date while keeping the waived penalty at PHP 0.00 after recalculation.
-- 3. Let historical buyer accounts define when the daily-penalty policy actually became effective.

USE `dc_prime_realty_system_db`;

ALTER TABLE lot_project_client_profiles
  ADD COLUMN soa_penalty_effective_from DATE NULL AFTER soa_penalty_grace_days;

ALTER TABLE lot_project_penalty_reliefs
  ADD COLUMN effective_date DATE NULL AFTER promised_payment_date,
  ADD COLUMN lot_project_payment_id INT UNSIGNED NULL AFTER lot_project_payment_schedule_id;

-- Existing reliefs keep their current behavior by becoming effective on the date they were created.
UPDATE lot_project_penalty_reliefs
SET effective_date = DATE(created_at)
WHERE effective_date IS NULL;

ALTER TABLE lot_project_penalty_reliefs
  ADD INDEX idx_penalty_relief_effective_date (effective_date),
  ADD INDEX idx_penalty_relief_payment (lot_project_payment_id),
  ADD CONSTRAINT fk_penalty_relief_payment
    FOREIGN KEY (lot_project_payment_id)
    REFERENCES lot_project_payments (lot_project_payment_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

SELECT lot_project_client_profile_id, soa_penalty_rate_percent, soa_penalty_grace_days, soa_penalty_effective_from
FROM lot_project_client_profiles
ORDER BY lot_project_client_profile_id DESC
LIMIT 20;

SELECT penalty_relief_id, lot_project_payment_schedule_id, lot_project_payment_id, relief_type,
       effective_date, relief_amount, status, created_at
FROM lot_project_penalty_reliefs
ORDER BY penalty_relief_id DESC
LIMIT 50;
