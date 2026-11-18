-- Additive HR-owned verification and immutable undo history. Existing payroll is preserved.
CREATE TABLE IF NOT EXISTS hr_payroll_undo_challenges (
  id char(36) NOT NULL PRIMARY KEY,
  payroll_id int unsigned NOT NULL,
  user_id int unsigned NOT NULL,
  code_hash char(64) NOT NULL,
  state_hash char(64) NOT NULL,
  identity_version bigint unsigned NOT NULL,
  request_json json NOT NULL,
  attempts tinyint unsigned NOT NULL DEFAULT 0,
  requested_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at datetime NOT NULL,
  used_at datetime DEFAULT NULL,
  KEY idx_undo_user_time (user_id,requested_at),
  KEY idx_undo_payroll (payroll_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS hr_payroll_undo_history (
  id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payroll_id int unsigned NOT NULL,
  actor_user_id int unsigned NOT NULL,
  actor_name varchar(255) NOT NULL,
  previous_status varchar(20) NOT NULL,
  reason varchar(1000) NOT NULL,
  cash_date date DEFAULT NULL,
  snapshot_json json NOT NULL,
  receipt_json json NOT NULL,
  reversal_event_id char(36) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_undo_history_payroll (payroll_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT IGNORE INTO hr_permissions(permission_code,description) VALUES ('employee_salary.undo','Undo payroll with administrator password and email verification');
INSERT IGNORE INTO hr_role_permissions(role_code,permission_code) SELECT role_code,'employee_salary.undo' FROM hr_roles WHERE role_code='hr_admin';
