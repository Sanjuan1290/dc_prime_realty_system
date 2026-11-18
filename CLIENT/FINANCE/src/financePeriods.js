const manilaCalendar = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});
const readableDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
});
const dayMs = 86_400_000;
const asDate = value => new Date(value + 'T00:00:00Z');
const isoDay = date => date.toISOString().slice(0, 10);

export const financeRangeOptions = [
  ['month', 'This Month'],
  ['previous', 'Last Month'],
  ['year', 'Year to Date'],
  ['custom', 'Custom Range'],
];

export const todayInManila = () => manilaCalendar.format(new Date());

export function financePresetRange(preset, today = todayInManila()) {
  if (preset === 'year') return { preset, from: today.slice(0, 4) + '-01-01', to: today };
  const start = asDate(today.slice(0, 7) + '-01');
  if (preset === 'previous') start.setUTCMonth(start.getUTCMonth() - 1);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { preset, from: isoDay(start), to: isoDay(end) };
}

export function financeDayCount(from, to) {
  if (!from || !to) return 0;
  return Math.max(0, (asDate(to) - asDate(from)) / dayMs + 1) || 0;
}

export const financeDate = value => readableDate.format(asDate(value));

export function financePeriodLabel(from, to) {
  return from === to ? financeDate(from) : financeDate(from) + ' – ' + financeDate(to);
}

export const financeBucketLabel = bucket => ({ day: 'Daily', month: 'Monthly', year: 'Yearly' }[bucket]);
