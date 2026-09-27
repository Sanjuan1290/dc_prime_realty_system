-- 2026-09-27 — System account code suffix = users.id primary key.
--
-- Canonical visible format:
--   SURNAME-ROLECODE-<users.id padded to at least 3 digits>
-- Examples:
--   users.id = 1  -> CORTEZ-ADM-001
--   users.id = 2  -> REYES-MKT-002
--   users.id = 27 -> CORTEZ-SS-027
--
-- person_key + role_sequence remain unchanged and continue to track a person's
-- historical position sequence. They are intentionally NOT used in account_code.

USE `dc_prime_realty_system_db`;

START TRANSACTION;

-- Move existing system account codes to collision-proof temporary values first.
-- This avoids transient unique-key conflicts when converting legacy per-surname
-- sequence codes to users.id-based codes.
UPDATE `users`
SET `account_code` = CONCAT('__ACCOUNT_ID_MIGRATION__', `id`)
WHERE COALESCE(`account_category`, 'seller') = 'system'
   OR `role` IN ('super_admin','admin','marketing','sales','accounting','operations');

UPDATE `users`
SET `account_code` = CONCAT(
  COALESCE(
    NULLIF(REGEXP_REPLACE(UPPER(COALESCE(`last_name`, 'USER')), '[^A-Z0-9]', ''), ''),
    'USER'
  ),
  '-',
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
    WHEN `id` < 1000 THEN LPAD(CAST(`id` AS CHAR), 3, '0')
    ELSE CAST(`id` AS CHAR)
  END
)
WHERE COALESCE(`account_category`, 'seller') = 'system'
   OR `role` IN ('super_admin','admin','marketing','sales','accounting','operations');

COMMIT;

-- Read-only verification.
SELECT
  `id`,
  `account_code`,
  `first_name`,
  `last_name`,
  `role`,
  `person_key`,
  `role_sequence`,
  `status`
FROM `users`
WHERE COALESCE(`account_category`, 'seller') = 'system'
   OR `role` IN ('super_admin','admin','marketing','sales','accounting','operations')
ORDER BY `id`;
