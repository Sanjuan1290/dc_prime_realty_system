-- D&C Prime Realty — Approval/Audit Redesign
-- Batch 1 of 4: Staff/Head/Auditor/System Admin roles and RBAC foundation
-- Apply once to the 2026-10-04 schema before deploying Batch 1 application code.
-- Existing user ids, passwords, project assignments, employee links, account codes,
-- user_permissions and audit history are preserved.

SET NAMES utf8mb4;

-- 1) Expand users.role temporarily so legacy roles can be migrated in-place.
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'super_admin',
    'admin','marketing','sales','accounting','operations',
    'system_admin','auditor',
    'marketing_staff','marketing_head',
    'sales_staff','sales_head',
    'accounting_staff','accounting_head',
    'operations_staff','operations_head',
    'division_manager','sales_director','unit_manager','sales_agent','external_group'
  ) NOT NULL DEFAULT 'sales_agent';

UPDATE users SET role = 'system_admin' WHERE role = 'admin';
UPDATE users SET role = 'marketing_staff' WHERE role = 'marketing';
UPDATE users SET role = 'sales_staff' WHERE role = 'sales';
UPDATE users SET role = 'accounting_staff' WHERE role = 'accounting';
UPDATE users SET role = 'operations_staff' WHERE role = 'operations';

ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'super_admin','system_admin','auditor',
    'marketing_staff','marketing_head',
    'sales_staff','sales_head',
    'accounting_staff','accounting_head',
    'operations_staff','operations_head',
    'division_manager','sales_director','unit_manager','sales_agent','external_group'
  ) NOT NULL DEFAULT 'sales_agent';

-- 2) Migrate persisted role-default templates without changing existing user permissions.
ALTER TABLE role_permission_defaults
  MODIFY COLUMN role ENUM(
    'admin','marketing','sales','accounting','operations',
    'system_admin','auditor',
    'marketing_staff','marketing_head',
    'sales_staff','sales_head',
    'accounting_staff','accounting_head',
    'operations_staff','operations_head'
  ) NOT NULL;

UPDATE role_permission_defaults SET role = 'system_admin' WHERE role = 'admin';
UPDATE role_permission_defaults SET role = 'marketing_staff' WHERE role = 'marketing';
UPDATE role_permission_defaults SET role = 'sales_staff' WHERE role = 'sales';
UPDATE role_permission_defaults SET role = 'accounting_staff' WHERE role = 'accounting';
UPDATE role_permission_defaults SET role = 'operations_staff' WHERE role = 'operations';

ALTER TABLE role_permission_defaults
  MODIFY COLUMN role ENUM(
    'system_admin','auditor',
    'marketing_staff','marketing_head',
    'sales_staff','sales_head',
    'accounting_staff','accounting_head',
    'operations_staff','operations_head'
  ) NOT NULL;

-- 3) System Admin and Auditor are global-scope governance roles.
UPDATE users
SET account_category = 'system',
    all_projects_access = 1,
    admin_all_projects = 1
WHERE role IN ('super_admin','system_admin','auditor');

DELETE upa
FROM user_project_access upa
INNER JOIN users u ON u.id = upa.user_id
WHERE u.role IN ('super_admin','system_admin','auditor');

UPDATE users
SET account_category = 'system'
WHERE role IN (
  'marketing_staff','marketing_head',
  'sales_staff','sales_head',
  'accounting_staff','accounting_head',
  'operations_staff','operations_head'
);

-- 4) Role history preserves promotions/demotions while the same user account remains active.
CREATE TABLE IF NOT EXISTS user_role_history (
  user_role_history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  previous_role VARCHAR(80) NOT NULL,
  new_role VARCHAR(80) NOT NULL,
  previous_account_code VARCHAR(80) NULL,
  current_account_code VARCHAR(80) NULL,
  reason VARCHAR(500) NULL,
  changed_by_user_id INT UNSIGNED NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_role_history_id),
  KEY idx_user_role_history_user (user_id, changed_at),
  KEY idx_user_role_history_changed_by (changed_by_user_id),
  CONSTRAINT fk_user_role_history_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_user_role_history_changed_by
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- 5) Protected business-action permission changes are intentionally deferred to Batch 4.

-- 6) Workflow/RBAC permissions required by governance roles.
INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('marketing_staff', 'workflow.review_center.view', 1, NULL),
  ('sales_staff', 'workflow.review_center.view', 1, NULL),
  ('accounting_staff', 'workflow.review_center.view', 1, NULL),
  ('operations_staff', 'workflow.review_center.view', 1, NULL),

  ('system_admin', 'system.access_control.view', 1, NULL),
  ('system_admin', 'system.access_control.manage', 1, NULL),
  ('system_admin', 'workflow.review_center.view', 1, NULL),
  ('system_admin', 'workflow.system_correction.apply', 1, NULL),

  ('marketing_head', 'workflow.review_center.view', 1, NULL),
  ('marketing_head', 'workflow.department.review', 1, NULL),
  ('marketing_head', 'workflow.department.return_for_correction', 1, NULL),
  ('marketing_head', 'workflow.department.approve_protected_change', 1, NULL),
  ('marketing_head', 'workflow.department.case.respond', 1, NULL),

  ('sales_head', 'workflow.review_center.view', 1, NULL),
  ('sales_head', 'workflow.department.review', 1, NULL),
  ('sales_head', 'workflow.department.return_for_correction', 1, NULL),
  ('sales_head', 'workflow.department.approve_protected_change', 1, NULL),
  ('sales_head', 'workflow.department.case.respond', 1, NULL),

  ('accounting_head', 'workflow.review_center.view', 1, NULL),
  ('accounting_head', 'workflow.department.review', 1, NULL),
  ('accounting_head', 'workflow.department.return_for_correction', 1, NULL),
  ('accounting_head', 'workflow.department.approve_protected_change', 1, NULL),
  ('accounting_head', 'workflow.department.case.respond', 1, NULL),

  ('operations_head', 'workflow.review_center.view', 1, NULL),
  ('operations_head', 'workflow.department.review', 1, NULL),
  ('operations_head', 'workflow.department.return_for_correction', 1, NULL),
  ('operations_head', 'workflow.department.approve_protected_change', 1, NULL),
  ('operations_head', 'workflow.department.case.respond', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

-- Auditor permissions are enforced by application policy as immutable read-only,
-- but persist the expected baseline for reporting/diagnostics.
INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
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
  ('auditor', 'workflow.audit.correction.verify', 1, NULL)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_at = CURRENT_TIMESTAMP;

