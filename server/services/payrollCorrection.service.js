import { createHash } from 'node:crypto';
import { calculateDraftPayrollMoney } from './payrollCalculation.service.js';
import { getPayrollAttendanceSummary } from './payrollAttendance.service.js';
import { getEffectiveCompensationForPeriod } from './payrollCompensation.service.js';
import { clampPayrollAttendanceThrough } from './payrollPeriod.service.js';
import { getPayrollSettingsSnapshot } from './payrollSettings.service.js';
import {
  buildFinalizedPayrollSnapshot,
  buildPayrollAttendanceFingerprintPayload,
  hashPayrollAttendanceFingerprint,
} from './payrollFinalization.service.js';
import { getPayrollDraftById, PAYROLL_CALCULATION_VERSION } from './employeePayroll.service.js';

const payrollError = (message, code = 'PAYROLL_CORRECTION_ERROR', statusCode = 409, data = null) => Object.assign(
  new Error(message),
  { code, statusCode, data }
);

const n = (value) => Number(value || 0);
const cleanReason = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 2000);
const stableHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const comparable = (value) => typeof value === 'number' ? roundMoney(value) : (value ?? null);

const CORRECTION_DIFF_FIELDS = [
  ['employee.position', 'Position'],
  ['employee.department', 'Department'],
  ['employee.employment_status', 'Employment Status'],
  ['compensation.monthly_basic', 'Monthly Basic'],
  ['compensation.half_month_basic', 'Half-Month Basic'],
  ['compensation.daily_rate', 'Daily Rate'],
  ['compensation.hourly_rate', 'Hourly Rate'],
  ['compensation.minute_rate', 'Minute Rate'],
  ['payroll_multipliers.settings_revision', 'Payroll Settings Revision'],
  ['payroll_multipliers.regular_ot_multiplier', 'Regular OT Multiplier'],
  ['payroll_multipliers.rest_day_ot_multiplier', 'Rest Day OT Multiplier'],
  ['payroll_multipliers.regular_holiday_multiplier', 'Regular Holiday Multiplier'],
  ['payroll_multipliers.regular_holiday_ot_multiplier', 'Regular Holiday OT Multiplier'],
  ['payroll_multipliers.special_holiday_multiplier', 'Special Holiday Multiplier'],
  ['payroll_multipliers.special_holiday_ot_multiplier', 'Special Holiday OT Multiplier'],
  ['payroll_multipliers.night_differential_percentage', 'Night Differential Percentage'],
  ['payroll_multipliers.mid_period_change_rule', 'Mid-Period Salary Change Rule'],
  ['attendance.expected_regular_minutes', 'Expected Regular Minutes'],
  ['attendance.regular_attended_minutes', 'Regular Attended Minutes'],
  ['attendance.pto_minutes', 'Paid Time Off Minutes'],
  ['attendance.regular_holiday_minutes', 'Regular Holiday Minutes'],
  ['attendance.special_holiday_minutes', 'Special Holiday Minutes'],
  ['attendance.tardiness_absence_minutes', 'Tardiness / Absence Minutes'],
  ['attendance.overtime_minutes', 'Overtime Minutes'],
  ['attendance.rest_day_overtime_minutes', 'Rest Day Overtime Minutes'],
  ['attendance.night_differential_minutes', 'Night Differential Minutes'],
  ['deductions.attendance_deduction', 'Attendance Deduction'],
  ['earnings.overtime_pay', 'Overtime Pay'],
  ['earnings.rest_day_overtime_pay', 'Rest Day Overtime Pay'],
  ['earnings.regular_holiday_pay', 'Regular Holiday Pay'],
  ['earnings.special_holiday_pay', 'Special Holiday Pay'],
  ['earnings.night_differential_pay', 'Night Differential Pay'],
  ['allowances.rice_allowance', 'Rice Allowance'],
  ['allowances.transportation_allowance', 'Transportation Allowance'],
  ['allowances.attendance_bonus', 'Attendance Bonus'],
  ['adjustments.manual_additions_total', 'Manual Additions'],
  ['adjustments.manual_deductions_total', 'Manual Deductions'],
  ['net_fund_release', 'Net Fund Release'],
];

