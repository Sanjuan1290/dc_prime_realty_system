-- Introduces separate In-House and External Group commission structures.
-- Also replaces the old real-estate hierarchy role codes with the business role names.
--
-- Role mapping:
--   broker_network_manager -> division_manager
--   broker                 -> sales_director
--   manager                -> unit_manager
--   agent                  -> sales_agent
--
-- Existing groups and project rates are retained as In-House records.
-- Safe to run again after a successful migration.

DELIMITER $$

DROP PROCEDURE IF EXISTS migration_20260725_add_column_if_missing$$
CREATE PROCEDURE migration_20260725_add_column_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_column_name VARCHAR(128),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'),
      '` ', p_definition
    );
    PREPARE migration_statement FROM @migration_sql;
    EXECUTE migration_statement;
    DEALLOCATE PREPARE migration_statement;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_20260725_rename_column_if_needed$$
CREATE PROCEDURE migration_20260725_rename_column_if_needed(
  IN p_table_name VARCHAR(128),
  IN p_old_column_name VARCHAR(128),
  IN p_new_column_name VARCHAR(128),
  IN p_definition TEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_old_column_name
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_new_column_name
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` CHANGE COLUMN `', REPLACE(p_old_column_name, '`', '``'),
      '` `', REPLACE(p_new_column_name, '`', '``'),
      '` ', p_definition
    );
    PREPARE migration_statement FROM @migration_sql;
    EXECUTE migration_statement;
    DEALLOCATE PREPARE migration_statement;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_20260725_drop_check_if_exists$$
CREATE PROCEDURE migration_20260725_drop_check_if_exists(
  IN p_table_name VARCHAR(128),
  IN p_constraint_name VARCHAR(128)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND constraint_name = p_constraint_name
      AND constraint_type = 'CHECK'
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` DROP CHECK `', REPLACE(p_constraint_name, '`', '``'), '`'
    );
    PREPARE migration_statement FROM @migration_sql;
    EXECUTE migration_statement;
    DEALLOCATE PREPARE migration_statement;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_20260725_add_check_if_missing$$
CREATE PROCEDURE migration_20260725_add_check_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_constraint_name VARCHAR(128),
  IN p_check_expression TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND constraint_name = p_constraint_name
      AND constraint_type = 'CHECK'
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD CONSTRAINT `', REPLACE(p_constraint_name, '`', '``'),
      '` CHECK (', p_check_expression, ')'
    );
    PREPARE migration_statement FROM @migration_sql;
    EXECUTE migration_statement;
    DEALLOCATE PREPARE migration_statement;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_20260725_add_index_if_missing$$
CREATE PROCEDURE migration_20260725_add_index_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD ', p_index_definition
    );
    PREPARE migration_statement FROM @migration_sql;
    EXECUTE migration_statement;
    DEALLOCATE PREPARE migration_statement;
  END IF;
END$$

DROP PROCEDURE IF EXISTS migration_20260725_add_fk_if_missing$$
CREATE PROCEDURE migration_20260725_add_fk_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_constraint_name VARCHAR(128),
  IN p_fk_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND constraint_name = p_constraint_name
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    SET @migration_sql = CONCAT(
      'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
      '` ADD CONSTRAINT `', REPLACE(p_constraint_name, '`', '``'),
      '` ', p_fk_definition
    );
    PREPARE migration_statement FROM @migration_sql;
    EXECUTE migration_statement;
    DEALLOCATE PREPARE migration_statement;
  END IF;
END$$

DELIMITER ;

-- 1. Expand role enums first so existing records can be renamed without data loss.
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'super_admin',
    'admin',
    'broker_network_manager',
    'broker',
    'manager',
    'agent',
    'division_manager',
    'sales_director',
    'unit_manager',
    'sales_agent',
    'external_group'
  ) NOT NULL DEFAULT 'sales_agent';

UPDATE users
SET role = CASE role
  WHEN 'broker_network_manager' THEN 'division_manager'
  WHEN 'broker' THEN 'sales_director'
  WHEN 'manager' THEN 'unit_manager'
  WHEN 'agent' THEN 'sales_agent'
  ELSE role
END;

ALTER TABLE lot_project_commissions
  MODIFY COLUMN commission_role ENUM(
    'broker_network_manager',
    'broker',
    'manager',
    'agent',
    'division_manager',
    'sales_director',
    'unit_manager',
    'sales_agent',
    'external_group'
  ) NOT NULL;

UPDATE lot_project_commissions
SET commission_role = CASE commission_role
  WHEN 'broker_network_manager' THEN 'division_manager'
  WHEN 'broker' THEN 'sales_director'
  WHEN 'manager' THEN 'unit_manager'
  WHEN 'agent' THEN 'sales_agent'
  ELSE commission_role
END;

-- Historical snapshot fields use VARCHAR, so update their readable role codes too.
UPDATE lot_project_archived_commission_releases
SET commission_role = CASE commission_role
  WHEN 'broker_network_manager' THEN 'division_manager'
  WHEN 'broker' THEN 'sales_director'
  WHEN 'manager' THEN 'unit_manager'
  WHEN 'agent' THEN 'sales_agent'
  ELSE commission_role
END
WHERE commission_role IN ('broker_network_manager', 'broker', 'manager', 'agent');

UPDATE audit_logs
SET actor_role = CASE actor_role
  WHEN 'broker_network_manager' THEN 'division_manager'
  WHEN 'broker' THEN 'sales_director'
  WHEN 'manager' THEN 'unit_manager'
  WHEN 'agent' THEN 'sales_agent'
  ELSE actor_role
