-- D&C Prime Realty — RBAC role/default/project-scope reconciliation
-- Date: 2026-09-25
-- Prerequisite: 20260922_system_user_access_control.sql
--
-- IMPORTANT:
--   * This migration intentionally updates ROLE DEFAULT TEMPLATES only.
--   * Existing user_permissions are NOT rewritten. Existing accounts keep their
--     authoritative per-account permissions until a Super Admin explicitly uses
--     "Reset to Role Default".
--   * Accredited-seller roles are not modified.

SET NAMES utf8mb4;

-- Keep the six internal system roles distinct from accredited-seller roles.
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'super_admin','admin','marketing','sales','accounting','operations',
    'division_manager','sales_director','unit_manager','sales_agent','external_group'
  ) NOT NULL DEFAULT 'sales_agent';

-- Re-assert the generalized project-scope invariants without touching normal
-- per-account selected-project assignments.
UPDATE users
SET account_category = 'system'
WHERE role IN ('super_admin','admin','marketing','sales','accounting','operations');

UPDATE users
SET all_projects_access = 1
WHERE role = 'super_admin';

DELETE upa
FROM user_project_access upa
INNER JOIN users u ON u.id = upa.user_id
WHERE u.role = 'super_admin';

-- Preserve any legacy Admin project assignments that were added after the
-- original 2026-09-22 backfill.
INSERT IGNORE INTO user_project_access (user_id, lot_project_id, created_by_user_id, created_at)
SELECT apa.user_id, apa.lot_project_id, apa.created_by_user_id, apa.created_at
FROM admin_project_access apa
INNER JOIN users u ON u.id = apa.user_id
WHERE u.role = 'admin';

-- Build the approved role-default template in a temporary table, then sync the
-- persisted defaults to it. This does NOT modify user_permissions.
DROP TEMPORARY TABLE IF EXISTS rbac_20260925_role_defaults;
CREATE TEMPORARY TABLE rbac_20260925_role_defaults (
  role ENUM('admin','marketing','sales','accounting','operations') NOT NULL,
  permission_key VARCHAR(120) NOT NULL,
  PRIMARY KEY (role, permission_key)
) ENGINE=InnoDB;

INSERT INTO rbac_20260925_role_defaults (role, permission_key) VALUES
-- ADMIN
('admin','system.dashboard.view'),
('admin','system.reports.view'),('admin','system.reports.export'),
('admin','system.projects.view'),('admin','system.projects.create'),('admin','system.projects.edit'),('admin','system.projects.print_price_list'),
('admin','system.users.view'),('admin','system.users.create'),('admin','system.users.edit'),('admin','system.users.reset_password'),('admin','system.users.deactivate'),
('admin','system.accredited.view'),('admin','system.accredited.print'),
('admin','employees.view'),('admin','employees.manage'),
('admin','attendance.view'),('admin','attendance.manage'),
('admin','audit.logs.view'),
('admin','system.notifications.view'),('admin','system.notifications.manage'),
('admin','system.documents.view'),('admin','system.documents.create'),('admin','system.documents.edit'),('admin','system.documents.delete'),
('admin','system.document_templates.view'),('admin','system.document_templates.create'),('admin','system.document_templates.edit'),('admin','system.document_templates.delete'),
('admin','lot_project.view'),('admin','lot_project.dashboard.view'),('admin','lot_project.reports.view'),('admin','lot_project.reports.export'),
('admin','lot_project.listings.view'),('admin','lot_project.listings.import'),('admin','lot_project.listings.create'),('admin','lot_project.listings.edit'),('admin','lot_project.listing_profile.view'),('admin','lot_project.reservations.create'),
('admin','lot_project.buyer_profile.edit'),
('admin','lot_project.payments.view'),('admin','lot_project.payments.create'),('admin','lot_project.payments.edit'),
('admin','lot_project.buyer_documents.view'),('admin','lot_project.buyer_documents.update'),
('admin','lot_project.account_history.view'),('admin','lot_project.printouts.use'),('admin','lot_project.payment_logs.view'),
('admin','lot_project.commissions.view'),
('admin','lot_project.settings.view'),('admin','lot_project.settings.manage'),

-- MARKETING
('marketing','system.dashboard.view'),('marketing','system.reports.view'),
('marketing','system.projects.view'),('marketing','system.projects.print_price_list'),
('marketing','system.accredited.view'),('marketing','system.notifications.view'),('marketing','system.documents.view'),
('marketing','lot_project.view'),('marketing','lot_project.dashboard.view'),('marketing','lot_project.reports.view'),('marketing','lot_project.listings.view'),

