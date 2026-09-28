const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
};

const nullableRate = (value) => value === null || value === undefined || value === '' ? null : Number(value);
const hoursFromMinutes = (minutes) => Number(minutes || 0) / 60;

export const calculatePayrollRates = ({ monthlyBasicSalary, regularWorkingMinutes }) => {
  const monthly = Number(monthlyBasicSalary || 0);
  const regularMinutes = Number(regularWorkingMinutes || 0);
  if (!Number.isFinite(monthly) || monthly < 0) {
    throw Object.assign(new Error('Monthly Basic Salary must be a non-negative amount.'), { statusCode: 400, code: 'INVALID_MONTHLY_BASIC' });
  }
  if (!Number.isFinite(regularMinutes) || regularMinutes <= 0) {
    throw Object.assign(new Error('Attendance Settings must define Regular Working Minutes greater than zero.'), { statusCode: 409, code: 'INVALID_REGULAR_WORKING_MINUTES' });
  }

  const halfMonthBasic = round(monthly / 2, 2);
  const dailyRate = round((monthly * 12) / 365, 6);
  const regularHoursPerDay = regularMinutes / 60;
  // The supplied receipt establishes the displayed 2-decimal hourly rate as the
  // deduction basis (49.32 -> 1,031.61 for 1,255 minutes).
  const hourlyRate = round(dailyRate / regularHoursPerDay, 2);
  const minuteRate = round(hourlyRate / 60, 6);

  return { halfMonthBasic, dailyRate, hourlyRate, minuteRate, regularHoursPerDay };
};

export const calculateAttendanceDeduction = ({ tardinessAbsenceMinutes, hourlyRate }) =>
  round(Number(tardinessAbsenceMinutes || 0) * (Number(hourlyRate || 0) / 60), 2);

export const resolvePayrollAllowances = ({ periodType, riceAllowance, transportationAllowance }) => ({
  riceAllowance: periodType === 'second_half' ? round(riceAllowance, 2) : 0,
  transportationAllowance: periodType === 'second_half' ? round(transportationAllowance, 2) : 0,
  // The master plan still does not define an attendance-bonus eligibility/timing rule.
  attendanceBonus: 0,
});

export const calculateConfiguredPayrollEarnings = ({
  hourlyRate,
  overtimeMinutes = 0,
  restDayOvertimeMinutes = 0,
  regularHolidayMinutes = 0,
  specialHolidayMinutes = 0,
  nightDifferentialMinutes = 0,
  payrollSettings = {},
}) => {
  const regularOtMultiplier = nullableRate(payrollSettings.regular_ot_multiplier);
  const restDayOtMultiplier = nullableRate(payrollSettings.rest_day_ot_multiplier);
  const regularHolidayMultiplier = nullableRate(payrollSettings.regular_holiday_multiplier);
  const specialHolidayMultiplier = nullableRate(payrollSettings.special_holiday_multiplier);
  const nightDifferentialPercentage = nullableRate(payrollSettings.night_differential_percentage);

  return {
    overtimePay: regularOtMultiplier === null ? 0 : round(Number(hourlyRate || 0) * hoursFromMinutes(overtimeMinutes) * regularOtMultiplier, 2),
    restDayOvertimePay: restDayOtMultiplier === null ? 0 : round(Number(hourlyRate || 0) * hoursFromMinutes(restDayOvertimeMinutes) * restDayOtMultiplier, 2),
    regularHolidayPay: regularHolidayMultiplier === null ? 0 : round(Number(hourlyRate || 0) * hoursFromMinutes(regularHolidayMinutes) * regularHolidayMultiplier, 2),
    specialHolidayPay: specialHolidayMultiplier === null ? 0 : round(Number(hourlyRate || 0) * hoursFromMinutes(specialHolidayMinutes) * specialHolidayMultiplier, 2),
    nightDifferentialPay: nightDifferentialPercentage === null ? 0 : round(Number(hourlyRate || 0) * hoursFromMinutes(nightDifferentialMinutes) * (nightDifferentialPercentage / 100), 2),
  };
};

export const calculateDraftPayrollMoney = ({
  monthlyBasicSalary,
  regularWorkingMinutes,
  tardinessAbsenceMinutes,
  periodType,
  riceAllowance,
  transportationAllowance,
  overtimeMinutes = 0,
  restDayOvertimeMinutes = 0,
  regularHolidayMinutes = 0,
  specialHolidayMinutes = 0,
  nightDifferentialMinutes = 0,
  payrollSettings = {},
}) => {
  const rates = calculatePayrollRates({ monthlyBasicSalary, regularWorkingMinutes });
  const attendanceDeduction = calculateAttendanceDeduction({
    tardinessAbsenceMinutes,
    hourlyRate: rates.hourlyRate,
  });
  const allowances = resolvePayrollAllowances({ periodType, riceAllowance, transportationAllowance });
  const configuredEarnings = calculateConfiguredPayrollEarnings({
    hourlyRate: rates.hourlyRate,
    overtimeMinutes,
    restDayOvertimeMinutes,
    regularHolidayMinutes,
    specialHolidayMinutes,
    nightDifferentialMinutes,
    payrollSettings,
  });
  const manualAdditionsTotal = 0;
  const manualDeductionsTotal = 0;

  const netFundRelease = round(
    rates.halfMonthBasic
      - attendanceDeduction
      + configuredEarnings.overtimePay
      + configuredEarnings.restDayOvertimePay
      + configuredEarnings.regularHolidayPay
      + configuredEarnings.specialHolidayPay
      + configuredEarnings.nightDifferentialPay
      + allowances.riceAllowance
      + allowances.transportationAllowance
      + allowances.attendanceBonus
      + manualAdditionsTotal
      - manualDeductionsTotal,
    2
  );

  return {
    ...rates,
    attendanceDeduction,
    ...allowances,
    ...configuredEarnings,
    manualAdditionsTotal,
    manualDeductionsTotal,
    netFundRelease,
  };
};
