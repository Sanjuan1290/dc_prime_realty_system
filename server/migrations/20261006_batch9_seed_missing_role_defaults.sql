/*
  D&C Prime Realty
  2026-10-06 Batch 9: seed missing role permission defaults.
  Run after 20261006_batch8_role_default_cleanup.sql.

  A database built from a structure-only export never receives the role
  default seeds from earlier migrations, so role_permission_defaults is empty
  and every role (Staff, Head, System Admin, Auditor) defaults to its required
  keys only. This seeds the recommended templates from
  server/config/recommendedRolePermissions.js.

  Safety:
  - A role is seeded only when none of its rows were saved from Role & Access
    Control (updated_by_user_id IS NOT NULL), so customised defaults are kept.
  - INSERT IGNORE only adds missing rows; it never removes or changes a row.
  - Only direct keys are stored. Heads inherit their Staff role and required
    keys come from the application policy, so Heads and Auditor get no rows.
  - Existing user_permissions rows are not changed. Use Apply Latest Role
    Default on any existing account that should receive the seeded defaults.
  Idempotent and TiDB-safe (same temporary-table pattern as 20260925).
*/
SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS rbac_20261006_seed_role_defaults;
CREATE TEMPORARY TABLE rbac_20261006_seed_role_defaults (
  role VARCHAR(40) NOT NULL,
  permission_key VARCHAR(120) NOT NULL,
  PRIMARY KEY (role, permission_key)
) ENGINE=InnoDB;

INSERT INTO rbac_20261006_seed_role_defaults (role, permission_key) VALUES
('system_admin', 'attendance.view'),
('system_admin', 'employee_salary.history.view'),
('system_admin', 'employee_salary.view'),
('system_admin', 'employees.employment_history.view'),
('system_admin', 'employees.view'),
('system_admin', 'lot_project.account_history.view'),
('system_admin', 'lot_project.buyer_documents.view'),
('system_admin', 'lot_project.commissions.view'),
('system_admin', 'lot_project.dashboard.view'),
('system_admin', 'lot_project.listing_profile.view'),
('system_admin', 'lot_project.listings.view'),
('system_admin', 'lot_project.payment_logs.view'),
('system_admin', 'lot_project.payments.view'),
('system_admin', 'lot_project.reports.view'),
('system_admin', 'lot_project.settings.view'),
('system_admin', 'lot_project.view'),
('system_admin', 'system.accredited.view'),
('system_admin', 'system.data_integrity.view'),
('system_admin', 'system.document_templates.view'),
('system_admin', 'system.documents.view'),
('system_admin', 'system.notifications.view'),
('system_admin', 'system.projects.print_price_list'),
('system_admin', 'system.projects.view'),
('system_admin', 'system.reports.view'),

('marketing_staff', 'lot_project.dashboard.view'),
('marketing_staff', 'lot_project.listings.view'),
('marketing_staff', 'lot_project.reports.view'),
('marketing_staff', 'lot_project.view'),
('marketing_staff', 'system.accredited.view'),
('marketing_staff', 'system.dashboard.view'),
('marketing_staff', 'system.documents.view'),
('marketing_staff', 'system.notifications.view'),
('marketing_staff', 'system.projects.print_price_list'),
('marketing_staff', 'system.projects.view'),
('marketing_staff', 'system.reports.view'),
('marketing_staff', 'system.seller_groups.manage'),
('marketing_staff', 'system.seller_groups.view'),
('marketing_staff', 'system.users.create'),
('marketing_staff', 'system.users.edit'),

('sales_staff', 'lot_project.account_history.view'),
('sales_staff', 'lot_project.buyer_documents.update'),
('sales_staff', 'lot_project.buyer_documents.view'),
('sales_staff', 'lot_project.buyer_profile.edit'),
('sales_staff', 'lot_project.commissions.view'),
('sales_staff', 'lot_project.dashboard.view'),
('sales_staff', 'lot_project.listing_profile.view'),
('sales_staff', 'lot_project.listings.view'),
('sales_staff', 'lot_project.printouts.use'),
('sales_staff', 'lot_project.reports.view'),
('sales_staff', 'lot_project.reservation.correct'),
('sales_staff', 'lot_project.reservations.create'),
('sales_staff', 'lot_project.view'),
('sales_staff', 'system.accredited.print'),
('sales_staff', 'system.accredited.view'),
('sales_staff', 'system.dashboard.view'),
('sales_staff', 'system.documents.view'),
('sales_staff', 'system.notifications.view'),
('sales_staff', 'system.projects.print_price_list'),
('sales_staff', 'system.projects.view'),
('sales_staff', 'system.reports.view'),