export const comparePayrollCorrectionSnapshots = (before = {}, after = {}) => CORRECTION_DIFF_FIELDS
  .map(([path, label]) => ({
    field: path,
    label,
    before: comparable(getPath(before, path)),
    after: comparable(getPath(after, path)),
  }))
  .filter((item) => JSON.stringify(item.before) !== JSON.stringify(item.after));

export const validatePayrollCorrectionTarget = (payroll) => {
  if (!payroll) throw payrollError('Employee payroll not found.', 'EMPLOYEE_PAYROLL_NOT_FOUND', 404);
  const status = String(payroll.payroll_status || '').toLowerCase();
  if (status === 'released') {
    throw payrollError(
      'Released payroll is historical and cannot be directly rewritten. Record any post-release difference through a separate authorized adjustment workflow.',
      'RELEASED_PAYROLL_CORRECTION_BLOCKED',
      409
    );
  }
  if (!['finalized', 'corrected'].includes(status)) {
    throw payrollError('Only Finalized payroll can enter the Salary Correction workflow.', 'PAYROLL_NOT_FINALIZED_FOR_CORRECTION', 409);
  }
  if (!payroll.finalized_snapshot) {
    throw payrollError('An immutable finalized snapshot is required before Salary Correction can be created.', 'FINALIZED_SNAPSHOT_REQUIRED', 409);
  }
  return status;
};

export const validatePayrollCorrectionReason = (reason) => {
  const normalized = cleanReason(reason);
  if (normalized.length < 5) {
    throw payrollError('Enter a clear correction reason with at least 5 characters.', 'PAYROLL_CORRECTION_REASON_REQUIRED', 400);
  }
  return normalized;
};

const correctionWarnings = ({ attendance, compensation, payrollSettings }) => {
  const warnings = [];
  const missing = [];
  if (attendance.overtimeMinutes && payrollSettings.regular_ot_multiplier === null) missing.push('Regular OT Multiplier');
  if (attendance.restDayOvertimeMinutes && payrollSettings.rest_day_ot_multiplier === null) missing.push('Rest Day OT Multiplier');
  if (attendance.regularHolidayMinutes && payrollSettings.regular_holiday_multiplier === null) missing.push('Regular Holiday Multiplier');
  if (attendance.specialHolidayMinutes && payrollSettings.special_holiday_multiplier === null) missing.push('Special Holiday Multiplier');
  if (attendance.nightDifferentialMinutes && payrollSettings.night_differential_percentage === null) missing.push('Night Differential Percentage');
  if (missing.length) warnings.push(`Payroll Settings are incomplete for recorded premium hours: ${missing.join(', ')}.`);
  if ((attendance.regularHolidayMinutes || attendance.specialHolidayMinutes) && (payrollSettings.regular_holiday_ot_multiplier !== null || payrollSettings.special_holiday_ot_multiplier !== null)) {
    warnings.push('Holiday OT multipliers are stored but are not applied because Attendance does not expose separate holiday-OT minutes.');
  }
  if (Number(compensation.attendance_bonus || 0) > 0) {
    warnings.push('Attendance Bonus remains unpaid because its approved eligibility/timing rule has not yet been configured.');
  }
  return warnings;
};

