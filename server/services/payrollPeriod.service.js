import { dateOnly } from '../controllers/System/Employees/employeeModule.shared.js';

export const PAYROLL_PERIOD_TYPES = Object.freeze(['first_half', 'second_half']);

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const payrollError = (message, code = 'INVALID_PAYROLL_PERIOD', statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const resolvePayrollPeriod = ({ month, periodType }) => {
  const match = String(month || '').match(MONTH_PATTERN);
  if (!match) throw payrollError('Month must use YYYY-MM format.');

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw payrollError('Select a valid payroll month.');
  if (!PAYROLL_PERIOD_TYPES.includes(String(periodType || ''))) {
    throw payrollError('Payroll Period must be first_half or second_half.');
  }

  const lastDay = daysInMonth(year, monthNumber);
  const startDay = periodType === 'first_half' ? 1 : 16;
  const endDay = periodType === 'first_half' ? 15 : lastDay;
  const pad = (value) => String(value).padStart(2, '0');
  const periodStart = `${year}-${pad(monthNumber)}-${pad(startDay)}`;
  const periodEnd = `${year}-${pad(monthNumber)}-${pad(endDay)}`;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
  });
  const startLabel = formatter.format(new Date(`${periodStart}T00:00:00Z`));
  const endLabel = formatter.format(new Date(`${periodEnd}T00:00:00Z`));

  return {
    month: `${year}-${pad(monthNumber)}`,
    periodType,
    periodStart,
    periodEnd,
    periodLabel: `${startLabel} - ${endLabel}`,
  };
};

export const payrollPeriodFromDates = ({ periodStart, periodEnd }) => {
  const start = dateOnly(periodStart);
  const end = dateOnly(periodEnd);
  if (!start || !end || end < start) throw payrollError('Payroll period dates are invalid.');
  const month = start.slice(0, 7);
  const startDay = Number(start.slice(8, 10));
  const expectedType = startDay === 1 ? 'first_half' : startDay === 16 ? 'second_half' : null;
  if (!expectedType) throw payrollError('Payroll periods must begin on the 1st or 16th.');
  const resolved = resolvePayrollPeriod({ month, periodType: expectedType });
  if (resolved.periodStart !== start || resolved.periodEnd !== end) {
    throw payrollError('Payroll periods must be 1–15 or 16–last calendar day.');
  }
  return resolved;
};

export const clampPayrollAttendanceThrough = ({ periodStart, periodEnd, today }) => {
  const current = dateOnly(today);
  if (!current) throw payrollError('Current payroll date could not be resolved.');
  if (periodStart > current) {
    throw payrollError('A Draft payroll cannot be generated for a future payroll period.', 'FUTURE_PAYROLL_PERIOD', 409);
  }
  return periodEnd < current ? periodEnd : current;
};

