-- READ-ONLY: run against the LIVE database; does not alter any data.
-- This checks why Friday was classed Rest-Day Work in an Oct 1–15 payroll draft.
-- Current checkboxes alone do NOT prove what was effective in October 1–15.
SELECT e.employee_code, r.day_of_week, r.effective_from, r.effective_to
FROM employees e
JOIN employee_rest_day_assignments r ON r.employee_id = e.employee_id
WHERE e.employee_code = 'IT-001'
ORDER BY r.effective_from, r.day_of_week;

SELECT e.employee_code, p.employee_payroll_id, p.payroll_status,
       per.period_start, per.period_end, p.calculation_version,
       p.expected_regular_minutes, p.rest_day_overtime_minutes,
       p.rest_day_overtime_pay, p.net_fund_release,
       p.updated_at
FROM employee_payrolls p
JOIN employees e ON e.employee_id = p.employee_id
JOIN employee_payroll_periods per ON per.employee_payroll_period_id = p.employee_payroll_period_id
WHERE e.employee_code='IT-001'
  AND per.period_start='2026-10-01' AND per.period_end='2026-10-15';

SELECT e.employee_code, a.attendance_date, DAYNAME(a.attendance_date) AS weekday,
       a.actual_time_in, a.actual_time_out, a.attendance_status
FROM employee_attendance_records a
JOIN employees e ON e.employee_id = a.employee_id
WHERE e.employee_code='IT-001'
  AND a.attendance_date IN ('2026-10-02','2026-10-09')
ORDER BY a.attendance_date;
