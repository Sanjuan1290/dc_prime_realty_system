-- Payment entry notifications + granular cancellation permissions
-- 2026-09-26
--
-- Adds the Super-Admin-controlled setting that emails Company Email after a
-- newly recorded verified payment. Cancellation permissions themselves are
-- permission keys stored in role_permission_defaults/user_permissions, so no
-- permission rows are seeded here: they intentionally default OFF for every
-- configurable role. Super Admin receives them through the application bypass.

SET NAMES utf8mb4;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS payment_entry_email_notification_enabled TINYINT(1) NOT NULL DEFAULT 0
  AFTER default_release_day_two;

-- Intentionally no INSERT into role_permission_defaults for:
--   lot_project.cancellations.manage
--   lot_project.cancellations.settle
--   lot_project.cancellations.release_unit
-- Persisted role defaults represent ALLOWED permissions only. Leaving these
-- absent means Admin/Marketing/Sales/Accounting/Operations start with them OFF.
