-- Simplify payroll policy to On/Off, ON for new installations and never overwrite an explicit OFF.
-- Run once after the 20261012 and 20261025 additive payroll settings migrations.
-- Old default values are enabled only for system-seeded settings that were never edited.
ALTER TABLE employee_payroll_settings
  ALTER COLUMN new_hire_proration_rule SET DEFAULT 'scheduled_workdays';
ALTER TABLE employee_payroll_settings
  ALTER COLUMN attendance_bonus_rule SET DEFAULT 'perfect_attendance_per_period';

UPDATE employee_payroll_settings
SET new_hire_proration_rule = CASE WHEN new_hire_proration_rule = 'disabled' THEN 'scheduled_workdays' ELSE new_hire_proration_rule END,
    attendance_bonus_rule = CASE WHEN attendance_bonus_rule = 'not_configured' THEN 'perfect_attendance_per_period' ELSE attendance_bonus_rule END
WHERE employee_payroll_settings_id = 1
  AND updated_by_user_id IS NULL;

-- To enable both for an existing company that has already saved Payroll Settings,
-- use Payroll Settings > turn both switches On > Save Changes.
-- Do not update finalized or released payroll records.
