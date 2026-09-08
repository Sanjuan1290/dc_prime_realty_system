-- D&C Prime Realty
-- Role-based seller rates and hierarchy synchronization
--
-- New meaning of accredited_seller_lot_project_rates:
--   Agent                         = sales commission rate
--   Manager / Broker / BNM       = override commission rate
--
-- Run after the 20260718 direct-agent override migrations.
-- This migration does not delete historical commission or reservation records.

START TRANSACTION;

-- A selected group head must belong to that group and report to the developer.
UPDATE accredited_sellers seller
INNER JOIN seller_groups group_row
  ON group_row.seller_group_head_user_id = seller.user_id
SET
  seller.seller_group_id = group_row.seller_group_id,
  seller.accredited_seller_reports_under_user_id = NULL
WHERE COALESCE(seller.is_system_dummy, 0) = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_legacy_seller_project_rates;
CREATE TEMPORARY TABLE tmp_legacy_seller_project_rates AS
SELECT
  rate_row.accredited_seller_id,
  rate_row.lot_project_id,
  rate_row.accredited_seller_project_rate,
  rate_row.accredited_seller_lot_project_rate_status
FROM accredited_seller_lot_project_rates rate_row;

ALTER TABLE tmp_legacy_seller_project_rates
  ADD PRIMARY KEY (accredited_seller_id, lot_project_id);

DROP TEMPORARY TABLE IF EXISTS tmp_parent_override_rates;
CREATE TEMPORARY TABLE tmp_parent_override_rates AS
SELECT
  override_row.parent_accredited_seller_id AS accredited_seller_id,
  override_row.lot_project_id,
  MAX(CASE
    WHEN override_row.override_rate_status = 'active' THEN override_row.override_rate
    ELSE 0
  END) AS role_override_rate,
  CASE
    WHEN SUM(override_row.override_rate_status = 'active') > 0 THEN 'active'
    ELSE 'inactive'
  END AS role_override_status
FROM seller_hierarchy_lot_project_overrides override_row
GROUP BY
  override_row.parent_accredited_seller_id,
  override_row.lot_project_id;

ALTER TABLE tmp_parent_override_rates
  ADD PRIMARY KEY (accredited_seller_id, lot_project_id);

DROP TEMPORARY TABLE IF EXISTS tmp_child_ceiling_rates;
CREATE TEMPORARY TABLE tmp_child_ceiling_rates AS
SELECT
  parent.accredited_seller_id AS parent_accredited_seller_id,
  child_rate.lot_project_id,
  MAX(child_rate.accredited_seller_project_rate) AS highest_child_ceiling
FROM accredited_sellers parent
INNER JOIN users parent_user ON parent_user.id = parent.user_id
INNER JOIN accredited_sellers child
  ON child.seller_group_id = parent.seller_group_id
 AND COALESCE(child.is_system_dummy, 0) = 0
INNER JOIN users child_user ON child_user.id = child.user_id
INNER JOIN seller_groups group_row ON group_row.seller_group_id = parent.seller_group_id
INNER JOIN tmp_legacy_seller_project_rates child_rate
  ON child_rate.accredited_seller_id = child.accredited_seller_id
WHERE COALESCE(parent.is_system_dummy, 0) = 0
  AND (
    child.accredited_seller_reports_under_user_id = parent.user_id
    OR (
      group_row.seller_group_head_user_id = parent.user_id
      AND child.accredited_seller_reports_under_user_id IS NULL
      AND child.user_id <> parent.user_id
    )
  )
GROUP BY
  parent.accredited_seller_id,
  child_rate.lot_project_id;

ALTER TABLE tmp_child_ceiling_rates
  ADD PRIMARY KEY (parent_accredited_seller_id, lot_project_id);

-- Agents keep their explicit direct rate when one exists. Legacy project rates
-- are used only as a fallback.
INSERT INTO accredited_seller_lot_project_rates (
  accredited_seller_id,
  lot_project_id,
  accredited_seller_project_rate,
  accredited_seller_lot_project_rate_status
)
SELECT
  seller.accredited_seller_id,
  legacy_rate.lot_project_id,
  COALESCE(direct_rate.direct_rate, legacy_rate.accredited_seller_project_rate, 0),
  COALESCE(direct_rate.direct_rate_status, legacy_rate.accredited_seller_lot_project_rate_status, 'inactive')
FROM accredited_sellers seller
INNER JOIN users user ON user.id = seller.user_id
INNER JOIN tmp_legacy_seller_project_rates legacy_rate
  ON legacy_rate.accredited_seller_id = seller.accredited_seller_id
LEFT JOIN agent_lot_project_direct_rates direct_rate
  ON direct_rate.accredited_seller_id = seller.accredited_seller_id
 AND direct_rate.lot_project_id = legacy_rate.lot_project_id
