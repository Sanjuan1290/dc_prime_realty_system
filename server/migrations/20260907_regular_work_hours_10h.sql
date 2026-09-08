-- 2026-09-07 — Correct regular working hours to 10 hours.
-- Schedule is 09:00-20:00 (11 elapsed hours) less the 60-minute lunch break = 10 working hours.

ALTER TABLE `system_settings`
  MODIFY COLUMN `attendance_regular_work_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 600;

UPDATE `system_settings`
SET `attendance_regular_work_minutes` = 600
WHERE `system_setting_id` = 1;

