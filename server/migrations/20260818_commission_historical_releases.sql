-- 2026-08-18 — Controlled historical commission release dates.
--
-- Purpose:
-- 1. Keep actual_release_date as the authoritative date the seller was paid.
-- 2. Distinguish normal/live releases from historical records encoded later.
-- 3. Preserve when the release was recorded in the system and an optional
--    historical-source note without rewriting existing financial history.
-- 4. Preserve the same metadata when released commissions are copied into the
--    immutable cancelled-sale archive.
--
-- SAFE / NON-DESTRUCTIVE:
-- - Existing actual_release_date values are NOT changed.
-- - Existing released amounts/statuses are NOT recalculated.
-- - Existing rows default to release_entry_mode = 'live'.
-- - release_recorded_at remains NULL for pre-migration releases because the
--   original recording timestamp cannot be reconstructed reliably.
--
-- TiDB/MySQL-compatible for the current project. Ordinary ALTER statements are
-- used; no stored procedures or DELIMITER blocks are required.

USE `dc_prime_realty_system_db`;

ALTER TABLE lot_project_commission_releases
  ADD COLUMN IF NOT EXISTS release_entry_mode
    ENUM('live','historical') NOT NULL DEFAULT 'live'
    AFTER released_by_user_id;

ALTER TABLE lot_project_commission_releases
  ADD COLUMN IF NOT EXISTS release_recorded_at
    DATETIME NULL
    AFTER release_entry_mode;

ALTER TABLE lot_project_commission_releases
  ADD COLUMN IF NOT EXISTS historical_release_note
    VARCHAR(500) NULL
    AFTER release_recorded_at;

CREATE INDEX IF NOT EXISTS idx_commission_release_entry_mode_date
  ON lot_project_commission_releases (release_entry_mode, actual_release_date);

ALTER TABLE lot_project_archived_commission_releases
  ADD COLUMN IF NOT EXISTS release_entry_mode
    ENUM('live','historical') NOT NULL DEFAULT 'live'
    AFTER actual_release_date;

ALTER TABLE lot_project_archived_commission_releases
  ADD COLUMN IF NOT EXISTS release_recorded_at
    DATETIME NULL
    AFTER release_entry_mode;

ALTER TABLE lot_project_archived_commission_releases
  ADD COLUMN IF NOT EXISTS historical_release_note
    VARCHAR(500) NULL
    AFTER release_recorded_at;

CREATE INDEX IF NOT EXISTS idx_archived_commission_release_entry_mode_date
  ON lot_project_archived_commission_releases (release_entry_mode, actual_release_date);

-- -----------------------------------------------------------------------------
-- READ-ONLY VERIFICATION
-- Expected: 6 rows (3 live-release columns + 3 archived-release columns).
-- -----------------------------------------------------------------------------
SELECT
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  COLUMN_DEFAULT,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'lot_project_commission_releases',
    'lot_project_archived_commission_releases'
  )
  AND COLUMN_NAME IN (
    'release_entry_mode',
    'release_recorded_at',
    'historical_release_note'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- Existing financial history must remain unchanged. This is a post-migration
-- visibility check only; compare these totals with the pre-migration backup or
-- preflight values taken before running this migration.
SELECT
  COUNT(*) AS released_stage_count,
  COALESCE(SUM(net_release_amount), 0) AS released_net_total,
  MIN(actual_release_date) AS earliest_actual_release_date,
  MAX(actual_release_date) AS latest_actual_release_date
FROM lot_project_commission_releases
WHERE release_status = 'Released';

SELECT
  release_entry_mode,
  COUNT(*) AS row_count
FROM lot_project_commission_releases
GROUP BY release_entry_mode
ORDER BY release_entry_mode;
