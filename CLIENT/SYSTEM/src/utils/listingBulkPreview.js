// Pure table helpers shared by the Bulk Edit Listings workspace and its tests.
// Filtering and pagination affect only what the user sees; they never change
// the validated rows submitted to the API.
export const BULK_PREVIEW_PAGE_SIZES = Object.freeze([10, 25, 50, 100]);

export const BULK_PREVIEW_FIELD_LABELS = Object.freeze({
  unitCode: 'Unit ID',
  oldUnitIds: 'Old Unit IDs',
  cadastralLots: 'Cadastral Lots',
  lotType: 'Lot Type',
  lotAreaSqm: 'Lot Area (SQM)',
  installmentPricePerSqm: 'Installment Price / SQM',
  cashPricePerSqm: 'Cash Price / SQM',
  reservationFee: 'Reservation Fee',
  legalMiscRate: 'Legal / Misc Rate',
  annualInterestRate: 'Annual Interest Rate',
});

export const bulkPreviewValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
};

export const bulkPreviewFields = (item) => Object.entries(item?.changes || {}).map(([key, values]) => ({
  key,
  label: BULK_PREVIEW_FIELD_LABELS[key] || key,
  before: bulkPreviewValue(values?.before),
  after: bulkPreviewValue(values?.after),
}));

export const filterBulkPreview = (items, query) => {
  const search = String(query || '').trim().toLocaleLowerCase();
  if (!search) return items || [];
  return (items || []).filter((item) => {
    const values = [
      item?.before?.unitCode,
      item?.after?.unitCode,
      item?.status,
      ...bulkPreviewFields(item).flatMap((field) => [field.label, field.before, field.after]),
    ];
    return values.some((value) => String(value ?? '').toLocaleLowerCase().includes(search));
  });
};

export const paginateBulkPreview = (items, requestedPage = 1, requestedSize = 10) => {
  const size = BULK_PREVIEW_PAGE_SIZES.includes(Number(requestedSize)) ? Number(requestedSize) : 10;
  const total = (items || []).length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, Math.trunc(Number(requestedPage) || 1)), totalPages);
  const startIndex = (page - 1) * size;
  return {
    items: (items || []).slice(startIndex, startIndex + size),
    total,
    page,
    pageSize: size,
    totalPages,
    from: total ? startIndex + 1 : 0,
    to: Math.min(startIndex + size, total),
  };
};