('accounting_staff', 'audit.logs.view'),
('accounting_staff', 'employee_salary.correct_finalized'),
('accounting_staff', 'employee_salary.finalize'),
('accounting_staff', 'employee_salary.generate'),
('accounting_staff', 'employee_salary.history.view'),
('accounting_staff', 'employee_salary.recalculate_draft'),
('accounting_staff', 'employee_salary.receipt.export'),
('accounting_staff', 'employee_salary.receipt.print'),
('accounting_staff', 'employee_salary.release'),
('accounting_staff', 'employee_salary.settings.manage'),
('accounting_staff', 'employee_salary.summary.export'),
('accounting_staff', 'employee_salary.view'),
('accounting_staff', 'employees.employment_history.view'),
('accounting_staff', 'lot_project.account_history.view'),
('accounting_staff', 'lot_project.buyer_documents.view'),
('accounting_staff', 'lot_project.commissions.adjust'),
('accounting_staff', 'lot_project.commissions.hold'),
('accounting_staff', 'lot_project.commissions.release'),
('accounting_staff', 'lot_project.commissions.unhold'),
('accounting_staff', 'lot_project.commissions.view'),
('accounting_staff', 'lot_project.dashboard.view'),
('accounting_staff', 'lot_project.listing_profile.view'),
('accounting_staff', 'lot_project.listings.view'),
('accounting_staff', 'lot_project.payment_logs.view'),
('accounting_staff', 'lot_project.payments.create'),
('accounting_staff', 'lot_project.payments.delete'),
('accounting_staff', 'lot_project.payments.edit'),
('accounting_staff', 'lot_project.payments.view'),
('accounting_staff', 'lot_project.penalties.correct'),
('accounting_staff', 'lot_project.printouts.use'),
('accounting_staff', 'lot_project.reports.export'),
('accounting_staff', 'lot_project.reports.view'),
('accounting_staff', 'lot_project.view'),
('accounting_staff', 'system.accredited.print'),
('accounting_staff', 'system.accredited.upload_proof'),
('accounting_staff', 'system.accredited.view'),
('accounting_staff', 'system.dashboard.view'),
('accounting_staff', 'system.documents.view'),
('accounting_staff', 'system.notifications.view'),
('accounting_staff', 'system.projects.print_price_list'),
('accounting_staff', 'system.projects.view'),
('accounting_staff', 'system.reports.export'),
('accounting_staff', 'system.reports.view'),

('operations_staff', 'attendance.manage'),
('operations_staff', 'attendance.view'),
('operations_staff', 'audit.logs.view'),
('operations_staff', 'employees.compensation.manage'),
('operations_staff', 'employees.employment_change.create'),
('operations_staff', 'employees.employment_history.view'),
('operations_staff', 'employees.manage'),
('operations_staff', 'employees.view'),
('operations_staff', 'lot_project.account_history.view'),
('operations_staff', 'lot_project.buyer_documents.update'),
('operations_staff', 'lot_project.buyer_documents.view'),
('operations_staff', 'lot_project.buyer_profile.edit'),
('operations_staff', 'lot_project.commissions.view'),
('operations_staff', 'lot_project.dashboard.view'),
('operations_staff', 'lot_project.listing_profile.view'),
('operations_staff', 'lot_project.listings.create'),
('operations_staff', 'lot_project.listings.delete'),
('operations_staff', 'lot_project.listings.edit'),
('operations_staff', 'lot_project.listings.import'),
('operations_staff', 'lot_project.listings.view'),
('operations_staff', 'lot_project.payment_logs.view'),
('operations_staff', 'lot_project.printouts.use'),
('operations_staff', 'lot_project.reports.view'),
('operations_staff', 'lot_project.reservations.create'),
('operations_staff', 'lot_project.settings.manage'),
('operations_staff', 'lot_project.settings.view'),
('operations_staff', 'lot_project.view'),
('operations_staff', 'system.accredited.view'),
('operations_staff', 'system.dashboard.view'),
('operations_staff', 'system.document_templates.create'),
('operations_staff', 'system.document_templates.delete'),
('operations_staff', 'system.document_templates.edit'),
('operations_staff', 'system.document_templates.view'),
('operations_staff', 'system.documents.create'),
('operations_staff', 'system.documents.delete'),
('operations_staff', 'system.documents.edit'),
('operations_staff', 'system.documents.view'),
('operations_staff', 'system.notifications.manage'),
('operations_staff', 'system.notifications.view'),
('operations_staff', 'system.projects.create'),
('operations_staff', 'system.projects.edit'),
('operations_staff', 'system.projects.print_price_list'),
('operations_staff', 'system.projects.view'),
('operations_staff', 'system.reports.export'),
('operations_staff', 'system.reports.view'),
('operations_staff', 'system.users.view');

INSERT IGNORE INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
SELECT seed.role, seed.permission_key, 1, NULL
FROM rbac_20261006_seed_role_defaults seed
LEFT JOIN (
  SELECT DISTINCT role
  FROM role_permission_defaults
  WHERE updated_by_user_id IS NOT NULL
) customised ON customised.role = seed.role
WHERE customised.role IS NULL;

DROP TEMPORARY TABLE IF EXISTS rbac_20261006_seed_role_defaults;

