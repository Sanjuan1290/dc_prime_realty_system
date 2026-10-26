import { findUnsupportedHolidayOvertime, holidayOvertimeWarning } from './payrollHolidayOvertimeGuard.service.js';
/** Read-only preflight for Employee Salary. No payroll or Attendance rows are written. */
import { getEffectiveCompensationForPeriod } from './payrollCompensation.service.js';
import { getPayrollAttendanceSummary } from './payrollAttendance.service.js';
import { calculateDraftPayrollMoney } from './payrollCalculation.service.js';
import { clampPayrollAttendanceThrough } from './payrollPeriod.service.js';
import { getEmployeeRestDaysAsOf } from './employeeRestDay.service.js';

const valuePresent = (value) => value !== null && value !== undefined && String(value).trim() !== '';

export const payrollRequirements = Object.freeze([
  { field: 'employee_code', label: 'Employee code', source: 'Employees', required: true },
  { field: 'employee_status', label: 'Active employee status', source: 'Employees', required: true },
  { field: 'position', label: 'Position', source: 'Employees / Employment History', required: true },
  { field: 'department', label: 'Department', source: 'Employees / Employment History', required: true },
  { field: 'employment_type', label: 'Employment type', source: 'Employees / Employment History', required: true },
  { field: 'hire_date', label: 'Hire date', source: 'Employees', required: true },
  { field: 'monthly_basic_salary', label: 'Monthly basic salary and effective dates / approved first-hire policy', source: 'Employment & Compensation History', required: true },
  { field: 'regular_working_minutes', label: 'Working minutes, shift and break settings', source: 'Attendance Settings', required: true },
  { field: 'rest_days', label: 'Rest-day assignments', source: 'Employees / Attendance', required: false },
  { field: 'attendance', label: 'Time In, Time Out, absences, leave and holiday records', source: 'Attendance', required: false },
  { field: 'premium_rates', label: 'Approved overtime, holiday and night differential rates if applicable', source: 'Payroll Settings', required: false },
]);

const friendlyIssue = (error) => ({
  code: error?.code || 'PAYROLL_READINESS_FAILED',
  message: ['PAYROLL_COMPENSATION_NOT_FOUND', 'PARTIAL_PERIOD_COMPENSATION_BLOCKED', 'MID_PERIOD_COMPENSATION_CHANGE_BLOCKED', 'FUTURE_PAYROLL_PERIOD', 'INVALID_REGULAR_WORKING_MINUTES', 'NEW_HIRE_PRORATION_NOT_APPROVED', 'NEW_HIRE_COMPENSATION_DATE_MISMATCH'].includes(error?.code)
    ? error.message
    : 'Payroll readiness could not be verified. Check the employee records or ask an administrator to inspect the server log.',
});

