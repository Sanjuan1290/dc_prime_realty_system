-- Adds an optional Title Number field to lot projects.
-- Safe to run more than once.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_lot_project_title_number_if_missing$$
CREATE PROCEDURE add_lot_project_title_number_if_missing()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'lot_projects'
      AND column_name = 'lot_project_title_number'
  ) THEN
    ALTER TABLE lot_projects
      ADD COLUMN lot_project_title_number VARCHAR(150) NULL
      AFTER lot_project_tax_declaration_no;
  END IF;
END$$

DELIMITER ;

CALL add_lot_project_title_number_if_missing();
DROP PROCEDURE IF EXISTS add_lot_project_title_number_if_missing;
