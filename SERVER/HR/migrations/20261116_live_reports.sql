-- Additive access grants; does not alter payroll or employee data.
USE dc_prime_hr_db;
INSERT IGNORE INTO hr_permissions(permission_code,description) VALUES
('audit.view','View HR and payroll audit history'),
('employee_salary.receipt.print','Print finalized payroll receipts'),
('employee_salary.receipt.export','Export finalized payroll receipts');
INSERT IGNORE INTO hr_role_permissions(role_code,permission_code) VALUES
('hr_admin','audit.view'),('hr_payroll_manager','audit.view'),
('hr_admin','employee_salary.receipt.print'),('hr_admin','employee_salary.receipt.export'),
('hr_payroll_manager','employee_salary.receipt.print'),('hr_payroll_manager','employee_salary.receipt.export');