const buildCurrentCorrectedSnapshot = async (connection, payroll, today) => {
  const before = payroll.finalized_snapshot;
  const attendanceThrough = clampPayrollAttendanceThrough({
    periodStart: payroll.period_start,
    periodEnd: payroll.period_end,
    today,
  });
  const payrollSettings = await getPayrollSettingsSnapshot(connection);
  const attendance = await getPayrollAttendanceSummary(connection, {
    employeeId: payroll.employee_id,
    dateFrom: payroll.period_start,
    dateTo: attendanceThrough,
  });
  const compensation = await getEffectiveCompensationForPeriod(connection, {
    employeeId: payroll.employee_id,
    periodStart: payroll.period_start,
    periodEnd: payroll.period_end,
    midPeriodChangeRule: payrollSettings.mid_period_change_rule,
  });
  const money = calculateDraftPayrollMoney({
    monthlyBasicSalary: compensation.monthly_basic_salary,
    regularWorkingMinutes: attendance.schedule.regularWorkingMinutes,
    tardinessAbsenceMinutes: attendance.summary.tardinessAbsenceMinutes,
    periodType: payroll.period_type,
    riceAllowance: compensation.rice_allowance,
    transportationAllowance: compensation.transportation_allowance,
    overtimeMinutes: attendance.summary.overtimeMinutes,
    restDayOvertimeMinutes: attendance.summary.restDayOvertimeMinutes,
    regularHolidayMinutes: attendance.summary.regularHolidayMinutes,
    specialHolidayMinutes: attendance.summary.specialHolidayMinutes,
    nightDifferentialMinutes: attendance.summary.nightDifferentialMinutes,
    payrollSettings,
  });

  // Manual adjustments are historical authorized inputs. Until the dedicated
  // adjustment workflow changes them, a correction carries the approved totals forward.
  const manualAdditionsTotal = n(before?.adjustments?.manual_additions_total);
  const manualDeductionsTotal = n(before?.adjustments?.manual_deductions_total);
  const netFundRelease = roundMoney(money.netFundRelease + manualAdditionsTotal - manualDeductionsTotal);

  const payrollLike = {
    ...payroll,
    employment_history_id: Number(compensation.employee_employment_history_id || 0),
    employee_name_snapshot: before?.employee?.name || payroll.employee_name_snapshot,
    position_snapshot: compensation.position,
    department_snapshot: compensation.department,
    employment_status_snapshot: compensation.employment_type,
    monthly_salary_snapshot: n(compensation.monthly_basic_salary),
    half_month_basic: money.halfMonthBasic,
    daily_rate: money.dailyRate,
    hourly_rate_snapshot: money.hourlyRate,
    minute_rate: money.minuteRate,
    regular_working_minutes_snapshot: Number(attendance.schedule.regularWorkingMinutes || 0),
    attendance_calculated_through: attendanceThrough,
    expected_regular_minutes: attendance.summary.expectedRegularMinutes,
    regular_attended_minutes: attendance.summary.regularAttendedMinutes,
    pto_minutes: attendance.summary.ptoMinutes,
    regular_holiday_minutes: attendance.summary.regularHolidayMinutes,
    special_holiday_minutes: attendance.summary.specialHolidayMinutes,
    late_minutes: attendance.summary.lateMinutes,
    absence_minutes: attendance.summary.absenceMinutes,
    tardiness_absence_minutes: attendance.summary.tardinessAbsenceMinutes,
    overtime_minutes: attendance.summary.overtimeMinutes,
    rest_day_overtime_minutes: attendance.summary.restDayOvertimeMinutes,
    night_differential_minutes: attendance.summary.nightDifferentialMinutes,
    attendance_breakdown: attendance.rows,
    attendance_deduction: money.attendanceDeduction,
    overtime_pay: money.overtimePay,
    rest_day_overtime_pay: money.restDayOvertimePay,
    regular_holiday_pay: money.regularHolidayPay,
    special_holiday_pay: money.specialHolidayPay,
    night_differential_pay: money.nightDifferentialPay,
    rice_allowance: money.riceAllowance,
    transportation_allowance: money.transportationAllowance,
    attendance_bonus: money.attendanceBonus,
    manual_additions_total: manualAdditionsTotal,
    manual_deductions_total: manualDeductionsTotal,
    net_fund_release: netFundRelease,
    payroll_settings_snapshot: payrollSettings,
    calculation_version: PAYROLL_CALCULATION_VERSION,
    calculation_warnings: correctionWarnings({ attendance: attendance.summary, compensation, payrollSettings }),
  };

  const snapshot = buildFinalizedPayrollSnapshot(payrollLike);
  const fingerprintPayload = buildPayrollAttendanceFingerprintPayload({
    attendanceCalculatedThrough: attendanceThrough,
    regularWorkingMinutes: attendance.schedule.regularWorkingMinutes,
    summary: attendance.summary,
    rows: attendance.rows,
  });
  return {
    snapshot,
    attendanceFingerprint: hashPayrollAttendanceFingerprint(fingerprintPayload),
  };
};

