-- System User Access Control Refactor
-- Adds Marketing, Sales, Accounting, Operations, role defaults, per-account permissions,
-- generalized project scope, immutable historical account metadata, and safe reusable email login.

SET NAMES utf8mb4;

ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'super_admin','admin','marketing','sales','accounting','operations',
    'division_manager','sales_director','unit_manager','sales_agent','external_group'
  ) NOT NULL DEFAULT 'sales_agent';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_code VARCHAR(80) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS account_category ENUM('system','seller','external') NOT NULL DEFAULT 'seller' AFTER account_code,
  ADD COLUMN IF NOT EXISTS person_key CHAR(36) NULL AFTER account_category,
  ADD COLUMN IF NOT EXISTS role_sequence INT UNSIGNED NOT NULL DEFAULT 1 AFTER role,
  ADD COLUMN IF NOT EXISTS all_projects_access TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_all_projects,
  ADD COLUMN IF NOT EXISTS deactivated_at DATETIME NULL AFTER status,
  ADD COLUMN IF NOT EXISTS deactivated_by_user_id INT UNSIGNED NULL AFTER deactivated_at,
  ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(500) NULL AFTER deactivated_by_user_id;

UPDATE users
SET account_category = CASE
  WHEN role IN ('super_admin','admin','marketing','sales','accounting','operations') THEN 'system'
  WHEN role = 'external_group' THEN 'external'
  ELSE 'seller'
END;

UPDATE users SET person_key = UUID() WHERE person_key IS NULL OR person_key = '';
UPDATE users SET all_projects_access = COALESCE(admin_all_projects, 0)
WHERE role IN ('super_admin','admin') AND all_projects_access = 0;
UPDATE users SET all_projects_access = 1 WHERE role = 'super_admin';

-- Existing unique email prevents a retired employee from receiving a new role account.
ALTER TABLE users DROP INDEX uq_users_email;

