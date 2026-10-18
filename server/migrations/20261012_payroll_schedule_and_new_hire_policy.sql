-- Additive, non-destructive payroll configuration; apply before deploying Render.
-- Defaults preserve 22nd/7th schedule. First-hire proration is OFF until explicitly enabled.
ALTER TABLE employee_payroll_settings ADD COLUMN IF NOT EXISTS first_half_payday TINYINT UNSIGNED NOT NULL DEFAULT 22;
ALTER TABLE employee_payroll_settings ADD COLUMN IF NOT EXISTS second_half_payday TINYINT UNSIGNED NOT NULL DEFAULT 7;
ALTER TABLE employee_payroll_settings ADD COLUMN IF NOT EXISTS new_hire_proration_rule VARCHAR(40) NOT NULL DEFAULT 'disabled';
ALTER TABLE employee_payroll_periods ADD COLUMN IF NOT EXISTS scheduled_release_date DATE NULL;
-- Existing final payroll and release dates are never recalculated/backfilled.

