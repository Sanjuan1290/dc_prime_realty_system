-- D&C Prime Realty
-- Fixed seller-group commission rates per project.
-- BNM, Broker, and Manager receive fixed override rates; Agent receives a fixed sales rate.
-- The four role rates must total the group project pool exactly.

USE `dc_prime_realty_system_db`;

SET @schema_name = DATABASE();

DROP PROCEDURE IF EXISTS migration_add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE migration_add_column_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_column_name VARCHAR(128),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND column_name = p_column_name
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_column_definition
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL migration_add_column_if_missing(
  'seller_group_lot_project_rates',
  'bnm_override_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER seller_group_pool_rate'
);
CALL migration_add_column_if_missing(
  'seller_group_lot_project_rates',
  'broker_override_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER bnm_override_rate'
);
CALL migration_add_column_if_missing(
  'seller_group_lot_project_rates',
  'manager_override_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER broker_override_rate'
);
CALL migration_add_column_if_missing(
  'seller_group_lot_project_rates',
  'agent_rate',
  'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER manager_override_rate'
);

DROP PROCEDURE IF EXISTS migration_add_column_if_missing;

-- Read the former member rates only as migration defaults. After this migration,
-- seller_group_lot_project_rates is the single source of truth.
DROP TEMPORARY TABLE IF EXISTS tmp_group_fixed_rate_defaults;
CREATE TEMPORARY TABLE tmp_group_fixed_rate_defaults AS
SELECT
  group_rate.seller_group_id,
  group_rate.lot_project_id,
  head_user.role AS group_head_role,
  group_rate.seller_group_pool_rate AS pool_rate,
  CASE
    WHEN head_user.role = 'broker' THEN 0.00
    ELSE COALESCE(MAX(CASE
      WHEN user_row.role = 'broker_network_manager'
       AND legacy_rate.accredited_seller_lot_project_rate_status = 'active'
      THEN legacy_rate.accredited_seller_project_rate
    END), 1.00)
  END AS bnm_rate,
  COALESCE(MAX(CASE
    WHEN user_row.role = 'broker'
     AND legacy_rate.accredited_seller_lot_project_rate_status = 'active'
    THEN legacy_rate.accredited_seller_project_rate
  END), 1.00) AS broker_rate,
  COALESCE(MAX(CASE
    WHEN user_row.role = 'manager'
     AND legacy_rate.accredited_seller_lot_project_rate_status = 'active'
    THEN legacy_rate.accredited_seller_project_rate
  END), 1.00) AS manager_rate
FROM seller_group_lot_project_rates group_rate
INNER JOIN seller_groups group_row
  ON group_row.seller_group_id = group_rate.seller_group_id
LEFT JOIN users head_user
  ON head_user.id = group_row.seller_group_head_user_id
LEFT JOIN accredited_sellers seller
  ON seller.seller_group_id = group_rate.seller_group_id
 AND COALESCE(seller.is_system_dummy, 0) = 0
LEFT JOIN users user_row
  ON user_row.id = seller.user_id
LEFT JOIN accredited_seller_lot_project_rates legacy_rate
  ON legacy_rate.accredited_seller_id = seller.accredited_seller_id
 AND legacy_rate.lot_project_id = group_rate.lot_project_id
GROUP BY
  group_rate.seller_group_id,
  group_rate.lot_project_id,
  head_user.role,
  group_rate.seller_group_pool_rate;

-- Use the available pool remainder as the fixed Agent rate so every migrated
-- group-project configuration totals the pool exactly.
UPDATE seller_group_lot_project_rates group_rate
INNER JOIN tmp_group_fixed_rate_defaults defaults_row
  ON defaults_row.seller_group_id = group_rate.seller_group_id
 AND defaults_row.lot_project_id = group_rate.lot_project_id
SET
  group_rate.bnm_override_rate = CASE
    WHEN defaults_row.bnm_rate + defaults_row.broker_rate + defaults_row.manager_rate < defaults_row.pool_rate
      THEN defaults_row.bnm_rate
    ELSE CASE WHEN defaults_row.group_head_role = 'broker' THEN 0.00 ELSE 1.00 END
  END,
  group_rate.broker_override_rate = CASE
    WHEN defaults_row.bnm_rate + defaults_row.broker_rate + defaults_row.manager_rate < defaults_row.pool_rate
      THEN defaults_row.broker_rate
    ELSE 1.00
  END,
  group_rate.manager_override_rate = CASE
    WHEN defaults_row.bnm_rate + defaults_row.broker_rate + defaults_row.manager_rate < defaults_row.pool_rate
      THEN defaults_row.manager_rate
    ELSE 1.00
  END;

