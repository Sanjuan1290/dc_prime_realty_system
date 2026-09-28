import { listPayrollDrafts } from './employeePayroll.service.js';
import { resolvePayrollPeriod } from './payrollPeriod.service.js';
import { buildPayrollSummaryFromRows } from './payrollSummary.shared.js';

export { buildPayrollSummaryFromRows } from './payrollSummary.shared.js';

export const getPayrollPeriodSummary = async (connection, { month, periodType }) => {
  const period = resolvePayrollPeriod({ month, periodType });
  const rows = await listPayrollDrafts(connection, { month, periodType });
  return buildPayrollSummaryFromRows({ rows, period });
};
