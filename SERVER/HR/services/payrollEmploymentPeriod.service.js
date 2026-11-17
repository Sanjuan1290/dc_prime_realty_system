// Current salary and rest-day settings must never be substituted for a period
// before employment. An actual hire-date correction is an explicit HR action.
export const getPayrollEmploymentPeriodIssue = (employee, period) => {
  const hireDate = employee.hire_date instanceof Date
    ? employee.hire_date.toISOString().slice(0, 10)
    : String(employee.hire_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDate) || !period.periodEnd || hireDate <= period.periodEnd) return null;
  return {
    code: 'EMPLOYEE_HIRED_AFTER_PERIOD',
    message: `The recorded hire date is ${hireDate}, after this pay period (${period.periodStart} to ${period.periodEnd}). Choose a period on or after the hire date. If the hire date is incorrect, correct it in Edit Employee using the actual start date and a reason.`,
    data: {hire_date: hireDate, period_start: period.periodStart, period_end: period.periodEnd},
  };
};
