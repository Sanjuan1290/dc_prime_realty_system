/*
  D&C Prime Realty
  2026-10-06 Batch 8: role permission default cleanup.
  Run after 20261006_batch7_marketing_network_permissions.sql.

  1) Removes stored System Admin and Auditor default rows outside their permission
     ceiling. The application already ignores these rows (filterToRoleCeiling),
     so effective defaults do not change. This clears the 29 legacy Admin rows
     still stored for System Admin.
  2) Adds system.data_integrity.view to the System Admin default. It is part of
     the recommended System Admin template but was never seeded, and it was not
     shown in the permission grid, so it could not be granted from the UI.

  Defaults customised in Role & Access Control are kept.
  Existing user_permissions rows are not changed: use Apply Latest Role Default
  on existing System Admin accounts that should receive Data Integrity access.
  Idempotent and TiDB-safe.
*/
SET NAMES utf8mb4;

START TRANSACTION;

DELETE FROM role_permission_defaults
WHERE role = 'system_admin'
  AND permission_key NOT IN (
    'attendance.view',
    'audit.logs.view',
    'employee_salary.history.view',
    'employee_salary.view',
    'employees.employment_history.view',
    'employees.view',
    'lot_project.account_history.view',
    'lot_project.buyer_documents.update',
    'lot_project.buyer_documents.view',
    'lot_project.buyer_profile.edit',
    'lot_project.commissions.adjust',
    'lot_project.commissions.view',
    'lot_project.dashboard.view',
    'lot_project.listing_profile.view',
    'lot_project.listings.edit',
    'lot_project.listings.view',
    'lot_project.payment_logs.view',
    'lot_project.payments.delete',
    'lot_project.payments.edit',
    'lot_project.payments.view',
    'lot_project.penalties.correct',
    'lot_project.printouts.use',
    'lot_project.reports.view',
    'lot_project.reservation.correct',
    'lot_project.settings.manage',
    'lot_project.settings.view',
    'lot_project.view',
    'system.access_control.manage',
    'system.access_control.view',
    'system.accredited.view',
    'system.dashboard.view',
    'system.data_integrity.view',
    'system.document_templates.view',
    'system.documents.view',
    'system.notifications.view',
    'system.projects.print_price_list',
    'system.projects.view',
    'system.reports.view',
    'system.seller_groups.manage',
    'system.seller_groups.view',
    'system.settings.view',
    'system.users.create',
    'system.users.deactivate',
    'system.users.edit',
    'system.users.reset_password',
    'system.users.view',
    'workflow.review_center.view',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'auditor'
  AND permission_key NOT IN (
    'attendance.view',
    'audit.logs.view',
    'employee_salary.history.view',
    'employee_salary.receipt.export',
    'employee_salary.receipt.print',
    'employee_salary.summary.export',
    'employee_salary.view',
    'employees.employment_history.view',
    'employees.view',
    'lot_project.account_history.view',
    'lot_project.buyer_documents.view',
    'lot_project.commissions.view',
    'lot_project.dashboard.view',
    'lot_project.listing_profile.view',
    'lot_project.listings.view',
    'lot_project.payment_logs.view',
    'lot_project.payments.view',
    'lot_project.printouts.use',
    'lot_project.reports.export',
    'lot_project.reports.view',
    'lot_project.settings.view',
    'lot_project.view',
    'system.access_control.view',
    'system.accredited.print',
    'system.accredited.view',
    'system.dashboard.view',
    'system.data_integrity.view',
    'system.document_templates.view',
    'system.documents.view',
    'system.notifications.view',
    'system.projects.print_price_list',
    'system.projects.view',
    'system.reports.export',
    'system.reports.view',
    'system.seller_groups.view',
    'system.settings.view',
    'system.users.view',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.review_center.view'
  );

INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('system_admin', 'system.data_integrity.view', 1, NULL)
ON DUPLICATE KEY UPDATE
  allowed = VALUES(allowed),
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

