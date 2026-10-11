import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import { getManilaDateTime } from './attendanceLite.shared.js';
import {
  calculateAndStoreDraftPayroll,
  ensureEmployeePayrollSchema,
  getPayrollDraftById,
  listPayrollDrafts,
  listPayrollEligibleEmployees,
  listEmployeePayrollHistory,
  recalculateDraftPayrollById,
} from '../../../services/employeePayroll.service.js';
import { resolvePayrollPeriod } from '../../../services/payrollPeriod.service.js';
import { buildFundReleaseReceipt } from '../../../services/payrollReceipt.service.js';
import { releasePayroll } from '../../../services/payrollRelease.service.js';
import { getPayrollSettings, updatePayrollSettings } from '../../../services/payrollSettings.service.js';
import { getPayrollPeriodSummary } from '../../../services/payrollSummary.service.js';
import {
  applyPayrollCorrection,
  buildPayrollCorrectionReview,
  listPayrollCorrections,
} from '../../../services/payrollCorrection.service.js';
import {
  finalizePayroll,
  getFinalizedAttendanceChangeStatus,
  getPayrollFinalizationReview,
} from '../../../services/payrollFinalization.service.js';

const getErrorMessage = (error) => error?.message || 'Payroll operation failed.';
const numberId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const sendError = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  code: error.code || 'PAYROLL_ERROR',
  message: getErrorMessage(error),
  data: error.data || null,
});


