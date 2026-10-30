-- D&C Prime: explicit audit report export permission; no existing records modified.
-- Owners already have all registered permissions; no user grant required for them.
-- Other users can receive this permission through Role & Access Control.
-- Add the permission to the Auditor's recommended template, but do not silently
-- grant it to existing Auditor accounts.
INSERT INTO role_permission_defaults (role, permission_key, allowed)
VALUES ('auditor','audit.logs.export',1)
ON DUPLICATE KEY UPDATE permission_key = VALUES(permission_key);


