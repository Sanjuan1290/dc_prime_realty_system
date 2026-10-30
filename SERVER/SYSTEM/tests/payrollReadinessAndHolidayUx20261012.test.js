import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assessPayrollReadiness, payrollRequirements } from '../services/payrollReadiness.service.js';
import { resolvePayrollPeriod } from '../services/payrollPeriod.service.js';
import { calculateConfiguredPayrollEarnings } from '../services/payrollCalculation.service.js';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const employee = {
  employee_id: 11,
  employee_code: 'EMP-011',
  employee_status: 'active',
  position: 'Accounting Clerk',
  department: 'Accounting',
  employment_type: 'regular',
  hire_date: '2026-01-01',
};
const period = resolvePayrollPeriod({ month: '2026-10', periodType: 'first_half' });
const settings = {
  mid_period_change_rule: 'period_boundary_only',
  regular_ot_multiplier: null,
  rest_day_ot_multiplier: null,
  regular_holiday_multiplier: null,
  special_holiday_multiplier: null,
  night_differential_percentage: null,
};
const mockConnection = (history = []) => ({
  query: async (sql) => {
    if (/FROM employee_employment_history h/.test(sql)) return [history];
    if (/FROM system_settings/.test(sql)) return [[{ attendance_regular_work_minutes: 600 }]];
    return [[]]; // No attendance, day-settings or rest days; absence policy remains in engine.
  },
});

test('payroll readiness identifies missing effective Employee compensation instead of generic skipped count', async () => {
  const result = await assessPayrollReadiness(mockConnection(), employee, { period, today: '2026-10-12', settings });
  assert.equal(result.can_generate, false);
  assert.ok(result.issues.some((issue) => issue.code === 'PAYROLL_COMPENSATION_NOT_FOUND'));
  assert.equal(result.attendance.recorded_days, 0);
  assert.ok(result.checks.some((item) => item.field === 'regular_working_minutes'));
});

test('salary effective on 1st with full period coverage is accepted, while missing Attendance is transparently reported', async () => {
  const history = [{ employee_employment_history_id: 7, employee_id: 11, monthly_basic_salary: '19000.00', rice_allowance: 500, transportation_allowance: 500, effective_from: '2026-10-01', effective_to: null }];
  const result = await assessPayrollReadiness(mockConnection(history), employee, { period, today: '2026-10-12', settings });
  assert.equal(result.can_generate, true, JSON.stringify(result.issues));
  assert.equal(result.compensation.monthly_basic_salary, 19000);
  assert.equal(result.attendance.recorded_days, 0);
  assert.equal(result.checks.find((item) => item.field === 'attendance').ok, false);
});

test('mid-period hire remains blocked without invented salary proration', async () => {
  const history = [{ employee_employment_history_id: 7, employee_id: 11, monthly_basic_salary: '19000.00', effective_from: '2026-10-10', effective_to: null }];
  const result = await assessPayrollReadiness(mockConnection(history), employee, { period, today: '2026-10-12', settings });
  assert.equal(result.can_generate, false);
  assert.ok(result.issues.some((issue) => issue.code === 'PARTIAL_PERIOD_COMPENSATION_BLOCKED'));
});

test('payroll requirements identify Employee, compensation, Attendance and Payroll Settings sources', () => {
  const sources = new Set(payrollRequirements.map((requirement) => requirement.source));
  assert.ok(sources.has('Employees'));
  assert.ok(sources.has('Employment & Compensation History'));
  assert.ok(sources.has('Attendance Settings'));
  assert.ok(sources.has('Attendance'));
  assert.ok(sources.has('Payroll Settings'));
});

test('eligibility endpoint remains permission-gated and adds period-specific readiness without new mutation', () => {
  const router = read('SERVER/SYSTEM/routers/System/employeePayroll.routers.js');
  const controller = read('SERVER/SYSTEM/controllers/System/Employees/EmployeePayroll.controller.js');
  const modal = read('CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/GeneratePayrollModal.jsx');
  const page = read('CLIENT/SYSTEM/src/pages/System/EmployeeSalary.jsx');
  assert.match(router, /eligible-employees'.*PERMISSIONS\.PAYROLL_GENERATE/);
  assert.match(controller, /assessPayrollReadiness\(connection, employee/);
  assert.match(modal, /Payroll Check/);
  assert.doesNotMatch(modal, /Fields and settings required for payroll generation/);
  assert.doesNotMatch(modal, /payroll_readiness\.checks\.map/);
  assert.match(modal, /lastResult\.skipped\?\.map/);
  assert.match(modal, /employee_id: Number\(employeeId\)/);
  assert.match(page, /payroll draft\(s\) created/);
});

test('one visible Holiday Multiplier applies the same approved rate to existing holiday categories without touching prior payroll', () => {
  const settingsUi = read('CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/PayrollSettingsModal.jsx');
  assert.match(settingsUi, /Holiday Pay Rate/);
  assert.match(settingsUi, /legacyHolidayOtKeys/);
  assert.match(settingsUi, /regular_holiday_multiplier: payloadValue\(form\?\.holiday_multiplier\)/);
  assert.match(settingsUi, /special_holiday_multiplier: payloadValue\(form\?\.holiday_multiplier\)/);
  assert.match(settingsUi, /sharedHolidayRateRequired/);
  assert.doesNotMatch(settingsUi, /'Regular Holiday OT Multiplier'/);
  const earned = calculateConfiguredPayrollEarnings({
    hourlyRate: 100, regularHolidayMinutes: 60, specialHolidayMinutes: 60,
    payrollSettings: { regular_holiday_multiplier: 2, special_holiday_multiplier: 2 },
  });
  assert.equal(earned.regularHolidayPay + earned.specialHolidayPay, 400);
});