export const getEmployeePayrollSettings = async (_req, res) => {
  const connection = await db.getConnection();
  try {
    const data = await getPayrollSettings(connection);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const updateEmployeePayrollSettings = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await updatePayrollSettings(connection, {
      body: req.body || {},
      updatedByUserId: req.authUser?.id || null,
    });
    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Employee Salary',
      entityType: 'payroll_settings',
      entityId: '1',
      entityLabel: 'Employee Payroll Settings',
      title: 'Payroll Settings Changed',
      description: 'Employee payroll multipliers and the mid-period salary-change policy were updated.',
      metadata: {
        before: result.before,
        after: result.after,
      },
    });
    await connection.commit();
    return res.json({
      success: true,
      message: 'Payroll Settings updated. Existing Draft payroll must be recalculated before Finalization; finalized historical payroll remains unchanged.',
      data: result.after,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const getPayrollPeriodPreview = async (req, res) => {
  try {
    const period = resolvePayrollPeriod({
      month: req.query.month,
      periodType: req.query.period_type,
    });
    return res.json({ success: true, data: period });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getPayrollSummaryExportData = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const data = await getPayrollPeriodSummary(connection, {
      month: req.query.month,
      periodType: req.query.period_type,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const getDraftPayrolls = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const data = await listPayrollDrafts(connection, {
      month: req.query.month,
      periodType: req.query.period_type,
      department: req.query.department,
      payrollStatus: req.query.payroll_status,
      search: req.query.search,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const getDraftPayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });
    const data = await getPayrollDraftById(connection, payrollId);
    if (['finalized', 'corrected', 'released'].includes(String(data.payroll_status || '').toLowerCase())) {
      data.attendance_change = await getFinalizedAttendanceChangeStatus(connection, data, getManilaDateTime().date);
      data.correction_history = await listPayrollCorrections(connection, payrollId);
    }
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};


export const getFundReleaseReceipt = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });
    const payroll = await getPayrollDraftById(connection, payrollId);
    const data = buildFundReleaseReceipt(payroll, { today: getManilaDateTime().date });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};


export const getEmployeeSalaryHistory = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const employeeId = numberId(req.params.employeeId);
    if (!employeeId) return res.status(400).json({ success: false, message: 'Select a valid employee.' });
    const data = await listEmployeePayrollHistory(connection, employeeId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const getHistoricalPayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });
    const data = await getPayrollDraftById(connection, payrollId);
    if (['finalized', 'corrected', 'released'].includes(String(data.payroll_status || '').toLowerCase())) {
      data.correction_history = await listPayrollCorrections(connection, payrollId);
    }
    return res.json({ success: true, data: { ...data, historical_view: true } });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const getHistoricalFundReleaseReceipt = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });
    const payroll = await getPayrollDraftById(connection, payrollId);
    const data = buildFundReleaseReceipt(payroll, { today: getManilaDateTime().date });
    return res.json({ success: true, data: { ...data, historical_view: true } });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const getPayrollEligibleEmployees = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const data = await listPayrollEligibleEmployees(connection);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const generateDraftPayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeePayrollSchema(connection);
    const period = resolvePayrollPeriod({ month: req.body.month, periodType: req.body.period_type });
    const requestedEmployeeId = req.body.employee_id ? numberId(req.body.employee_id) : null;
    if (req.body.employee_id && !requestedEmployeeId) {
      return res.status(400).json({ success: false, message: 'Select a valid employee.' });
    }
    const employees = await listPayrollEligibleEmployees(connection, requestedEmployeeId);
    const today = getManilaDateTime().date;
    const generated = [];
    const skipped = [];

    await connection.beginTransaction();
    for (const employee of employees) {
      try {
        const result = await calculateAndStoreDraftPayroll(connection, {
          employeeId: Number(employee.employee_id),
          period,
          today,
        });
        generated.push({
          employee_id: Number(employee.employee_id),
          employee_code: employee.employee_code,
          employee_name: employee.full_name,
          employee_payroll_id: result.payrollId,
          net_fund_release: result.payload.netFundRelease,
          warnings: result.payload.warnings,
        });

        await writeAuditLog(connection, req, {
          actor: req.authUser,
          action: 'create',
          module: 'Employee Salary',
          entityType: 'employee_payroll',
          entityId: String(result.payrollId),
          entityLabel: `${employee.employee_code} - ${period.periodLabel}`,
          title: 'Payroll Generated',
          description: `Draft payroll was generated for ${employee.full_name} for ${period.periodLabel}.`,
          metadata: {
            employeeId: Number(employee.employee_id),
            employeeCode: employee.employee_code,
            employeeName: employee.full_name,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            periodType: period.periodType,
            attendanceCalculatedThrough: result.payload.attendanceCalculatedThrough,
            employmentHistoryId: result.payload.employmentHistoryId,
            monthlyBasic: result.payload.monthlyBasic,
            halfMonthBasic: result.payload.halfMonthBasic,
            attendanceDeduction: result.payload.attendanceDeduction,
            overtimePay: result.payload.overtimePay,
            restDayOvertimePay: result.payload.restDayOvertimePay,
            regularHolidayPay: result.payload.regularHolidayPay,
            specialHolidayPay: result.payload.specialHolidayPay,
            nightDifferentialPay: result.payload.nightDifferentialPay,
            payrollSettingsRevision: result.payload.payrollSettingsSnapshot?.settings_revision ?? null,
            netFundRelease: result.payload.netFundRelease,
            warnings: result.payload.warnings,
          },
        });
      } catch (error) {
        if (requestedEmployeeId) throw error;
        skipped.push({
          employee_id: Number(employee.employee_id),
          employee_code: employee.employee_code,
          employee_name: employee.full_name,
          code: error.code || 'PAYROLL_SKIPPED',
          message: error.message,
          data: error.data || null,
        });
      }
    }
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: requestedEmployeeId
        ? 'Draft payroll generated.'
        : `Draft payroll generated for ${generated.length} employee(s).`,
      data: { period, generated, skipped },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const recalculateDraftPayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });

    await connection.beginTransaction();
    const before = await getPayrollDraftById(connection, payrollId);
    const result = await recalculateDraftPayrollById(connection, payrollId, getManilaDateTime().date);
    const after = await getPayrollDraftById(connection, result.payrollId);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Employee Salary',
      entityType: 'employee_payroll',
      entityId: String(result.payrollId),
      entityLabel: `${after.employee_name_snapshot} - ${after.period_label}`,
      title: 'Payroll Recalculated',
      description: `Draft payroll was recalculated for ${after.employee_name_snapshot}.`,
      metadata: {
        employeeId: after.employee_id,
        periodStart: after.period_start,
        periodEnd: after.period_end,
        before: {
          attendanceCalculatedThrough: before.attendance_calculated_through,
          attendanceDeduction: before.attendance_deduction,
          netFundRelease: before.net_fund_release,
          payrollSettingsRevision: before.payroll_settings_snapshot?.settings_revision ?? null,
        },
        after: {
          attendanceCalculatedThrough: after.attendance_calculated_through,
          attendanceDeduction: after.attendance_deduction,
          netFundRelease: after.net_fund_release,
          payrollSettingsRevision: after.payroll_settings_snapshot?.settings_revision ?? null,
        },
      },
    });
    await connection.commit();
    return res.json({ success: true, message: 'Draft payroll recalculated.', data: after });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return sendError(res, error);
  } finally {
    connection.release();
  }
};


