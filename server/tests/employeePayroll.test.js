import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAttendanceMetrics } from '../controllers/System/Employees/employeeModule.shared.js';

const employee = {
  monthly_salary: 26000,
  payroll_divisor: 26,
  attendance_grace_minutes: 0,
};
const schedule = {
  is_work_day: 1,
  shift_start: '08:00:00',
  shift_end: '17:00:00',
  break_minutes: 60,
};

test('Late and undertime deductions use exact seconds', () => {
  const result = calculateAttendanceMetrics({
    employee,
    schedule,
    status: 'present',
    actualTimeIn: '08:01:30',
    actualTimeOut: '16:59:30',
  });
  assert.equal(result.dailyRate, 1000);
  assert.equal(result.lateSeconds, 90);
  assert.equal(result.undertimeSeconds, 30);
  assert.equal(result.lateDeduction, 3.13);
  assert.equal(result.undertimeDeduction, 1.04);
});

test('Grace minutes remove only the covered late time', () => {
  const result = calculateAttendanceMetrics({
    employee: { ...employee, attendance_grace_minutes: 5 },
    schedule,
    status: 'present',
    actualTimeIn: '08:07:30',
    actualTimeOut: '17:00:00',
  });
  assert.equal(result.lateSeconds, 150);
  assert.equal(result.lateDeduction, 5.21);
});

test('Unpaid absence deducts one configured daily rate', () => {
  const result = calculateAttendanceMetrics({ employee, schedule, status: 'absent' });
  assert.equal(result.absenceDeduction, 1000);
  assert.equal(result.lateDeduction, 0);
  assert.equal(result.undertimeDeduction, 0);
});
