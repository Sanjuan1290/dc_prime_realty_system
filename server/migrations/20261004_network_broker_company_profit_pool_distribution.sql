-- D&C Prime Realty
-- 2026-10-04 Network + Broker Identity + Company Profit + Pool Distribution redesign.
-- TiDB-safe / idempotent migration for the current production schema.
--
-- Safe migration principles:
--   * Historical commission amounts are not recalculated.
--   * Existing seller_groups IDs / API relationships are preserved.
--   * New broker identity columns are nullable for legacy rows; the application requires them on create/edit.
--   * DDL statements are intentionally separate. TiDB validates multi-schema ALTER TABLE
--     statements against the pre-change schema, so a column added earlier in the same ALTER
--     cannot safely be referenced by a later AFTER clause.

-- -----------------------------------------------------------------------------
-- Network broker identity
-- -----------------------------------------------------------------------------
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS broker_name VARCHAR(180) NULL AFTER seller_group_external_account_user_id;
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS broker_license_number VARCHAR(100) NULL AFTER broker_name;
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS realty_name VARCHAR(180) NULL AFTER broker_license_number;
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS broker_prc_number VARCHAR(100) NULL AFTER realty_name;
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS broker_name_normalized VARCHAR(180) NULL AFTER broker_prc_number;
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS broker_license_number_normalized VARCHAR(100) NULL AFTER broker_name_normalized;
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS realty_name_normalized VARCHAR(180) NULL AFTER broker_license_number_normalized;
ALTER TABLE seller_groups
  ADD COLUMN IF NOT EXISTS broker_prc_number_normalized VARCHAR(100) NULL AFTER realty_name_normalized;

-- -----------------------------------------------------------------------------
-- Network project allocation precision + Company Profit
-- -----------------------------------------------------------------------------
ALTER TABLE seller_group_lot_project_rates
  MODIFY COLUMN seller_group_pool_rate DECIMAL(7,4) NOT NULL DEFAULT 8.0000;
ALTER TABLE seller_group_lot_project_rates
  ADD COLUMN IF NOT EXISTS company_profit_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000 AFTER seller_group_pool_rate;
ALTER TABLE seller_group_lot_project_rates
  MODIFY COLUMN division_manager_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE seller_group_lot_project_rates
  MODIFY COLUMN sales_director_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE seller_group_lot_project_rates
  MODIFY COLUMN unit_manager_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE seller_group_lot_project_rates
  MODIFY COLUMN sales_agent_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000;

-- -----------------------------------------------------------------------------
-- Global In-House pool-share defaults (Super Admin managed)
-- -----------------------------------------------------------------------------
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS in_house_dm_pool_share_percent DECIMAL(7,4) NOT NULL DEFAULT 14.1800 AFTER default_release_day_two;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS in_house_sd_pool_share_percent DECIMAL(7,4) NOT NULL DEFAULT 15.8200 AFTER in_house_dm_pool_share_percent;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS in_house_um_pool_share_percent DECIMAL(7,4) NOT NULL DEFAULT 20.0000 AFTER in_house_sd_pool_share_percent;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS in_house_sa_pool_share_percent DECIMAL(7,4) NOT NULL DEFAULT 50.0000 AFTER in_house_um_pool_share_percent;

-- -----------------------------------------------------------------------------
-- Commission snapshots / precision
-- -----------------------------------------------------------------------------
ALTER TABLE lot_project_commissions
  MODIFY COLUMN commission_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE lot_project_commissions
  ADD COLUMN IF NOT EXISTS commission_pool_rate_snapshot DECIMAL(7,4) NULL AFTER seller_group_name_snapshot;
ALTER TABLE lot_project_commissions
  ADD COLUMN IF NOT EXISTS company_profit_rate_snapshot DECIMAL(7,4) NULL AFTER commission_pool_rate_snapshot;
ALTER TABLE lot_project_commissions
  ADD COLUMN IF NOT EXISTS distribution_pool_rate_snapshot DECIMAL(7,4) NULL AFTER company_profit_rate_snapshot;
ALTER TABLE lot_project_commissions
  ADD COLUMN IF NOT EXISTS role_pool_share_percent_snapshot DECIMAL(7,4) NULL AFTER distribution_pool_rate_snapshot;

ALTER TABLE lot_project_archived_commission_releases
  MODIFY COLUMN commission_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000;

-- -----------------------------------------------------------------------------
-- Recalculate only the live Network configuration cache.
-- Historical lot_project_commissions rows remain untouched.
-- Sales Agent receives the rounding residual so the seller allocation is exact.
-- -----------------------------------------------------------------------------
UPDATE seller_group_lot_project_rates rate_row
INNER JOIN seller_groups network_row
  ON network_row.seller_group_id = rate_row.seller_group_id
INNER JOIN system_settings settings_row
  ON settings_row.system_setting_id = 1
SET
  rate_row.division_manager_rate = ROUND(
    (rate_row.seller_group_pool_rate - rate_row.company_profit_rate)
    * settings_row.in_house_dm_pool_share_percent / 100,
    4
  ),
  rate_row.sales_director_rate = ROUND(
    (rate_row.seller_group_pool_rate - rate_row.company_profit_rate)
    * settings_row.in_house_sd_pool_share_percent / 100,
    4
  ),
  rate_row.unit_manager_rate = ROUND(
    (rate_row.seller_group_pool_rate - rate_row.company_profit_rate)
    * settings_row.in_house_um_pool_share_percent / 100,
    4
  ),
  rate_row.sales_agent_rate = ROUND(
    (rate_row.seller_group_pool_rate - rate_row.company_profit_rate)
    - ROUND((rate_row.seller_group_pool_rate - rate_row.company_profit_rate) * settings_row.in_house_dm_pool_share_percent / 100, 4)
    - ROUND((rate_row.seller_group_pool_rate - rate_row.company_profit_rate) * settings_row.in_house_sd_pool_share_percent / 100, 4)
    - ROUND((rate_row.seller_group_pool_rate - rate_row.company_profit_rate) * settings_row.in_house_um_pool_share_percent / 100, 4),
    4
  )
WHERE network_row.seller_group_type = 'in_house';

-- -----------------------------------------------------------------------------
-- Case/whitespace-normalized uniqueness guards.
-- TiDB supports CREATE INDEX IF NOT EXISTS. NULL legacy values remain allowed.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_network_broker_name_normalized
  ON seller_groups (broker_name_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS uq_network_broker_license_normalized
  ON seller_groups (broker_license_number_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS uq_network_realty_name_normalized
  ON seller_groups (realty_name_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS uq_network_broker_prc_normalized
  ON seller_groups (broker_prc_number_normalized);