export const getPayrollFinalReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });
    const payroll = await getPayrollDraftById(connection, payrollId);
    const review = await getPayrollFinalizationReview(connection, payroll, getManilaDateTime().date);
    return res.json({ success: true, data: review });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const finalizeEmployeePayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });

    await connection.beginTransaction();
    const payroll = await getPayrollDraftById(connection, payrollId, { forUpdate: true });
    const result = await finalizePayroll(connection, {
      payroll,
      finalizedByUserId: req.authUser?.id || null,
      today: getManilaDateTime().date,
    });
    const finalized = await getPayrollDraftById(connection, payrollId);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Employee Salary',
      entityType: 'employee_payroll',
      entityId: String(payrollId),
      entityLabel: `${finalized.employee_name_snapshot} - ${finalized.period_label}`,
      title: 'Payroll Finalized',
      description: `Payroll was finalized for ${finalized.employee_name_snapshot} for ${finalized.period_label}.`,
      metadata: {
        employeeId: finalized.employee_id,
        employeeName: finalized.employee_name_snapshot,
        periodStart: finalized.period_start,
        periodEnd: finalized.period_end,
        employmentHistoryId: finalized.employment_history_id,
        monthlyBasic: finalized.monthly_salary_snapshot,
        halfMonthBasic: finalized.half_month_basic,
        attendanceDeduction: finalized.attendance_deduction,
        netFundRelease: finalized.net_fund_release,
        calculationVersion: finalized.calculation_version,
        finalizedAttendanceFingerprint: result.review.current_attendance_fingerprint,
      },
    });

    await connection.commit();
    return res.json({
      success: true,
      message: 'Payroll finalized. The approved salary snapshot is now locked from automatic recalculation.',
      data: finalized,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const getPayrollCorrectionReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });
    const payroll = await getPayrollDraftById(connection, payrollId);
    const data = await buildPayrollCorrectionReview(connection, { payroll, today: getManilaDateTime().date });
    data.correction_history = await listPayrollCorrections(connection, payrollId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const correctFinalizedEmployeePayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });
    await connection.beginTransaction();
    const result = await applyPayrollCorrection(connection, {
      payrollId,
      reason: req.body?.reason,
      reviewHash: req.body?.review_hash,
      correctedByUserId: req.authUser?.id,
      today: getManilaDateTime().date,
    });
    const payroll = await getPayrollDraftById(connection, payrollId);
    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Employee Salary',
      entityType: 'employee_payroll_correction',
      entityId: String(result.correctionId),
      entityLabel: `${payroll.employee_name_snapshot} - ${payroll.period_label}`,
      title: 'Payroll Corrected',
      description: `A formal Salary Correction was recorded for ${payroll.employee_name_snapshot} for ${payroll.period_label}. Original finalized values were preserved in the correction history.`,
      metadata: {
        employeePayrollId: payrollId,
        employeeId: payroll.employee_id,
        periodStart: payroll.period_start,
        periodEnd: payroll.period_end,
        reason: result.reason,
        beforeNetFundRelease: result.review.before_snapshot?.net_fund_release ?? null,
        afterNetFundRelease: result.review.after_snapshot?.net_fund_release ?? null,
        differences: result.review.differences,
        correctionId: result.correctionId,
      },
    });
    await connection.commit();
    return res.json({
      success: true,
      message: 'Salary Correction saved. The original finalized snapshot remains preserved in Correction History.',
      data: {
        correction_id: result.correctionId,
        payroll_status: 'corrected',
        reason: result.reason,
        differences: result.review.differences,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

export const releaseEmployeePayroll = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payrollId = numberId(req.params.employeePayrollId);
    if (!payrollId) return res.status(400).json({ success: false, message: 'Select a valid employee payroll.' });

    await connection.beginTransaction();
    const payroll = await getPayrollDraftById(connection, payrollId, { forUpdate: true });
    const release = await releasePayroll(connection, {
      payroll,
      releasedByUserId: req.authUser?.id || null,
      releaseDate: req.body?.release_date,
      releaseReference: req.body?.release_reference,
      releaseNotes: req.body?.release_notes,
    });
    const released = await getPayrollDraftById(connection, payrollId);

    await writeAuditLog(connection, req, {
      actor: req.authUser,
      action: 'update',
      module: 'Employee Salary',
      entityType: 'employee_payroll',
      entityId: String(payrollId),
      entityLabel: `${released.employee_name_snapshot} - ${released.period_label}`,
      title: 'Payroll Released',
      description: `Payroll was marked as Released for ${released.employee_name_snapshot} for ${released.period_label}.`,
      metadata: {
        employeeId: released.employee_id,
        employeeName: released.employee_name_snapshot,
        periodStart: released.period_start,
        periodEnd: released.period_end,
        netFundRelease: released.net_fund_release,
        releaseDate: release.releaseDate,
        releasedByUserId: release.releasedByUserId,
        releasedByName: released.released_by_name || null,
        releaseReference: release.releaseReference,
        releaseNotes: release.releaseNotes,
        finalizedAt: released.finalized_at,
        finalizedByUserId: released.finalized_by_user_id,
      },
    });

    await connection.commit();
    return res.json({
      success: true,
      message: 'Payroll marked as Released. The finalized salary snapshot remains unchanged and historical.',
      data: released,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return sendError(res, error);
  } finally {
    connection.release();
  }
};

