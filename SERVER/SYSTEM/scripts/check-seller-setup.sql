-- Phase 1 - READ ONLY seller setup checks for TiDB Cloud.
-- Run one SELECT at a time in TiDB SQL Editor. Does not change any record.
USE `dc_prime_realty_system_db`;

-- 1. Seller accounts with missing accreditation or mismatched statuses.
SELECT u.id AS seller_user_id, u.account_code, u.role AS position,
       u.status AS account_status, s.accredited_seller_status AS seller_status,
       s.seller_group_id AS network_id,
       CASE WHEN s.accredited_seller_id IS NULL THEN 'Seller record missing'
            ELSE 'Account and seller status do not match' END AS problem
FROM users u LEFT JOIN accredited_sellers s ON s.user_id=u.id
WHERE u.role IN ('division_manager','sales_director','unit_manager','sales_agent')
  AND (s.accredited_seller_id IS NULL OR u.status <> s.accredited_seller_status)
ORDER BY u.id;

-- 2. Active sellers whose manager is missing, inactive, in another Network or has the wrong position.
SELECT s.accredited_seller_id, u.id AS seller_user_id,
       TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) AS seller,
       u.role AS position, s.seller_group_id AS network_id,
       s.accredited_seller_reports_under_user_id AS reports_under_user_id,
       manager.role AS manager_position, manager.status AS manager_account_status,
       parent.accredited_seller_status AS manager_seller_status,
       CASE WHEN s.accredited_seller_reports_under_user_id IS NULL THEN 'No manager assigned'
            WHEN manager.id IS NULL OR parent.accredited_seller_id IS NULL THEN 'Manager record missing'
            WHEN parent.seller_group_id <> s.seller_group_id THEN 'Manager belongs to another Network'
            WHEN manager.status <> 'active' OR parent.accredited_seller_status <> 'active' THEN 'Manager is inactive'
            WHEN (u.role='sales_agent' AND manager.role<>'unit_manager') OR
                 (u.role='unit_manager' AND manager.role<>'sales_director') OR
                 (u.role='sales_director' AND manager.role<>'division_manager') THEN 'Incorrect manager position'
            ELSE 'Ready' END AS finding
FROM accredited_sellers s
JOIN users u ON u.id=s.user_id
LEFT JOIN users manager ON manager.id=s.accredited_seller_reports_under_user_id
LEFT JOIN accredited_sellers parent ON parent.user_id=manager.id
WHERE COALESCE(s.is_system_dummy,0)=0
  AND u.role IN ('sales_agent','unit_manager','sales_director')
  AND u.status='active' AND s.accredited_seller_status='active'
HAVING finding <> 'Ready'
ORDER BY network_id, position, seller;

-- 3. Network Heads that are missing, inactive or not Division Managers.
SELECT g.seller_group_id, g.seller_group_name, g.seller_group_status,
       g.seller_group_head_user_id, u.role AS head_position,
       u.status AS head_account_status, s.accredited_seller_status AS head_seller_status,
       CASE WHEN g.seller_group_head_user_id IS NULL THEN 'No Network Head assigned'
            WHEN u.role <> 'division_manager' THEN 'Network Head must be Division Manager'
            WHEN u.status <> 'active' OR s.accredited_seller_status <> 'active' THEN 'Network Head is inactive'
            WHEN s.seller_group_id <> g.seller_group_id THEN 'Network Head belongs to another Network'
            ELSE 'Ready' END AS finding
FROM seller_groups g
LEFT JOIN users u ON u.id=g.seller_group_head_user_id
LEFT JOIN accredited_sellers s ON s.user_id=u.id
WHERE g.seller_group_type='in_house'
ORDER BY g.seller_group_name;

-- 4. Existing buyer accounts assigned to a seller who is currently inactive.
-- History only: never update old commissions or buyer accounts from this result.
SELECT p.lot_project_client_profile_id AS buyer_account_id,
       p.assigned_accredited_seller_id AS seller_id,
       u.account_code AS seller_account,
       u.status AS account_status, s.accredited_seller_status AS seller_status
FROM lot_project_client_profiles p
JOIN accredited_sellers s ON s.accredited_seller_id=p.assigned_accredited_seller_id
JOIN users u ON u.id=s.user_id
WHERE u.status <> 'active' OR s.accredited_seller_status <> 'active'
ORDER BY p.lot_project_client_profile_id DESC;