UPDATE seller_group_lot_project_rates
SET agent_rate = ROUND(
  seller_group_pool_rate
  - bnm_override_rate
  - broker_override_rate
  - manager_override_rate,
  2
);

DROP TEMPORARY TABLE IF EXISTS tmp_group_fixed_rate_defaults;

-- Prevent old individual values from being used by older code paths. Historical
-- lot_project_commissions rows are snapshots and are not modified.
UPDATE accredited_seller_lot_project_rates
SET accredited_seller_lot_project_rate_status = 'inactive';

UPDATE agent_lot_project_direct_rates
SET direct_rate_status = 'inactive';

UPDATE seller_hierarchy_lot_project_overrides
SET override_rate_status = 'inactive';

DROP PROCEDURE IF EXISTS migration_drop_check_if_exists;
DELIMITER $$
CREATE PROCEDURE migration_drop_check_if_exists(
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
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table_name, '` DROP CHECK `', p_constraint_name, '`'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL migration_drop_check_if_exists(
  'seller_group_lot_project_rates',
  'chk_group_fixed_role_rates_range'
);
CALL migration_drop_check_if_exists(
  'seller_group_lot_project_rates',
  'chk_group_fixed_role_rates_total'
);

DROP PROCEDURE IF EXISTS migration_drop_check_if_exists;

DROP PROCEDURE IF EXISTS migration_add_check_if_missing;
DELIMITER $$
CREATE PROCEDURE migration_add_check_if_missing(
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
    SET @sql = CONCAT(
      'ALTER TABLE `', p_table_name, '` ADD CONSTRAINT `', p_constraint_name,
      '` CHECK (', p_check_expression, ')'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL migration_add_check_if_missing(
  'seller_group_lot_project_rates',
  'chk_group_fixed_role_rates_range',
  'bnm_override_rate BETWEEN 0 AND 15 AND broker_override_rate > 0 AND broker_override_rate <= 15 AND manager_override_rate > 0 AND manager_override_rate <= 15 AND agent_rate > 0 AND agent_rate <= 15'
);
CALL migration_add_check_if_missing(
  'seller_group_lot_project_rates',
  'chk_group_fixed_role_rates_total',
  'ROUND(bnm_override_rate + broker_override_rate + manager_override_rate + agent_rate, 2) = ROUND(seller_group_pool_rate, 2)'
);

DROP PROCEDURE IF EXISTS migration_add_check_if_missing;

SELECT
  group_row.seller_group_name,
  project.lot_project_name,
  rate.seller_group_pool_rate AS pool_rate,
  rate.bnm_override_rate,
  rate.broker_override_rate,
  rate.manager_override_rate,
  rate.agent_rate,
  head_user.role AS Realty_head_role,
  ROUND(
    rate.bnm_override_rate
    + rate.broker_override_rate
    + rate.manager_override_rate
    + rate.agent_rate,
    2
  ) AS allocated_rate,
  CASE
    WHEN ROUND(
      rate.bnm_override_rate
      + rate.broker_override_rate
      + rate.manager_override_rate
      + rate.agent_rate,
      2
    ) = ROUND(rate.seller_group_pool_rate, 2)
      AND rate.broker_override_rate > 0
      AND rate.manager_override_rate > 0
      AND rate.agent_rate > 0
      AND (
        (head_user.role = 'broker' AND rate.bnm_override_rate = 0)
        OR (COALESCE(head_user.role, 'broker_network_manager') <> 'broker' AND rate.bnm_override_rate > 0)
      )
    THEN 'valid'
    ELSE 'invalid'
  END AS rate_status
FROM seller_group_lot_project_rates rate
INNER JOIN seller_groups group_row
  ON group_row.seller_group_id = rate.seller_group_id
LEFT JOIN users head_user
  ON head_user.id = group_row.seller_group_head_user_id
INNER JOIN lot_projects project
  ON project.lot_project_id = rate.lot_project_id
ORDER BY group_row.seller_group_name, project.lot_project_name;
