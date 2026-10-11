-- 2026-09-27 — Move Add Payment email notifications from global settings to each lot project.
-- Requires the 20260926 payment notification migration to have been applied first.
-- The legacy system_settings column is intentionally retained for backwards-safe rollback,
-- but current application code no longer reads or writes it.

ALTER TABLE lot_project_settings
  ADD COLUMN IF NOT EXISTS payment_entry_email_notification_enabled TINYINT(1) NOT NULL DEFAULT 0
  AFTER company_contact_number;

-- Preserve the existing global behavior for already-configured projects.
-- If the old global switch was ON, every existing project remains ON after migration;
-- each project can then be changed independently in Project Settings.
UPDATE lot_project_settings lps
JOIN system_settings ss ON ss.system_setting_id = 1
SET lps.payment_entry_email_notification_enabled = COALESCE(ss.payment_entry_email_notification_enabled, 0);

