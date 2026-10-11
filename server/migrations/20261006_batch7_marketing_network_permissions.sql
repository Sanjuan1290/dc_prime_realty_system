-- D&C Prime Realty
-- 2026-10-06 Batch 7: Marketing Network / in-house seller permission defaults.
-- TiDB-safe and idempotent. This changes ROLE DEFAULTS only; existing user_permissions
-- are intentionally not changed. Use Access Control > Apply Latest Role Default on
-- each existing Marketing account that should receive these permissions.

INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id)
VALUES
  ('marketing_staff', 'system.seller_groups.view', 1, NULL),
  ('marketing_staff', 'system.seller_groups.manage', 1, NULL),
  ('marketing_staff', 'system.users.create', 1, NULL),
  ('marketing_staff', 'system.users.edit', 1, NULL),
  ('marketing_head', 'system.seller_groups.view', 1, NULL),
  ('marketing_head', 'system.seller_groups.manage', 1, NULL),
  ('marketing_head', 'system.users.create', 1, NULL),
  ('marketing_head', 'system.users.edit', 1, NULL)
ON DUPLICATE KEY UPDATE
  allowed = VALUES(allowed),
  updated_by_user_id = VALUES(updated_by_user_id),
  updated_at = CURRENT_TIMESTAMP;