export const buildPayrollCorrectionReview = async (connection, { payroll, today }) => {
  validatePayrollCorrectionTarget(payroll);
  const beforeSnapshot = payroll.finalized_snapshot;
  const proposed = await buildCurrentCorrectedSnapshot(connection, payroll, today);
  const differences = comparePayrollCorrectionSnapshots(beforeSnapshot, proposed.snapshot);
  const reviewHash = stableHash({
    employeePayrollId: Number(payroll.employee_payroll_id),
    beforeSnapshot,
    afterSnapshot: proposed.snapshot,
    attendanceFingerprint: proposed.attendanceFingerprint,
  });

  return {
    employee_payroll_id: Number(payroll.employee_payroll_id),
    payroll_status: payroll.payroll_status,
    period_label: payroll.period_label,
    before_snapshot: beforeSnapshot,
    after_snapshot: proposed.snapshot,
    differences,
    has_changes: differences.length > 0,
    review_hash: reviewHash,
    current_attendance_fingerprint: proposed.attendanceFingerprint,
  };
};

export const listPayrollCorrections = async (connection, employeePayrollId) => {
  const [rows] = await connection.query(`
    SELECT c.employee_payroll_correction_id, c.employee_payroll_id, c.reason,
      c.before_snapshot_json, c.after_snapshot_json, c.review_hash,
      c.created_by_user_id, c.created_at,
      TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS created_by_name
    FROM employee_payroll_corrections c
    LEFT JOIN users u ON u.id = c.created_by_user_id
    WHERE c.employee_payroll_id = ?
    ORDER BY c.created_at DESC, c.employee_payroll_correction_id DESC
  `, [Number(employeePayrollId)]);
  return rows.map((row) => ({
    employee_payroll_correction_id: Number(row.employee_payroll_correction_id),
    employee_payroll_id: Number(row.employee_payroll_id),
    reason: row.reason,
    before_snapshot: typeof row.before_snapshot_json === 'object' ? row.before_snapshot_json : JSON.parse(row.before_snapshot_json || '{}'),
    after_snapshot: typeof row.after_snapshot_json === 'object' ? row.after_snapshot_json : JSON.parse(row.after_snapshot_json || '{}'),
    review_hash: row.review_hash,
    created_by_user_id: row.created_by_user_id ? Number(row.created_by_user_id) : null,
    created_by_name: row.created_by_name || null,
    created_at: row.created_at,
  }));
};

export const applyPayrollCorrection = async (connection, {
  payrollId,
  reason,
  reviewHash,
  correctedByUserId,
  today,
}) => {
  const normalizedReason = validatePayrollCorrectionReason(reason);
  const actorId = Number(correctedByUserId || 0);
  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw payrollError('Correction authorization requires an authenticated user.', 'PAYROLL_CORRECTION_ACTOR_REQUIRED', 403);
  }

  const payroll = await getPayrollDraftById(connection, payrollId, { forUpdate: true });
  validatePayrollCorrectionTarget(payroll);
  const review = await buildPayrollCorrectionReview(connection, { payroll, today });
  if (!review.has_changes) {
    throw payrollError('No salary or Attendance differences were found. There is nothing to correct.', 'PAYROLL_CORRECTION_NO_CHANGES', 409, review);
  }
  if (!reviewHash || String(reviewHash) !== review.review_hash) {
    throw payrollError(
      'The correction inputs changed after Final Double-Check. Reopen Salary Correction and review the latest Before vs After values.',
      'PAYROLL_CORRECTION_REVIEW_STALE',
      409,
      review
    );
  }

  const [insert] = await connection.query(`
    INSERT INTO employee_payroll_corrections (
      employee_payroll_id, reason, before_snapshot_json, after_snapshot_json,
      review_hash, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    Number(payroll.employee_payroll_id),
    normalizedReason,
    JSON.stringify(review.before_snapshot),
    JSON.stringify(review.after_snapshot),
    review.review_hash,
    actorId,
  ]);

  const [update] = await connection.query(`
    UPDATE employee_payrolls
    SET payroll_status = 'corrected',
        finalized_snapshot_json = ?,
        finalized_attendance_fingerprint = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_payroll_id = ?
      AND payroll_status IN ('finalized','corrected')
  `, [
    JSON.stringify(review.after_snapshot),
    review.current_attendance_fingerprint,
    Number(payroll.employee_payroll_id),
  ]);

  if (Number(update?.affectedRows || 0) !== 1) {
    throw payrollError('Payroll status changed before the correction could be saved. Refresh and review it again.', 'PAYROLL_CORRECTION_CONFLICT', 409);
  }

  return {
    correctionId: Number(insert.insertId),
    reason: normalizedReason,
    review,
  };
};

