/** Explicit HR-approved first-hire policy. Uses the employee's rest-day pattern
 * effective on their actual hire date for both numerator and denominator.
 * Does NOT backdate or pay pre-employment attendance. */
export const computeNewHireWorkdayFraction = ({ periodStart, periodEnd, hireDate, restDays }) => {
  const rest = new Set(restDays || []);
  if (!rest.size) throw Object.assign(new Error('First-payroll proration requires assigned employee Rest Days.'), { code: 'NEW_HIRE_REST_DAYS_REQUIRED', statusCode: 409 });
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (![periodStart, periodEnd, hireDate].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')) || hireDate < periodStart || hireDate > periodEnd) {
    throw Object.assign(new Error('Invalid new-hire payroll date coverage.'), { code: 'NEW_HIRE_INVALID_DATES', statusCode: 409 });
  }
  let allDays = 0;
  let eligibleDays = 0;
  for (let date = new Date(`${periodStart}T00:00:00Z`); date.toISOString().slice(0, 10) <= periodEnd; date.setUTCDate(date.getUTCDate() + 1)) {
    if (rest.has(names[date.getUTCDay()])) continue;
    allDays += 1;
    if (date.toISOString().slice(0, 10) >= hireDate) eligibleDays += 1;
  }
  if (!allDays) throw Object.assign(new Error('Cannot calculate a first payroll without scheduled working days.'), { code: 'NEW_HIRE_NO_WORKDAYS', statusCode: 409 });
  return { allDays, eligibleDays, fraction: eligibleDays / allDays };
};


