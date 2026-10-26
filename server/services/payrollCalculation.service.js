const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
};

const nullableRate = (value) => value === null || value === undefined || value === '' ? null : Number(value);
const hoursFromMinutes = (minutes) => Number(minutes || 0) / 60;

// D&C Prime's signed salary sample: 52 weeks × 5 workdays and 8 paid hours.
export const PAYROLL_ANNUAL_WORKDAYS = 52 * 5;
export const PAYROLL_PAID_WORK_MINUTES = 8 * 60;

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
  const dailyRate = round((monthly * 12) / PAYROLL_ANNUAL_WORKDAYS, 6);
  // Payroll pay rates use 8 paid hours, even when the attendance clock uses a
  // longer shift. Payroll attendance summaries likewise use this 8-hour cap.
  const regularHoursPerDay = PAYROLL_PAID_WORK_MINUTES / 60;
  // The signed payroll sample rounds the hourly rate to 2 decimal places before
  // computing the late/absence deduction (86.54 × 1,830 / 60 = 2,639.47).
  const hourlyRate = round(dailyRate / regularHoursPerDay, 2);
  const minuteRate = round(hourlyRate / 60, 6);

  return { halfMonthBasic, dailyRate, hourlyRate, minuteRate, regularHoursPerDay };
};

export const calculateAttendanceDeduction = ({ tardinessAbsenceMinutes, hourlyRate }) =>
  round(Number(tardinessAbsenceMinutes || 0) * (Number(hourlyRate || 0) / 60), 2);

// Attendance Bonus rules are company-controlled. Unconfigured rules never pay silently.
export const evaluateAttendanceBonus = ({ rule = 'not_configured', amount = 0, attendance = {}, rows = [], attendanceThrough, periodEnd } = {}) => {
  const configured = Math.max(0, Number(amount || 0));
  if (!configured) return { eligible: false, note: 'No attendance bonus configured for this employee.' };
  if (rule === 'disabled') return { eligible: false, note: 'Attendance bonus is disabled by company policy.' };
  if (rule !== 'perfect_attendance_per_period') return { eligible: false, note: 'Attendance bonus has no approved rule; it is not included.' };
  if (!periodEnd || !attendanceThrough || attendanceThrough < periodEnd) return { eligible: false, note: 'Attendance bonus waits until the pay period is complete.' };
  if (Number(attendance.scheduledDays || 0) < 1) return { eligible: false, note: 'No scheduled working days in the period.' };
  if (!rows.some((r) => Boolean(r.timeIn || r.time_in) && Boolean(r.timeOut || r.time_out))) return { eligible: false, note: 'No completed Attendance entries were recorded for this pay period.' };
  if (rows.some((r) => Boolean(r.timeIn || r.time_in) && !Boolean(r.timeOut || r.time_out))) return { eligible: false, note: 'Some Attendance entries have no Time Out.' };
  if (Number(attendance.tardinessAbsenceMinutes || 0) > 0) return { eligible: false, note: 'Attendance bonus not earned: late or absent time was recorded.' };
  return { eligible: true, note: 'Full bonus earned for a completed pay period with no late or absent time.' };
};

export const resolvePayrollAllowances = ({ periodType, riceAllowance, transportationAllowance, attendanceBonusAmount = 0, attendanceBonusEligible = false }) => ({
  riceAllowance: periodType === 'second_half' ? round(riceAllowance, 2) : 0,
  transportationAllowance: periodType === 'second_half' ? round(transportationAllowance, 2) : 0,
  attendanceBonus: attendanceBonusEligible ? round(attendanceBonusAmount, 2) : 0,
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
  attendanceBonusAmount = 0,
  attendanceBonusEligible = false,
  overtimeMinutes = 0,
  restDayOvertimeMinutes = 0,
  regularHolidayMinutes = 0,
  specialHolidayMinutes = 0,
  nightDifferentialMinutes = 0,
  payrollSettings = {},
  prorationFraction = 1,
}) => {
  const rates = calculatePayrollRates({ monthlyBasicSalary, regularWorkingMinutes });
  if (!Number.isFinite(prorationFraction) || prorationFraction < 0 || prorationFraction > 1) {
    throw Object.assign(new Error('Invalid new-hire proration fraction.'), { code: 'INVALID_PRORATION_FRACTION', statusCode: 409 });
  }
  const halfMonthBasic = round(rates.halfMonthBasic * prorationFraction, 2);
  const attendanceDeduction = calculateAttendanceDeduction({
    tardinessAbsenceMinutes,
    hourlyRate: rates.hourlyRate,
  });
  const allowances = resolvePayrollAllowances({ periodType, riceAllowance, transportationAllowance, attendanceBonusAmount, attendanceBonusEligible });
  const proratedAllowances = {
    riceAllowance: round(allowances.riceAllowance * prorationFraction, 2),
    transportationAllowance: round(allowances.transportationAllowance * prorationFraction, 2),
    attendanceBonus: round(allowances.attendanceBonus * prorationFraction, 2),
  };
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
    halfMonthBasic
      - attendanceDeduction
      + configuredEarnings.overtimePay
      + configuredEarnings.restDayOvertimePay
      + configuredEarnings.regularHolidayPay
      + configuredEarnings.specialHolidayPay
      + configuredEarnings.nightDifferentialPay
      + proratedAllowances.riceAllowance
      + proratedAllowances.transportationAllowance
      + proratedAllowances.attendanceBonus
      + manualAdditionsTotal
      - manualDeductionsTotal,
    2
  );

  return {
    ...rates,
    halfMonthBasic,
    prorationFraction,
    attendanceDeduction,
    ...proratedAllowances,
    ...configuredEarnings,
    manualAdditionsTotal,
    manualDeductionsTotal,
    netFundRelease,
  };
};






