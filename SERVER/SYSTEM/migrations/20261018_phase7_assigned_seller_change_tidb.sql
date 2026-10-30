-- D&C Prime Realty Phase 7: TiDB Cloud, no triggers or DELIMITER.
-- Back up and test in staging before applying to production.
-- Changes only schema/permission defaults; no existing buyer/commission rows updated.
CREATE TABLE IF NOT EXISTS lot_project_assigned_seller_changes (
  change_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lot_project_id INT UNSIGNED NOT NULL,
  lot_project_listing_id INT UNSIGNED NOT NULL,
  lot_project_account_id BIGINT UNSIGNED NOT NULL,
  lot_project_client_profile_id INT UNSIGNED NOT NULL,
  old_seller_id INT UNSIGNED NOT NULL,
  new_seller_id INT UNSIGNED NOT NULL,
  old_sale_channel VARCHAR(40) NOT NULL,
  new_sale_channel VARCHAR(40) NOT NULL,
  before_snapshot_json JSON NOT NULL,
  after_snapshot_json JSON NOT NULL,
  changed_by_user_id INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  authorization_type VARCHAR(40) NOT NULL,
  authorization_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_seller_changes_account (lot_project_account_id, created_at),
  KEY idx_seller_changes_profile (lot_project_client_profile_id, created_at),
  KEY idx_seller_changes_actor (changed_by_user_id, created_at),
  CONSTRAINT fk_assigned_seller_change_account FOREIGN KEY(lot_project_account_id) REFERENCES lot_project_accounts(lot_project_account_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assigned_seller_change_old FOREIGN KEY(old_seller_id) REFERENCES accredited_sellers(accredited_seller_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assigned_seller_change_new FOREIGN KEY(new_seller_id) REFERENCES accredited_sellers(accredited_seller_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Grant defaults only to roles that operate on commission changes. Other roles denied.
INSERT IGNORE INTO role_permission_defaults(role,permission_key,allowed,updated_by_user_id)
VALUES
  ('system_admin','lot_project.commissions.change_seller',1,NULL),
  ('accounting_head','lot_project.commissions.change_seller',1,NULL),
  ('accounting_staff','lot_project.commissions.change_seller',1,NULL);

-- Existing accounts use explicitly saved permissions, so seed only these roles.
-- INSERT IGNORE does not overwrite an administrator's current explicit permissions.
INSERT IGNORE INTO user_permissions(user_id,permission_key,allowed,granted_by_user_id)
SELECT id,'lot_project.commissions.change_seller',1,NULL FROM users
WHERE role IN ('system_admin','accounting_head','accounting_staff') AND status='active';

