// Display-only converter for UTC-sourced TiDB DATETIME strings.
// Check the application's @@session.time_zone and NOW() against UTC_TIMESTAMP()
// before using this assumption against a production database.
const NAIVE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/
const SOURCE_TIME_ZONE = process.env.TIDB_DATETIME_SOURCE_TIME_ZONE === 'Asia/Manila' ? 'Asia/Manila' : 'UTC';
const OFFSET = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i
export const toBusinessInstant = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date || typeof value === 'number') {
    const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const naive = raw.match(NAIVE);
  let normalized = raw.replace(' ', 'T');
  if (naive) normalized = `${naive[1]}T${naive[2]}:${naive[3] || '00'}${naive[4] ? `.${naive[4]}` : ''}Z`;
  else if (OFFSET.test(raw)) normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  else return null;
  const result = new Date(normalized);
  if (naive && SOURCE_TIME_ZONE === 'Asia/Manila') result.setTime(result.getTime() - 8 * 3600_000);
  return Number.isNaN(result.getTime()) ? null : result;
};
export const displayBusinessInstant = (value, { fallback = '-', timeZoneLabel = false } = {}) => {
  const date = toBusinessInstant(value);
  if (!date) return fallback;
  const text = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(date);
  return timeZoneLabel ? `${text} PHT` : text;
};