WHERE user.role = 'agent'
  AND COALESCE(seller.is_system_dummy, 0) = 0
ON DUPLICATE KEY UPDATE
  accredited_seller_project_rate = VALUES(accredited_seller_project_rate),
  accredited_seller_lot_project_rate_status = VALUES(accredited_seller_lot_project_rate_status);

-- Managers, Brokers, and BNMs use one override rate per project. Existing
-- relationship overrides are preferred. For older cumulative rows, the
-- incremental fallback is parent ceiling minus the highest direct-child ceiling.
INSERT INTO accredited_seller_lot_project_rates (
  accredited_seller_id,
  lot_project_id,
  accredited_seller_project_rate,
  accredited_seller_lot_project_rate_status
)
SELECT
  seller.accredited_seller_id,
  legacy_rate.lot_project_id,
  COALESCE(
    parent_override.role_override_rate,
    GREATEST(
      legacy_rate.accredited_seller_project_rate - COALESCE(child_ceiling.highest_child_ceiling, 0),
      0
    )
  ),
  COALESCE(
    parent_override.role_override_status,
    legacy_rate.accredited_seller_lot_project_rate_status,
    'inactive'
  )
FROM accredited_sellers seller
INNER JOIN users user ON user.id = seller.user_id
INNER JOIN tmp_legacy_seller_project_rates legacy_rate
  ON legacy_rate.accredited_seller_id = seller.accredited_seller_id
LEFT JOIN tmp_parent_override_rates parent_override
  ON parent_override.accredited_seller_id = seller.accredited_seller_id
 AND parent_override.lot_project_id = legacy_rate.lot_project_id
LEFT JOIN tmp_child_ceiling_rates child_ceiling
  ON child_ceiling.parent_accredited_seller_id = seller.accredited_seller_id
 AND child_ceiling.lot_project_id = legacy_rate.lot_project_id
WHERE user.role IN ('manager', 'broker', 'broker_network_manager')
  AND COALESCE(seller.is_system_dummy, 0) = 0
ON DUPLICATE KEY UPDATE
  accredited_seller_project_rate = VALUES(accredited_seller_project_rate),
  accredited_seller_lot_project_rate_status = VALUES(accredited_seller_lot_project_rate_status);

-- Mirror every real Agent project rate into the direct-rate table.
INSERT INTO agent_lot_project_direct_rates (
  accredited_seller_id,
  lot_project_id,
  direct_rate,
  direct_rate_status
)
SELECT
  seller.accredited_seller_id,
  role_rate.lot_project_id,
  role_rate.accredited_seller_project_rate,
  role_rate.accredited_seller_lot_project_rate_status
FROM accredited_sellers seller
INNER JOIN users user ON user.id = seller.user_id
INNER JOIN accredited_seller_lot_project_rates role_rate
  ON role_rate.accredited_seller_id = seller.accredited_seller_id
WHERE user.role = 'agent'
  AND COALESCE(seller.is_system_dummy, 0) = 0
ON DUPLICATE KEY UPDATE
  direct_rate = VALUES(direct_rate),
  direct_rate_status = VALUES(direct_rate_status);

-- Non-agents cannot own an active sales/direct rate.
UPDATE agent_lot_project_direct_rates direct_rate
INNER JOIN accredited_sellers seller
  ON seller.accredited_seller_id = direct_rate.accredited_seller_id
INNER JOIN users user ON user.id = seller.user_id
SET direct_rate.direct_rate_status = 'inactive'
WHERE user.role <> 'agent';

-- Rebuild the current manager-to-managed-seller links from Reports Under.
-- Group heads have no managed-parent row because they report to the developer.
DELETE managed_link
FROM accredited_seller_managed_sellers managed_link
INNER JOIN accredited_sellers managed_seller
  ON managed_seller.accredited_seller_id = managed_link.managed_accredited_seller_id
WHERE COALESCE(managed_seller.is_system_dummy, 0) = 0;

INSERT INTO accredited_seller_managed_sellers (
  manager_accredited_seller_id,
  managed_accredited_seller_id
)
SELECT
  parent.accredited_seller_id,
  child.accredited_seller_id
FROM accredited_sellers child
INNER JOIN accredited_sellers parent
  ON parent.user_id = child.accredited_seller_reports_under_user_id
 AND parent.seller_group_id = child.seller_group_id
