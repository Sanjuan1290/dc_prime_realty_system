const VALID_ACTIONS = new Set(['create','update','delete','login','logout','send','approve','reject','release','system','view','import','export','correct']);
const dateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v;
const clean = (v) => String(v ?? '').trim();

export const parseAuditReportFilters = (query = {}) => {
  const from = clean(query.from), to = clean(query.to);
  if ((from && !dateOnly(from)) || (to && !dateOnly(to)) || (from && to && from > to)) {
    throw Object.assign(new Error('Select a valid date range. The From date cannot be after the To date.'), { statusCode: 400 });
  }
  if (from && to && Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 10 * 366 * 86400000) {
    throw Object.assign(new Error('Choose a date range of 10 years or less.'), { statusCode: 400 });
  }
  const action = clean(query.action || 'all').toLowerCase();
  if (action !== 'all' && !VALID_ACTIONS.has(action)) throw Object.assign(new Error('Select a valid audit action.'), { statusCode: 400 });
  const module = clean(query.module || 'all'), search = clean(query.search);
  if (module.length > 100 || search.length > 150) throw Object.assign(new Error('Please shorten the module or search filter.'), { statusCode: 400 });
  return { from, to, action, module, search, includeArchived: query.includeArchived === 'true' || query.includeArchived === true };
};

// No fuzzy associations: only explicit saved review/case IDs are considered.
export const getExactAuditReferences = (metadata = {}) => {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  const positive = (n) => Number.isSafeInteger(Number(n)) && Number(n) > 0 ? Number(n) : null;
  return {
    reviewId: positive(meta.operationalReviewId ?? meta.operational_review_id ?? meta.reviewId ?? meta.review_id),
    caseId: positive(meta.auditCaseId ?? meta.audit_case_id),
  };
};

// Safely redact historical metadata too: earlier records may predate current
// write-time redaction, including nested keys from imported workflow events.
export const redactReportMetadata = (value, key = '', depth = 0) => {
  if (/(password|passcode|otp|one[_-]?time|token|jwt|authorization|cookie|secret|signature|private[_-]?key|pin|verification[_-]?code|reset[_-]?code)/i.test(key)) return '[REDACTED]';
  if (/(account[_-]?number|bank[_-]?account)/i.test(key)) {
    const last = String(value ?? '').replace(/\s+/g, '').slice(-4);
    return last ? `****${last}` : '****';
  }
  if (depth >= 20) return '[Nested value omitted]';
  if (Array.isArray(value)) return value.map((v) => redactReportMetadata(v, '', depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, redactReportMetadata(v, k, depth + 1)]));
  return value;
};

