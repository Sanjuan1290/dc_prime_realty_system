USE `dc_prime_realty_system_db`;

-- Restore the current canonical Auditor default permission template.
-- This changes the role default used for NEW Auditor accounts.
-- It does not modify permissions already saved on existing Auditor users.

START TRANSACTION;

DELETE FROM `role_permission_defaults`
WHERE `role` = 'auditor';

INSERT INTO `role_permission_defaults`
  (`role`, `permission_key`, `allowed`, `updated_by_user_id`)
VALUES
  ('auditor', 'system.dashboard.view', 1, NULL),
  ('auditor', 'system.reports.view', 1, NULL),
  ('auditor', 'system.projects.view', 1, NULL),
  ('auditor', 'system.accredited.view', 1, NULL),
  ('auditor', 'system.seller_groups.view', 1, NULL),
  ('auditor', 'system.documents.view', 1, NULL),
  ('auditor', 'system.document_templates.view', 1, NULL),
  ('auditor', 'system.notifications.view', 1, NULL),
  ('auditor', 'system.data_integrity.view', 1, NULL),
  ('auditor', 'audit.logs.view', 1, NULL),
  ('auditor', 'system.users.view', 1, NULL),
  ('auditor', 'system.settings.view', 1, NULL),
  ('auditor', 'system.access_control.view', 1, NULL),
  ('auditor', 'employees.view', 1, NULL),
  ('auditor', 'employees.employment_history.view', 1, NULL),
  ('auditor', 'employee_salary.view', 1, NULL),
  ('auditor', 'employee_salary.history.view', 1, NULL),
  ('auditor', 'attendance.view', 1, NULL),
  ('auditor', 'lot_project.view', 1, NULL),
  ('auditor', 'lot_project.dashboard.view', 1, NULL),
  ('auditor', 'lot_project.reports.view', 1, NULL),
  ('auditor', 'lot_project.listings.view', 1, NULL),
  ('auditor', 'lot_project.listing_profile.view', 1, NULL),
  ('auditor', 'lot_project.payments.view', 1, NULL),
  ('auditor', 'lot_project.buyer_documents.view', 1, NULL),
  ('auditor', 'lot_project.account_history.view', 1, NULL),
  ('auditor', 'lot_project.payment_logs.view', 1, NULL),
  ('auditor', 'lot_project.commissions.view', 1, NULL),
  ('auditor', 'lot_project.settings.view', 1, NULL),
  ('auditor', 'workflow.review_center.view', 1, NULL),
  ('auditor', 'workflow.audit.review', 1, NULL),
  ('auditor', 'workflow.audit.case.create', 1, NULL),
  ('auditor', 'workflow.audit.case.resolve', 1, NULL),
  ('auditor', 'workflow.audit.correction.verify', 1, NULL);

COMMIT;

-- Verification: expected total = 34
SELECT
  `role`,
  COUNT(*) AS `default_permission_count`
FROM `role_permission_defaults`
WHERE `role` = 'auditor'
  AND `allowed` = 1
GROUP BY `role`;

SELECT `permission_key`, `allowed`
FROM `role_permission_defaults`
WHERE `role` = 'auditor'
ORDER BY `permission_key`;
