// Shared server-side workbook contract. Never trust editable spreadsheet IDs/statuses.
export const BULK_STATUS_OPTIONS = Object.freeze([
  ['available', 'Available Only'], ['all', 'All Statuses'], ['hold', 'Hold'],
  ['sold', 'Sold / Active'], ['fully_paid', 'Fully Paid'],
  ['pending_for_cancellation', 'Pending Cancellation'], ['cancelled', 'Cancelled'],
]);
export const BULK_FIELDS = Object.freeze([
  'unitCode', 'oldUnitIds', 'cadastralLots', 'lotType', 'lotAreaSqm',
  'installmentPricePerSqm', 'cashPricePerSqm', 'reservationFee',
  'legalMiscRate', 'annualInterestRate',
]);
// Contracted units keep their signed financial terms, but their identity may
// need administrative correction after cadastral changes or a re-survey.
export const PROTECTED_IDENTITY_FIELDS = Object.freeze([
  'unitCode', 'oldUnitIds', 'cadastralLots', 'lotType',
]);
export const BULK_FIELD_LABELS = Object.freeze({
  unitCode: 'Unit ID', oldUnitIds: 'Old Unit IDs', cadastralLots: 'Cadastral Lot Numbers',
  lotType: 'Lot Type', lotAreaSqm: 'Lot Area (SQM)',
  installmentPricePerSqm: 'Installment Price / SQM', cashPricePerSqm: 'Cash Price / SQM',
  reservationFee: 'Reservation Fee', legalMiscRate: 'Legal / Misc Rate',
  annualInterestRate: 'Annual Interest Rate',
});
export const isContractProtected = (status) => !['available', 'hold'].includes(String(status || '').toLowerCase());
export const getProtectedFieldErrors = (changes, status) => {
  if (!isContractProtected(status)) return [];
  return Object.keys(changes).filter((field) => !PROTECTED_IDENTITY_FIELDS.includes(field)).map((field) =>
    `${BULK_FIELD_LABELS[field] || field} cannot be changed: this unit has a sale or cancellation record, so its contract amounts are fixed. Restore the original value in Excel. For a surveyed area correction, use the separate approved re-survey process.`
  );
};
export const NUMERIC_FIELDS = Object.freeze([
  'lotAreaSqm', 'installmentPricePerSqm', 'cashPricePerSqm',
  'reservationFee', 'legalMiscRate', 'annualInterestRate',
]);
const normalizeCodes = (value) => [...new Set(String(value ?? '').split(/[,;\n]+/)
  .map((item) => item.trim().toUpperCase()).filter((item) => item && item !== '-' && item !== '—'))];
