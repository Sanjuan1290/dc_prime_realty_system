import * as XLSX from 'xlsx-js-style'

export const LISTING_EXPORT_STATUS_OPTIONS = [
  { value: 'available', label: 'Available Only' }, { value: 'all', label: 'All Statuses' },
  { value: 'hold', label: 'Hold' }, { value: 'sold', label: 'Sold / Active' },
  { value: 'fully_paid', label: 'Fully Paid' }, { value: 'pending_for_cancellation', label: 'Pending Cancellation' },
  { value: 'cancelled', label: 'Cancelled' },
]

// The visible workbook shows one effective rate. For available/hold inventory this
// is the listing default; for contracted listings it is the current buyer SOA rate.
export const FIELD_HEADERS = {
  unitCode: 'Unit ID', oldUnitIds: 'Old Unit IDs', cadastralLots: 'Cadastral Lots',
  lotType: 'Lot Type', lotAreaSqm: 'Lot Area SQM',
  installmentPricePerSqm: 'Installment Price / SQM', cashPricePerSqm: 'Cash Price / SQM',
  reservationFee: 'Reservation Fee', legalMiscRate: 'Legal / Misc Rate (%)',
  annualInterestRate: 'Annual Interest Rate (%)',
}
export const FIELDS = Object.keys(FIELD_HEADERS)
export const NEW_FIELD_HEADERS = Object.fromEntries(FIELDS.map(field => [field, `New ${FIELD_HEADERS[field]}`]))

// Read older v2 editable templates without confusing their buyer SOA display
// column with the listing-default value used by the bulk update API.
const LEGACY_FIELD_HEADERS = {
  cadastralLots: 'Cadastral Lots (comma-separated)',
  annualInterestRate: 'Listing Default Annual Interest Rate (%)',
}
const LEGACY_NEW_FIELD_HEADERS = {
  annualInterestRate: 'New Listing Default Annual Interest Rate (%)',
}
const IDENTITY_HEADERS = ['Listing ID', 'Project ID', 'Status', 'Contract Protection']
export const INVENTORY_RATE_BASELINE_HEADER = 'Inventory Annual Interest Rate Baseline (%)'
export const PROTECTED_IDENTITY_FIELDS = ['unitCode', 'oldUnitIds', 'cadastralLots', 'lotType']
export const isProtectedListingRow = (item) => !['available', 'hold'].includes(String(item.rawStatus || '').toLowerCase())

const formatValue = (field, value) => field === 'cadastralLots'
  ? (Array.isArray(value) ? value.join(', ') : value || '')
  : value === 'oldUnitIds'
    ? (value === '-' || value === '—' ? '' : value || '')
    : value
const has = (row, header) => Object.prototype.hasOwnProperty.call(row, header)
const fieldHeader = (row, field) => {
  if (has(row, LEGACY_FIELD_HEADERS[field])) return LEGACY_FIELD_HEADERS[field]
  if (has(row, FIELD_HEADERS[field])) return FIELD_HEADERS[field]
  return LEGACY_FIELD_HEADERS[field] || FIELD_HEADERS[field]
}
const newFieldHeader = (row, field, templateVersion) => {
  if (templateVersion >= 3) return NEW_FIELD_HEADERS[field]
  if (has(row, LEGACY_NEW_FIELD_HEADERS[field])) return LEGACY_NEW_FIELD_HEADERS[field]
  return NEW_FIELD_HEADERS[field]
}
const validHeaders = (row) => IDENTITY_HEADERS.every(name => has(row, name))
  && FIELDS.every(field => has(row, fieldHeader(row, field)))
const referenceValue = value => String(value ?? '').trim()