-- SALES (internal system role; deliberately separate from sales_agent)
('sales','system.dashboard.view'),('sales','system.reports.view'),
('sales','system.projects.view'),('sales','system.projects.print_price_list'),
('sales','system.accredited.view'),('sales','system.accredited.print'),('sales','system.notifications.view'),('sales','system.documents.view'),
('sales','lot_project.view'),('sales','lot_project.dashboard.view'),('sales','lot_project.reports.view'),
('sales','lot_project.listings.view'),('sales','lot_project.listing_profile.view'),('sales','lot_project.reservations.create'),
('sales','lot_project.buyer_profile.edit'),('sales','lot_project.buyer_documents.view'),('sales','lot_project.buyer_documents.update'),
('sales','lot_project.account_history.view'),('sales','lot_project.printouts.use'),('sales','lot_project.commissions.view'),

-- ACCOUNTING
('accounting','system.dashboard.view'),('accounting','system.reports.view'),('accounting','system.reports.export'),
('accounting','system.projects.view'),('accounting','system.projects.print_price_list'),
('accounting','system.accredited.view'),('accounting','system.accredited.print'),('accounting','system.accredited.upload_proof'),
('accounting','audit.logs.view'),('accounting','system.notifications.view'),('accounting','system.documents.view'),
('accounting','lot_project.view'),('accounting','lot_project.dashboard.view'),('accounting','lot_project.reports.view'),('accounting','lot_project.reports.export'),
('accounting','lot_project.listings.view'),('accounting','lot_project.listing_profile.view'),
('accounting','lot_project.payments.view'),('accounting','lot_project.payments.create'),('accounting','lot_project.payments.edit'),('accounting','lot_project.payments.delete'),
('accounting','lot_project.buyer_documents.view'),('accounting','lot_project.account_history.view'),('accounting','lot_project.printouts.use'),('accounting','lot_project.payment_logs.view'),
('accounting','lot_project.commissions.view'),('accounting','lot_project.commissions.release'),('accounting','lot_project.commissions.hold'),('accounting','lot_project.commissions.unhold'),

-- OPERATIONS
('operations','system.dashboard.view'),('operations','system.reports.view'),('operations','system.reports.export'),
('operations','system.projects.view'),('operations','system.projects.create'),('operations','system.projects.edit'),('operations','system.projects.print_price_list'),
('operations','system.users.view'),('operations','system.accredited.view'),
('operations','employees.view'),('operations','employees.manage'),('operations','attendance.view'),('operations','attendance.manage'),
('operations','audit.logs.view'),('operations','system.notifications.view'),('operations','system.notifications.manage'),
('operations','system.documents.view'),('operations','system.documents.create'),('operations','system.documents.edit'),('operations','system.documents.delete'),
('operations','system.document_templates.view'),('operations','system.document_templates.create'),('operations','system.document_templates.edit'),('operations','system.document_templates.delete'),
('operations','lot_project.view'),('operations','lot_project.dashboard.view'),('operations','lot_project.reports.view'),
('operations','lot_project.listings.view'),('operations','lot_project.listings.import'),('operations','lot_project.listings.create'),('operations','lot_project.listings.edit'),('operations','lot_project.listings.delete'),('operations','lot_project.listing_profile.view'),('operations','lot_project.reservations.create'),
('operations','lot_project.buyer_profile.edit'),('operations','lot_project.buyer_documents.view'),('operations','lot_project.buyer_documents.update'),
('operations','lot_project.account_history.view'),('operations','lot_project.printouts.use'),('operations','lot_project.payment_logs.view'),('operations','lot_project.commissions.view'),
('operations','lot_project.settings.view'),('operations','lot_project.settings.manage');

-- Remove stale/default-on permissions that are not in the approved 2026-09-25
-- template. Existing account permissions are intentionally unaffected.
DELETE rpd
FROM role_permission_defaults rpd
LEFT JOIN rbac_20260925_role_defaults desired
  ON desired.role = rpd.role
 AND desired.permission_key = rpd.permission_key
WHERE rpd.role IN ('admin','marketing','sales','accounting','operations')
  AND desired.permission_key IS NULL;

-- Add/enable every approved default.
INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
SELECT role, permission_key, 1, NULL
FROM rbac_20260925_role_defaults
ON DUPLICATE KEY UPDATE
  allowed = 1,
  updated_at = CURRENT_TIMESTAMP;

DROP TEMPORARY TABLE IF EXISTS rbac_20260925_role_defaults;

-- Super Admin remains a bypass role and therefore intentionally has no rows in
-- role_permission_defaults or user_permissions requirements.
