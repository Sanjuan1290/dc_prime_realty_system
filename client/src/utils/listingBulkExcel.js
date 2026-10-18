import * as XLSX from 'xlsx-js-style'

export const LISTING_EXPORT_STATUS_OPTIONS = [
  { value: 'available', label: 'Available Only' }, { value: 'all', label: 'All Statuses' },
  { value: 'hold', label: 'Hold' }, { value: 'sold', label: 'Sold / Active' },
  { value: 'fully_paid', label: 'Fully Paid' }, { value: 'pending_for_cancellation', label: 'Pending Cancellation' },
  { value: 'cancelled', label: 'Cancelled' },
]
export const FIELD_HEADERS = {
  unitCode: 'Unit ID', oldUnitIds: 'Old Unit IDs', cadastralLots: 'Cadastral Lots (comma-separated)',
  lotType: 'Lot Type', lotAreaSqm: 'Lot Area SQM',
  installmentPricePerSqm: 'Installment Price / SQM', cashPricePerSqm: 'Cash Price / SQM',
  reservationFee: 'Reservation Fee', legalMiscRate: 'Legal / Misc Rate (%)',
  annualInterestRate: 'Annual Interest Rate (%)',
}
export const FIELDS = Object.keys(FIELD_HEADERS)
export const PROTECTED_IDENTITY_FIELDS = ['unitCode', 'oldUnitIds', 'cadastralLots', 'lotType']
export const isProtectedListingRow = (item) => !['available', 'hold'].includes(String(item.rawStatus || '').toLowerCase())
const formatValue = (field, value) => field === 'cadastralLots' ? (Array.isArray(value) ? value.join(', ') : value || '') : value === 'oldUnitIds' ? (value === '-' || value === '—' ? '' : value || '') : value
const validHeaders = (row) => ['Listing ID', 'Project ID', 'Status', 'Contract Protection', ...Object.values(FIELD_HEADERS)].every((name) => Object.prototype.hasOwnProperty.call(row, name))
export const exportListingWorkbook = ({ listings, project, status, editable }) => {
  const rows = listings.map((item) => ({
    'Listing ID': Number(item.id ?? item.lot_project_listing_id),
    'Project ID': Number(project.id ?? project.lot_project_id),
    'Status': item.status,
    'Contract Protection': isProtectedListingRow(item) ? 'Protected — identity corrections only' : 'Editable inventory',
    ...Object.fromEntries(FIELDS.map((field) => [FIELD_HEADERS[field], formatValue(field, item[field] ?? (field === 'lotAreaSqm' ? item.area : field === 'legalMiscRate' ? item.lmfRate : item[field]) )])),
    ...(editable ? {} : {
      'Installment TCP': item.installmentTcp ?? item.tcp,
      'Cash TCP': item.cashTcp, 'Storage Code': item.storageCode,
    }),
  }))
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows, { header: rows.length ? undefined : ['Listing ID', 'Project ID', 'Status', 'Contract Protection', ...Object.values(FIELD_HEADERS)] })
  sheet['!cols'] = Object.keys(rows[0] || { 'Listing ID': '', 'Project ID': '', 'Status': '', 'Contract Protection': '', ...Object.fromEntries(FIELDS.map(x => [FIELD_HEADERS[x], ''])) }).map((key) => ({ wch: Math.min(42, Math.max(15, key.length + 3)) }))
  if (rows.length) {
    Object.keys(rows[0]).forEach((_, index) => {
      const address = XLSX.utils.encode_cell({ r: 0, c: index })
      sheet[address].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D4ED8' } } }
    })
  }
  if (editable) {
    // Keep the worksheet fully editable. xlsx-js-style does not reliably persist
    // unlocked-cell styles, so Excel sheet protection can accidentally lock EVERY
    // cell. Cell colors are guidance only; the server rejects protected changes.
    const headers = Object.keys(rows[0] || {});
    rows.forEach((item, rowIndex) => {
      const protectedRow = String(item['Contract Protection'] || '').startsWith('Protected');
      headers.forEach((header, columnIndex) => {
        const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
        const cell = sheet[address];
        if (!cell) return;
        const field = FIELDS.find((key) => FIELD_HEADERS[key] === header);
        const allowed = Boolean(field) && (!protectedRow || PROTECTED_IDENTITY_FIELDS.includes(field));
        cell.s = {
          ...(cell.s || {}),
          ...(protectedRow && !allowed ? { fill: { fgColor: { rgb: 'E5E7EB' } }, font: { color: { rgb: '6B7280' } } } : {}),
          ...(allowed ? { fill: { fgColor: { rgb: 'EFF6FF' } } } : {}),
        };
      });
    });
    // Do NOT set sheet['!protect']: it would lock valid Available/Hold edits.
  }
  sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1:A1' }
  XLSX.utils.book_append_sheet(wb, sheet, 'Listings')
  if (editable) {
    // Immutable snapshot for detecting stale workbook uploads. The server still
    // independently checks every identity, status and original value.
    const baselineSheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ ...row })))
    XLSX.utils.book_append_sheet(wb, baselineSheet, 'Original Values')
    baselineSheet['!cols'] = sheet['!cols']
    wb.Workbook = wb.Workbook || { Sheets: [] }
    wb.Workbook.Sheets = [{ Hidden: 0 }, { Hidden: 1 }]
  }
  if (editable) {
    const help = XLSX.utils.aoa_to_sheet([
      ['Bulk Edit Listings — Instructions'],
      ['The Listings worksheet is editable. BLUE cells are permitted changes; GREY cells are contract-protected reference values.'],
      ['Edit only the existing listing values on the Listings tab. Do not change Listing ID, Project ID, or Status.'],
      ['Unit ID is matched by permanent Listing ID. Previous Unit ID is automatically appended to Old Unit IDs.'],
      ['Old Unit IDs and Cadastral Lots are comma-separated. Cadastral lot numbers must exist in the selected project.'],
      ['Available/Hold: regular listing and price updates are allowed.'],
      ['Sold/Active, Fully Paid, Pending Cancellation and Cancelled: Unit ID, Old Unit IDs, Cadastral Lots and Lot Type may be corrected with Operations Head approval.'],
      ['Do not change grey cells for contracted units: prices, reservation fee, LMF, interest rate and lot area must stay unchanged. The server checks these fields even if you type in them.'],
      ['Changes to a protected unit need Operations Head approval before ANY rows in the batch are saved.'],
      ['If validation finds a contract-field change, the ENTIRE batch is rejected. Restore the original value and validate again.'],
      ['A completed workbook is not saved until server validation and final confirmation are completed.'],
    ])
    help['!cols'] = [{ wch: 115 }]
    XLSX.utils.book_append_sheet(wb, help, 'Instructions')
    wb.Workbook.Sheets.push({ Hidden: 0 })
  }
  const safeName = String(project.name || 'project').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 50)
  XLSX.writeFile(wb, `${safeName}_${editable ? 'Bulk_Edit_Listings' : 'Listings'}_${status}.xlsx`, { compression: true, cellStyles: true })
}
export const parseBulkWorkbook = async (file, projectId) => {
  if (!/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error('Select an .xlsx file smaller than 10 MB.')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets.Listings
  if (!sheet || !workbook.Sheets['Original Values']) throw new Error('Workbook must have Listings and Original Values worksheets. Use an exported editable template.')
  const records = XLSX.utils.sheet_to_json(sheet, { defval: null })
  if (!records.length || records.length > 5000) throw new Error('Workbook must contain 1–5000 listing rows.')
  const originalRows = XLSX.utils.sheet_to_json(workbook.Sheets['Original Values'], { defval: null })
  const originalsById = new Map(originalRows.map((row) => [Number(row['Listing ID']), row]))
  if (originalRows.length !== records.length) throw new Error('Workbook rows must not be added or deleted.')
  const ids = new Set()
  return records.map((row, index) => {
    if (!validHeaders(row)) throw new Error(`Excel row ${index + 2}: This file is missing required listing columns. Download a new Editable Listings Template from Export Listings and copy your permitted edits into it.`)
    const listingId = Number(row['Listing ID'])
    if (!Number.isSafeInteger(listingId) || listingId <= 0 || ids.has(listingId)) throw new Error(`Excel row ${index + 2}: Duplicate or invalid Listing ID.`)
    if (Number(row['Project ID']) !== Number(projectId)) throw new Error(`Excel row ${index + 2}: This listing belongs to another project.`)
    const originalRow = originalsById.get(listingId)
    if (!originalRow || Number(originalRow['Project ID']) !== Number(projectId) || row.Status !== originalRow.Status) throw new Error(`Excel row ${index + 2}: Original listing identity or status was altered.`)
    ids.add(listingId)
    return { listingId, excelRowNumber: index + 2, expectedStatus: originalRow.Status,
      original: Object.fromEntries(FIELDS.map((field) => [field, originalRow[FIELD_HEADERS[field]]])),
      values: Object.fromEntries(FIELDS.map((field) => [field, row[FIELD_HEADERS[field]]])) }
  })
}

