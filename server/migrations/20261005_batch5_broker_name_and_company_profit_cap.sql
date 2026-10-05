-- D&C Prime Realty
-- 2026-10-05 Batch 5: Broker Name may repeat + Maximum Company Profit setting.
-- TiDB-safe / idempotent. Apply after 20261004_network_broker_company_profit_pool_distribution.sql.
--
-- What changes:
--   1. Broker Name is no longer unique. Two different brokers can share a name.
--      Broker License No., Realty Name and PRC No. stay unique across all Networks.
--      A normal (non-unique) index is kept so the duplicate-name warning stays fast.
--   2. system_settings.max_company_profit_percent_of_pool (default 50.0000):
--      the highest Company Profit a Network may keep, as a % of its Pool Rate.
--      Enforced only when a Network is created or edited. Existing Networks and
--      historical commissions are not recalculated.
--
-- No data is modified. Before or after applying, run the read-only report
-- server/scripts/verify-company-profit-and-seller-identity.sql to list Networks
-- that exceed the new cap and sellers that need a PRC No. or have duplicates.
--
-- MySQL 8 note: MySQL does not support DROP INDEX IF EXISTS. On MySQL, run
--   ALTER TABLE seller_groups DROP INDEX uq_network_broker_name_normalized;
-- once instead of the first statement below.

ALTER TABLE seller_groups
  DROP INDEX IF EXISTS uq_network_broker_name_normalized;

CREATE INDEX IF NOT EXISTS idx_network_broker_name_normalized
  ON seller_groups (broker_name_normalized);

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS max_company_profit_percent_of_pool DECIMAL(7,4) NOT NULL DEFAULT 50.0000
  AFTER in_house_sa_pool_share_percent;
