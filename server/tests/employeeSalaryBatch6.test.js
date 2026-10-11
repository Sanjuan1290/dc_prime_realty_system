import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Batch 6 adds a dedicated View Payroll History permission and protected history routes', () => {
  const router = read('server/routers/System/employeePayroll.routers.js');
  const serverPermissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const accessControl = read('server/controllers/System/accessControl.controller.js');
  assert.match(serverPermissions, /PAYROLL_HISTORY_VIEW: 'employee_salary\.history\.view'/);
  assert.match(clientPermissions, /PAYROLL_HISTORY_VIEW: 'employee_salary\.history\.view'/);
  assert.match(router, /history\/:employeeId'.*PAYROLL_HISTORY_VIEW/);
  assert.match(router, /history\/payrolls\/:employeePayrollId'.*PAYROLL_HISTORY_VIEW/);
  assert.match(router, /history\/payrolls\/:employeePayrollId\/receipt'.*PAYROLL_HISTORY_VIEW/);
  assert.match(accessControl, /View Payroll History/);
});

test('Batch 6 history query prefers immutable finalized snapshot values over current employee values', () => {
  const service = read('server/services/employeePayroll.service.js');
  assert.match(service, /export const listEmployeePayrollHistory/);
  assert.match(service, /const snapshot = parseJson\(row\.finalized_snapshot_json, null\)/);
  assert.match(service, /position_snapshot: employee\.position \|\| row\.position_snapshot/);
  assert.match(service, /monthly_salary_snapshot: Number\(compensation\.monthly_basic/);
  assert.match(service, /net_fund_release: Number\(snapshot\?\.net_fund_release/);
  assert.match(service, /snapshot_source: snapshot \? 'finalized_snapshot' : 'stored_payroll_record'/);
});

test('Employee Salary History UI supports old payroll viewing and historical receipt export', () => {
  const history = read('client/src/components/System/employeeSalaryComponents/SalaryHistoryModal.jsx');
  const detail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx');
  const receipt = read('client/src/components/System/employeeSalaryComponents/FundReleaseReceiptModal.jsx');
  assert.match(history, /Employee Salary History/);
  assert.match(history, /Promotion-Safe History/);
  assert.match(history, /Immutable Snapshot/);
  assert.match(history, /View Salary/);
  assert.match(history, /Receipt \/ Export/);
  assert.match(history, /<SalaryDetailModal[^>]*historyMode/);
  assert.match(history, /<FundReleaseReceiptModal[^>]*historyMode/);
  assert.match(detail, /history\/payrolls\/\$\{payrollId\}/);
  assert.match(receipt, /history\/payrolls\/\$\{payrollId\}\/receipt/);
});

test('Employees and Employee Salary pages expose per-employee Salary History only with history permission', () => {
  const employees = read('client/src/pages/System/Employees.jsx');
  const salary = read('client/src/pages/System/EmployeeSalary.jsx');
  assert.match(employees, /PAYROLL_HISTORY_VIEW/);
  assert.match(employees, /Salary History/);
  assert.match(employees, /<SalaryHistoryModal/);
  assert.match(salary, /PAYROLL_HISTORY_VIEW/);
  assert.match(salary, /<FiClock \/>History/);
  assert.match(salary, /<SalaryHistoryModal/);
});

test('Batch 6 migration grants payroll-history defaults to Admin and Accounting without mutating payroll data', () => {
  const migration = read('server/migrations/20260928_employee_salary_batch6_history.sql');
  assert.match(migration, /employee_salary\.history\.view/);
  assert.match(migration, /'admin'/);
  assert.match(migration, /'accounting'/);
  assert.doesNotMatch(migration, /UPDATE employee_payrolls/i);
  assert.doesNotMatch(migration, /DELETE FROM employee_payrolls/i);
});

