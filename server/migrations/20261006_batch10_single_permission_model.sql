/*
  D&C Prime Realty
  2026-10-06 Batch 10: one permission model for every non-owner role.
  Run after 20261006_batch9_seed_missing_role_defaults.sql, together with the
  matching server release.

  Before: the server added "Required" and "From Staff Role" permissions at
  runtime, and ignored stored rows outside each role's limits ("Restricted
  governance"). After: Super Admin and System Admin have full access, and every
  other account holds exactly its stored permission rows.

  This migration converts the stored data so that NO account gains or loses
  access in the switch:
    1. Remove stored rows the old rules ignored (outside a role's old limits).
    2. Store each account's runtime-added keys (old Required, and for Heads the
       current Staff role default they inherited).
    3. Turn each role default into a complete template (Staff + required,
       Head = Staff default + Head extras + required, Auditor + core keys).
    4. Remove rows for System Admin accounts and the System Admin template,
       which now always have full access.
  Idempotent and TiDB-safe. Generated from the pre-change rules.
*/
SET NAMES utf8mb4;

START TRANSACTION;

/* 1. Rows the old rules ignored */
DELETE FROM role_permission_defaults
WHERE role = 'auditor'
  AND permission_key IN (
    'attendance.manage',
    'audit.logs.archive',
    'employee_salary.correct_finalized',
    'employee_salary.finalize',
    'employee_salary.generate',
    'employee_salary.recalculate_draft',
    'employee_salary.release',
    'employee_salary.settings.manage',
    'employees.compensation.manage',
    'employees.employment_change.create',
    'employees.manage',
    'lot_project.buyer_documents.update',
    'lot_project.buyer_profile.edit',
    'lot_project.cancellations.manage',
    'lot_project.cancellations.release_unit',
    'lot_project.cancellations.settle',
    'lot_project.commissions.adjust',
    'lot_project.commissions.hold',
    'lot_project.commissions.manage',
    'lot_project.commissions.release',
    'lot_project.commissions.unhold',
    'lot_project.listings.create',
    'lot_project.listings.delete',
    'lot_project.listings.edit',
    'lot_project.listings.import',
    'lot_project.listings.import_undo',
    'lot_project.listings.manage',
    'lot_project.payments.create',
    'lot_project.payments.delete',
    'lot_project.payments.edit',
    'lot_project.penalties.correct',
    'lot_project.reservation.correct',
    'lot_project.reservations.create',
    'lot_project.settings.manage',
    'system.access_control.manage',
    'system.accredited.manage',
    'system.accredited.upload_proof',
    'system.document_templates.create',
    'system.document_templates.delete',
    'system.document_templates.edit',
    'system.documents.create',
    'system.documents.delete',
    'system.documents.edit',
    'system.documents.manage',
    'system.notifications.manage',
    'system.projects.create',
    'system.projects.delete',
    'system.projects.edit',
    'system.projects.manage',
    'system.seller_groups.manage',
    'system.settings.manage',
    'system.users.change_status',
    'system.users.create',
    'system.users.deactivate',
    'system.users.edit',
    'system.users.manage',
    'system.users.reset_password',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'marketing_staff'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'marketing_head'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'sales_staff'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'sales_head'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'accounting_staff'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'accounting_head'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'operations_staff'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE FROM role_permission_defaults
WHERE role = 'operations_head'
  AND permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'auditor'
  AND up.permission_key IN (
    'attendance.manage',
    'audit.logs.archive',
    'employee_salary.correct_finalized',
    'employee_salary.finalize',
    'employee_salary.generate',
    'employee_salary.recalculate_draft',
    'employee_salary.release',
    'employee_salary.settings.manage',
    'employees.compensation.manage',
    'employees.employment_change.create',
    'employees.manage',
    'lot_project.buyer_documents.update',
    'lot_project.buyer_profile.edit',
    'lot_project.cancellations.manage',
    'lot_project.cancellations.release_unit',
    'lot_project.cancellations.settle',
    'lot_project.commissions.adjust',
    'lot_project.commissions.hold',
    'lot_project.commissions.manage',
    'lot_project.commissions.release',
    'lot_project.commissions.unhold',
    'lot_project.listings.create',
    'lot_project.listings.delete',
    'lot_project.listings.edit',
    'lot_project.listings.import',
    'lot_project.listings.import_undo',
    'lot_project.listings.manage',
    'lot_project.payments.create',
    'lot_project.payments.delete',
    'lot_project.payments.edit',
    'lot_project.penalties.correct',
    'lot_project.reservation.correct',
    'lot_project.reservations.create',
    'lot_project.settings.manage',
    'system.access_control.manage',
    'system.accredited.manage',
    'system.accredited.upload_proof',
    'system.document_templates.create',
    'system.document_templates.delete',
    'system.document_templates.edit',
    'system.documents.create',
    'system.documents.delete',
    'system.documents.edit',
    'system.documents.manage',
    'system.notifications.manage',
    'system.projects.create',
    'system.projects.delete',
    'system.projects.edit',
    'system.projects.manage',
    'system.seller_groups.manage',
    'system.settings.manage',
    'system.users.change_status',
    'system.users.create',
    'system.users.deactivate',
    'system.users.edit',
    'system.users.manage',
    'system.users.reset_password',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'marketing_staff'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'marketing_head'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'sales_staff'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'sales_head'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'accounting_staff'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'accounting_head'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'operations_staff'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.department.approve_protected_change',
    'workflow.department.case.respond',
    'workflow.department.return_for_correction',
    'workflow.department.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

DELETE up FROM user_permissions up INNER JOIN users u ON u.id = up.user_id
WHERE u.role = 'operations_head'
  AND up.permission_key IN (
    'audit.logs.archive',
    'system.access_control.manage',
    'system.access_control.view',
    'system.settings.manage',
    'workflow.audit.case.create',
    'workflow.audit.case.resolve',
    'workflow.audit.correction.verify',
    'workflow.audit.review',
    'workflow.emergency_override',
    'workflow.system_correction.apply'
  );

/* Old runtime-added (Required) keys per role */
DROP TEMPORARY TABLE IF EXISTS rbac_20261006_required;
CREATE TEMPORARY TABLE rbac_20261006_required (
  role VARCHAR(40) NOT NULL,
  permission_key VARCHAR(120) NOT NULL,
  PRIMARY KEY (role, permission_key)
) ENGINE=InnoDB;

INSERT INTO rbac_20261006_required (role, permission_key) VALUES
('auditor', 'system.dashboard.view'),
('auditor', 'system.reports.view'),
('auditor', 'system.projects.view'),
('auditor', 'system.accredited.view'),
('auditor', 'system.seller_groups.view'),
('auditor', 'system.documents.view'),
('auditor', 'system.document_templates.view'),
('auditor', 'system.notifications.view'),
('auditor', 'system.data_integrity.view'),
('auditor', 'audit.logs.view'),
('auditor', 'system.users.view'),
('auditor', 'system.settings.view'),
('auditor', 'system.access_control.view'),
('auditor', 'employees.view'),
('auditor', 'employees.employment_history.view'),
('auditor', 'employee_salary.view'),
('auditor', 'employee_salary.history.view'),
('auditor', 'attendance.view'),
('auditor', 'lot_project.view'),
('auditor', 'lot_project.dashboard.view'),
('auditor', 'lot_project.reports.view'),
('auditor', 'lot_project.listings.view'),
('auditor', 'lot_project.listing_profile.view'),
('auditor', 'lot_project.payments.view'),
('auditor', 'lot_project.buyer_documents.view'),
('auditor', 'lot_project.account_history.view'),
('auditor', 'lot_project.payment_logs.view'),
('auditor', 'lot_project.commissions.view'),
('auditor', 'lot_project.settings.view'),
('auditor', 'workflow.review_center.view'),
('auditor', 'workflow.audit.review'),
('auditor', 'workflow.audit.case.create'),
('auditor', 'workflow.audit.case.resolve'),
('auditor', 'workflow.audit.correction.verify'),
('marketing_staff', 'workflow.review_center.view'),
('marketing_head', 'workflow.review_center.view'),
('marketing_head', 'workflow.department.review'),
('marketing_head', 'workflow.department.return_for_correction'),
('marketing_head', 'workflow.department.approve_protected_change'),
('marketing_head', 'workflow.department.case.respond'),
('sales_staff', 'workflow.review_center.view'),
('sales_head', 'workflow.review_center.view'),
('sales_head', 'workflow.department.review'),
('sales_head', 'workflow.department.return_for_correction'),
('sales_head', 'workflow.department.approve_protected_change'),
('sales_head', 'workflow.department.case.respond'),
('accounting_staff', 'workflow.review_center.view'),
('accounting_head', 'workflow.review_center.view'),
('accounting_head', 'workflow.department.review'),
('accounting_head', 'workflow.department.return_for_correction'),
('accounting_head', 'workflow.department.approve_protected_change'),
('accounting_head', 'workflow.department.case.respond'),
('operations_staff', 'workflow.review_center.view'),
('operations_head', 'workflow.review_center.view'),
('operations_head', 'workflow.department.review'),
('operations_head', 'workflow.department.return_for_correction'),
('operations_head', 'workflow.department.approve_protected_change'),
('operations_head', 'workflow.department.case.respond');

/* 2a. Accounts: store old Required keys */
INSERT IGNORE INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, r.permission_key, 1, NULL
FROM users u
INNER JOIN rbac_20261006_required r ON r.role = u.role;

/* 2b. Head accounts: store what they inherited from the Staff role default
   (Staff template rows plus the Staff required key) */
INSERT IGNORE INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, inherited.permission_key, 1, NULL
FROM users u
INNER JOIN (
  SELECT d.role, d.permission_key FROM role_permission_defaults d WHERE d.allowed = 1
  UNION
  SELECT r.role, r.permission_key FROM rbac_20261006_required r
) inherited ON inherited.role = CASE u.role
    WHEN 'marketing_head' THEN 'marketing_staff'
    WHEN 'sales_head' THEN 'sales_staff'
    WHEN 'accounting_head' THEN 'accounting_staff'
    WHEN 'operations_head' THEN 'operations_staff'
    ELSE NULL
  END;

/* 3. Role defaults become complete templates.
   Heads first, while Staff templates still hold only their stored rows. */
DROP TEMPORARY TABLE IF EXISTS rbac_20261006_head_from_staff;
CREATE TEMPORARY TABLE rbac_20261006_head_from_staff (
  role VARCHAR(40) NOT NULL,
  permission_key VARCHAR(120) NOT NULL,
  PRIMARY KEY (role, permission_key)
) ENGINE=InnoDB;

INSERT IGNORE INTO rbac_20261006_head_from_staff (role, permission_key)
SELECT head.role, d.permission_key
FROM role_permission_defaults d
INNER JOIN (
  SELECT 'marketing_head' AS role, 'marketing_staff' AS staff_role
  UNION ALL
  SELECT 'sales_head' AS role, 'sales_staff' AS staff_role
  UNION ALL
  SELECT 'accounting_head' AS role, 'accounting_staff' AS staff_role
  UNION ALL
  SELECT 'operations_head' AS role, 'operations_staff' AS staff_role
) head ON head.staff_role = d.role
WHERE d.allowed = 1;

INSERT IGNORE INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
SELECT role, permission_key, 1, NULL FROM rbac_20261006_head_from_staff;

INSERT IGNORE INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
SELECT head.role, r.permission_key, 1, NULL
FROM rbac_20261006_required r
INNER JOIN (
  SELECT 'marketing_head' AS role, 'marketing_staff' AS staff_role
  UNION ALL
  SELECT 'sales_head' AS role, 'sales_staff' AS staff_role
  UNION ALL
  SELECT 'accounting_head' AS role, 'accounting_staff' AS staff_role
  UNION ALL
  SELECT 'operations_head' AS role, 'operations_staff' AS staff_role
) head ON head.staff_role = r.role;

INSERT IGNORE INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
SELECT role, permission_key, 1, NULL FROM rbac_20261006_required;

/* 4. Owner-level accounts need no rows */
DELETE up FROM user_permissions up
INNER JOIN users u ON u.id = up.user_id
WHERE u.role IN ('super_admin', 'system_admin');

DELETE FROM role_permission_defaults WHERE role = 'system_admin';

DROP TEMPORARY TABLE IF EXISTS rbac_20261006_head_from_staff;
DROP TEMPORARY TABLE IF EXISTS rbac_20261006_required;

COMMIT;