WHERE COALESCE(child.is_system_dummy, 0) = 0
  AND COALESCE(parent.is_system_dummy, 0) = 0
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Relationship overrides mirror the direct parent's role-based project rate.
INSERT INTO seller_hierarchy_lot_project_overrides (
  child_accredited_seller_id,
  parent_accredited_seller_id,
  lot_project_id,
  override_rate,
  override_rate_status
)
SELECT
  child.accredited_seller_id,
  parent.accredited_seller_id,
  parent_rate.lot_project_id,
  parent_rate.accredited_seller_project_rate,
  parent_rate.accredited_seller_lot_project_rate_status
FROM accredited_sellers child
INNER JOIN seller_groups group_row ON group_row.seller_group_id = child.seller_group_id
INNER JOIN accredited_sellers parent
  ON parent.seller_group_id = child.seller_group_id
 AND parent.accredited_seller_id <> child.accredited_seller_id
INNER JOIN users parent_user ON parent_user.id = parent.user_id
INNER JOIN accredited_seller_lot_project_rates parent_rate
  ON parent_rate.accredited_seller_id = parent.accredited_seller_id
WHERE COALESCE(child.is_system_dummy, 0) = 0
  AND COALESCE(parent.is_system_dummy, 0) = 0
  AND parent_user.role IN ('manager', 'broker', 'broker_network_manager')
  AND (
    child.accredited_seller_reports_under_user_id = parent.user_id
    OR (
      child.accredited_seller_reports_under_user_id IS NULL
      AND group_row.seller_group_head_user_id = parent.user_id
      AND child.user_id <> parent.user_id
    )
  )
ON DUPLICATE KEY UPDATE
  override_rate = VALUES(override_rate),
  override_rate_status = VALUES(override_rate_status);

-- Old relationship rows that are not the current direct parent are retained for
-- history but disabled.
UPDATE seller_hierarchy_lot_project_overrides override_row
INNER JOIN accredited_sellers child
  ON child.accredited_seller_id = override_row.child_accredited_seller_id
INNER JOIN accredited_sellers parent
  ON parent.accredited_seller_id = override_row.parent_accredited_seller_id
LEFT JOIN seller_groups group_row ON group_row.seller_group_id = child.seller_group_id
SET override_row.override_rate_status = 'inactive'
WHERE child.seller_group_id <> parent.seller_group_id
   OR NOT (
     child.accredited_seller_reports_under_user_id = parent.user_id
     OR (
       child.accredited_seller_reports_under_user_id IS NULL
       AND group_row.seller_group_head_user_id = parent.user_id
       AND child.user_id <> parent.user_id
     )
   );

DROP TEMPORARY TABLE IF EXISTS tmp_child_ceiling_rates;
DROP TEMPORARY TABLE IF EXISTS tmp_parent_override_rates;
DROP TEMPORARY TABLE IF EXISTS tmp_legacy_seller_project_rates;

COMMIT;

-- Review only: this result should be empty after existing accounts are manually
-- aligned to BNM -> Broker -> Manager -> Agent. The application blocks new
-- invalid assignments but this migration does not guess reporting parents.
SELECT
  child.accredited_seller_id,
  TRIM(CONCAT_WS(' ', child_user.first_name, child_user.middle_name, child_user.last_name)) AS seller_name,
  child_user.role AS seller_role,
  child.accredited_seller_reports_under_user_id,
  parent_user.role AS current_parent_role,
  CASE child_user.role
    WHEN 'agent' THEN 'manager'
    WHEN 'manager' THEN 'broker'
    WHEN 'broker' THEN 'broker_network_manager'
    WHEN 'broker_network_manager' THEN 'developer / group head'
    ELSE 'unknown'
  END AS required_parent
FROM accredited_sellers child
INNER JOIN users child_user ON child_user.id = child.user_id
LEFT JOIN users parent_user ON parent_user.id = child.accredited_seller_reports_under_user_id
LEFT JOIN seller_groups group_row ON group_row.seller_group_id = child.seller_group_id
WHERE COALESCE(child.is_system_dummy, 0) = 0
  AND (
    (
      child.user_id = COALESCE(group_row.seller_group_head_user_id, 0)
      AND (
        child_user.role NOT IN ('broker_network_manager', 'broker')
        OR child.accredited_seller_reports_under_user_id IS NOT NULL
      )
    )
    OR (child_user.role = 'agent' AND COALESCE(parent_user.role, '') <> 'manager')
    OR (child_user.role = 'manager' AND COALESCE(parent_user.role, '') <> 'broker')
    OR (
      child_user.role = 'broker'
      AND child.user_id <> COALESCE(group_row.seller_group_head_user_id, 0)
      AND COALESCE(parent_user.role, '') <> 'broker_network_manager'
    )
    OR (
      child_user.role = 'broker_network_manager'
      AND child.user_id <> COALESCE(group_row.seller_group_head_user_id, 0)
    )
  )
ORDER BY child.seller_group_id, child_user.role, seller_name;

