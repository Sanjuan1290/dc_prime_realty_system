import { createHash, timingSafeEqual } from 'node:crypto';

const err = (message, code = 'SALARY_EVENT_INVALID', statusCode = 400) => Object.assign(new Error(message), { code, statusCode });
const isoDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00.000Z`)) && new Date(`${s}T00:00:00.000Z`).toISOString().slice(0, 10) === s;
export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};
export const payloadHash = event => createHash('sha256').update(canonical(event)).digest('hex');
export const compareSecrets = (candidate, expected) => {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || expected.length < 32) return false;
  const a = Buffer.from(candidate), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const parseSalaryEvent = (event) => {
  if (!event || Array.isArray(event) || typeof event !== 'object') throw err('Invalid event body.');
  const allowed = ['schema_version','event_id','event_type','source_system','source_payroll_id','source_event_version','cash_date','recorded_at','currency','amount','direction','reference','display_label'];
  if (Object.keys(event).some(k => !allowed.includes(k)) || Object.keys(event).length !== allowed.length) throw err('Unexpected or missing salary event fields.');
  if (event.schema_version !== '1.0' || event.event_type !== 'salary.cash_released.v1' || event.source_system !== 'hr') throw err('Unsupported event contract.');
  if (typeof event.event_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.event_id)) throw err('Invalid event identifier.');
  if (typeof event.source_payroll_id !== 'string' || !/^[1-9]\d{0,17}$/.test(event.source_payroll_id)) throw err('Invalid payroll identifier.');
  if (event.source_event_version !== 1) throw err('Unsupported payroll event revision.');
  if (!isoDay(event.cash_date)) throw err('Invalid cash date.');
  if (typeof event.recorded_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.recorded_at) || Number.isNaN(Date.parse(event.recorded_at))) throw err('Invalid UTC timestamp.');
  if (event.currency !== 'PHP' || event.direction !== 'out') throw err('Unsupported currency or cash direction.');
  if (typeof event.amount !== 'string' || !/^\d{1,12}\.\d{2}$/.test(event.amount) || !/[1-9]/.test(event.amount)) throw err('Invalid positive peso amount.');
  if (typeof event.reference !== 'string' || event.reference !== `HR-PAYROLL-${event.source_payroll_id}-RELEASE-1`) throw err('Invalid immutable salary reference.');
  if (typeof event.display_label !== 'string' || event.display_label !== `Salary payment #${event.source_payroll_id}`) throw err('Unexpected display label.');
  return Object.freeze({ ...event });
};
