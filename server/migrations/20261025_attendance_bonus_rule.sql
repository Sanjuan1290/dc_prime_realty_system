-- Run before deploying the Attendance Bonus Payroll Settings UI.
-- Default is not configured; it does not change any historical payroll amounts.
ALTER TABLE employee_payroll_settings
  ADD COLUMN IF NOT EXISTS attendance_bonus_rule VARCHAR(48) NOT NULL DEFAULT 'not_configured';
