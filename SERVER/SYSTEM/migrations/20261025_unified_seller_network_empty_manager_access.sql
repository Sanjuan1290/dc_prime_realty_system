-- D&C Prime Realty: combined seller/network permission (TiDB / MySQL)
-- Run once after backing up. Idempotent. No seller, commission, or user deletion.
-- Preserve any explicit deny already stored for this permission.
-- Recommended role defaults apply to NEW Marketing Staff/Head accounts.
INSERT IGNORE INTO role_permission_defaults
  (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('marketing_staff', 'system.seller_groups.members.deactivate_empty_manager', 1, NULL),
  ('marketing_head', 'system.seller_groups.members.deactivate_empty_manager', 1, NULL);

-- Existing active Marketing Staff/Head users get the new permission only when
-- they ALREADY had both privileges required by the previous implementation.
-- Do not override an explicit prior denial of the new permission.
INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id)
SELECT u.id, 'system.seller_groups.members.deactivate_empty_manager', 1, NULL
FROM users u
WHERE u.role IN ('marketing_staff', 'marketing_head') AND u.status = 'active'
  AND EXISTS (
    SELECT 1 FROM user_permissions m
    WHERE m.user_id = u.id AND m.permission_key = 'system.seller_groups.manage' AND m.allowed = 1
  )
  AND EXISTS (
    SELECT 1 FROM user_permissions e
    WHERE e.user_id = u.id AND e.permission_key = 'system.users.edit' AND e.allowed = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions p
    WHERE p.user_id = u.id AND p.permission_key = 'system.seller_groups.members.deactivate_empty_manager'
  );

-- System Admin / Super Admin have owner-level full access in application code;
-- no user_permissions row is required for either owner role.

