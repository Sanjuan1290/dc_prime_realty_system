import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Batch 1 creates effective-dated immutable employment and compensation history', () => {
  const migration = read('server/migrations/20260928_employee_salary_batch1_employment_history.sql');
  const service = read('server/services/employeeEmploymentHistory.service.js');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS employee_employment_history/);
  assert.match(migration, /effective_from DATE NOT NULL/);
  assert.match(migration, /effective_to DATE NULL/);
  assert.match(migration, /previous_history_id/);
  assert.match(migration, /monthly_basic_salary/);
  assert.match(migration, /rice_allowance/);
  assert.match(migration, /transportation_allowance/);
  assert.match(migration, /attendance_bonus/);
  assert.match(service, /UPDATE employee_employment_history SET effective_to =/);
  assert.match(service, /INSERT INTO employee_employment_history/);
  assert.match(service, /UPDATE employees[\s\S]*monthly_salary/);
  assert.match(service, /Effective Date must be after the current record start date/);
});

test('ordinary employee edit cannot silently overwrite employment or compensation history', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  const start = controller.indexOf('export const updateEmployee =');
  const end = controller.indexOf('export const regenerateEmployeeAttendanceBarcode =');
  const block = controller.slice(start, end);
  assert.match(block, /UPDATE employees SET first_name = \?, middle_name = \?, last_name = \?/);
  assert.doesNotMatch(block, /SET[\s\S]{0,200}monthly_salary\s*=/i);
  assert.doesNotMatch(block, /SET[\s\S]{0,200}position\s*=/i);
  assert.match(block, /compensationPreserved: true/);
});

test('promotion and compensation changes use a before-vs-after final review and audit log', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  const changeModal = read('client/src/components/System/employeeComponents/EmploymentChangeModal.jsx');
  assert.match(changeModal, /Final Double-Check/);
  assert.match(changeModal, /Before/);
  assert.match(changeModal, /After/);
  assert.match(changeModal, /Promote \/ Update Compensation/);
  assert.match(controller, /module: 'Employee Compensation'/);
  assert.match(controller, /Previous employment\/compensation history was preserved/);
  assert.match(controller, /before: change\.before/);
  assert.match(controller, /after: change\.after/);
});

test('employment history has dedicated permissions and protected routes', () => {
  const serverPermissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const router = read('server/routers/System/employees.routers.js');
  for (const source of [serverPermissions, clientPermissions]) {
    assert.match(source, /employees\.compensation\.manage/);
    assert.match(source, /employees\.employment_change\.create/);
    assert.match(source, /employees\.employment_history\.view/);
  }
  assert.match(router, /employment-history'.*EMPLOYMENT_HISTORY_VIEW/);
  assert.match(router, /employment-changes'.*EMPLOYEE_COMPENSATION_MANAGE.*EMPLOYMENT_CHANGE_CREATE/);
});

test('Employees UI exposes history and promotion actions without restoring the legacy payroll page', () => {
  const employees = read('client/src/pages/System/Employees.jsx');
  const app = read('client/src/App.jsx');
  assert.match(employees, /EmploymentHistoryModal/);
  assert.match(employees, /EmploymentChangeModal/);
  assert.match(employees, /Promote \/ Compensation/);
  assert.match(employees, /employee\.position/);
  assert.doesNotMatch(app, /\/portal\/employee-payroll/);
});

