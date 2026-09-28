-- 2026-09-27 — Remove surname from internal system account codes.
-- Final format: ROLECODE-<users.id padded to at least 5 digits>
-- Example: CORTEZ-SS-00002 -> SS-00002
--
-- Safe for existing databases. Historical users keep their same user IDs;
-- only the visible account_code is normalized.

USE `dc_prime_realty_system_db`;

START TRANSACTION;

-- Temporary collision-proof values avoid unique-key conflicts during normalization.
UPDATE `users`
SET `account_code` = CONCAT('__ROLE_ID_CODE__', `id`)
WHERE COALESCE(`account_category`, 'seller') = 'system'
   OR `role` IN ('super_admin','admin','marketing','sales','accounting','operations');

UPDATE `users`
SET `account_code` = CONCAT(
  CASE `role`
    WHEN 'super_admin' THEN 'SA'
    WHEN 'admin' THEN 'ADM'
    WHEN 'marketing' THEN 'MKT'
    WHEN 'sales' THEN 'SS'
    WHEN 'accounting' THEN 'ACC'
    WHEN 'operations' THEN 'OPS'
    ELSE UPPER(LEFT(COALESCE(`role`, 'USR'), 3))
  END,
  '-',
  CASE
    WHEN `id` < 100000 THEN LPAD(CAST(`id` AS CHAR), 5, '0')
    ELSE CAST(`id` AS CHAR)
  END
)
WHERE COALESCE(`account_category`, 'seller') = 'system'
   OR `role` IN ('super_admin','admin','marketing','sales','accounting','operations');

COMMIT;

SELECT `id`, `account_code`, `first_name`, `last_name`, `role`, `status`
FROM `users`
WHERE COALESCE(`account_category`, 'seller') = 'system'
   OR `role` IN ('super_admin','admin','marketing','sales','accounting','operations')
ORDER BY `id`;

