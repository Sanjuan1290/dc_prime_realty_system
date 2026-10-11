import { createHash } from 'node:crypto';
import { getPayrollAttendanceSummary } from './payrollAttendance.service.js';
import { getEffectiveCompensationForPeriod } from './payrollCompensation.service.js';
import { clampPayrollAttendanceThrough } from './payrollPeriod.service.js';
import { getPayrollSettingsSnapshot, payrollSettingsEqual } from './payrollSettings.service.js';

const payrollError = (message, code = 'PAYROLL_FINALIZATION_ERROR', statusCode = 409, data = null) => Object.assign(
  new Error(message),
  { code, statusCode, data }
);

const n = (value) => Number(value || 0);
const text = (value) => value === null || value === undefined ? null : String(value);

const attendanceRowSnapshot = (row = {}) => ({
  date: text(row.date),
  state: text(row.state),
  day_type: text(row.day_type ?? row.dayType),
  time_in: text(row.time_in ?? row.timeIn),
  time_out: text(row.time_out ?? row.timeOut),
  scheduled_day: Boolean(row.scheduled_day ?? row.scheduledDay),
  absence: Boolean(row.absence),
  regular_attended_minutes: n(row.regular_attended_minutes ?? Math.round(n(row.regularAttendedSeconds) / 60)),
  late_minutes: n(row.late_minutes ?? Math.round(n(row.lateSeconds) / 60)),
  overtime_minutes: n(row.overtime_minutes ?? Math.round(n(row.overtimeSeconds) / 60)),
  rest_day_overtime_minutes: n(row.rest_day_overtime_minutes ?? Math.round(n(row.restDayOvertimeSeconds) / 60)),
  regular_holiday_minutes: n(row.regular_holiday_minutes ?? Math.round(n(row.regularHolidaySeconds) / 60)),
  special_holiday_minutes: n(row.special_holiday_minutes ?? Math.round(n(row.specialHolidaySeconds) / 60)),
});

const attendanceSummarySnapshot = ({ source = {}, regularWorkingMinutes = 0, attendanceCalculatedThrough = null }) => ({
  attendance_calculated_through: text(attendanceCalculatedThrough),
  regular_working_minutes: n(regularWorkingMinutes),
  expected_regular_minutes: n(source.expectedRegularMinutes ?? source.expected_regular_minutes),
  regular_attended_minutes: n(source.regularAttendedMinutes ?? source.regular_attended_minutes),
  pto_minutes: n(source.ptoMinutes ?? source.pto_minutes),
  regular_holiday_minutes: n(source.regularHolidayMinutes ?? source.regular_holiday_minutes),
  special_holiday_minutes: n(source.specialHolidayMinutes ?? source.special_holiday_minutes),
  late_minutes: n(source.lateMinutes ?? source.late_minutes),
  absence_minutes: n(source.absenceMinutes ?? source.absence_minutes),
  tardiness_absence_minutes: n(source.tardinessAbsenceMinutes ?? source.tardiness_absence_minutes),
  overtime_minutes: n(source.overtimeMinutes ?? source.overtime_minutes),
  rest_day_overtime_minutes: n(source.restDayOvertimeMinutes ?? source.rest_day_overtime_minutes),
  night_differential_minutes: n(source.nightDifferentialMinutes ?? source.night_differential_minutes),
});

export const buildPayrollAttendanceFingerprintPayload = ({
  attendanceCalculatedThrough,
  regularWorkingMinutes,
  summary,
  rows = [],
}) => ({
  summary: attendanceSummarySnapshot({
    source: summary,
    regularWorkingMinutes,
    attendanceCalculatedThrough,
  }),
  rows: rows.map(attendanceRowSnapshot),
});

export const hashPayrollAttendanceFingerprint = (payload) => createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

export const buildStoredPayrollAttendanceFingerprint = (payroll) => hashPayrollAttendanceFingerprint(
  buildPayrollAttendanceFingerprintPayload({
    attendanceCalculatedThrough: payroll.attendance_calculated_through,
    regularWorkingMinutes: payroll.regular_working_minutes_snapshot,
    summary: payroll,
    rows: payroll.attendance_breakdown || [],
  })
);

const buildLiveAttendance = async (connection, payroll, today) => {
  const attendanceThrough = clampPayrollAttendanceThrough({
    periodStart: payroll.period_start,
    periodEnd: payroll.period_end,
    today,
  });
  const attendance = await getPayrollAttendanceSummary(connection, {
    employeeId: payroll.employee_id,
    dateFrom: payroll.period_start,
    dateTo: attendanceThrough,
  });
  const payload = buildPayrollAttendanceFingerprintPayload({
    attendanceCalculatedThrough: attendanceThrough,
    regularWorkingMinutes: attendance.schedule.regularWorkingMinutes,
    summary: attendance.summary,
    rows: attendance.rows,
  });
  return {
    attendanceThrough,
    attendance,
    payload,
    fingerprint: hashPayrollAttendanceFingerprint(payload),
  };
};