export const assessPayrollReadiness = async (connection, employee, { period, today, settings }) => {
  const issues = [];
  const warnings = [];
  const checks = payrollRequirements.filter(({ source }) => source === 'Employees' || source === 'Employees / Employment History')
    .map((entry) => {
      const fieldValue = employee[entry.field];
      const ok = entry.field === 'employee_status' ? fieldValue === 'active' : valuePresent(fieldValue);
      if (!ok && entry.required) issues.push({ code: `MISSING_${entry.field.toUpperCase()}`, message: `${entry.label} must be provided in Employees.` });
      return { ...entry, ok, value: fieldValue ?? null };
    });

  let compensation = null;
  try {
    const hireDate = employee.hire_date?.toISOString?.().slice(0, 10) || String(employee.hire_date || '').slice(0, 10);
    if (hireDate > period.periodStart && hireDate <= period.periodEnd && settings.new_hire_proration_rule !== 'scheduled_workdays') {
      const err = new Error('New-hire first payroll begins mid-period. Enable and approve scheduled-workday proration in Payroll Settings.');
      err.code = 'NEW_HIRE_PRORATION_NOT_APPROVED';
      throw err;
    }
    compensation = await getEffectiveCompensationForPeriod(connection, {
      employeeId: employee.employee_id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      midPeriodChangeRule: settings.mid_period_change_rule,
      hireDate,
      newHireProrationRule: settings.new_hire_proration_rule,
    });
    if (hireDate > period.periodStart && hireDate <= period.periodEnd && !compensation.payroll_new_hire_start) {
      const err = new Error('Effective Compensation History must start on the actual hire date for first-period proration.');
      err.code = 'NEW_HIRE_COMPENSATION_DATE_MISMATCH';
      throw err;
    }
    if (compensation.payroll_new_hire_start) {
      warnings.push(`Approved new-hire workday proration applies from ${compensation.payroll_new_hire_start}. Pre-hire attendance is excluded.`);
    }
    if (Number(compensation.monthly_basic_salary) === 0) {
      warnings.push('Monthly basic salary is ₱0.00 in the effective compensation record. Verify that this is intentional before generating Draft payroll.');
    }
  } catch (error) {
    issues.push(friendlyIssue(error));
  }
  checks.push({ field: 'monthly_basic_salary', label: 'Effective compensation covers the full payroll period', source: 'Employment & Compensation History', required: true, ok: Boolean(compensation) && Number(compensation.monthly_basic_salary) > 0, value: compensation ? {
    effective_from: compensation.effective_from,
    effective_to: compensation.effective_to,
    monthly_basic_salary: Number(compensation.monthly_basic_salary),
  } : null });

  let attendance = null;
  try {
    const through = clampPayrollAttendanceThrough({ ...period, today });
    attendance = await getPayrollAttendanceSummary(connection, { employeeId: employee.employee_id, dateFrom: compensation?.payroll_new_hire_start || period.periodStart, dateTo: through });
    if (Number(attendance.schedule.regularWorkingMinutes) <= 0) {
      issues.push({ code: 'INVALID_REGULAR_WORKING_MINUTES', message: 'Set Regular Working Minutes greater than zero in Attendance Settings.' });
    }
    if (compensation) {
      calculateDraftPayrollMoney({
        monthlyBasicSalary: compensation.monthly_basic_salary,
        regularWorkingMinutes: attendance.schedule.regularWorkingMinutes,
        tardinessAbsenceMinutes: attendance.summary.tardinessAbsenceMinutes,
        periodType: period.periodType,
        riceAllowance: compensation.rice_allowance,
        transportationAllowance: compensation.transportation_allowance,
        overtimeMinutes: attendance.summary.overtimeMinutes,
        restDayOvertimeMinutes: attendance.summary.restDayOvertimeMinutes,
        regularHolidayMinutes: attendance.summary.regularHolidayMinutes,
        specialHolidayMinutes: attendance.summary.specialHolidayMinutes,
        nightDifferentialMinutes: attendance.summary.nightDifferentialMinutes,
        payrollSettings: settings,
      });
    }
  } catch (error) {
    if (!issues.some(({ code }) => code === error.code)) issues.push(friendlyIssue(error));
  }
  checks.push({ field: 'regular_working_minutes', label: 'Attendance Settings: regular working minutes', source: 'Attendance Settings', required: true, ok: Number(attendance?.schedule?.regularWorkingMinutes) > 0, value: attendance?.schedule?.regularWorkingMinutes ?? null });

  let restDays = [];
  try {
    restDays = (await getEmployeeRestDaysAsOf(connection, [employee.employee_id], period.periodEnd)).get(Number(employee.employee_id)) || [];
  } catch (error) {
    issues.push(friendlyIssue(error));
  }
  checks.push({ field: 'rest_days', label: 'Rest days', source: 'Employees / Attendance', required: false, ok: restDays.length > 0, value: restDays });
  if (!restDays.length) warnings.push('No rest-day assignment was found for this payroll period. Verify the employee schedule before generating.');
  const recordedDays = attendance?.rows?.filter((row) => Boolean(row.timeIn || row.timeOut))?.length || 0;
  const incompleteDays = attendance?.rows?.filter((row) => Boolean(row.timeIn) && !row.timeOut)?.length || 0;
  checks.push({ field: 'attendance', label: 'Recorded Attendance days', source: 'Attendance', required: false, ok: recordedDays > 0 && incompleteDays === 0, value: { recordedDays, incompleteDays, checkedDays: attendance?.rows?.length || 0 } });

  const premiumMissing = [];
  if (attendance?.summary?.overtimeMinutes && settings.regular_ot_multiplier === null) premiumMissing.push('Regular OT');
  if (attendance?.summary?.restDayOvertimeMinutes && settings.rest_day_ot_multiplier === null) premiumMissing.push('Rest Day OT');
  if (attendance?.summary?.regularHolidayMinutes && settings.regular_holiday_multiplier === null) premiumMissing.push('Holiday');
  if (attendance?.summary?.specialHolidayMinutes && settings.special_holiday_multiplier === null) premiumMissing.push('Holiday');
  if (attendance?.summary?.nightDifferentialMinutes && settings.night_differential_percentage === null) premiumMissing.push('Night Differential');
  checks.push({ field: 'premium_rates', label: 'Premium pay rates for recorded hours', source: 'Payroll Settings', required: false, ok: premiumMissing.length === 0, value: [...new Set(premiumMissing)] });
  if (premiumMissing.length) warnings.push(`Payroll Settings not configured for recorded premium hours: ${[...new Set(premiumMissing)].join(', ')}. Draft premium pay may be ₱0.00.`);
  if (recordedDays === 0 && attendance?.rows?.length) warnings.push('No Time In/Out entries were found in this period. Unrecorded scheduled days may be treated as absences.');
  if (incompleteDays) warnings.push(`${incompleteDays} Attendance day(s) have Time In but no Time Out. Verify automatic/manual timeout first.`);
  const holidayIssue = holidayOvertimeWarning(findUnsupportedHolidayOvertime(attendance?.rows || []));
  if (holidayIssue) warnings.push(holidayIssue);

  return {
    can_generate: issues.length === 0,
    issues,
    warnings,
    checks,
    compensation: compensation ? { effective_from: compensation.effective_from, effective_to: compensation.effective_to, monthly_basic_salary: Number(compensation.monthly_basic_salary) } : null,
    attendance: { recorded_days: recordedDays, incomplete_days: incompleteDays, checked_days: attendance?.rows?.length || 0, rest_days: restDays },
  };
};


