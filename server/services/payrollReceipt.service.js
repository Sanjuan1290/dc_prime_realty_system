const n = (value) => Number(value || 0);
const text = (value) => value === null || value === undefined ? '' : String(value);
const dateOnly = (value) => {
  const match = text(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN',
];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
const SCALES = [
  [1_000_000_000_000, 'TRILLION'],
  [1_000_000_000, 'BILLION'],
  [1_000_000, 'MILLION'],
  [1_000, 'THOUSAND'],
];

const underThousandToWords = (value) => {
  let number = Math.trunc(Number(value || 0));
  const parts = [];
  if (number >= 100) {
    parts.push(`${ONES[Math.trunc(number / 100)]} HUNDRED`);
    number %= 100;
  }
  if (number >= 20) {
    parts.push(TENS[Math.trunc(number / 10)]);
    number %= 10;
    if (number) parts.push(ONES[number]);
  } else if (number > 0) {
    parts.push(ONES[number]);
  }
  return parts.join(' ');
};

export const integerToWords = (value) => {
  let number = Math.trunc(Math.abs(Number(value || 0)));
  if (!number) return 'ZERO';
  const parts = [];
  for (const [scale, label] of SCALES) {
    if (number >= scale) {
      const chunk = Math.trunc(number / scale);
      parts.push(`${integerToWords(chunk)} ${label}`);
      number %= scale;
    }
  }
  if (number) parts.push(underThousandToWords(number));
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
};

export const amountToPhilippineWords = (value) => {
  const amount = Math.max(0, n(value));
  const roundedCentavos = Math.round(amount * 100);
  const pesos = Math.trunc(roundedCentavos / 100);
  const centavos = roundedCentavos % 100;
  const pesoLabel = pesos === 1 ? 'PESO' : 'PESOS';
  const pesoWords = `${integerToWords(pesos)} ${pesoLabel}`;
  if (!centavos) return `${pesoWords} ONLY`;
  const centavoLabel = centavos === 1 ? 'CENTAVO' : 'CENTAVOS';
  return `${pesoWords} AND ${integerToWords(centavos)} ${centavoLabel} ONLY`;
};

const hoursFromMinutes = (minutes) => Number((n(minutes) / 60).toFixed(2));

const draftSource = (payroll) => ({
  period: {
    label: payroll.period_label,
    start: payroll.period_start,
    end: payroll.period_end,
    type: payroll.period_type,
  },
  employee: {
    name: payroll.employee_name_snapshot,
    position: payroll.position_snapshot,
    department: payroll.department_snapshot,
    employment_status: payroll.employment_status_snapshot,
  },
  compensation: {
    monthly_basic: payroll.monthly_salary_snapshot,
    half_month_basic: payroll.half_month_basic,
    daily_rate: payroll.daily_rate,
    hourly_rate: payroll.hourly_rate_snapshot,
    minute_rate: payroll.minute_rate,
  },
  attendance: {
    expected_regular_minutes: payroll.expected_regular_minutes,
    regular_attended_minutes: payroll.regular_attended_minutes,
    pto_minutes: payroll.pto_minutes,
    regular_holiday_minutes: payroll.regular_holiday_minutes,
    special_holiday_minutes: payroll.special_holiday_minutes,
    tardiness_absence_minutes: payroll.tardiness_absence_minutes,
    overtime_minutes: payroll.overtime_minutes,
    rest_day_overtime_minutes: payroll.rest_day_overtime_minutes,
    night_differential_minutes: payroll.night_differential_minutes,
  },
  earnings: {
    overtime_pay: payroll.overtime_pay,
    rest_day_overtime_pay: payroll.rest_day_overtime_pay,
    regular_holiday_pay: payroll.regular_holiday_pay,
    special_holiday_pay: payroll.special_holiday_pay,
    night_differential_pay: payroll.night_differential_pay,
  },
  allowances: {
    rice_allowance: payroll.rice_allowance,
    transportation_allowance: payroll.transportation_allowance,
    attendance_bonus: payroll.attendance_bonus,
  },
  adjustments: {
    manual_additions_total: payroll.manual_additions_total,
    manual_deductions_total: payroll.manual_deductions_total,
  },
  deductions: { attendance_deduction: payroll.attendance_deduction },
  net_fund_release: payroll.net_fund_release,
});

export const buildFundReleaseReceipt = (payroll, { today = null } = {}) => {
  const status = text(payroll?.payroll_status || 'draft').toLowerCase();
  const finalizedStatus = ['finalized', 'released', 'corrected'].includes(status);
  const hasFinalizedSnapshot = Boolean(payroll?.finalized_snapshot);
  const official = finalizedStatus && hasFinalizedSnapshot;
  const source = official
    ? payroll.finalized_snapshot
    : draftSource(payroll || {});

  const compensation = source.compensation || {};
  const attendance = source.attendance || {};
  const earnings = source.earnings || {};
  const allowances = source.allowances || {};
  const adjustments = source.adjustments || {};
  const deductions = source.deductions || {};
  const employee = source.employee || {};
  const period = source.period || {};

  const attendanceDeduction = n(deductions.attendance_deduction ?? payroll?.attendance_deduction);
  const halfMonthBasic = n(compensation.half_month_basic ?? payroll?.half_month_basic);
  const manualDeductions = n(adjustments.manual_deductions_total ?? payroll?.manual_deductions_total);
  const netFundRelease = n(source.net_fund_release ?? payroll?.net_fund_release);
  const receiptDate = dateOnly(payroll?.released_date)
    || dateOnly(payroll?.period_release_date)
    || dateOnly(payroll?.finalized_at)
    || dateOnly(today)
    || dateOnly(new Date().toISOString());

  return {
    employee_payroll_id: n(payroll?.employee_payroll_id),
    payroll_status: status,
    official,
    preview_only: !official,
    finalized_snapshot_missing: finalizedStatus && !hasFinalizedSnapshot,
    receipt_date: receiptDate,
    employee_name: text(employee.name || payroll?.employee_name_snapshot),
    position: text(employee.position || payroll?.position_snapshot),
    department: text(employee.department || payroll?.department_snapshot),
    employment_status: text(employee.employment_status || payroll?.employment_status_snapshot),
    pay_period: {
      label: text(period.label || payroll?.period_label),
      start: dateOnly(period.start || payroll?.period_start),
      end: dateOnly(period.end || payroll?.period_end),
      type: text(period.type || payroll?.period_type),
    },
    half_month_basic: halfMonthBasic,
    hourly_rate: n(compensation.hourly_rate ?? payroll?.hourly_rate_snapshot),
    total_regular_hours: hoursFromMinutes(attendance.expected_regular_minutes ?? payroll?.expected_regular_minutes),
    total_regular_hours_attended: hoursFromMinutes(attendance.regular_attended_minutes ?? payroll?.regular_attended_minutes),
    paid_time_off_hours: hoursFromMinutes(attendance.pto_minutes ?? payroll?.pto_minutes),
    regular_holiday_hours: hoursFromMinutes(attendance.regular_holiday_minutes ?? payroll?.regular_holiday_minutes),
    special_holiday_hours: hoursFromMinutes(attendance.special_holiday_minutes ?? payroll?.special_holiday_minutes),
    tardiness_absence_minutes: n(attendance.tardiness_absence_minutes ?? payroll?.tardiness_absence_minutes),
    total_deduction: attendanceDeduction + manualDeductions,
    subtotal_after_attendance: halfMonthBasic - attendanceDeduction - manualDeductions,
    overtime_hours: hoursFromMinutes(attendance.overtime_minutes ?? payroll?.overtime_minutes),
    rest_day_overtime_hours: hoursFromMinutes(attendance.rest_day_overtime_minutes ?? payroll?.rest_day_overtime_minutes),
    night_differential_hours: hoursFromMinutes(attendance.night_differential_minutes ?? payroll?.night_differential_minutes),
    overtime_pay: n(earnings.overtime_pay ?? payroll?.overtime_pay),
    rest_day_overtime_pay: n(earnings.rest_day_overtime_pay ?? payroll?.rest_day_overtime_pay),
    regular_holiday_pay: n(earnings.regular_holiday_pay ?? payroll?.regular_holiday_pay),
    special_holiday_pay: n(earnings.special_holiday_pay ?? payroll?.special_holiday_pay),
    night_differential_pay: n(earnings.night_differential_pay ?? payroll?.night_differential_pay),
    rice_allowance: n(allowances.rice_allowance ?? payroll?.rice_allowance),
    transportation_allowance: n(allowances.transportation_allowance ?? payroll?.transportation_allowance),
    attendance_bonus: n(allowances.attendance_bonus ?? payroll?.attendance_bonus),
    manual_additions_total: n(adjustments.manual_additions_total ?? payroll?.manual_additions_total),
    manual_deductions_total: manualDeductions,
    total: netFundRelease,
    amount_in_words: amountToPhilippineWords(netFundRelease),
    witness_name: text(payroll?.witness_name || 'Authorized Representative'),
    finalized_at: payroll?.finalized_at || null,
    finalized_by_name: text(payroll?.finalized_by_name),
    released_date: dateOnly(payroll?.released_date),
    released_at: payroll?.released_at || null,
    released_by_name: text(payroll?.released_by_name),
    release_reference: text(payroll?.release_reference),
    release_notes: text(payroll?.release_notes),
    source: official && payroll?.finalized_snapshot ? 'finalized_snapshot' : 'draft_calculation',
  };
};

