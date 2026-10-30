import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Employee Salary workspace migrated from SYSTEM to permission-protected HR app', () => {
  const app = read('CLIENT/SYSTEM/src/App.jsx');
  const hr = read('CLIENT/HR/src/App.jsx');
  const permissions = read('CLIENT/HR/src/config/permissions.js');
  assert.doesNotMatch(app, /path="employee-salary"/);
  assert.match(hr, /const Payroll=lazy\(\(\)=>import\('\.\/pages\/System\/EmployeeSalary'\)\)/);
  assert.match(hr, /path:'payroll',element:<ProtectedPage permission=\{PERMISSIONS\.EMPLOYEE_SALARY_VIEW\}/);
  assert.match(permissions, /EMPLOYEE_SALARY_VIEW/);
})

test('Employee Salary register exposes required filters, summary cards and payroll actions', () => {
  const page = read('CLIENT/SYSTEM/src/pages/System/EmployeeSalary.jsx');

  for (const phrase of ['Month', 'Payroll Period', 'Department', 'Payroll Status', 'Search Employee']) {
    assert.match(page, new RegExp(phrase));
  }
  for (const phrase of ['Half-Month Basic', 'Deductions', 'Allowances', 'Total Fund Release']) {
    assert.match(page, new RegExp(phrase));
  }
  for (const phrase of ['View Salary', 'Attendance', 'Recalculate', 'Preview Receipt']) {
    assert.match(page, new RegExp(phrase));
  }
  assert.match(page, /setSelectedReceiptPayrollId/);
  assert.doesNotMatch(page, /Preview Receipt is implemented in Batch 5 after Finalization/);
});

test('Batch 3 salary detail includes compensation, attendance, earnings, deductions, allowances and net release', () => {
  const detail = read('CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx');

  for (const phrase of ['Salary and Pay Rates', 'Attendance for This Pay Period', 'Earnings', 'Allowances', 'Deductions and Take-Home Pay', 'Net Fund Release']) {
    assert.match(detail, new RegExp(phrase));
  }
  assert.match(detail, /Attendance Breakdown/);
  assert.match(detail, /attendance_breakdown/);
  assert.match(detail, /Recalculate Draft/);
  assert.match(detail, /Preview Receipt/);
  assert.match(detail, /official Print \/ PDF Export stays locked until Finalization/);
});

test('Batch 3 generation UI can generate all or one active employee without depending on Employees permission', () => {
  const modal = read('CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/GeneratePayrollModal.jsx');
  const router = read('SERVER/SYSTEM/routers/System/employeePayroll.routers.js');
  const controller = read('SERVER/SYSTEM/controllers/System/Employees/EmployeePayroll.controller.js');

  assert.match(modal, /All Active Employees/);
  assert.match(modal, /employee_id: Number\(employeeId\)/);
  assert.match(modal, /employee-payroll\/eligible-employees/);
  assert.match(router, /eligible-employees'.*PAYROLL_GENERATE/);
  assert.match(controller, /getPayrollEligibleEmployees/);
});

test('salary register backend supports department, payroll status and employee search filters', () => {
  const controller = read('SERVER/SYSTEM/controllers/System/Employees/EmployeePayroll.controller.js');
  const service = read('SERVER/SYSTEM/services/employeePayroll.service.js');

  assert.match(controller, /department: req\.query\.department/);
  assert.match(controller, /payrollStatus: req\.query\.payroll_status/);
  assert.match(controller, /search: req\.query\.search/);
  assert.match(service, /p\.department_snapshot = \?/);
  assert.match(service, /p\.payroll_status = \?/);
  assert.match(service, /p\.employee_name_snapshot LIKE \?/);
  assert.match(service, /e\.employee_code LIKE \?/);
});