END
WHERE actor_role IN ('broker_network_manager', 'broker', 'manager', 'agent');

UPDATE audit_logs_archive
SET actor_role = CASE actor_role
  WHEN 'broker_network_manager' THEN 'division_manager'
  WHEN 'broker' THEN 'sales_director'
  WHEN 'manager' THEN 'unit_manager'
  WHEN 'agent' THEN 'sales_agent'
  ELSE actor_role
END
WHERE actor_role IN ('broker_network_manager', 'broker', 'manager', 'agent');

-- 2. Add group-type and external-account ownership.
CALL migration_20260725_add_column_if_missing(
  'seller_groups',
  'seller_group_type',
  'ENUM(''in_house'',''external'') NOT NULL DEFAULT ''in_house'' AFTER `seller_group_name`'
);

CALL migration_20260725_add_column_if_missing(
  'seller_groups',
  'seller_group_external_account_user_id',
  'INT UNSIGNED NULL AFTER `seller_group_head_user_id`'
);

UPDATE seller_groups
SET seller_group_type = 'in_house'
WHERE seller_group_type IS NULL OR seller_group_type NOT IN ('in_house', 'external');

CALL migration_20260725_add_index_if_missing(
  'seller_groups',
  'uq_seller_group_external_account_user',
  'UNIQUE KEY `uq_seller_group_external_account_user` (`seller_group_external_account_user_id`)'
);

CALL migration_20260725_add_fk_if_missing(
  'seller_groups',
  'fk_seller_group_external_account_user',
  'FOREIGN KEY (`seller_group_external_account_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);

-- 3. Rename the fixed-position rate columns to their actual business roles.
CALL migration_20260725_rename_column_if_needed(
  'seller_group_lot_project_rates',
  'bnm_override_rate',
  'division_manager_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT ''0.00'''
);
CALL migration_20260725_rename_column_if_needed(
  'seller_group_lot_project_rates',
  'broker_override_rate',
  'sales_director_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT ''0.00'''
);
CALL migration_20260725_rename_column_if_needed(
  'seller_group_lot_project_rates',
  'manager_override_rate',
  'unit_manager_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT ''0.00'''
);
CALL migration_20260725_rename_column_if_needed(
  'seller_group_lot_project_rates',
  'agent_rate',
  'sales_agent_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT ''0.00'''
);

CALL migration_20260725_add_column_if_missing(
  'seller_group_lot_project_rates',
  'commission_structure_type',
  'ENUM(''in_house'',''external'') NOT NULL DEFAULT ''in_house'' AFTER `seller_group_pool_rate`'
);

UPDATE seller_group_lot_project_rates rate_row
INNER JOIN seller_groups group_row
  ON group_row.seller_group_id = rate_row.seller_group_id
SET rate_row.commission_structure_type = group_row.seller_group_type;

-- Replace the old unconditional four-rate checks with group-type-aware checks.
CALL migration_20260725_drop_check_if_exists(
  'seller_group_lot_project_rates',
  'chk_group_fixed_role_rates_range'
);
CALL migration_20260725_drop_check_if_exists(
  'seller_group_lot_project_rates',
  'chk_group_fixed_role_rates_total'
);
CALL migration_20260725_drop_check_if_exists(
  'seller_group_lot_project_rates',
  'chk_group_commission_structure_rates'
);

CALL migration_20260725_add_check_if_missing(
  'seller_group_lot_project_rates',
  'chk_group_commission_structure_rates',
  '(
    (`commission_structure_type` = ''external''
      AND `division_manager_rate` = 0
      AND `sales_director_rate` = 0
      AND `unit_manager_rate` = 0
      AND `sales_agent_rate` = 0)
    OR
    (`commission_structure_type` = ''in_house''
      AND `division_manager_rate` BETWEEN 0 AND 15
      AND `sales_director_rate` BETWEEN 0 AND 15
      AND `unit_manager_rate` BETWEEN 0 AND 15
      AND `sales_agent_rate` BETWEEN 0 AND 15
      AND ROUND(
        `division_manager_rate`
        + `sales_director_rate`
        + `unit_manager_rate`
        + `sales_agent_rate`,
        2
      ) = ROUND(`seller_group_pool_rate`, 2))
  )'
);

-- 4. Record whether each reservation used the in-house hierarchy or one External Group recipient.
ALTER TABLE lot_project_client_profiles
  MODIFY COLUMN sale_channel ENUM(
    'distributed',
    'direct_to_developer',
    'external_group'
  ) NOT NULL DEFAULT 'distributed';

-- 5. Remove legacy role values only after all role-bearing records are renamed.
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'super_admin',
    'admin',
    'division_manager',
    'sales_director',
    'unit_manager',
    'sales_agent',
    'external_group'
  ) NOT NULL DEFAULT 'sales_agent';

ALTER TABLE lot_project_commissions
  MODIFY COLUMN commission_role ENUM(
    'division_manager',
    'sales_director',
    'unit_manager',
    'sales_agent',
    'external_group'
  ) NOT NULL;

DROP PROCEDURE IF EXISTS migration_20260725_add_column_if_missing;
DROP PROCEDURE IF EXISTS migration_20260725_rename_column_if_needed;
DROP PROCEDURE IF EXISTS migration_20260725_drop_check_if_exists;
DROP PROCEDURE IF EXISTS migration_20260725_add_check_if_missing;
DROP PROCEDURE IF EXISTS migration_20260725_add_index_if_missing;
DROP PROCEDURE IF EXISTS migration_20260725_add_fk_if_missing;


