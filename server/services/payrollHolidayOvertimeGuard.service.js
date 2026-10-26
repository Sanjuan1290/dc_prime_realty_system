import { PAYROLL_PAID_WORK_MINUTES } from './payrollCalculation.service.js';

// Existing holiday pay calculations do not split ordinary holiday hours and
// overtime on that same holiday. Flag affected drafts; never guess the premium.
export const findUnsupportedHolidayOvertime = (rows = [], paidMinutes = PAYROLL_PAID_WORK_MINUTES) => {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const regularMinutes = Number(row.regular_holiday_minutes ?? Math.round(Number(row.regularHolidaySeconds || 0) / 60));
    const specialMinutes = Number(row.special_holiday_minutes ?? Math.round(Number(row.specialHolidaySeconds || 0) / 60));
    const kind = regularMinutes > 0 ? 'Regular holiday' : specialMinutes > 0 ? 'Special holiday' : null;
    const minutes = regularMinutes > 0 ? regularMinutes : specialMinutes;
    if (!kind || !Number.isFinite(minutes) || minutes <= paidMinutes) return [];
    return [{ date: String(row.date || ''), holiday_type: kind, extra_minutes: minutes - paidMinutes }];
  });
};

export const holidayOvertimeWarning = (days = []) => days.length
  ? `Holiday overtime needs review on ${days.map((day) => day.date || 'an unknown date').join(', ')}. This draft cannot be finalized because holiday work exceeds ${PAYROLL_PAID_WORK_MINUTES / 60} paid hours per day and separate holiday overtime pay is not yet supported.`
  : null;
