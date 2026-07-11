const manilaToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const normalizeDate = (value) => {
  if (!value || value === '-') return manilaToday();

  if (typeof value === 'string') {
    const clean = value.trim();
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return manilaToday();
  return parsed.toISOString().slice(0, 10);
};

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const addDaysToDate = (value, days = 0) => {
  const [year, month, day] = normalizeDate(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

const getMonthlyStartedPeriods = (startDate, endDate) => {
  const [startYear, startMonth, startDay] = normalizeDate(startDate).split('-').map(Number);
  const [endYear, endMonth, endDay] = normalizeDate(endDate).split('-').map(Number);
  const monthDifference = ((endYear - startYear) * 12) + (endMonth - startMonth);
  return Math.max(1, monthDifference + (endDay > startDay ? 1 : 0));
};

/**
 * Flat penalty based on the scheduled due amount for each calendar month started
 * after the grace period. It does not compound against prior penalties.
 */
export const calculateSchedulePenalty = ({
  dueDate,
  dueAmount,
  ratePercent = 0,
  graceDays = 0,
  asOfDate = manilaToday(),
} = {}) => {
  const normalizedDueDate = dueDate ? normalizeDate(dueDate) : null;
  const normalizedAsOfDate = asOfDate ? normalizeDate(asOfDate) : manilaToday();
  const rate = Math.max(Number(ratePercent || 0), 0) / 100;
  const baseAmount = Math.max(Number(dueAmount || 0), 0);

  if (!normalizedDueDate || baseAmount <= 0 || rate <= 0) return 0;

  const graceDate = addDaysToDate(normalizedDueDate, Math.max(Number(graceDays || 0), 0));
  if (normalizedAsOfDate <= graceDate) return 0;

  const periodsLate = getMonthlyStartedPeriods(graceDate, normalizedAsOfDate);
  return roundMoney(baseAmount * rate * periodsLate);
};
