-- Resumable repair migration for the direct-agent commission update.
-- Use this file after Error 3823 or when the original migration stopped midway.
-- It checks columns, indexes, and named foreign keys before adding them.
-- Back up the database before running this file.

DELIMITER $$

DROP PROCEDURE IF EXISTS migration_add_column_if_missing$$
CREATE PROCEDURE migration_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` ADD COLUMN `', p_column_name, '` ', p_definition
    );
    PREPARE migration_stmt FROM @migration_sql;
    EXECUTE migration_stmt;
    DEALLOCATE PREPARE migration_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_index_if_missing$$
CREATE PROCEDURE migration_add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` ADD ', p_definition
    );
    PREPARE migration_stmt FROM @migration_sql;
    EXECUTE migration_stmt;
    DEALLOCATE PREPARE migration_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_add_constraint_if_missing$$
CREATE PROCEDURE migration_add_constraint_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_constraint_name VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND CONSTRAINT_NAME = p_constraint_name
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', p_table_name,
      '` ADD CONSTRAINT `', p_constraint_name, '` ', p_definition
    );
    PREPARE migration_stmt FROM @migration_sql;
    EXECUTE migration_stmt;
    DEALLOCATE PREPARE migration_stmt;
  END IF;
END$$

DELIMITER ;

-- Repair or complete user and accredited-seller schema changes.
CALL migration_add_column_if_missing(
  'users',
  'can_login',
  'TINYINT(1) NOT NULL DEFAULT 1 AFTER `must_change_password`'
);
CALL migration_add_column_if_missing(
  'users',
  'is_system_account',
  'TINYINT(1) NOT NULL DEFAULT 0 AFTER `can_login`'
);
CALL migration_add_column_if_missing(
  'accredited_sellers',
  'is_system_dummy',
  'TINYINT(1) NOT NULL DEFAULT 0 AFTER `accredited_seller_reports_under_user_id`'
);
CALL migration_add_column_if_missing(
  'accredited_sellers',
  'dummy_owner_accredited_seller_id',
  'INT UNSIGNED NULL AFTER `is_system_dummy`'
);
CALL migration_add_index_if_missing(
  'accredited_sellers',
  'uq_accredited_seller_dummy_owner',
  'UNIQUE KEY `uq_accredited_seller_dummy_owner` (`dummy_owner_accredited_seller_id`)'
);
CALL migration_add_index_if_missing(
  'accredited_sellers',
  'idx_accredited_seller_system_dummy',
  'KEY `idx_accredited_seller_system_dummy` (`is_system_dummy`)'
);
CALL migration_add_constraint_if_missing(
  'accredited_sellers',
  'fk_accredited_seller_dummy_owner',
  'FOREIGN KEY (`dummy_owner_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE'
);

