-- Admin project scoping. Super Admin remains global and owner-only actions stay protected.
SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_all_projects TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_type;

CREATE TABLE IF NOT EXISTS admin_project_access (
  admin_project_access_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  lot_project_id INT UNSIGNED NOT NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_project_access_id),
  UNIQUE KEY uq_admin_project_access (user_id, lot_project_id),
  KEY idx_admin_project_access_project (lot_project_id),
  KEY idx_admin_project_access_created_by (created_by_user_id),
  CONSTRAINT fk_admin_project_access_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_admin_project_access_project
    FOREIGN KEY (lot_project_id) REFERENCES lot_projects (lot_project_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_admin_project_access_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Existing operational admins previously had global Admin 1 access. Preserve that
-- effective access during the migration instead of unexpectedly locking them out.
UPDATE users
SET admin_all_projects = 1,
    admin_type = NULL
WHERE role = 'admin';

-- Non-admin accounts never carry project-admin scope.
UPDATE users
SET admin_all_projects = 0,
    admin_type = NULL
WHERE role <> 'admin';

