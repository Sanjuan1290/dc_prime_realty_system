-- Adds the future-ready Admin Type field.
-- Admin 1 is enabled and has full system access.
-- Admin 2 and Admin 3 remain reserved for later permission sets.
-- Safe to run more than once.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_admin_type_column_if_missing$$
CREATE PROCEDURE add_admin_type_column_if_missing()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'admin_type'
  ) THEN
    ALTER TABLE users
      ADD COLUMN admin_type ENUM('admin_1','admin_2','admin_3') NULL AFTER role;
  END IF;
END$$

DELIMITER ;

CALL add_admin_type_column_if_missing();
DROP PROCEDURE IF EXISTS add_admin_type_column_if_missing;

UPDATE users
SET admin_type = 'admin_1'
WHERE role = 'admin'
  AND (admin_type IS NULL OR admin_type = '');

UPDATE users
SET admin_type = NULL
WHERE role <> 'admin'
  AND admin_type IS NOT NULL;
