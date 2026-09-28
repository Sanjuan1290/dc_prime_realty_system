import { mapEmploymentHistoryRow } from './employeeEmploymentHistory.service.js';
import { SUPPORTED_MID_PERIOD_CHANGE_RULE } from './payrollSettings.service.js';

const payrollError = (message, code, statusCode = 409, data = null) => Object.assign(
  new Error(message),
  { code, statusCode, data }
);

export const getEffectiveCompensationForPeriod = async (connection, {
  employeeId,
  periodStart,
  periodEnd,
  midPeriodChangeRule = SUPPORTED_MID_PERIOD_CHANGE_RULE,
}) => {
  const [rows] = await connection.query(`
    SELECT h.*
    FROM employee_employment_history h
    WHERE h.employee_id = ?
      AND h.effective_from <= ?
      AND (h.effective_to IS NULL OR h.effective_to >= ?)
    ORDER BY h.effective_from ASC, h.employee_employment_history_id ASC
  `, [employeeId, periodEnd, periodStart]);

  const history = rows.map(mapEmploymentHistoryRow);
  if (!history.length) {
    throw payrollError(
      'No employment and compensation record covers this payroll period.',
      'PAYROLL_COMPENSATION_NOT_FOUND',
      409
    );
  }

  if (midPeriodChangeRule !== SUPPORTED_MID_PERIOD_CHANGE_RULE) {
    throw payrollError(
      'The configured mid-period salary-change rule is not supported by the approved payroll engine.',
      'MID_PERIOD_RULE_NOT_SUPPORTED',
      409,
      { configured_rule: midPeriodChangeRule }
    );
  }

  if (history.length > 1) {
    throw payrollError(
      'Payroll Settings require compensation changes to start on a payroll boundary (1st or 16th). Move the effective date to the next payroll boundary before calculating this period.',
      'MID_PERIOD_COMPENSATION_CHANGE_BLOCKED',
      409,
      { rule: SUPPORTED_MID_PERIOD_CHANGE_RULE, segments: history }
    );
  }

  const record = history[0];
  if (record.effective_from > periodStart || (record.effective_to && record.effective_to < periodEnd)) {
    throw payrollError(
      'Payroll Settings require the compensation record to cover the whole payroll period. A partial-period salary proration formula has not been approved.',
      'PARTIAL_PERIOD_COMPENSATION_BLOCKED',
      409,
      { rule: SUPPORTED_MID_PERIOD_CHANGE_RULE, segments: history }
    );
  }

  return record;
};
