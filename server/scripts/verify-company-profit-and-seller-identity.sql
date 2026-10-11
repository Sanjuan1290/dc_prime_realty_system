-- D&C Prime Realty
-- READ-ONLY report for the 2026-10-05 rollout (plan items 7 and 8-11).
-- Nothing here modifies data. Run it before and after
-- migrations/20261005_batch5_broker_name_and_company_profit_cap.sql.
--
-- Fix any rows these queries return by editing the Network or seller in the app.
-- The new rules only block a save when that record is next edited, so existing
-- Networks and sellers keep working until then.

-- -----------------------------------------------------------------------------
-- 1) Active In-House Network project rates above the Maximum Company Profit cap,
--    or leaving any role (DM / SD / UM / SA) at 0%.
-- -----------------------------------------------------------------------------
SELECT
  network.seller_group_id,
  network.seller_group_name,
  project.lot_project_name,
  rate.seller_group_pool_rate AS pool_rate,
  rate.company_profit_rate AS company_profit_rate,
  ROUND(rate.seller_group_pool_rate * COALESCE(settings.max_company_profit_percent_of_pool, 50) / 100, 4) AS max_allowed_company_profit,
  rate.division_manager_rate, rate.sales_director_rate, rate.unit_manager_rate, rate.sales_agent_rate,
  CASE
    WHEN rate.company_profit_rate > ROUND(rate.seller_group_pool_rate * COALESCE(settings.max_company_profit_percent_of_pool, 50) / 100, 4)
      THEN 'Company Profit above cap'
    ELSE 'A role receives 0%'
  END AS problem
FROM seller_group_lot_project_rates rate
INNER JOIN seller_groups network ON network.seller_group_id = rate.seller_group_id
INNER JOIN lot_projects project ON project.lot_project_id = rate.lot_project_id
LEFT JOIN system_settings settings ON settings.system_setting_id = 1
WHERE network.seller_group_type = 'in_house'
  AND rate.seller_group_lot_project_rate_status = 'active'
  AND (
    rate.company_profit_rate > ROUND(rate.seller_group_pool_rate * COALESCE(settings.max_company_profit_percent_of_pool, 50) / 100, 4)
    OR rate.division_manager_rate < 0.0001
    OR rate.sales_director_rate < 0.0001
    OR rate.unit_manager_rate < 0.0001
    OR rate.sales_agent_rate < 0.0001
  )
ORDER BY network.seller_group_name, project.lot_project_name;

-- -----------------------------------------------------------------------------
-- 2) Active in-house sellers with no PRC No. (now required; the next edit of
--    these sellers will ask for it).
-- -----------------------------------------------------------------------------
SELECT user.id AS user_id, TRIM(CONCAT_WS(' ', user.first_name, user.middle_name, user.last_name)) AS seller_name,
       user.email, user.role, network.seller_group_name
FROM users user
INNER JOIN accredited_sellers seller ON seller.user_id = user.id
LEFT JOIN seller_groups network ON network.seller_group_id = seller.seller_group_id
WHERE user.status = 'active'
  AND seller.accredited_seller_status = 'active'
  AND COALESCE(seller.is_system_dummy, 0) = 0
  AND user.role IN ('division_manager','sales_director','unit_manager','sales_agent')
  AND TRIM(IFNULL(user.prc_no, '')) = ''
ORDER BY network.seller_group_name, seller_name;

-- -----------------------------------------------------------------------------
-- 3) PRC No. shared by more than one ACTIVE in-house seller
--    (normalized the same way as the app: uppercase, no spaces/dashes/dots/slashes).
-- -----------------------------------------------------------------------------
SELECT normalized_prc, COUNT(*) AS active_sellers,
       GROUP_CONCAT(CONCAT(seller_name, ' <', email, '> in ', IFNULL(network_name, 'no Network')) SEPARATOR ' | ') AS sellers
FROM (
  SELECT UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(user.prc_no, '')), '-', ''), ' ', ''), '.', ''), '/', ''), '_', '')) AS normalized_prc,
         TRIM(CONCAT_WS(' ', user.first_name, user.middle_name, user.last_name)) AS seller_name,
         user.email, network.seller_group_name AS network_name
  FROM users user
  INNER JOIN accredited_sellers seller ON seller.user_id = user.id
  LEFT JOIN seller_groups network ON network.seller_group_id = seller.seller_group_id
  WHERE user.status = 'active'
    AND seller.accredited_seller_status = 'active'
    AND COALESCE(seller.is_system_dummy, 0) = 0
    AND user.role IN ('division_manager','sales_director','unit_manager','sales_agent')
) active_prc
WHERE normalized_prc <> ''
GROUP BY normalized_prc
HAVING COUNT(*) > 1
ORDER BY active_sellers DESC, normalized_prc;

-- -----------------------------------------------------------------------------
-- 4) TIN shared by more than one ACTIVE in-house seller.
-- -----------------------------------------------------------------------------
SELECT normalized_tin, COUNT(*) AS active_sellers,
       GROUP_CONCAT(CONCAT(seller_name, ' <', email, '> in ', IFNULL(network_name, 'no Network')) SEPARATOR ' | ') AS sellers
FROM (
  SELECT UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(user.tin_no, '')), '-', ''), ' ', ''), '.', ''), '/', ''), '_', '')) AS normalized_tin,
         TRIM(CONCAT_WS(' ', user.first_name, user.middle_name, user.last_name)) AS seller_name,
         user.email, network.seller_group_name AS network_name
  FROM users user
  INNER JOIN accredited_sellers seller ON seller.user_id = user.id
  LEFT JOIN seller_groups network ON network.seller_group_id = seller.seller_group_id
  WHERE user.status = 'active'
    AND seller.accredited_seller_status = 'active'
    AND COALESCE(seller.is_system_dummy, 0) = 0
    AND user.role IN ('division_manager','sales_director','unit_manager','sales_agent')
) active_tin
WHERE normalized_tin <> ''
GROUP BY normalized_tin
HAVING COUNT(*) > 1
ORDER BY active_sellers DESC, normalized_tin;

