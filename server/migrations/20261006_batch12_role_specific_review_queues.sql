/*
  D&C Prime Realty
  2026-10-06 Batch 12: role-specific Review Center queues.

  Review Center is an action inbox for:
    - Department Heads
    - Auditor
    - System Admin
    - Super Admin

  Staff do not use Review Center. Staff continue normal work in the source modules;
  review/correction status is communicated through workflow notifications.

  This migration removes only Review Center access from Staff defaults and from
  existing Staff accounts. No review/audit history is deleted.
*/

USE `dc_prime_realty_system_db`;

START TRANSACTION;

DELETE FROM `role_permission_defaults`
WHERE `role` IN ('marketing_staff','sales_staff','accounting_staff','operations_staff')
  AND `permission_key` = 'workflow.review_center.view';

DELETE up
FROM `user_permissions` up
INNER JOIN `users` u ON u.`id` = up.`user_id`
WHERE u.`role` IN ('marketing_staff','sales_staff','accounting_staff','operations_staff')
  AND up.`permission_key` = 'workflow.review_center.view';

COMMIT;

-- Verification: Staff should return zero rows.
SELECT `role`, `permission_key`, `allowed`
FROM `role_permission_defaults`
WHERE `permission_key` = 'workflow.review_center.view'
ORDER BY `role`;

SELECT u.`role`, COUNT(*) AS `staff_accounts_with_review_center`
FROM `user_permissions` up
INNER JOIN `users` u ON u.`id` = up.`user_id`
WHERE u.`role` IN ('marketing_staff','sales_staff','accounting_staff','operations_staff')
  AND up.`permission_key` = 'workflow.review_center.view'
  AND up.`allowed` = 1
GROUP BY u.`role`;
