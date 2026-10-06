/*
  D&C Prime Realty
  2026-10-06 Batch 13: Staff correction access to Review Center.

  A Department Head can return an already-completed Staff operation for
  correction. Staff must therefore be able to see that returned Review, read the
  reason, open the affected record, and resubmit the same Review.

  This migration restores ONLY workflow.review_center.view for Department Staff.
  Server-side Review Center queries remain scoped so Staff can see their own
  review history and can act only on their own returned_for_correction items.

  This is intentionally applied to both role defaults and existing Staff
  accounts so a returned correction cannot become unreachable after deployment.
*/

USE `dc_prime_realty_system_db`;

START TRANSACTION;

INSERT INTO `role_permission_defaults` (`role`, `permission_key`, `allowed`, `updated_by_user_id`)
VALUES
  ('marketing_staff', 'workflow.review_center.view', 1, NULL),
  ('sales_staff', 'workflow.review_center.view', 1, NULL),
  ('accounting_staff', 'workflow.review_center.view', 1, NULL),
  ('operations_staff', 'workflow.review_center.view', 1, NULL)
ON DUPLICATE KEY UPDATE
  `allowed` = VALUES(`allowed`),
  `updated_at` = CURRENT_TIMESTAMP;

INSERT INTO `user_permissions` (`user_id`, `permission_key`, `allowed`, `granted_by_user_id`)
SELECT u.`id`, 'workflow.review_center.view', 1, NULL
FROM `users` u
WHERE u.`role` IN ('marketing_staff','sales_staff','accounting_staff','operations_staff')
ON DUPLICATE KEY UPDATE
  `allowed` = VALUES(`allowed`),
  `updated_at` = CURRENT_TIMESTAMP;

COMMIT;

-- Verification: each Staff template should have the permission enabled.
SELECT `role`, `permission_key`, `allowed`
FROM `role_permission_defaults`
WHERE `role` IN ('marketing_staff','sales_staff','accounting_staff','operations_staff')
  AND `permission_key` = 'workflow.review_center.view'
ORDER BY `role`;

-- Verification: all current Department Staff accounts should have it enabled.
SELECT u.`role`, COUNT(*) AS `staff_accounts_with_review_center`
FROM `user_permissions` up
INNER JOIN `users` u ON u.`id` = up.`user_id`
WHERE u.`role` IN ('marketing_staff','sales_staff','accounting_staff','operations_staff')
  AND up.`permission_key` = 'workflow.review_center.view'
  AND up.`allowed` = 1
GROUP BY u.`role`
ORDER BY u.`role`;
