const officialStatuses = new Set(['finalized', 'corrected', 'released']);

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const numberValue = (value) => Number(value || 0);

export const buildPayrollSummaryFromRows = ({ rows = [], period }) => {
  const includedRows = (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.payroll_status || '').toLowerCase() !== 'cancelled')
    .map((row) => {
      const basic = roundMoney(row.half_month_basic);
      const attendanceDeduction = roundMoney(row.attendance_deduction);
      const overtime = roundMoney(row.overtime_pay);
      const restDayOvertime = roundMoney(row.rest_day_overtime_pay);
      const holidayPay = roundMoney(numberValue(row.regular_holiday_pay) + numberValue(row.special_holiday_pay));
      const nightDifferential = roundMoney(row.night_differential_pay);
      const allowances = roundMoney(numberValue(row.rice_allowance) + numberValue(row.transportation_allowance) + numberValue(row.attendance_bonus));
      const manualAdjustments = roundMoney(numberValue(row.manual_additions_total) - numberValue(row.manual_deductions_total));
      const adjustments = roundMoney(holidayPay + nightDifferential + manualAdjustments);
      const calculatedNet = roundMoney(basic - attendanceDeduction + overtime + restDayOvertime + allowances + adjustments);
      const net = roundMoney(row.net_fund_release);
      return {
        employee_payroll_id: Number(row.employee_payroll_id || 0),
        employee_id: Number(row.employee_id || 0),
        employee_code: row.employee_code || null,
        employee_name: row.employee_name_snapshot || '',
        position: row.position_snapshot || '',
        payroll_status: String(row.payroll_status || '').toLowerCase(),
        basic,
        deduction: attendanceDeduction,
        overtime,
        rest_day_overtime: restDayOvertime,
        holiday_pay: holidayPay,
        night_differential: nightDifferential,
        allowances,
        manual_adjustments: manualAdjustments,
        adjustments,
        net,
        reconciliation_difference: roundMoney(net - calculatedNet),
      };
    });

  const totals = includedRows.reduce((summary, row) => ({
    employee_count: summary.employee_count + 1,
    total_basic: summary.total_basic + row.basic,
    total_attendance_deduction: summary.total_attendance_deduction + row.deduction,
    total_overtime: summary.total_overtime + row.overtime,
    total_rest_day_overtime: summary.total_rest_day_overtime + row.rest_day_overtime,
    total_holiday_pay: summary.total_holiday_pay + row.holiday_pay,
    total_night_differential: summary.total_night_differential + row.night_differential,
    total_allowances: summary.total_allowances + row.allowances,
    total_manual_adjustments: summary.total_manual_adjustments + row.manual_adjustments,
    total_adjustments: summary.total_adjustments + row.adjustments,
    total_fund_release: summary.total_fund_release + row.net,
  }), {
    employee_count: 0,
    total_basic: 0,
    total_attendance_deduction: 0,
    total_overtime: 0,
    total_rest_day_overtime: 0,
    total_holiday_pay: 0,
    total_night_differential: 0,
    total_allowances: 0,
    total_manual_adjustments: 0,
    total_adjustments: 0,
    total_fund_release: 0,
  });

  Object.keys(totals).forEach((key) => {
    if (key !== 'employee_count') totals[key] = roundMoney(totals[key]);
  });

  const statusCounts = includedRows.reduce((counts, row) => {
    counts[row.payroll_status] = (counts[row.payroll_status] || 0) + 1;
    return counts;
  }, {});
  const reconciliationIssues = includedRows.filter((row) => Math.abs(row.reconciliation_difference) >= 0.01);

  return {
    period,
    official: includedRows.length > 0 && includedRows.every((row) => officialStatuses.has(row.payroll_status)),
    status_counts: statusCounts,
    rows: includedRows,
    totals,
    warnings: [
      ...(includedRows.some((row) => row.payroll_status === 'draft')
        ? ['This period contains Draft payroll. The summary is operational and not an official final fund-release summary.']
        : []),
      ...(reconciliationIssues.length
        ? [`${reconciliationIssues.length} payroll record(s) do not reconcile to the summary formula and should be reviewed before export.`]
        : []),
    ],
  };
};