export const createListingWorkbook = ({ listings, project, editable }) => {
  const visibleReferenceHeaders = [...IDENTITY_HEADERS, ...Object.values(FIELD_HEADERS)]
  const headers = [
    ...IDENTITY_HEADERS,
    ...FIELDS.flatMap(field => editable ? [FIELD_HEADERS[field], NEW_FIELD_HEADERS[field]] : [FIELD_HEADERS[field]]),
    ...(!editable ? ['Installment TCP', 'Cash TCP', 'Storage Code'] : []),
  ]
  const rows = listings.map((item) => ({
    'Listing ID': Number(item.id ?? item.lot_project_listing_id),
    'Project ID': Number(project.id ?? project.lot_project_id),
    'Status': item.status,
    'Contract Protection': isProtectedListingRow(item) ? 'Protected — identity corrections only' : 'Editable inventory',
    ...Object.fromEntries(FIELDS.map((field) => [
      FIELD_HEADERS[field],
      field === 'annualInterestRate'
        ? Number(item.soaAnnualInterestRate ?? item.annualInterestRate ?? 0)
        : formatValue(field, item[field] ?? (field === 'lotAreaSqm' ? item.area : field === 'legalMiscRate' ? item.lmfRate : item[field])),
    ])),
    ...(editable ? Object.fromEntries(Object.values(NEW_FIELD_HEADERS).map(header => [header, ''])) : {}),
    ...(editable ? {} : {
      'Installment TCP': item.installmentTcp ?? item.tcp,
      'Cash TCP': item.cashTcp,
      'Storage Code': item.storageCode,
    }),
  }))

  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers })
  sheet['!cols'] = headers.map(key => ({ wch: Math.min(44, Math.max(17, key.length + 2)) }))
  headers.forEach((header, index) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: index })
    sheet[address].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: Object.values(NEW_FIELD_HEADERS).includes(header) ? '047857' : '1D4ED8' } },
      alignment: { wrapText: true, vertical: 'center' },
    }
  })
  sheet['!rows'] = [{ hpt: 36 }]

  if (editable) {
    // Cell colors are guidance only; the server independently rejects protected edits.
    rows.forEach((item, rowIndex) => {
      const protectedRow = String(item['Contract Protection'] || '').startsWith('Protected')
      headers.forEach((header, columnIndex) => {
        const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })
        const cell = sheet[address]
        if (!cell) return
        const field = FIELDS.find(key => NEW_FIELD_HEADERS[key] === header)
        const allowed = Boolean(field) && (!protectedRow || PROTECTED_IDENTITY_FIELDS.includes(field))
        cell.s = {
          ...(cell.s || {}),
          ...(!allowed ? { fill: { fgColor: { rgb: 'E5E7EB' } }, font: { color: { rgb: '6B7280' } } } : {}),
          ...(allowed ? { fill: { fgColor: { rgb: 'EFF6FF' } } } : {}),
        }
      })
    })
    // Do NOT set sheet['!protect']: it would lock valid Available/Hold edits.
  }

  sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1:A1' }
  XLSX.utils.book_append_sheet(wb, sheet, 'Listings')

  if (editable) {
    // The hidden baseline preserves the effective rate shown to users AND the
    // actual inventory default used by the backend. This prevents a buyer's SOA
    // rate from being mistaken for a listing-default edit or stale-data conflict.
    const baselineRows = rows.map((row, index) => ({
      ...Object.fromEntries(visibleReferenceHeaders.map(header => [header, row[header]])),
      [INVENTORY_RATE_BASELINE_HEADER]: Number(listings[index]?.annualInterestRate ?? 0),
    }))
    const baselineHeaders = [...visibleReferenceHeaders, INVENTORY_RATE_BASELINE_HEADER]
    const baselineSheet = XLSX.utils.json_to_sheet(baselineRows, { header: baselineHeaders })
    XLSX.utils.book_append_sheet(wb, baselineSheet, 'Original Values')
    wb.Workbook = wb.Workbook || { Sheets: [] }
    wb.Workbook.Sheets = [{ Hidden: 0 }, { Hidden: 1 }]
    wb.Custprops = { ListingBulkTemplateVersion: 3 }
  }

  if (editable) {
    const help = XLSX.utils.aoa_to_sheet([
      ['Bulk Edit Listings — Instructions'],
      ['On Listings, each current value has a matching New value column. Enter changes only in BLUE cells under New headers.'],
      ['GREY cells are reference values or contract-protected fields. Do not change current values, Listing ID, Project ID, Status, or Original Values.'],
      ['Leave a New cell blank to keep the current value. A numeric 0 is an intentional new value.'],
      ['Unit ID is matched by permanent Listing ID. Previous Unit ID is automatically appended to Old Unit IDs.'],
      ['Old Unit IDs and Cadastral Lots are comma-separated. Cadastral lot numbers must exist in the selected project.'],
      ['To clear Cadastral Lots, enter - in New Cadastral Lots. Previous Unit IDs cannot be removed from history.'],
      ['Annual Interest Rate (%) shows the effective rate: the buyer SOA rate for a contracted unit, otherwise the listing default rate.'],
      ['New Annual Interest Rate (%) changes only the listing default for Available/Hold inventory. It never changes an existing buyer SOA rate.'],
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
  return wb
}

export const exportListingWorkbook = ({ listings, project, status, editable }) => {
  const wb = createListingWorkbook({ listings, project, editable })
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
  const originalsById = new Map(originalRows.map(row => [Number(row['Listing ID']), row]))
  if (originalRows.length !== records.length) throw new Error('Workbook rows must not be added or deleted.')
  if (originalsById.size !== originalRows.length) throw new Error('Original Values contains duplicate Listing IDs. Download a fresh template.')

  const templateVersion = Number(workbook.Custprops?.ListingBulkTemplateVersion || 0)
  const currentNewColumnCount = Object.values(NEW_FIELD_HEADERS).filter(header => has(records[0], header)).length
  const legacyNewColumnCount = templateVersion < 3
    ? FIELDS.filter(field => has(records[0], newFieldHeader(records[0], field, templateVersion))).length
    : 0
  const newColumnCount = templateVersion >= 3 ? currentNewColumnCount : Math.max(currentNewColumnCount, legacyNewColumnCount)
  const isCurrentTemplate = templateVersion >= 3
    || has(originalRows[0] || {}, INVENTORY_RATE_BASELINE_HEADER)
    || (has(records[0], NEW_FIELD_HEADERS.annualInterestRate) && !has(records[0], LEGACY_NEW_FIELD_HEADERS.annualInterestRate))
  if ((templateVersion >= 2 || isCurrentTemplate || newColumnCount > 0) && newColumnCount !== FIELDS.length) {
    throw new Error('Workbook is missing New value columns. Download a fresh Editable Listings Template.')
  }
  const pairedColumns = newColumnCount === FIELDS.length
  const ids = new Set()

  return records.map((row, index) => {
    if (!validHeaders(row)) throw new Error(`Excel row ${index + 2}: This file is missing required listing columns. Download a new Editable Listings Template from Export Listings and copy your permitted edits into it.`)
    const listingId = Number(row['Listing ID'])
    if (!Number.isSafeInteger(listingId) || listingId <= 0 || ids.has(listingId)) throw new Error(`Excel row ${index + 2}: Duplicate or invalid Listing ID.`)
    if (Number(row['Project ID']) !== Number(projectId)) throw new Error(`Excel row ${index + 2}: This listing belongs to another project.`)
    const originalRow = originalsById.get(listingId)
    if (!originalRow || !validHeaders(originalRow) || Number(originalRow['Project ID']) !== Number(projectId) || row.Status !== originalRow.Status) {
      throw new Error(`Excel row ${index + 2}: Original listing identity or status was altered.`)
    }
    if (isCurrentTemplate && !has(originalRow, INVENTORY_RATE_BASELINE_HEADER)) {
      throw new Error('The hidden interest-rate baseline is missing. Download a fresh Editable Listings Template.')
    }
    const visibleReferenceHeaders = Object.keys(originalRow).filter(header => header !== INVENTORY_RATE_BASELINE_HEADER)
    if (pairedColumns && visibleReferenceHeaders.some(header => !has(row, header) || referenceValue(row[header]) !== referenceValue(originalRow[header]))) {
      throw new Error(`Excel row ${index + 2}: A current/reference value was changed. Restore it and enter the adjustment in its New column.`)
    }

    const original = Object.fromEntries(FIELDS.map(field => {
      const header = isCurrentTemplate && field === 'annualInterestRate'
        ? INVENTORY_RATE_BASELINE_HEADER
        : fieldHeader(originalRow, field)
      return [field, originalRow[header]]
    }))
    ids.add(listingId)
    return {
      listingId,
      excelRowNumber: index + 2,
      expectedStatus: originalRow.Status,
      original,
      values: Object.fromEntries(FIELDS.map(field => {
        const valueHeader = pairedColumns
          ? newFieldHeader(row, field, templateVersion)
          : fieldHeader(row, field)
        const value = row[valueHeader]
        return [field, pairedColumns && referenceValue(value) === '' ? original[field] : value]
      })),
    }
  })
}