export const normalizedListing = (listing) => ({
  unitCode: String(listing.lot_project_listing_unit_id ?? listing.unitCode ?? '').trim().toUpperCase(),
  oldUnitIds: normalizeCodes(listing.lot_project_listing_old_unit_ids ?? listing.oldUnitIds).join(', '),
  cadastralLots: normalizeCodes(listing.cadastral_lots ?? listing.cadastralLots).sort().join(', '),
  lotType: String(listing.lot_project_listing_unit_type ?? listing.lotType ?? '').trim(),
  lotAreaSqm: Number(listing.lot_project_listing_area_sqm ?? listing.lotAreaSqm ?? 0),
  installmentPricePerSqm: Number(listing.lot_project_listing_installment_price_per_sqm ?? listing.installmentPricePerSqm ?? listing.lot_project_listing_price_per_sqm ?? 0),
  cashPricePerSqm: Number(listing.lot_project_listing_cash_price_per_sqm ?? listing.cashPricePerSqm ?? listing.lot_project_listing_price_per_sqm ?? 0),
  reservationFee: Number(listing.lot_project_listing_reservation_fee ?? listing.reservationFee ?? 0),
  legalMiscRate: Number(listing.lot_project_listing_lmf_rate ?? listing.legalMiscRate ?? 0),
  annualInterestRate: Number(listing.annual_interest_rate ?? listing.annualInterestRate ?? 0),
});
export const normalizeBulkInput = (raw, original = {}) => {
  const normalized = {};
  for (const field of BULK_FIELDS) {
    const value = raw?.[field];
    if (value === undefined) throw new Error(`${BULK_FIELD_LABELS[field] || field} is missing from the workbook. Download a new editable template.`);
    if (value == null && !['oldUnitIds', 'cadastralLots'].includes(field)) throw new Error(`${BULK_FIELD_LABELS[field] || field} is blank. Enter a value or restore the original.`);
    normalized[field] = NUMERIC_FIELDS.includes(field) ? Number(value) : String(value ?? '').trim();
  }
  normalized.unitCode = normalized.unitCode.toUpperCase();
  normalized.oldUnitIds = normalizeCodes(normalized.oldUnitIds).join(', ');
  normalized.cadastralLots = normalizeCodes(normalized.cadastralLots).sort().join(', ');
  if (normalized.unitCode !== original.unitCode && original.unitCode) {
    normalized.oldUnitIds = normalizeCodes(`${normalized.oldUnitIds},${original.unitCode}`).filter((id) => id !== normalized.unitCode).join(', ');
  }
  return normalized;
};
export const listingChanges = (before, after) => Object.fromEntries(
  BULK_FIELDS.filter((key) => before[key] !== after[key]).map((key) => [key, { before: before[key], after: after[key] }])
);
// Compare what the user actually edited against the workbook's Original Values.
// Unedited rows are not stale conflicts and must not overwrite newer database data.
export const prepareBulkListingRow = (before, workbookOriginal, workbookValues) => {
  const original = normalizeBulkInput(workbookOriginal, {});
  const edited = normalizeBulkInput(workbookValues, original);
  const intendedEdits = Object.keys(listingChanges(original, edited)).length > 0;
  return {
    intendedEdits,
    stale: intendedEdits && BULK_FIELDS.some((field) => original[field] !== before[field]),
    after: intendedEdits ? normalizeBulkInput(workbookValues, before) : before,
  };
};
export const validateBulkListing = (next, locationCode) => {
  const errors = [];
  if (!next.unitCode || next.unitCode.length > 50 || !next.unitCode.startsWith(`${locationCode}-`)) errors.push(`Unit ID must begin with ${locationCode}- and be 50 characters or fewer.`);
  if (!['Inner', 'Corner', 'End'].includes(next.lotType)) errors.push('Lot type must be Inner, Corner, or End.');
  for (const key of NUMERIC_FIELDS) {
    if (!Number.isFinite(next[key])) errors.push(`${BULK_FIELD_LABELS[key]} must be a valid number.`);
    else if (['lotAreaSqm', 'installmentPricePerSqm', 'cashPricePerSqm'].includes(key) && next[key] <= 0) errors.push(`${BULK_FIELD_LABELS[key]} must be greater than zero.`);
    else if (next[key] < 0 || (['annualInterestRate', 'legalMiscRate'].includes(key) && next[key] > 100)) errors.push(`${BULK_FIELD_LABELS[key]} is outside the allowed range.`);
  }
  if (next.oldUnitIds.length > 65500) errors.push('Old Unit IDs are too long.');
  if (normalizeCodes(next.oldUnitIds).includes(next.unitCode)) errors.push('Old Unit IDs cannot contain the current Unit ID.');
  return errors;
};
export const statusFilterSQL = (status) => {
  if (!BULK_STATUS_OPTIONS.some(([value]) => value === status)) throw new Error('Invalid status filter.');
  if (status === 'all') return { sql: '', params: [] };
  if (status === 'sold') return { sql: "AND l.lot_project_listing_status = 'sold' AND COALESCE(l.lot_project_listing_sold_substatus, 'active') = 'active'", params: [] };
  if (status === 'fully_paid') return { sql: "AND l.lot_project_listing_status = 'sold' AND l.lot_project_listing_sold_substatus = 'fully_paid'", params: [] };
  return { sql: 'AND l.lot_project_listing_status = ?', params: [status] };
};

