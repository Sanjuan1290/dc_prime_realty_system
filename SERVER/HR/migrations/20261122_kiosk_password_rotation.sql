-- HR database only. Apply once before deploying password rotation.
-- An existing environment PIN works only until the first rotation.
ALTER TABLE hr_settings
  ADD COLUMN attendance_kiosk_password_hash VARCHAR(255) NULL,
  ADD COLUMN attendance_kiosk_generation BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN attendance_kiosk_password_expires_at_ms BIGINT UNSIGNED NULL,
  ADD COLUMN attendance_kiosk_rotated_at DATETIME(3) NULL;