-- Only one ACTIVE login-capable non-system account may own a given email.
ALTER TABLE users
  ADD COLUMN active_login_email VARCHAR(150)
    GENERATED ALWAYS AS (
      CASE
        WHEN status = 'active' AND can_login = 1 AND is_system_account = 0
        THEN LOWER(email)
        ELSE NULL
      END
    ) STORED;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_active_login_email (active_login_email),
  ADD UNIQUE KEY uq_users_account_code (account_code),
  ADD UNIQUE KEY uq_users_person_role_sequence (person_key, role, role_sequence),
  ADD KEY idx_users_person_key (person_key),
  ADD KEY idx_users_account_category (account_category),
  ADD KEY idx_users_role_status (role, status),
  ADD KEY idx_users_deactivated_by (deactivated_by_user_id),
  ADD CONSTRAINT fk_users_deactivated_by
    FOREIGN KEY (deactivated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS role_permission_defaults (
  role_permission_default_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role ENUM('admin','marketing','sales','accounting','operations') NOT NULL,
  permission_key VARCHAR(120) NOT NULL,
  allowed TINYINT(1) NOT NULL DEFAULT 1,
  updated_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_permission_default_id),
  UNIQUE KEY uq_role_permission_default (role, permission_key),
  KEY idx_role_permission_default_updated_by (updated_by_user_id),
  CONSTRAINT fk_role_permission_default_updated_by
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  user_permission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  permission_key VARCHAR(120) NOT NULL,
  allowed TINYINT(1) NOT NULL DEFAULT 1,
  granted_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_permission_id),
  UNIQUE KEY uq_user_permission (user_id, permission_key),
  KEY idx_user_permission_granted_by (granted_by_user_id),
  CONSTRAINT fk_user_permission_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_permission_granted_by FOREIGN KEY (granted_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_project_access (
  user_project_access_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_project_access_id),
  UNIQUE KEY uq_user_project_access (user_id, lot_project_id),
  KEY idx_user_project_access_project (lot_project_id),
  KEY idx_user_project_access_created_by (created_by_user_id),
  CONSTRAINT fk_user_project_access_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_project_access_project FOREIGN KEY (lot_project_id) REFERENCES lot_projects(lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_project_access_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Preserve all current Admin project assignments.
INSERT IGNORE INTO user_project_access (user_id, lot_project_id, created_by_user_id, created_at)
SELECT user_id, lot_project_id, created_by_user_id, created_at
FROM admin_project_access;

-- Default permission templates. Super Admin is deliberately absent: it always bypasses the matrix.
INSERT INTO role_permission_defaults (role, permission_key, allowed) VALUES
-- Admin
('admin','system.dashboard.view',1),('admin','system.reports.view',1),('admin','system.reports.export',1),
('admin','system.projects.view',1),('admin','system.projects.create',1),('admin','system.projects.edit',1),('admin','system.projects.print_price_list',1),
('admin','system.accredited.view',1),('admin','system.accredited.print',1),('admin','system.accredited.upload_proof',1),
('admin','system.seller_groups.view',1),('admin','system.seller_groups.manage',1),
('admin','system.documents.view',1),('admin','system.documents.create',1),('admin','system.documents.edit',1),('admin','system.documents.delete',1),
('admin','system.document_templates.view',1),('admin','system.document_templates.create',1),('admin','system.document_templates.edit',1),('admin','system.document_templates.delete',1),
('admin','system.notifications.view',1),('admin','system.notifications.manage',1),('admin','audit.logs.view',1),
('admin','system.users.view',1),('admin','system.users.create',1),('admin','system.users.edit',1),('admin','system.users.reset_password',1),('admin','system.users.deactivate',1),
('admin','employees.view',1),('admin','employees.manage',1),('admin','attendance.view',1),('admin','attendance.manage',1),
('admin','lot_project.view',1),('admin','lot_project.dashboard.view',1),('admin','lot_project.reports.view',1),('admin','lot_project.reports.export',1),
('admin','lot_project.listings.view',1),('admin','lot_project.listings.import',1),('admin','lot_project.listings.create',1),('admin','lot_project.listings.edit',1),('admin','lot_project.listings.delete',1),('admin','lot_project.listing_profile.view',1),
('admin','lot_project.reservations.create',1),('admin','lot_project.buyer_profile.edit',1),('admin','lot_project.payments.view',1),('admin','lot_project.payments.create',1),('admin','lot_project.payments.edit',1),('admin','lot_project.payments.delete',1),
('admin','lot_project.buyer_documents.view',1),('admin','lot_project.buyer_documents.update',1),('admin','lot_project.account_history.view',1),('admin','lot_project.printouts.use',1),
('admin','lot_project.payment_logs.view',1),('admin','lot_project.commissions.view',1),('admin','lot_project.settings.view',1),('admin','lot_project.settings.manage',1),
-- Marketing
('marketing','system.dashboard.view',1),('marketing','system.reports.view',1),('marketing','system.projects.view',1),('marketing','system.projects.print_price_list',1),
('marketing','system.accredited.view',1),('marketing','system.notifications.view',1),('marketing','system.documents.view',1),('marketing','system.document_templates.view',1),
('marketing','lot_project.view',1),('marketing','lot_project.dashboard.view',1),('marketing','lot_project.reports.view',1),('marketing','lot_project.listings.view',1),
-- Sales
('sales','system.dashboard.view',1),('sales','system.reports.view',1),('sales','system.projects.view',1),('sales','system.projects.print_price_list',1),
('sales','system.accredited.view',1),('sales','system.accredited.print',1),('sales','system.notifications.view',1),('sales','system.documents.view',1),('sales','system.document_templates.view',1),
('sales','lot_project.view',1),('sales','lot_project.dashboard.view',1),('sales','lot_project.reports.view',1),('sales','lot_project.listings.view',1),('sales','lot_project.listing_profile.view',1),
('sales','lot_project.reservations.create',1),('sales','lot_project.buyer_profile.edit',1),('sales','lot_project.buyer_documents.view',1),('sales','lot_project.buyer_documents.update',1),
('sales','lot_project.account_history.view',1),('sales','lot_project.printouts.use',1),('sales','lot_project.commissions.view',1),
-- Accounting
('accounting','system.dashboard.view',1),('accounting','system.reports.view',1),('accounting','system.reports.export',1),('accounting','system.projects.view',1),('accounting','system.projects.print_price_list',1),
('accounting','system.accredited.view',1),('accounting','system.accredited.print',1),('accounting','system.accredited.upload_proof',1),('accounting','system.notifications.view',1),('accounting','audit.logs.view',1),
('accounting','system.documents.view',1),('accounting','system.document_templates.view',1),
('accounting','lot_project.view',1),('accounting','lot_project.dashboard.view',1),('accounting','lot_project.reports.view',1),('accounting','lot_project.reports.export',1),
('accounting','lot_project.listings.view',1),('accounting','lot_project.listing_profile.view',1),('accounting','lot_project.payments.view',1),('accounting','lot_project.payments.create',1),('accounting','lot_project.payments.edit',1),('accounting','lot_project.payments.delete',1),
('accounting','lot_project.buyer_documents.view',1),('accounting','lot_project.account_history.view',1),('accounting','lot_project.printouts.use',1),('accounting','lot_project.payment_logs.view',1),
('accounting','lot_project.commissions.view',1),('accounting','lot_project.commissions.release',1),('accounting','lot_project.commissions.hold',1),('accounting','lot_project.commissions.unhold',1),
-- Operations
('operations','system.dashboard.view',1),('operations','system.reports.view',1),('operations','system.reports.export',1),('operations','system.projects.view',1),('operations','system.projects.create',1),('operations','system.projects.edit',1),('operations','system.projects.print_price_list',1),
('operations','system.accredited.view',1),('operations','system.accredited.print',1),('operations','system.documents.view',1),('operations','system.documents.create',1),('operations','system.documents.edit',1),('operations','system.documents.delete',1),
('operations','system.document_templates.view',1),('operations','system.document_templates.create',1),('operations','system.document_templates.edit',1),('operations','system.document_templates.delete',1),
('operations','system.notifications.view',1),('operations','system.notifications.manage',1),('operations','audit.logs.view',1),('operations','system.users.view',1),
('operations','employees.view',1),('operations','employees.manage',1),('operations','attendance.view',1),('operations','attendance.manage',1),
('operations','lot_project.view',1),('operations','lot_project.dashboard.view',1),('operations','lot_project.reports.view',1),('operations','lot_project.reports.export',1),
('operations','lot_project.listings.view',1),('operations','lot_project.listings.import',1),('operations','lot_project.listings.create',1),('operations','lot_project.listings.edit',1),('operations','lot_project.listings.delete',1),('operations','lot_project.listing_profile.view',1),
('operations','lot_project.reservations.create',1),('operations','lot_project.buyer_profile.edit',1),('operations','lot_project.buyer_documents.view',1),('operations','lot_project.buyer_documents.update',1),
('operations','lot_project.account_history.view',1),('operations','lot_project.printouts.use',1),('operations','lot_project.payment_logs.view',1),('operations','lot_project.commissions.view',1),
('operations','lot_project.settings.view',1),('operations','lot_project.settings.manage',1)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

-- Backfill Admin permissions with its default template. Existing Admins retain broad effective access.
INSERT IGNORE INTO user_permissions (user_id, permission_key, allowed)
SELECT u.id, d.permission_key, d.allowed
FROM users u
JOIN role_permission_defaults d ON d.role = u.role
WHERE u.role = 'admin';

-- Super Admin account codes. For existing non-SuperAdmin system users, account codes are generated by application code going forward.
UPDATE users
SET account_code = CONCAT(
      UPPER(REGEXP_REPLACE(last_name, '[^A-Za-z0-9]', '')),
      '-SA-', LPAD(id, 3, '0')
    )
WHERE role = 'super_admin' AND account_code IS NULL;