const compensationSnapshot = (row = {}) => ({
  employment_history_id: n(row.employee_employment_history_id ?? row.employment_history_id),
  position: text(row.position ?? row.position_snapshot),
  department: text(row.department ?? row.department_snapshot),
  employment_status: text(row.employment_type ?? row.employment_status_snapshot),
  monthly_basic: n(row.monthly_basic_salary ?? row.monthly_salary_snapshot),
  rice_allowance: n(row.rice_allowance),
  transportation_allowance: n(row.transportation_allowance),
  attendance_bonus: n(row.attendance_bonus),
});

const sameCompensation = (left, right) => JSON.stringify(compensationSnapshot(left)) === JSON.stringify(compensationSnapshot(right));

const ATTENDANCE_DIFF_FIELDS = [
  ['attendance_calculated_through', 'Attendance Calculated Through'],
  ['regular_working_minutes', 'Regular Working Minutes'],
  ['expected_regular_minutes', 'Expected Regular Minutes'],
  ['regular_attended_minutes', 'Regular Attended Minutes'],
  ['pto_minutes', 'Paid Time Off Minutes'],
  ['regular_holiday_minutes', 'Regular Holiday Minutes'],
  ['special_holiday_minutes', 'Special Holiday Minutes'],
  ['late_minutes', 'Late Minutes'],
  ['absence_minutes', 'Absence Minutes'],
  ['tardiness_absence_minutes', 'Tardiness / Absence Minutes'],
  ['overtime_minutes', 'Overtime Minutes'],
  ['rest_day_overtime_minutes', 'Rest Day Overtime Minutes'],
  ['night_differential_minutes', 'Night Differential Minutes'],
];

export const compareAttendanceFingerprints = ({ finalizedPayload, currentPayload }) => {
  const before = finalizedPayload?.summary || {};
  const after = currentPayload?.summary || {};
  const differences = ATTENDANCE_DIFF_FIELDS
    .filter(([field]) => String(before[field] ?? '') !== String(after[field] ?? ''))
    .map(([field, label]) => ({ field, label, before: before[field] ?? null, after: after[field] ?? null }));

  const beforeRowsHash = hashPayrollAttendanceFingerprint({ rows: finalizedPayload?.rows || [] });
  const afterRowsHash = hashPayrollAttendanceFingerprint({ rows: currentPayload?.rows || [] });
  if (beforeRowsHash !== afterRowsHash && !differences.length) {
    differences.push({
      field: 'attendance_breakdown',
      label: 'Date-level Attendance Records',
      before: 'Finalized attendance snapshot',
      after: 'Current attendance records differ',
    });
  }
  return differences;
};

export const buildFinalizedPayrollSnapshot = (payroll) => ({
  employee_payroll_id: n(payroll.employee_payroll_id),
  employee_id: n(payroll.employee_id),
  employment_history_id: n(payroll.employment_history_id),
  period: {
    label: text(payroll.period_label),
    start: text(payroll.period_start),
    end: text(payroll.period_end),
    type: text(payroll.period_type),
  },
  employee: {
    name: text(payroll.employee_name_snapshot),
    position: text(payroll.position_snapshot),
    department: text(payroll.department_snapshot),
    employment_status: text(payroll.employment_status_snapshot),
  },
  compensation: {
    monthly_basic: n(payroll.monthly_salary_snapshot),
    half_month_basic: n(payroll.half_month_basic),
    daily_rate: n(payroll.daily_rate),
    hourly_rate: n(payroll.hourly_rate_snapshot),
    minute_rate: n(payroll.minute_rate),
  },
  attendance_settings: {
    regular_working_minutes: n(payroll.regular_working_minutes_snapshot),
  },
  attendance: attendanceSummarySnapshot({
    source: payroll,
    regularWorkingMinutes: payroll.regular_working_minutes_snapshot,
    attendanceCalculatedThrough: payroll.attendance_calculated_through,
  }),
  attendance_breakdown: (payroll.attendance_breakdown || []).map(attendanceRowSnapshot),
  payroll_multipliers: payroll.payroll_settings_snapshot || {
    settings_revision: null,
    regular_ot_multiplier: null,
    rest_day_ot_multiplier: null,
    regular_holiday_multiplier: null,
    regular_holiday_ot_multiplier: null,
    special_holiday_multiplier: null,
    special_holiday_ot_multiplier: null,
    night_differential_percentage: null,
    mid_period_change_rule: 'period_boundary_only',
  },
  earnings: {
    overtime_pay: n(payroll.overtime_pay),
    rest_day_overtime_pay: n(payroll.rest_day_overtime_pay),
    regular_holiday_pay: n(payroll.regular_holiday_pay),
    special_holiday_pay: n(payroll.special_holiday_pay),
    night_differential_pay: n(payroll.night_differential_pay),
  },
  allowances: {
    rice_allowance: n(payroll.rice_allowance),
    transportation_allowance: n(payroll.transportation_allowance),
    attendance_bonus: n(payroll.attendance_bonus),
  },
  adjustments: {
    manual_additions_total: n(payroll.manual_additions_total),
    manual_deductions_total: n(payroll.manual_deductions_total),
  },
  deductions: {
    attendance_deduction: n(payroll.attendance_deduction),
  },
  net_fund_release: n(payroll.net_fund_release),
  calculation_version: text(payroll.calculation_version),
  calculation_warnings: payroll.calculation_warnings || [],
});

