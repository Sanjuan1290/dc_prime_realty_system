-- Company Finances: ONE aggregate balance. No bank linking or individual account balances.
-- Apply after a backup. The balance is UNCONFIGURED until the authorized opening balance is saved.
CREATE TABLE IF NOT EXISTS company_finance_settings (
  id tinyint unsigned NOT NULL PRIMARY KEY,
  start_date date DEFAULT NULL,
  opening_balance decimal(16,2) DEFAULT NULL,
  includes_property_collections tinyint(1) NOT NULL DEFAULT 1,
  set_by_user_id int unsigned DEFAULT NULL,
  set_at datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO company_finance_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS company_finance_categories (
  id int unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind enum('income','expense') NOT NULL,
  name varchar(90) NOT NULL,
  protected tinyint(1) NOT NULL DEFAULT 0,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_by_user_id int unsigned DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_finance_category_kind_name (kind,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO company_finance_categories (kind,name,protected) VALUES
('expense','Salary',1),('expense','Commissions',1),('expense','Food',0),
('expense','Team Building',0),('expense','Rent',0),('expense','Electricity',0),
('expense','Water',0),('expense','Internet & Phone',0),('expense','Office Supplies',0),
('expense','Transportation',0),('expense','Marketing',0),('expense','Maintenance',0),
('expense','Company Needs',0),('expense','Other Expenses',0),
('income','Service Fees',0),('income','Rental Income',0),('income','Interest',0),('income','Other Income',0);

CREATE TABLE IF NOT EXISTS company_finance_transactions (
  id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id int unsigned NOT NULL,
  kind enum('income','expense') NOT NULL,
  amount decimal(16,2) NOT NULL,
  transaction_date date NOT NULL,
  description varchar(240) NOT NULL,
  notes varchar(1000) DEFAULT NULL,
  status enum('posted','void') NOT NULL DEFAULT 'posted',
  created_by_user_id int unsigned DEFAULT NULL,
  updated_by_user_id int unsigned DEFAULT NULL,
  voided_by_user_id int unsigned DEFAULT NULL,
  void_reason varchar(500) DEFAULT NULL,
  voided_at datetime DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_company_finance_tx_date (transaction_date, status),
  KEY idx_company_finance_tx_category (category_id, transaction_date),
  CONSTRAINT fk_company_finance_tx_category FOREIGN KEY (category_id) REFERENCES company_finance_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- New roles/permissions are opt-in for existing accounts, except established Accounting roles.
-- These keys are intentionally separate from unrestricted System Reports access.
-- Explicit VALUES avoid the MySQL/TiDB INSERT...SELECT + ON DUPLICATE KEY
-- ambiguity and match the role-default migration regression parser.
-- INSERT IGNORE adds only missing permissions; existing allowed=0/1 rows remain untouched.
INSERT IGNORE INTO role_permission_defaults
  (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('accounting_staff', 'company_finances.view', 1, NULL),
  ('accounting_staff', 'company_finances.record', 1, NULL),
  ('accounting_staff', 'company_finances.edit_manual', 1, NULL),
  ('accounting_head', 'company_finances.view', 1, NULL),
  ('accounting_head', 'company_finances.record', 1, NULL),
  ('accounting_head', 'company_finances.edit_manual', 1, NULL),
  ('system_admin', 'company_finances.view', 1, NULL),
  ('system_admin', 'company_finances.record', 1, NULL),
  ('system_admin', 'company_finances.edit_manual', 1, NULL);

INSERT IGNORE INTO role_permission_defaults
  (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('accounting_head', 'company_finances.categories.manage', 1, NULL),
  ('accounting_head', 'company_finances.opening_balance.manage', 1, NULL),
  ('system_admin', 'company_finances.categories.manage', 1, NULL),
  ('system_admin', 'company_finances.opening_balance.manage', 1, NULL);
-- Existing account permissions are appended below; explicit deny (allowed=0) is preserved.

-- Existing Accounting user accounts use explicit user_permissions, so seed missing
-- keys without overwriting any explicit allow/deny setting.
INSERT IGNORE INTO user_permissions (user_id,permission_key,allowed,granted_by_user_id)
SELECT u.id, x.permission_key, 1, NULL FROM users u CROSS JOIN (
 SELECT 'company_finances.view' permission_key UNION ALL
 SELECT 'company_finances.record' UNION ALL
 SELECT 'company_finances.edit_manual'
) x WHERE u.role IN ('accounting_staff','accounting_head') AND u.status='active';
INSERT IGNORE INTO user_permissions (user_id,permission_key,allowed,granted_by_user_id)
SELECT u.id, x.permission_key, 1, NULL FROM users u CROSS JOIN (
 SELECT 'company_finances.categories.manage' permission_key UNION ALL
 SELECT 'company_finances.opening_balance.manage'
) x WHERE u.role='accounting_head' AND u.status='active';
