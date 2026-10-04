-- 2026-09-27 — System account code = role abbreviation + users.id primary key.
--
-- Canonical visible format:
--   ROLECODE-<users.id padded to at least 5 digits>
-- Examples:
--   users.id = 1  / admin      -> ADM-00001
--   users.id = 2  / marketing  -> MKT-00002
--   users.id = 27 / sales      -> SS-00027
--
-- Surnames are intentionally excluded. users.id is globally unique.
-- person_key + role_sequence remain unchanged and continue to track a person's
-- historical position sequence. They are intentionally NOT used in account_code.

USE `dc_prime_realty_system_db`;

START TRANSACTION;

UPDATE `users`
SET `account_code` = CONCAT('__ACCOUNT_ID_MIGRATION__', `id`)
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

SELECT
  `id`, `account_code`, `first_name`, `last_name`, `role`, `person_key`, `role_sequence`, `status`
FROM `users`
WHERE COALESCE(`account_category`, 'seller') = 'system'
   OR `role` IN ('super_admin','admin','marketing','sales','accounting','operations')
ORDER BY `id`;
