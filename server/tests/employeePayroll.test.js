import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendanceMetrics,
  calculateCashAdvanceDeduction,
  countScheduledWorkDays,
  getNextPayrollReleaseDate,
  getPayrollAllowances,
  getPayrollReleasePeriod,
} from '../controllers/System/Employees/employeeModule.shared.js';

const employee = {
  monthly_salary: 15000,
  payroll_divisor: 26, // Legacy field only; dynamic monthWorkDays is used when supplied.
  attendance_grace_minutes: 15,
};

const schedule = {
  is_work_day: 1,
  shift_start: '09:00:00',
  shift_end: '18:00:00',
  break_minutes: 60,
};

test('7th release covers the previous month from the 16th through month end', () => {
  const result = getPayrollReleasePeriod('2026-07-07');
  assert.equal(result.start, '2026-06-16');
  assert.equal(result.end, '2026-06-30');
  assert.equal(result.salaryMonthStart, '2026-06-01');
  assert.equal(result.salaryMonthEnd, '2026-06-30');
  assert.equal(result.periodType, 'second_half');
  assert.equal(result.includesAttendanceBonus, true);
});

test('22nd release covers the current month from the 1st through the 15th', () => {
  const result = getPayrollReleasePeriod('2026-07-22');
  assert.equal(result.start, '2026-07-01');
  assert.equal(result.end, '2026-07-15');
  assert.equal(result.periodType, 'first_half');
  assert.equal(result.includesAttendanceBonus, false);
});

test('next salary release follows the 7th and 22nd schedule', () => {
  assert.equal(getNextPayrollReleaseDate('2026-07-01'), '2026-07-07');
  assert.equal(getNextPayrollReleaseDate('2026-07-08'), '2026-07-22');
  assert.equal(getNextPayrollReleaseDate('2026-07-23'), '2026-08-07');
});

test('scheduled work days are counted dynamically for the salary month', () => {
  const schedules = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_work_day: [1, 3, 5].includes(weekday),
  }));

  assert.equal(countScheduledWorkDays({
    schedules,
    start: '2026-06-01',
    end: '2026-06-30',
    hireDate: '2026-01-01',
  }), 13);
});

test('14 late minutes remain salary-deductible but stay inside the 15-minute bonus grace', () => {
  const result = calculateAttendanceMetrics({
    employee,
    schedule,
    status: 'present',
    actualTimeIn: '09:14:00',
    actualTimeOut: '18:00:00',
    monthWorkDays: 20,
  });

  assert.equal(result.dailyRate, 750);
  assert.equal(result.hourlyRate, 93.75);
  assert.equal(result.lateSeconds, 840);
  assert.equal(result.lateDeduction, 21.88);
  assert.equal(result.bonusLateViolation, false);
});

test('late time beyond the 15-minute grace disqualifies the attendance bonus', () => {
  const result = calculateAttendanceMetrics({
    employee,
    schedule,
    status: 'present',
    actualTimeIn: '09:16:00',
    actualTimeOut: '18:00:00',
    monthWorkDays: 20,
  });

  assert.equal(result.lateSeconds, 960);
  assert.equal(result.lateDeduction, 25);
  assert.equal(result.bonusLateViolation, true);
});

test('unpaid absence deducts one dynamic daily rate', () => {
  const result = calculateAttendanceMetrics({
    employee,
    schedule,
    status: 'absent',
    monthWorkDays: 20,
  });

  assert.equal(result.absenceDeduction, 750);
  assert.equal(result.lateDeduction, 0);
  assert.equal(result.undertimeDeduction, 0);
});


test('rice allowance is included in both releases while transportation is 7th-only', () => {
  const allowanceEmployee = { rice_allowance: 500, transportation_allowance: 500 };
  const seventh = getPayrollReleasePeriod('2026-07-07');
  const twentySecond = getPayrollReleasePeriod('2026-07-22');

  assert.deepEqual(getPayrollAllowances({ employee: allowanceEmployee, period: seventh }), {
    riceAllowance: 500,
    transportationAllowance: 500,
  });
  assert.deepEqual(getPayrollAllowances({ employee: allowanceEmployee, period: twentySecond }), {
    riceAllowance: 500,
    transportationAllowance: 0,
  });
});


test('approved cash advance deducts the full outstanding balance on the next salary release', () => {
  const result = calculateCashAdvanceDeduction({
    advances: [{ remaining_balance: 5000 }],
    availableSalary: 9000,
  });

  assert.equal(result, 5000);
});

test('cash advance deduction is capped by the salary available after attendance deductions', () => {
  const result = calculateCashAdvanceDeduction({
    advances: [{ remaining_balance: 5000 }, { remaining_balance: 2500 }],
    availableSalary: 4200,
  });

  assert.equal(result, 4200);
});


