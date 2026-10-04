-- 2026-09-08 — Freeze cancelled commission progress at the retained/discontinued percentage.
--
-- A read-time Commissions synchronization previously recalculated cancelled
-- historical rows using verified cash / current TCP. This repairs only rows
-- whose buyer account is already cancelled and whose stored commission progress
-- differs from discontinued amount / original commission base.

USE `dc_prime_realty_system_db`;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_cancelled_commission_progress_repair;
CREATE TEMPORARY TABLE tmp_cancelled_commission_progress_repair AS
SELECT
  c.lot_project_commission_id,
  c.lot_project_account_id,
  c.lot_project_client_profile_id,
  c.lot_project_listing_id,
  c.payment_percent AS previous_payment_percent,
  LEAST(
    100,
    GREATEST(
      0,
      ROUND((COALESCE(a.discontinued_amount, 0) / NULLIF(c.commission_base_amount, 0)) * 100, 2)
    )
  ) AS repaired_payment_percent,
  COALESCE(a.discontinued_amount, 0) AS discontinued_amount,
  c.commission_base_amount,
  a.account_reference,
  a.unit_id_snapshot
FROM lot_project_commissions c
INNER JOIN lot_project_accounts a
  ON a.lot_project_account_id = c.lot_project_account_id
WHERE a.account_status = 'cancelled'
  AND c.commission_base_amount > 0
  AND ABS(
    COALESCE(c.payment_percent, 0) -
    LEAST(
      100,
      GREATEST(
        0,
        ROUND((COALESCE(a.discontinued_amount, 0) / NULLIF(c.commission_base_amount, 0)) * 100, 2)
      )
    )
  ) > 0.004;

UPDATE lot_project_commissions c
INNER JOIN tmp_cancelled_commission_progress_repair repair
  ON repair.lot_project_commission_id = c.lot_project_commission_id
SET
  c.payment_percent = repair.repaired_payment_percent,
  c.updated_at = NOW();

-- Keep the repair itself traceable. No user is attributed because this is a
-- deployment migration rather than an interactive business action.
INSERT INTO audit_logs (
  actor_user_id,
  actor_name,
  actor_email,
  actor_role,
  action,
  module,
  entity_type,
  entity_id,
  entity_label,
  title,
  description,
  metadata_json,
  ip_address,
  user_agent,
  audit_log_created_at
)
SELECT
  NULL,
  'System Migration',
  NULL,
  NULL,
  'system',
  'Commissions',
  'lot_project_commission',
  CAST(repair.lot_project_commission_id AS CHAR),
  CONCAT(COALESCE(repair.account_reference, 'Cancelled Account'), ' — ', COALESCE(repair.unit_id_snapshot, 'Unit')),
  'Repaired cancelled commission progress',
  'Restored the frozen cancellation commission percentage from discontinued/retained value divided by the original commission base.',
  JSON_OBJECT(
    'accountId', repair.lot_project_account_id,
    'clientProfileId', repair.lot_project_client_profile_id,
    'listingId', repair.lot_project_listing_id,
    'previousPaymentPercent', repair.previous_payment_percent,
    'repairedPaymentPercent', repair.repaired_payment_percent,
    'discontinuedAmount', repair.discontinued_amount,
    'commissionBaseAmount', repair.commission_base_amount,
    'repairSource', '20260908_cancelled_commission_progress_freeze.sql'
  ),
  NULL,
  NULL,
  NOW()
FROM tmp_cancelled_commission_progress_repair repair;

DROP TEMPORARY TABLE IF EXISTS tmp_cancelled_commission_progress_repair;
COMMIT;