export const getPayrollFinalizationReview = async (connection, payroll, today) => {
  if (payroll.payroll_status !== 'draft') {
    throw payrollError('Only Draft payroll can proceed to Final Review.', 'EMPLOYEE_PAYROLL_NOT_DRAFT', 409);
  }

  const liveAttendance = await buildLiveAttendance(connection, payroll, today);
  const storedAttendancePayload = buildPayrollAttendanceFingerprintPayload({
    attendanceCalculatedThrough: payroll.attendance_calculated_through,
    regularWorkingMinutes: payroll.regular_working_minutes_snapshot,
    summary: payroll,
    rows: payroll.attendance_breakdown || [],
  });
  const storedAttendanceFingerprint = hashPayrollAttendanceFingerprint(storedAttendancePayload);
  const attendanceChanged = storedAttendanceFingerprint !== liveAttendance.fingerprint;

  const currentPayrollSettings = await getPayrollSettingsSnapshot(connection);
  const draftPayrollSettings = payroll.payroll_settings_snapshot || {};
  const payrollSettingsChanged = !payrollSettingsEqual(draftPayrollSettings, currentPayrollSettings);

  const effectiveCompensation = await getEffectiveCompensationForPeriod(connection, {
    employeeId: payroll.employee_id,
    periodStart: payroll.period_start,
    periodEnd: payroll.period_end,
    midPeriodChangeRule: currentPayrollSettings.mid_period_change_rule,
  });
  const compensationChanged = !sameCompensation(payroll, effectiveCompensation);

  return {
    payroll,
    can_finalize: !attendanceChanged && !compensationChanged && !payrollSettingsChanged,
    attendance_changed_since_draft: attendanceChanged,
    compensation_changed_since_draft: compensationChanged,
    payroll_settings_changed_since_draft: payrollSettingsChanged,
    draft_attendance_fingerprint: storedAttendanceFingerprint,
    current_attendance_fingerprint: liveAttendance.fingerprint,
    attendance_differences: compareAttendanceFingerprints({
      finalizedPayload: storedAttendancePayload,
      currentPayload: liveAttendance.payload,
    }),
    draft_compensation: compensationSnapshot(payroll),
    current_compensation: compensationSnapshot(effectiveCompensation),
    draft_payroll_settings: draftPayrollSettings,
    current_payroll_settings: currentPayrollSettings,
  };
};

export const finalizePayroll = async (connection, { payroll, finalizedByUserId, today }) => {
  const review = await getPayrollFinalizationReview(connection, payroll, today);
  if (!review.can_finalize) {
    throw payrollError(
      'This Draft changed since its last calculation. Recalculate the Draft and review it again before Finalization.',
      'PAYROLL_FINAL_REVIEW_STALE',
      409,
      review
    );
  }

  const snapshot = buildFinalizedPayrollSnapshot(payroll);
  await connection.query(`
    UPDATE employee_payrolls
    SET payroll_status = 'finalized',
        finalized_snapshot_json = ?,
        finalized_attendance_fingerprint = ?,
        finalized_by_user_id = ?,
        finalized_at = CURRENT_TIMESTAMP
    WHERE employee_payroll_id = ? AND payroll_status = 'draft'
  `, [
    JSON.stringify(snapshot),
    review.current_attendance_fingerprint,
    finalizedByUserId || null,
    payroll.employee_payroll_id,
  ]);

  return { snapshot, review };
};

export const getFinalizedAttendanceChangeStatus = async (connection, payroll, today) => {
  if (!['finalized', 'corrected', 'released'].includes(String(payroll.payroll_status || '').toLowerCase())) return null;
  const finalizedPayload = buildPayrollAttendanceFingerprintPayload({
    attendanceCalculatedThrough: payroll.finalized_snapshot?.attendance?.attendance_calculated_through ?? payroll.attendance_calculated_through,
    regularWorkingMinutes: payroll.finalized_snapshot?.attendance_settings?.regular_working_minutes ?? payroll.regular_working_minutes_snapshot,
    summary: payroll.finalized_snapshot?.attendance ?? payroll,
    rows: payroll.finalized_snapshot?.attendance_breakdown ?? payroll.attendance_breakdown ?? [],
  });
  const finalizedFingerprint = payroll.finalized_attendance_fingerprint || hashPayrollAttendanceFingerprint(finalizedPayload);
  const current = await buildLiveAttendance(connection, payroll, today);
  const changed = finalizedFingerprint !== current.fingerprint;
  return {
    changed,
    message: changed ? 'Attendance changed after this payroll was finalized.' : 'Attendance still matches the finalized payroll snapshot.',
    finalized_attendance_fingerprint: finalizedFingerprint,
    current_attendance_fingerprint: current.fingerprint,
    checked_through: current.attendanceThrough,
    differences: changed ? compareAttendanceFingerprints({ finalizedPayload, currentPayload: current.payload }) : [],
    finalized: finalizedPayload.summary,
    current: current.payload.summary,
  };
};