CREATE TABLE IF NOT EXISTS agent_lot_project_direct_rates (
  agent_lot_project_direct_rate_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  accredited_seller_id INT UNSIGNED NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  direct_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  direct_rate_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_lot_project_direct_rate_id),
  UNIQUE KEY uq_agent_project_direct_rate (accredited_seller_id, lot_project_id),
  KEY idx_agent_direct_rate_project (lot_project_id, direct_rate_status),
  CONSTRAINT fk_agent_direct_rate_seller
    FOREIGN KEY (accredited_seller_id) REFERENCES accredited_sellers (accredited_seller_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_agent_direct_rate_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_agent_direct_rate CHECK (direct_rate >= 0 AND direct_rate <= 15)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS seller_hierarchy_lot_project_overrides (
  seller_hierarchy_lot_project_override_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  child_accredited_seller_id INT UNSIGNED NOT NULL,
  parent_accredited_seller_id INT UNSIGNED NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  override_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  override_rate_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (seller_hierarchy_lot_project_override_id),
  UNIQUE KEY uq_child_parent_project_override (
    child_accredited_seller_id,
    parent_accredited_seller_id,
    lot_project_id
  ),
  KEY idx_hierarchy_override_project (lot_project_id, override_rate_status),
  KEY idx_hierarchy_override_parent (parent_accredited_seller_id),
  CONSTRAINT fk_hierarchy_override_child
    FOREIGN KEY (child_accredited_seller_id) REFERENCES accredited_sellers (accredited_seller_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_hierarchy_override_parent
    FOREIGN KEY (parent_accredited_seller_id) REFERENCES accredited_sellers (accredited_seller_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_hierarchy_override_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_hierarchy_override_rate CHECK (override_rate >= 0 AND override_rate <= 15)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- MySQL blocks CHECK constraints that reference columns with CASCADE actions.
-- These triggers provide the same child-versus-parent validation.
DELIMITER $$

DROP TRIGGER IF EXISTS trg_hierarchy_override_no_self_insert$$
CREATE TRIGGER trg_hierarchy_override_no_self_insert
BEFORE INSERT ON seller_hierarchy_lot_project_overrides
FOR EACH ROW
BEGIN
  IF NEW.child_accredited_seller_id = NEW.parent_accredited_seller_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Child and parent accredited sellers must be different.';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_hierarchy_override_no_self_update$$
CREATE TRIGGER trg_hierarchy_override_no_self_update
BEFORE UPDATE ON seller_hierarchy_lot_project_overrides
FOR EACH ROW
BEGIN
  IF NEW.child_accredited_seller_id = NEW.parent_accredited_seller_id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Child and parent accredited sellers must be different.';
  END IF;
END$$

DELIMITER ;

-- Repair or complete commission snapshot columns, indexes, and foreign keys.
CALL migration_add_column_if_missing(
  'lot_project_commissions',
  'sale_origin_accredited_seller_id',
  'INT UNSIGNED NULL AFTER `accredited_seller_id`'
);
CALL migration_add_column_if_missing(
  'lot_project_commissions',
  'sale_owner_accredited_seller_id',
  'INT UNSIGNED NULL AFTER `sale_origin_accredited_seller_id`'
);
CALL migration_add_column_if_missing(
  'lot_project_commissions',
  'commission_rate_type',
  'ENUM(''direct'',''override'') NOT NULL DEFAULT ''override'' AFTER `commission_sale_type`'
);
CALL migration_add_column_if_missing(
  'lot_project_commissions',
  'seller_display_name_snapshot',
  'VARCHAR(255) NULL AFTER `commission_rate_type`'
);
CALL migration_add_column_if_missing(
  'lot_project_commissions',
  'seller_group_name_snapshot',
  'VARCHAR(150) NULL AFTER `seller_display_name_snapshot`'
);
CALL migration_add_index_if_missing(
  'lot_project_commissions',
  'idx_commission_rate_type',
  'KEY `idx_commission_rate_type` (`commission_rate_type`)'
);
CALL migration_add_index_if_missing(
  'lot_project_commissions',
  'idx_commission_sale_origin',
  'KEY `idx_commission_sale_origin` (`sale_origin_accredited_seller_id`)'
);
CALL migration_add_index_if_missing(
  'lot_project_commissions',
  'idx_commission_sale_owner',
  'KEY `idx_commission_sale_owner` (`sale_owner_accredited_seller_id`)'
);
CALL migration_add_constraint_if_missing(
  'lot_project_commissions',
  'fk_commission_sale_origin',
  'FOREIGN KEY (`sale_origin_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
CALL migration_add_constraint_if_missing(
  'lot_project_commissions',
  'fk_commission_sale_owner',
  'FOREIGN KEY (`sale_owner_accredited_seller_id`) REFERENCES `accredited_sellers` (`accredited_seller_id`) ON DELETE SET NULL ON UPDATE CASCADE'
);

START TRANSACTION;

-- Existing agent ceiling rates become direct rates.
INSERT INTO agent_lot_project_direct_rates (
  accredited_seller_id,
  lot_project_id,
  direct_rate,
  direct_rate_status
)
SELECT
  asr.accredited_seller_id,
  asr.lot_project_id,
  asr.accredited_seller_project_rate,
  asr.accredited_seller_lot_project_rate_status
FROM accredited_seller_lot_project_rates asr
INNER JOIN accredited_sellers acs ON acs.accredited_seller_id = asr.accredited_seller_id
INNER JOIN users u ON u.id = acs.user_id
WHERE u.role = 'agent'
ON DUPLICATE KEY UPDATE
  direct_rate = VALUES(direct_rate),
  direct_rate_status = VALUES(direct_rate_status);

-- Convert current direct reporting links into incremental parent overrides.
INSERT INTO seller_hierarchy_lot_project_overrides (
  child_accredited_seller_id,
  parent_accredited_seller_id,
  lot_project_id,
  override_rate,
  override_rate_status
)
SELECT
  child.accredited_seller_id,
  parent.accredited_seller_id,
  child_rate.lot_project_id,
  GREATEST(
    CASE
      WHEN parent_user.role = 'broker_network_manager'
        THEN COALESCE(group_rate.seller_group_pool_rate, parent_rate.accredited_seller_project_rate, 0)
      ELSE COALESCE(parent_rate.accredited_seller_project_rate, 0)
    END - COALESCE(child_rate.accredited_seller_project_rate, 0),
    0
  ) AS override_rate,
  'active'
FROM accredited_sellers child
INNER JOIN accredited_seller_lot_project_rates child_rate
  ON child_rate.accredited_seller_id = child.accredited_seller_id
 AND child_rate.accredited_seller_lot_project_rate_status = 'active'
INNER JOIN accredited_sellers parent
  ON parent.user_id = child.accredited_seller_reports_under_user_id
INNER JOIN users parent_user ON parent_user.id = parent.user_id
LEFT JOIN accredited_seller_lot_project_rates parent_rate
  ON parent_rate.accredited_seller_id = parent.accredited_seller_id
 AND parent_rate.lot_project_id = child_rate.lot_project_id
 AND parent_rate.accredited_seller_lot_project_rate_status = 'active'
LEFT JOIN seller_group_lot_project_rates group_rate
  ON group_rate.seller_group_id = child.seller_group_id
 AND group_rate.lot_project_id = child_rate.lot_project_id
 AND group_rate.seller_group_lot_project_rate_status = 'active'
WHERE child.accredited_seller_reports_under_user_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  override_rate = VALUES(override_rate),
  override_rate_status = VALUES(override_rate_status);

-- Backfill historical snapshot fields without changing commission amounts.
UPDATE lot_project_commissions c
LEFT JOIN lot_project_client_profiles cp
  ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
LEFT JOIN accredited_sellers recipient
  ON recipient.accredited_seller_id = c.accredited_seller_id
LEFT JOIN users recipient_user
  ON recipient_user.id = recipient.user_id
LEFT JOIN seller_groups recipient_group
  ON recipient_group.seller_group_id = recipient.seller_group_id
SET
  c.commission_rate_type = CASE
    WHEN c.commission_sale_type = 'direct'
      OR c.commission_seller_type = 'selling_agent'
      THEN 'direct'
    ELSE 'override'
  END,
  c.sale_origin_accredited_seller_id = COALESCE(
    c.sale_origin_accredited_seller_id,
    cp.assigned_accredited_seller_id,
    c.accredited_seller_id
  ),
  c.sale_owner_accredited_seller_id = COALESCE(
    c.sale_owner_accredited_seller_id,
    cp.assigned_accredited_seller_id,
    c.accredited_seller_id
  ),
  c.seller_display_name_snapshot = COALESCE(
    c.seller_display_name_snapshot,
    NULLIF(TRIM(CONCAT_WS(' ', recipient_user.first_name, recipient_user.middle_name, recipient_user.last_name)), '')
  ),
  c.seller_group_name_snapshot = COALESCE(
    c.seller_group_name_snapshot,
    recipient_group.seller_group_name
  );

COMMIT;

-- Remove temporary migration helpers.
DROP PROCEDURE IF EXISTS migration_add_column_if_missing;
DROP PROCEDURE IF EXISTS migration_add_index_if_missing;
DROP PROCEDURE IF EXISTS migration_add_constraint_if_missing;

-- Verification summary.
SELECT
  (SELECT COUNT(*) FROM agent_lot_project_direct_rates) AS direct_rate_rows,
  (SELECT COUNT(*) FROM seller_hierarchy_lot_project_overrides) AS override_rows,
  (SELECT COUNT(*) FROM lot_project_commissions WHERE commission_rate_type = 'direct') AS direct_commission_rows,
  (SELECT COUNT(*) FROM lot_project_commissions WHERE commission_rate_type = 'override') AS override_commission_rows;
